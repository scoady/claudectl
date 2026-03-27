package server

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	localtools "github.com/scoady/codexctl/internal/tools"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// Session represents a single agent session backed by a Codex CLI subprocess.
//
// Lifecycle:
//
//	created -> Start(task) -> streamStdout [parsing stdout] -> IDLE
//	        -> InjectMessage -> spawnAndStream [resume] -> IDLE -> ... -> cancelled | error
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
	mu               sync.RWMutex
	Phase            SessionPhase `json:"phase"`
	Milestones       []string     `json:"milestones"`
	StartedAt        string       `json:"started_at"`
	TurnCount        int          `json:"turn_count"`
	LastTextChunk    string       `json:"last_chunk,omitempty"`
	OutputBuffer     []map[string]any
	CLISessionID     string
	activeToolStarts map[string]string

	// Subprocess
	proc      *exec.Cmd
	procDone  chan struct{} // closed when subprocess exits
	cancelled bool

	// Pending injection
	pendingInjection *string

	// Tracing
	traceCtx  context.Context
	traceSpan trace.Span

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
		SessionID:        sessionID,
		ProjectName:      projectName,
		ProjectPath:      projectPath,
		Model:            model,
		IsController:     isController,
		TaskIndex:        taskIndex,
		MCPConfigPath:    mcpConfigPath,
		Phase:            PhaseStarting,
		Milestones:       make([]string, 0),
		StartedAt:        time.Now().UTC().Format(time.RFC3339),
		OutputBuffer:     make([]map[string]any, 0),
		activeToolStarts: make(map[string]string),
	}
}

// Start spawns the initial subprocess and begins streaming in a goroutine.
func (s *Session) Start(task string) {
	s.Task = task
	go s.spawnAndStream(task, false)
}

// InjectMessage sends a follow-up message to the session.
// If idle with a CLI session ID, spawns a resume follow-up.
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
		"project_name":          s.ProjectName,
		"project_path":          s.ProjectPath,
		"task":                  s.Task,
		"status":                status,
		"phase":                 string(s.Phase),
		"model":                 s.Model,
		"started_at":            s.StartedAt,
		"turn_count":            s.TurnCount,
		"milestones":            milestones,
		"last_chunk":            s.LastTextChunk,
		"is_controller":         s.IsController,
		"task_index":            s.TaskIndex,
		"has_pending_injection": s.pendingInjection != nil,
	}

	if s.proc != nil && s.proc.Process != nil {
		result["pid"] = s.proc.Process.Pid
	}

	return result
}

// ── Subprocess management ────────────────────────────────────────────────────

