package server

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// Session represents a single agent session backed by a claude CLI subprocess.
//
// Lifecycle:
//
//	created -> Start(task) -> streamStdout [parsing stdout] -> IDLE
//	        -> InjectMessage -> spawnAndStream [--resume] -> IDLE -> ... -> cancelled | error
type Session struct {
	// Identity
	SessionID   string `json:"session_id"`
	ProjectName string `json:"project_name"`
	ProjectPath string `json:"project_path"`
	Model       string `json:"model"`
	Task        string `json:"task"`

	// Flags
	IsController  bool `json:"is_controller"`
	TaskIndex     *int `json:"task_index,omitempty"`
	MCPConfigPath string

	// Runtime state (guarded by mu)
	mu             sync.RWMutex
	Phase          SessionPhase `json:"phase"`
	Milestones     []string     `json:"milestones"`
	StartedAt      string       `json:"started_at"`
	TurnCount      int          `json:"turn_count"`
	LastTextChunk  string       `json:"last_chunk,omitempty"`
	OutputBuffer   []map[string]any
	CLISessionID   string

	// Subprocess
	proc      *exec.Cmd
	procDone  chan struct{} // closed when subprocess exits
	cancelled bool

	// Pending injection
	pendingInjection *string

	// Partial message streaming state
	currentToolName string
	currentToolID   string
	toolInputBuf    strings.Builder

	// Callbacks — set by Broker after construction
	OnPhaseChange func(sessionID string, phase SessionPhase)
	OnTextDelta   func(sessionID string, chunk string)
	OnToolStart   func(sessionID string, toolEvent map[string]any)
	OnToolDone    func(sessionID string, toolEvent map[string]any)
	OnTurnDone    func(sessionID string, turnCount int)
	OnSessionDone func(sessionID string, reason string)
}

// NewSession creates a new Session with defaults.
func NewSession(sessionID, projectName, projectPath, model string, isController bool, taskIndex *int, mcpConfigPath string) *Session {
	return &Session{
		SessionID:     sessionID,
		ProjectName:   projectName,
		ProjectPath:   projectPath,
		Model:         model,
		IsController:  isController,
		TaskIndex:     taskIndex,
		MCPConfigPath: mcpConfigPath,
		Phase:         PhaseStarting,
		Milestones:    make([]string, 0),
		StartedAt:     time.Now().UTC().Format(time.RFC3339),
		OutputBuffer:  make([]map[string]any, 0),
	}
}

// Start spawns the initial subprocess and begins streaming in a goroutine.
func (s *Session) Start(task string) {
	s.Task = task
	go s.spawnAndStream(task, false)
}

// InjectMessage sends a follow-up message to the session.
// If idle with a CLI session ID, spawns a --resume follow-up.
// Otherwise, queues the message for later.
func (s *Session) InjectMessage(msg string) {
	s.mu.Lock()
	phase := s.Phase
	cliSID := s.CLISessionID
	s.mu.Unlock()

	if phase == PhaseIdle && cliSID != "" {
		go s.spawnAndStream(msg, true)
	} else {
		s.mu.Lock()
		s.pendingInjection = &msg
		s.mu.Unlock()
	}
}

// Cancel kills the subprocess.
func (s *Session) Cancel() {
	s.mu.Lock()
	s.cancelled = true
	proc := s.proc
	s.mu.Unlock()

	if proc != nil && proc.Process != nil {
		_ = proc.Process.Kill()
	}
}

// ToDict serializes the session to a JSON-compatible map.
func (s *Session) ToDict() map[string]any {
	s.mu.RLock()
	defer s.mu.RUnlock()

	status := agentStatusFromPhase(s.Phase)

	milestones := s.Milestones
	if len(milestones) > 10 {
		milestones = milestones[len(milestones)-10:]
	}

	result := map[string]any{
		"session_id":            s.SessionID,
		"project_name":         s.ProjectName,
		"project_path":         s.ProjectPath,
		"task":                 s.Task,
		"status":               status,
		"phase":                string(s.Phase),
		"model":                s.Model,
		"started_at":           s.StartedAt,
		"turn_count":           s.TurnCount,
		"milestones":           milestones,
		"last_chunk":           s.LastTextChunk,
		"is_controller":        s.IsController,
		"task_index":           s.TaskIndex,
		"has_pending_injection": s.pendingInjection != nil,
	}

	if s.proc != nil && s.proc.Process != nil {
		result["pid"] = s.proc.Process.Pid
	}

	return result
}

// ── Subprocess management ────────────────────────────────────────────────────

