package server

import "time"

// ── Enums ────────────────────────────────────────────────────────────────────

// AgentStatus represents the current status of an agent session.
type AgentStatus string

const (
	AgentStatusActive  AgentStatus = "active"
	AgentStatusIdle    AgentStatus = "idle"
	AgentStatusDone    AgentStatus = "done"
	AgentStatusError   AgentStatus = "error"
	AgentStatusPending AgentStatus = "pending"
)

// SessionPhase represents the granular phase an agent session is in.
type SessionPhase string

const (
	PhaseStarting   SessionPhase = "starting"
	PhaseThinking   SessionPhase = "thinking"
	PhaseGenerating SessionPhase = "generating"
	PhaseToolInput  SessionPhase = "tool_input"
	PhaseToolExec   SessionPhase = "tool_exec"
	PhaseIdle       SessionPhase = "idle"
	PhaseInjecting  SessionPhase = "injecting"
	PhaseCancelled  SessionPhase = "cancelled"
	PhaseError      SessionPhase = "error"
)

// ── Core Models ──────────────────────────────────────────────────────────────

// ProjectConfig holds per-project configuration.
type ProjectConfig struct {
	Parallelism     int    `json:"parallelism"`
	Model           string `json:"model,omitempty"`
	MCPConfig       string `json:"mcp_config,omitempty"`
	DashboardPrompt string `json:"dashboard_prompt,omitempty"`
}

// ManagedProject represents a managed project directory.
type ManagedProject struct {
	Name             string        `json:"name"`
	Path             string        `json:"path"`
	Description      string        `json:"description,omitempty"`
	Goal             string        `json:"goal,omitempty"`
	Config           ProjectConfig `json:"config"`
	ActiveSessionIDs []string      `json:"active_session_ids"`
}

// AgentSessionInfo is the JSON-serializable snapshot of an agent session.
type AgentSessionInfo struct {
	SessionID           string       `json:"session_id"`
	ProjectName         string       `json:"project_name"`
	ProjectPath         string       `json:"project_path"`
	Task                string       `json:"task,omitempty"`
	Status              AgentStatus  `json:"status"`
	Phase               SessionPhase `json:"phase"`
	Model               string       `json:"model,omitempty"`
	StartedAt           string       `json:"started_at,omitempty"`
	TurnCount           int          `json:"turn_count"`
	Milestones          []string     `json:"milestones"`
	LastChunk           string       `json:"last_chunk,omitempty"`
	IsController        bool         `json:"is_controller"`
	TaskIndex           *int         `json:"task_index,omitempty"`
	HasPendingInjection bool         `json:"has_pending_injection"`
	PID                 *int         `json:"pid,omitempty"`
}

// GlobalStats holds system-wide statistics.
type GlobalStats struct {
	ActiveAgents  int     `json:"active_agents"`
	IdleAgents    int     `json:"idle_agents"`
	TotalProjects int     `json:"total_projects"`
	UptimeSeconds float64 `json:"uptime_seconds"`
}

// ── Request/Response Models ──────────────────────────────────────────────────

// DispatchRequest is the body for POST /api/projects/{name}/dispatch.
type DispatchRequest struct {
	Task  string `json:"task"`
	Model string `json:"model,omitempty"`
}

// DispatchResponse is the response from a dispatch call.
type DispatchResponse struct {
	SessionID string   `json:"session_id,omitempty"`
	Status    string   `json:"status,omitempty"`
	AgentIDs  []string `json:"agent_ids,omitempty"`
}

// InjectRequest is the body for POST /api/agents/{id}/inject.
type InjectRequest struct {
	Message string `json:"message"`
}

// AddTaskRequest is the body for POST /api/projects/{name}/tasks.
type AddTaskRequest struct {
	Text string `json:"text"`
}

// ── WebSocket Event ──────────────────────────────────────────────────────────

// WSEvent is the envelope for all WebSocket messages.
type WSEvent struct {
	Type      string `json:"type"`
	Data      any    `json:"data"`
	Timestamp string `json:"timestamp"`
}

// NewWSEvent creates a WSEvent with the current timestamp.
func NewWSEvent(eventType string, data any) WSEvent {
	return WSEvent{
		Type:      eventType,
		Data:      data,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	}
}
