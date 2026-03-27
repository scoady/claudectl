package api

import (
	"fmt"
	"net/url"
	"time"
)

// Agent mirrors the session to_dict() output.
type Agent struct {
	SessionID           string   `json:"session_id"`
	ProjectName         string   `json:"project_name"`
	ProjectPath         string   `json:"project_path"`
	Task                string   `json:"task,omitempty"`
	Status              string   `json:"status"`
	Phase               string   `json:"phase"`
	Model               string   `json:"model,omitempty"`
	StartedAt           string   `json:"started_at,omitempty"`
	TurnCount           int      `json:"turn_count"`
	Milestones          []string `json:"milestones"`
	LastChunk           string   `json:"last_chunk,omitempty"`
	IsController        bool     `json:"is_controller"`
	TaskIndex           *int     `json:"task_index,omitempty"`
	HasPendingInjection bool     `json:"has_pending_injection"`
	PID                 *int     `json:"pid,omitempty"`
}

// ElapsedString returns a human-friendly duration since the agent started.
func (a Agent) ElapsedString() string {
	if a.StartedAt == "" {
		return "-"
	}
	for _, layout := range []string{
		time.RFC3339,
		time.RFC3339Nano,
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05",
	} {
		t, err := time.Parse(layout, a.StartedAt)
		if err == nil {
			d := time.Since(t)
			if d < time.Minute {
				return d.Round(time.Second).String()
			}
			if d < time.Hour {
				return d.Round(time.Second).String()
			}
			hours := int(d.Hours())
			mins := int(d.Minutes()) % 60
			if hours > 0 {
				return fmt.Sprintf("%dh%dm", hours, mins)
			}
			return fmt.Sprintf("%dm", mins)
		}
	}
	return a.StartedAt
}

// Message represents a single agent message.
type Message struct {
	Role      string         `json:"role"`
	Type      string         `json:"type,omitempty"`
	Content   string         `json:"content,omitempty"`
	Timestamp string         `json:"timestamp,omitempty"`
	ToolName  string         `json:"tool_name,omitempty"`
	ToolInput map[string]any `json:"tool_input,omitempty"`
}

// GetAgents lists all active agents.
func (c *Client) GetAgents() ([]Agent, error) {
	var out []Agent
	err := c.get("/api/agents", &out)
	return out, err
}

// KillAgent stops an agent by session ID.
func (c *Client) KillAgent(sessionID string) error {
	return c.delete("/api/agents/" + url.PathEscape(sessionID))
}

// InjectMessage sends a follow-up message to a running agent.
func (c *Client) InjectMessage(sessionID, message string) error {
	body := map[string]string{"message": message}
	return c.post("/api/agents/"+url.PathEscape(sessionID)+"/inject", body, nil)
}

// GetAgentMessages retrieves messages for an agent session.
func (c *Client) GetAgentMessages(sessionID string) ([]Message, error) {
	var out []Message
	err := c.get("/api/agents/"+url.PathEscape(sessionID)+"/messages", &out)
	return out, err
}