func (s *Session) spawnAndStream(message string, resume bool) {
	claudeBin := os.Getenv("CLAUDE_BIN")
	if claudeBin == "" {
		claudeBin = "claude"
	}

	cmd := []string{
		claudeBin,
		"--print", "--output-format", "stream-json",
		"--verbose", "--include-partial-messages",
		"--permission-mode", "acceptEdits",
	}

	if resume {
		s.mu.RLock()
		cliSID := s.CLISessionID
		s.mu.RUnlock()
		if cliSID != "" {
			cmd = append(cmd, "--resume", cliSID)
		}
	} else {
		cmd = append(cmd, "--model", s.Model)
		// Add MCP config for initial spawn (resume inherits from session)
		if s.MCPConfigPath != "" {
			if _, err := os.Stat(s.MCPConfigPath); err == nil {
				cmd = append(cmd, "--mcp-config", s.MCPConfigPath)
			}
		}
	}

	// Prepend autonomy directive on initial spawn (not resume follow-ups)
	if !resume {
		message = "IMPORTANT: You are an autonomous agent. NEVER use AskUserQuestion or ask " +
			"the user for input/clarification. Make your best judgment and proceed. " +
			"If you hit a blocker, document it and move on to the next actionable step.\n\n" +
			message
	}

	// Use -- separator to prevent the prompt being parsed as a flag/config arg
	cmd = append(cmd, "--", message)

	// Determine working directory
	cwd := s.ProjectPath
	if info, err := os.Stat(cwd); err != nil || !info.IsDir() {
		cwd = ""
	}

	env := getSpawnEnv()

	proc := exec.Command(cmd[0], cmd[1:]...)
	if cwd != "" {
		proc.Dir = cwd
	}
	proc.Env = env

	stdout, err := proc.StdoutPipe()
	if err != nil {
		log.Printf("[session:%s] stdout pipe error: %v", s.SessionID[:8], err)
		s.setPhase(PhaseError)
		if s.OnSessionDone != nil {
			s.OnSessionDone(s.SessionID, "error")
		}
		return
	}

	stderr, err := proc.StderrPipe()
	if err != nil {
		log.Printf("[session:%s] stderr pipe error: %v", s.SessionID[:8], err)
		s.setPhase(PhaseError)
		if s.OnSessionDone != nil {
			s.OnSessionDone(s.SessionID, "error")
		}
		return
	}

	if err := proc.Start(); err != nil {
		log.Printf("[session:%s] spawn error: %v", s.SessionID[:8], err)
		s.setPhase(PhaseError)
		if s.OnSessionDone != nil {
			s.OnSessionDone(s.SessionID, "error")
		}
		return
	}

	s.mu.Lock()
	s.proc = proc
	s.procDone = make(chan struct{})
	s.mu.Unlock()

	s.setPhase(PhaseGenerating)

	// Drain stderr in background
	go func() {
		scanner := bufio.NewScanner(stderr)
		scanner.Buffer(make([]byte, 1024*1024), 1024*1024)
		for scanner.Scan() {
			text := scanner.Text()
			if text != "" {
				log.Printf("[session:%s] stderr: %s", s.SessionID[:8], text)
			}
		}
	}()

	// Stream stdout
	s.streamStdout(bufio.NewScanner(stdout))

	// Wait for process to finish
	waitDone := make(chan error, 1)
	go func() { waitDone <- proc.Wait() }()

	select {
	case <-waitDone:
	case <-time.After(5 * time.Second):
		_ = proc.Process.Kill()
	}

	close(s.procDone)

	s.mu.RLock()
	wasCancelled := s.cancelled
	s.mu.RUnlock()

	if wasCancelled {
		s.setPhase(PhaseCancelled)
		if s.OnSessionDone != nil {
			s.OnSessionDone(s.SessionID, "cancelled")
		}
		return
	}

	s.mu.Lock()
	s.TurnCount++
	s.mu.Unlock()

	// Broadcast turn-done + stream-done markers
	if s.OnTextDelta != nil {
		s.OnTextDelta(s.SessionID, "") // sentinel
	}
	if s.OnTurnDone != nil {
		s.mu.RLock()
		tc := s.TurnCount
		s.mu.RUnlock()
		s.OnTurnDone(s.SessionID, tc)
	}

	// Check for pending injection
	s.mu.Lock()
	pending := s.pendingInjection
	cliSID := s.CLISessionID
	s.pendingInjection = nil
	s.mu.Unlock()

	if pending != nil && cliSID != "" {
		s.spawnAndStream(*pending, true)
	} else {
		s.setPhase(PhaseIdle)
		if s.OnSessionDone != nil {
			s.OnSessionDone(s.SessionID, "idle")
		}
	}
}

func (s *Session) streamStdout(scanner *bufio.Scanner) {
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024) // 1MB buffer for large events
	for scanner.Scan() {
		raw := strings.TrimSpace(scanner.Text())
		if raw == "" {
			continue
		}

		var event map[string]any
		if err := json.Unmarshal([]byte(raw), &event); err != nil {
			continue
		}

		s.handleStreamEvent(event)
	}
}