func (s *Session) spawnAndStream(message string, resume bool) {
	tracer := otel.Tracer("codexctl")

	parentCtx := context.Background()
	s.mu.RLock()
	if s.traceCtx != nil {
		parentCtx = s.traceCtx
	}
	s.mu.RUnlock()

	spanName := "agent.session"
	if resume {
		spanName = "agent.resume"
	}

	taskSnippet := message
	if len(taskSnippet) > 256 {
		taskSnippet = taskSnippet[:256] + "..."
	}

	ctx, span := tracer.Start(parentCtx, spanName,
		trace.WithAttributes(
			attribute.String("session.id", s.SessionID),
			attribute.String("project.name", s.ProjectName),
			attribute.String("project.path", s.ProjectPath),
			attribute.String("model", s.Model),
			attribute.String("task", taskSnippet),
			attribute.Bool("resume", resume),
			attribute.Bool("is_controller", s.IsController),
		),
	)
	s.mu.Lock()
	s.traceCtx = ctx
	s.traceSpan = span
	s.mu.Unlock()

	span.AddEvent("agent.spawn", trace.WithAttributes(
		attribute.String("session.id", s.SessionID),
		attribute.String("project.name", s.ProjectName),
	))

	defer func() {
		s.mu.RLock()
		turns := s.TurnCount
		milestoneCount := len(s.Milestones)
		s.mu.RUnlock()
		span.SetAttributes(
			attribute.Int("turn_count", turns),
			attribute.Int("milestone_count", milestoneCount),
		)
		span.End()
	}()

	s.mu.Lock()
	s.OutputBuffer = append(s.OutputBuffer, map[string]any{
		"role":      "user",
		"type":      "text",
		"content":   message,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
	s.mu.Unlock()

	codexBin := os.Getenv("CODEX_BIN")
	if codexBin == "" {
		codexBin = "codex"
	}

	var cmd []string
	if resume {
		cmd = []string{
			codexBin,
			"exec",
			"resume",
			"--json",
			"--skip-git-repo-check",
			"--dangerously-bypass-approvals-and-sandbox",
		}
		s.mu.RLock()
		cliSID := s.CLISessionID
		s.mu.RUnlock()
		if cliSID != "" {
			cmd = append(cmd, cliSID)
		}
		cmd = append(cmd, message)
	} else {
		cmd = []string{
			codexBin,
			"exec",
			"--json",
			"--skip-git-repo-check",
			"--dangerously-bypass-approvals-and-sandbox",
		}
		if s.Model != "" {
			cmd = append(cmd, "--model", s.Model)
		}
		message = "IMPORTANT: You are an autonomous agent. Do not ask the user for clarification. " +
			"Make the best reasonable judgment and continue. If you hit a blocker, document it " +
			"and move to the next actionable step.\n\n" + message
		cmd = append(cmd, message)
	}

	s.runProcess(span, cmd)
}

func (s *Session) runProcess(span trace.Span, cmd []string) {
	cwd := s.ProjectPath
	if info, err := os.Stat(cwd); err != nil || !info.IsDir() {
		cwd = ""
	}

	proc := exec.Command(cmd[0], cmd[1:]...)
	if cwd != "" {
		proc.Dir = cwd
	}
	proc.Env = getSpawnEnv()

	stdout, err := proc.StdoutPipe()
	if err != nil {
		log.Printf("[session:%s] stdout pipe error: %v", s.SessionID[:8], err)
		span.SetAttributes(attribute.String("error.type", "stdout_pipe"))
		span.RecordError(err)
		s.failSession()
		return
	}

	stderr, err := proc.StderrPipe()
	if err != nil {
		log.Printf("[session:%s] stderr pipe error: %v", s.SessionID[:8], err)
		span.SetAttributes(attribute.String("error.type", "stderr_pipe"))
		span.RecordError(err)
		s.failSession()
		return
	}

	if err := proc.Start(); err != nil {
		log.Printf("[session:%s] spawn error: %v", s.SessionID[:8], err)
		span.SetAttributes(attribute.String("error.type", "spawn_failed"))
		span.RecordError(err)
		s.failSession()
		return
	}

	span.AddEvent("process.started", trace.WithAttributes(
		attribute.Int("pid", proc.Process.Pid),
	))

	s.mu.Lock()
	s.proc = proc
	s.procDone = make(chan struct{})
	s.mu.Unlock()

	s.setPhase(PhaseGenerating)

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

	s.streamStdout(bufio.NewScanner(stdout))

	waitDone := make(chan error, 1)
	go func() { waitDone <- proc.Wait() }()

	var waitErr error
	select {
	case waitErr = <-waitDone:
	case <-time.After(5 * time.Second):
		_ = proc.Process.Kill()
		waitErr = <-waitDone
	}

	close(s.procDone)

	s.mu.RLock()
	wasCancelled := s.cancelled
	s.mu.RUnlock()

	if wasCancelled {
		span.AddEvent("agent.cancelled")
		span.SetAttributes(attribute.String("outcome", "cancelled"))
		s.setPhase(PhaseCancelled)
		if s.OnSessionDone != nil {
			s.OnSessionDone(s.SessionID, "cancelled")
		}
		return
	}

	if waitErr != nil {
		log.Printf("[session:%s] process exit error: %v", s.SessionID[:8], waitErr)
		span.SetAttributes(attribute.String("error.type", "process_exit"))
		span.RecordError(waitErr)
		span.SetAttributes(attribute.String("outcome", "error"))
		s.failSession()
		return
	}

	s.mu.Lock()
	s.TurnCount++
	s.mu.Unlock()

	if s.OnTextDelta != nil {
		s.OnTextDelta(s.SessionID, "")
	}
	if s.OnTurnDone != nil {
		s.mu.RLock()
		tc := s.TurnCount
		s.mu.RUnlock()
		s.OnTurnDone(s.SessionID, tc)
	}

	s.mu.Lock()
	pending := s.pendingInjection
	cliSID := s.CLISessionID
	s.pendingInjection = nil
	s.mu.Unlock()

	if pending != nil && cliSID != "" {
		span.AddEvent("agent.injection_pending")
		s.spawnAndStream(*pending, true)
		return
	}

	span.AddEvent("agent.idle")
	span.SetAttributes(attribute.String("outcome", "idle"))
	s.setPhase(PhaseIdle)
	if s.OnSessionDone != nil {
		s.OnSessionDone(s.SessionID, "idle")
	}
}

func (s *Session) failSession() {
	s.setPhase(PhaseError)
	if s.OnSessionDone != nil {
		s.OnSessionDone(s.SessionID, "error")
	}
}

func (s *Session) streamStdout(scanner *bufio.Scanner) {
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024)
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
	switch getStr(event, "type") {
	case "thread.started":
		s.handleThreadStarted(event)
	case "turn.started":
		s.setPhase(PhaseThinking)
	case "item.started":
		s.handleItemStarted(event)
	case "item.completed":
		s.handleItemCompleted(event)
	case "turn.failed", "error":
		s.handleError(event)
	}
}

func (s *Session) handleThreadStarted(event map[string]any) {
	if sid := getStr(event, "thread_id"); sid != "" {
		s.mu.Lock()
		s.CLISessionID = sid
		if s.traceSpan != nil {
			s.traceSpan.SetAttributes(attribute.String("cli.session_id", sid))
			s.traceSpan.AddEvent("cli.init", trace.WithAttributes(
				attribute.String("cli.session_id", sid),
			))
		}
		s.mu.Unlock()
	}
}

func (s *Session) handleItemStarted(event map[string]any) {
	item, _ := event["item"].(map[string]any)
	if item == nil {
		return
	}

	switch getStr(item, "type") {
	case "command_execution":
		s.setPhase(PhaseToolExec)
		s.emitToolStarted(item)
	case "agent_message":
		s.setPhase(PhaseGenerating)
	}
}

func (s *Session) handleItemCompleted(event map[string]any) {
	item, _ := event["item"].(map[string]any)
	if item == nil {
		return
	}

	switch getStr(item, "type") {
	case "agent_message":
		s.handleAgentMessage(item)
	case "command_execution":
		s.handleCommandExecution(item)
	}
}

func (s *Session) handleAgentMessage(item map[string]any) {
	text := getStr(item, "text")
	if text == "" {
		return
	}

	s.setPhase(PhaseGenerating)
	s.mu.Lock()
	s.LastTextChunk = text
	s.OutputBuffer = append(s.OutputBuffer, map[string]any{
		"role":      "assistant",
		"type":      "text",
		"content":   text,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
	s.mu.Unlock()

	if s.OnTextDelta != nil {
		s.OnTextDelta(s.SessionID, text)
	}
}

func (s *Session) emitToolStarted(item map[string]any) {
	toolID := getStr(item, "id")
	toolInput := commandToolInput(item)
	startedAt := time.Now().UTC().Format(time.RFC3339)

	s.recordToolTrace("Bash", toolID, toolInput)

	s.mu.Lock()
	s.activeToolStarts[toolID] = startedAt
	s.mu.Unlock()

	if s.OnToolStart != nil {
		s.OnToolStart(s.SessionID, map[string]any{
			"session_id":  s.SessionID,
			"tool_use_id": toolID,
			"tool_name":   "Bash",
			"tool_input":  toolInput,
			"started_at":  startedAt,
		})
	}
}

func (s *Session) handleCommandExecution(item map[string]any) {
	toolID := getStr(item, "id")
	toolInput := commandToolInput(item)

	s.mu.Lock()
	startedAt := s.activeToolStarts[toolID]
	delete(s.activeToolStarts, toolID)
	s.Milestones = append(s.Milestones, formatMilestone("Bash", toolInput))
	if len(s.Milestones) > 20 {
		s.Milestones = s.Milestones[1:]
	}
	s.OutputBuffer = append(s.OutputBuffer, map[string]any{
		"role":       "assistant",
		"type":       "tool_use",
		"tool_name":  "Bash",
		"tool_id":    toolID,
		"tool_input": toolInput,
		"timestamp":  time.Now().UTC().Format(time.RFC3339),
	})
	s.mu.Unlock()

	if startedAt == "" {
		startedAt = time.Now().UTC().Format(time.RFC3339)
	}
	if s.OnToolDone != nil {
		s.OnToolDone(s.SessionID, map[string]any{
			"session_id":  s.SessionID,
			"tool_use_id": toolID,
			"tool_name":   "Bash",
			"tool_input":  toolInput,
			"started_at":  startedAt,
			"finished_at": time.Now().UTC().Format(time.RFC3339),
		})
	}
}

func commandToolInput(item map[string]any) map[string]any {
	toolInput := map[string]any{
		"command": getStr(item, "command"),
	}
	if output := getStr(item, "aggregated_output"); output != "" {
		toolInput["output"] = output
	}
	if exitCode, ok := item["exit_code"]; ok && exitCode != nil {
		toolInput["exit_code"] = exitCode
	}
	if status := getStr(item, "status"); status != "" {
		toolInput["status"] = status
	}
	return toolInput
}

func (s *Session) recordToolTrace(toolName, toolID string, toolInput map[string]any) {
	s.mu.RLock()
	tCtx := s.traceCtx
	s.mu.RUnlock()
	if tCtx == nil {
		return
	}

	tracer := otel.Tracer("codexctl")
	toolDesc := getStr(toolInput, "command")
	if len(toolDesc) > 100 {
		toolDesc = toolDesc[:100]
	}
	_, toolSpan := tracer.Start(tCtx, "tool."+toolName,
		trace.WithAttributes(
			attribute.String("tool.name", toolName),
			attribute.String("tool.id", toolID),
			attribute.String("tool.description", toolDesc),
			attribute.String("session.id", s.SessionID),
			attribute.String("project.name", s.ProjectName),
		),
	)
	toolSpan.End()
}

func (s *Session) handleError(event map[string]any) {
	errMsg := getStr(event, "message")
	if errMsg == "" {
		errMsg = getStr(event, "error")
	}
	if errMsg == "" {
		errMsg = "Unknown error"
	}
	log.Printf("[session:%s] CLI error: %s", s.SessionID[:8], errMsg)
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
		return fmt.Sprintf("%s · %s", toolName, key)
	}
	return toolName
}

// getSpawnEnv returns the parent environment for the spawned Codex CLI.
// Codex manages its own auth state under ~/.codex, so there is no token shim here.
func getSpawnEnv() []string {
	env := os.Environ()
	toolDirs := localtools.InstalledToolBinDirs()
	currentPath := os.Getenv("PATH")
	if len(toolDirs) > 0 {
		parts := append([]string(nil), toolDirs...)
		if currentPath != "" {
			parts = append(parts, currentPath)
		}
		newPath := strings.Join(parts, string(os.PathListSeparator))
		replaced := false
		for i, item := range env {
			if strings.HasPrefix(item, "PATH=") {
				env[i] = "PATH=" + newPath
				replaced = true
				break
			}
		}
		if !replaced {
			env = append(env, "PATH="+newPath)
		}
	}
	configured := localtools.ConfiguredEnvVars()
	for key, value := range configured {
		if key == "" || value == "" {
			continue
		}
		replaced := false
		for i, item := range env {
			if strings.HasPrefix(item, key+"=") {
				env[i] = key + "=" + value
				replaced = true
				break
			}
		}
		if !replaced {
			env = append(env, key+"="+value)
		}
	}
	return env
}

// getStr safely extracts a string value from a map.
func getStr(m map[string]any, key string) string {
	v, _ := m[key].(string)
	return v
}
