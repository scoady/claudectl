package api

import "net/url"

// DispatchRequest is the body for POST /api/projects/{name}/dispatch.
type DispatchRequest struct {
	Task  string `json:"task"`
	Model string `json:"model,omitempty"`
}

// DispatchResponse is the response from dispatch.
type DispatchResponse struct {
	SessionID string   `json:"session_id,omitempty"`
	Status    string   `json:"status,omitempty"`
	AgentIDs  []string `json:"agent_ids,omitempty"`
}

// Dispatch sends a task to a project.
func (c *Client) Dispatch(project, task, model string) (*DispatchResponse, error) {
	body := DispatchRequest{Task: task, Model: model}
	var out DispatchResponse
	err := c.post("/api/projects/"+url.PathEscape(project)+"/dispatch", body, &out)
	return &out, err
}