// ── Stream event handling ────────────────────────────────────────────────────

func (s *Session) handleStreamEvent(event map[string]any) {
	// Unwrap stream_event wrapper — CLI emits {"type":"stream_event","event":{...}}
	if getStr(event, "type") == "stream_event" {
		if inner, ok := event["event"].(map[string]any); ok {
			event = inner
		}
	}

	etype := getStr(event, "type")

	switch etype {
	case "system":
		s.handleSystem(event)
	case "content_block_start":
		s.handleContentBlockStart(event)
	case "content_block_delta":
		s.handleContentBlockDelta(event)
	case "content_block_stop":
		s.handleContentBlockStop(event)
	case "message_start":
		s.handleMessageStart(event)
	case "message_stop":
		// no-op, process exit handles lifecycle
	case "assistant":
		s.handleAssistant(event)
	case "user":
		// user events contain tool results — not needed for core broker
	case "result":
		s.handleResult(event)
	}
}

func (s *Session) handleSystem(event map[string]any) {
	if getStr(event, "subtype") == "init" {
		if sid := getStr(event, "session_id"); sid != "" {
			s.mu.Lock()
			s.CLISessionID = sid
			s.mu.Unlock()
		}
	}
}

func (s *Session) handleContentBlockStart(event map[string]any) {
	block, _ := event["content_block"].(map[string]any)
	if block == nil {
		return
	}

	btype := getStr(block, "type")
	switch btype {
	case "tool_use":
		s.mu.Lock()
		s.currentToolName = getStr(block, "name")
		if s.currentToolName == "" {
			s.currentToolName = "tool"
		}
		s.currentToolID = getStr(block, "id")
		s.toolInputBuf.Reset()
		s.mu.Unlock()
		s.setPhase(PhaseToolInput)
	case "thinking":
		s.setPhase(PhaseThinking)
	case "text":
		s.setPhase(PhaseGenerating)
	}
}

func (s *Session) handleContentBlockDelta(event map[string]any) {
	delta, _ := event["delta"].(map[string]any)
	if delta == nil {
		return
	}

	dtype := getStr(delta, "type")
	switch dtype {
	case "text_delta":
		chunk := getStr(delta, "text")
		if chunk != "" {
			s.mu.Lock()
			s.LastTextChunk = chunk
			s.mu.Unlock()
			if s.OnTextDelta != nil {
				s.OnTextDelta(s.SessionID, chunk)
			}
		}
	case "input_json_delta":
		s.mu.Lock()
		s.toolInputBuf.WriteString(getStr(delta, "partial_json"))
		s.mu.Unlock()
	case "thinking_delta":
		// keep phase as thinking — no text to emit
	}
}

func (s *Session) handleContentBlockStop(event map[string]any) {
	s.mu.Lock()
	toolName := s.currentToolName
	toolID := s.currentToolID
	inputJSON := s.toolInputBuf.String()
	s.currentToolName = ""
	s.currentToolID = ""
	s.toolInputBuf.Reset()
	s.mu.Unlock()

	if toolName == "" {
		return
	}

	// Parse accumulated input JSON
	var toolInput map[string]any
	if inputJSON != "" {
		if err := json.Unmarshal([]byte(inputJSON), &toolInput); err != nil {
			toolInput = map[string]any{}
		}
	} else {
		toolInput = map[string]any{}
	}

	s.setPhase(PhaseToolExec)

	milestone := formatMilestone(toolName, toolInput)

	s.mu.Lock()
	s.Milestones = append(s.Milestones, milestone)
	if len(s.Milestones) > 20 {
		s.Milestones = s.Milestones[1:]
	}
	s.mu.Unlock()

	now := time.Now().UTC().Format(time.RFC3339)
	toolEvent := map[string]any{
		"session_id":  s.SessionID,
		"tool_use_id": toolID,
		"tool_name":   toolName,
		"tool_input":  toolInput,
		"started_at":  now,
	}

	if s.OnToolStart != nil {
		s.OnToolStart(s.SessionID, toolEvent)
	}
	if s.OnToolDone != nil {
		toolEvent["finished_at"] = time.Now().UTC().Format(time.RFC3339)
		s.OnToolDone(s.SessionID, toolEvent)
	}

	s.mu.Lock()
	s.OutputBuffer = append(s.OutputBuffer, map[string]any{
		"role":       "assistant",
		"type":       "tool_use",
		"tool_name":  toolName,
		"tool_id":    toolID,
		"tool_input": toolInput,
	})
	s.mu.Unlock()
}

