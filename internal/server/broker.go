package server

import (
	"context"
	"crypto/rand"
	"fmt"
	"log"
	"sync"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

const defaultModel = "claude-opus-4-6"

// Broker manages all agent sessions and wires their callbacks to Hub broadcasts.
type Broker struct {
	mu       sync.RWMutex
	sessions map[string]*Session
	hub      *Hub
	model    string

	// OnSessionDone is called when a session completes — wired by Operator.
	OnSessionDone func(sessionID, reason string)

	// OnSessionSpawn is called when a new session is spawned — wired by Server for metrics.
	OnSessionSpawn func(sessionID string)

	// OnToolCall is called when a tool invocation completes — wired by Server for metrics.
	OnToolCall func(sessionID, toolName string)

	// OnTurnComplete is called when a turn finishes — wired by Server for metrics.
	OnTurnComplete func(sessionID string, turnCount int)
}

// NewBroker creates a new Broker wired to the given Hub.
func NewBroker(hub *Hub, model string) *Broker {
	if model == "" {
		model = defaultModel
	}
	return &Broker{
		sessions: make(map[string]*Session),
		hub:      hub,
		model:    model,
	}
}

// CreateSession spawns a new standalone agent session (handler-compatible signature).
// Returns the session ID and nil error on success.
func (b *Broker) CreateSession(projectName, projectPath, task, model string) (string, error) {
	session := b.SpawnSession(projectName, projectPath, task, model, false, nil, "")
	return session.SessionID, nil
}

// SpawnSession spawns a new agent session with full options and broadcasts agent_spawned.
func (b *Broker) SpawnSession(
	projectName, projectPath, task string,
	model string,
	isController bool,
	taskIndex *int,
	mcpConfigPath string,
) *Session {
	if model == "" {
		model = b.model
	}

	sessionID := newUUID()

	// Create a dispatch span that becomes the parent of agent.session spans
	tracer := otel.Tracer("claudectl")
	taskSnippet := task
	if len(taskSnippet) > 256 {
		taskSnippet = taskSnippet[:256] + "..."
	}
	dispatchCtx, dispatchSpan := tracer.Start(context.Background(), "dispatch",
		trace.WithAttributes(
			attribute.String("dispatch.session_id", sessionID),
			attribute.String("dispatch.project", projectName),
			attribute.String("dispatch.task", taskSnippet),
			attribute.String("dispatch.model", model),
			attribute.Bool("dispatch.is_controller", isController),
		),
	)
	// End the dispatch span immediately — it's a marker event.
	// The agent.session span will be a child via the trace context.
	dispatchSpan.End()

	session := NewSession(sessionID, projectName, projectPath, model, isController, taskIndex, mcpConfigPath)

	// Inject the dispatch trace context so agent.session is a child of dispatch
	session.mu.Lock()
	session.traceCtx = dispatchCtx
	session.mu.Unlock()

	// Wire callbacks
	session.OnPhaseChange = b.onPhaseChange
	session.OnTextDelta = b.onTextDelta
	session.OnToolStart = b.onToolStart
	session.OnToolDone = b.onToolDone
	session.OnTurnDone = b.onTurnDone
	session.OnSessionDone = b.onSessionDone

	b.mu.Lock()
	b.sessions[sessionID] = session
	b.mu.Unlock()

	// Broadcast immediately so UI shows the card
	b.hub.Broadcast("agent_spawned", map[string]any{
		"session_id":    sessionID,
		"project_name":  projectName,
		"project_path":  projectPath,
		"task":          task,
		"started_at":    session.StartedAt,
		"model":         session.Model,
		"is_controller": isController,
		"task_index":    taskIndex,
	})

	log.Printf("[broker] created session %s for project %s (controller=%v)", sessionID[:8], projectName, isController)

	// Notify metrics
	if b.OnSessionSpawn != nil {
		b.OnSessionSpawn(sessionID)
	}

	session.Start(task)
	return session
}

// InjectMessage routes a follow-up message to the given session.
func (b *Broker) InjectMessage(sessionID, message string) error {
	b.mu.RLock()
	session, ok := b.sessions[sessionID]
	b.mu.RUnlock()

	if !ok {
		return fmt.Errorf("session not found: %s", sessionID)
	}

	session.InjectMessage(message)

	session.mu.RLock()
	phase := session.Phase
	session.mu.RUnlock()

	b.hub.Broadcast("injection_ack", map[string]any{
		"session_id": sessionID,
		"phase":      string(phase),
		"queued":     phase != PhaseIdle,
	})

	return nil
}

// CancelSession kills and removes a session, broadcasting agent_done.
func (b *Broker) CancelSession(sessionID string) error {
	b.mu.Lock()
	session, ok := b.sessions[sessionID]
	if ok {
		delete(b.sessions, sessionID)
	}
	b.mu.Unlock()

	if !ok {
		return fmt.Errorf("session not found: %s", sessionID)
	}

	session.Cancel()

	b.hub.Broadcast("agent_done", map[string]any{
		"session_id":   sessionID,
		"project_name": session.ProjectName,
		"reason":       "cancelled",
	})

	log.Printf("[broker] cancelled session %s", sessionID[:8])
	return nil
}

// GetSession returns a session by ID, or nil if not found.
func (b *Broker) GetSession(sessionID string) *Session {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.sessions[sessionID]
}

// GetAllSessions returns all sessions.
func (b *Broker) GetAllSessions() []*Session {
	b.mu.RLock()
	defer b.mu.RUnlock()
	result := make([]*Session, 0, len(b.sessions))
	for _, s := range b.sessions {
		result = append(result, s)
	}
	return result
}

// GetSessionsForProject returns all sessions belonging to a project.
func (b *Broker) GetSessionsForProject(projectName string) []*Session {
	b.mu.RLock()
	defer b.mu.RUnlock()
	var result []*Session
	for _, s := range b.sessions {
		if s.ProjectName == projectName {
			result = append(result, s)
		}
	}
	return result
}

// GetControllerForProject returns the controller session for a project, if any.
func (b *Broker) GetControllerForProject(projectName string) *Session {
	b.mu.RLock()
	defer b.mu.RUnlock()
	for _, s := range b.sessions {
		if s.ProjectName == projectName && s.IsController {
			return s
		}
	}
	return nil
}

// ActiveCount returns the number of non-idle, non-terminated sessions.
func (b *Broker) ActiveCount() int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	count := 0
	for _, s := range b.sessions {
		s.mu.RLock()
		phase := s.Phase
		s.mu.RUnlock()
		if phase != PhaseIdle && phase != PhaseCancelled && phase != PhaseError {
			count++
		}
	}
	return count
}

// CountByStatus returns the count of active and idle sessions.
func (b *Broker) CountByStatus() (active, idle int) {
	b.mu.RLock()
	defer b.mu.RUnlock()
	for _, s := range b.sessions {
		s.mu.RLock()
		phase := s.Phase
		s.mu.RUnlock()
		if phase == PhaseIdle {
			idle++
		} else if phase != PhaseCancelled && phase != PhaseError {
			active++
		}
	}
	return
}

// ListSessions returns all sessions as JSON-compatible maps.
func (b *Broker) ListSessions() []map[string]any {
	b.mu.RLock()
	defer b.mu.RUnlock()
	result := make([]map[string]any, 0, len(b.sessions))
	for _, s := range b.sessions {
		result = append(result, s.ToDict())
	}
	return result
}

// SessionIDsForProject returns session IDs for a given project.
func (b *Broker) SessionIDsForProject(projectName string) []string {
	b.mu.RLock()
	defer b.mu.RUnlock()
	var ids []string
	for _, s := range b.sessions {
		if s.ProjectName == projectName {
			ids = append(ids, s.SessionID)
		}
	}
	if ids == nil {
		ids = []string{}
	}
	return ids
}

// ── Callbacks -> Hub broadcasts ──────────────────────────────────────────────

func (b *Broker) onPhaseChange(sessionID string, phase SessionPhase) {
	b.mu.RLock()
	session := b.sessions[sessionID]
	b.mu.RUnlock()

	var sessionDict map[string]any
	if session != nil {
		sessionDict = session.ToDict()
	} else {
		sessionDict = map[string]any{}
	}

	b.hub.Broadcast("session_phase", map[string]any{
		"session_id": sessionID,
		"phase":      string(phase),
		"session":    sessionDict,
	})
}