func (s *Session) handleMessageStart(event map[string]any) {
	msg, _ := event["message"].(map[string]any)
	if msg == nil {
		return
	}
	model := getStr(msg, "model")
	if model != "" && model != "<synthetic>" {
		s.mu.Lock()
		s.Model = model
		s.mu.Unlock()
	}
}

func (s *Session) handleAssistant(event map[string]any) {
	msg, _ := event["message"].(map[string]any)
	if msg == nil {
		return
	}

	model := getStr(msg, "model")
	if model != "" && model != "<synthetic>" {
		s.mu.Lock()
		s.Model = model
		s.mu.Unlock()
	}

	content, _ := msg["content"].([]any)
	for _, item := range content {
		block, ok := item.(map[string]any)
		if !ok {
			continue
		}
		if getStr(block, "type") == "text" {
			text := getStr(block, "text")
			if text != "" {
				s.mu.Lock()
				s.OutputBuffer = append(s.OutputBuffer, map[string]any{
					"role":    "assistant",
					"type":    "text",
					"content": text,
				})
				s.mu.Unlock()
			}
		}
	}
}

func (s *Session) handleResult(event map[string]any) {
	if getBool(event, "is_error") {
		errMsg := getStr(event, "result")
		if errMsg == "" {
			errMsg = "Unknown error"
		}
		log.Printf("[session:%s] CLI error: %s", s.SessionID[:8], errMsg)
	}
}

// ── Helpers ──────────────────────────────────────────────────────────────────

func (s *Session) setPhase(phase SessionPhase) {
	s.mu.Lock()
	s.Phase = phase
	s.mu.Unlock()
	if s.OnPhaseChange != nil {
		s.OnPhaseChange(s.SessionID, phase)
	}
}

func agentStatusFromPhase(phase SessionPhase) string {
	switch phase {
	case PhaseStarting, PhaseThinking, PhaseGenerating, PhaseToolInput, PhaseToolExec, PhaseInjecting:
		return "working"
	case PhaseIdle:
		return "idle"
	case PhaseCancelled, PhaseError:
		return "disconnected"
	default:
		return "idle"
	}
}

func formatMilestone(toolName string, toolInput map[string]any) string {
	var key string
	switch toolName {
	case "Read", "Write", "Edit":
		if fp := getStr(toolInput, "file_path"); fp != "" {
			key = filepath.Base(fp)
		}
	case "Bash":
		cmd := getStr(toolInput, "command")
		if len(cmd) > 60 {
			cmd = cmd[:60]
		}
		if idx := strings.IndexByte(cmd, '\n'); idx >= 0 {
			cmd = cmd[:idx]
		}
		key = cmd
	case "Grep":
		key = getStr(toolInput, "pattern")
		if len(key) > 40 {
			key = key[:40]
		}
	case "Glob":
		key = getStr(toolInput, "pattern")
		if len(key) > 40 {
			key = key[:40]
		}
	case "WebFetch":
		url := getStr(toolInput, "url")
		if url != "" {
			parts := strings.Split(url, "/")
			key = parts[len(parts)-1]
			if len(key) > 40 {
				key = key[:40]
			}
		}
	case "WebSearch":
		key = getStr(toolInput, "query")
		if len(key) > 40 {
			key = key[:40]
		}
	case "Agent":
		key = getStr(toolInput, "description")
		if len(key) > 40 {
			key = key[:40]
		}
	}

	if key != "" {
		return fmt.Sprintf("%s \u00b7 %s", toolName, key)
	}
	return toolName
}

// getSpawnEnv builds the environment for the subprocess, reading a fresh
// OAuth token from CLAUDE_CODE_OAUTH_TOKEN env var or from a file at
// OAUTH_TOKEN_FILE env var path.
func getSpawnEnv() []string {
	env := os.Environ()

	// Check if CLAUDE_CODE_OAUTH_TOKEN is already set
	for _, e := range env {
		if strings.HasPrefix(e, "CLAUDE_CODE_OAUTH_TOKEN=") {
			return env
		}
	}

	// Try reading from file
	tokenFile := os.Getenv("OAUTH_TOKEN_FILE")
	if tokenFile == "" {
		tokenFile = "/run/claude-oauth-token"
	}

	data, err := os.ReadFile(tokenFile)
	if err != nil {
		return env
	}

	token := strings.TrimSpace(string(data))
	if token != "" {
		env = append(env, "CLAUDE_CODE_OAUTH_TOKEN="+token)
	}
	return env
}

// getStr safely extracts a string value from a map.
func getStr(m map[string]any, key string) string {
	v, _ := m[key].(string)
	return v
}

// getBool safely extracts a bool value from a map.
func getBool(m map[string]any, key string) bool {
	v, _ := m[key].(bool)
	return v
}