func (b *Broker) onTextDelta(sessionID string, chunk string) {
	done := chunk == "" // empty sentinel = turn done marker
	b.hub.Broadcast("agent_stream", map[string]any{
		"session_id": sessionID,
		"chunk":      chunk,
		"done":       done,
	})
}

func (b *Broker) onToolStart(sessionID string, toolEvent map[string]any) {
	b.mu.RLock()
	session := b.sessions[sessionID]
	b.mu.RUnlock()

	var milestones []string
	if session != nil {
		session.mu.RLock()
		ms := session.Milestones
		session.mu.RUnlock()
		if len(ms) > 10 {
			milestones = ms[len(ms)-10:]
		} else {
			milestones = ms
		}
	}

	b.hub.Broadcast("tool_start", map[string]any{
		"session_id": sessionID,
		"tool":       toolEvent,
		"milestones": milestones,
	})
}

func (b *Broker) onToolDone(sessionID string, toolEvent map[string]any) {
	b.mu.RLock()
	session := b.sessions[sessionID]
	b.mu.RUnlock()

	var milestones []string
	if session != nil {
		session.mu.RLock()
		ms := session.Milestones
		session.mu.RUnlock()
		if len(ms) > 10 {
			milestones = ms[len(ms)-10:]
		} else {
			milestones = ms
		}
	}

	b.hub.Broadcast("tool_done", map[string]any{
		"session_id": sessionID,
		"tool":       toolEvent,
		"milestones": milestones,
	})

	// Notify metrics about tool call
	if b.OnToolCall != nil {
		toolName, _ := toolEvent["tool_name"].(string)
		if toolName != "" {
			b.OnToolCall(sessionID, toolName)
		}
	}

	// Backward-compatible milestone event for existing frontend
	if session != nil {
		toolName, _ := toolEvent["tool_name"].(string)
		milestone := toolName + " \u00b7 done"
		b.hub.Broadcast("agent_milestone", map[string]any{
			"session_id":   sessionID,
			"project_name": session.ProjectName,
			"milestone":    milestone,
			"milestones":   milestones,
		})
	}
}

func (b *Broker) onTurnDone(sessionID string, turnCount int) {
	b.hub.Broadcast("turn_done", map[string]any{
		"session_id": sessionID,
		"turn_count": turnCount,
	})

	// Notify metrics about turn completion
	if b.OnTurnComplete != nil {
		b.OnTurnComplete(sessionID, turnCount)
	}
}

func (b *Broker) onSessionDone(sessionID string, reason string) {
	b.mu.RLock()
	session := b.sessions[sessionID]
	b.mu.RUnlock()

	projectName := ""
	if session != nil {
		projectName = session.ProjectName
	}

	// Controllers stay in registry regardless of reason (persistent brain).
	// Normal sessions stay on idle (for follow-up injections), removed otherwise.
	if reason != "idle" && (session == nil || !session.IsController) {
		b.mu.Lock()
		delete(b.sessions, sessionID)
		b.mu.Unlock()
	}

	b.hub.Broadcast("agent_done", map[string]any{
		"session_id":   sessionID,
		"project_name": projectName,
		"reason":       reason,
	})

	log.Printf("[broker] session %s done (reason=%s, project=%s)", sessionID[:8], reason, projectName)

	// Notify operator
	if b.OnSessionDone != nil {
		b.OnSessionDone(sessionID, reason)
	}
}

// newUUID generates a random UUID v4 string without external dependencies.
func newUUID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	b[6] = (b[6] & 0x0f) | 0x40 // version 4
	b[8] = (b[8] & 0x3f) | 0x80 // variant 2
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
