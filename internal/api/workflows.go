package api

import "net/url"

// Workflow represents a project workflow.
type Workflow struct {
	TemplateID        string          `json:"template_id,omitempty"`
	Status            string          `json:"status,omitempty"`
	CurrentPhase      string          `json:"current_phase,omitempty"`
	Phases            []WorkflowPhase `json:"phases,omitempty"`
	IsolationStrategy string          `json:"isolation_strategy,omitempty"`
}

// WorkflowPhase represents a single phase in a workflow.
type WorkflowPhase struct {
	PhaseID         string `json:"phase_id"`
	PhaseLabel      string `json:"phase_label"`
	IterationNumber int    `json:"iteration_number,omitempty"`
	Status          string `json:"status,omitempty"`
}

// GetWorkflow fetches the workflow for a project.
func (c *Client) GetWorkflow(project string) (*Workflow, error) {
	var out Workflow
	err := c.get("/api/projects/"+url.PathEscape(project)+"/workflow", &out)
	return &out, err
}

// CreateWorkflow creates a new workflow for a project.
func (c *Client) CreateWorkflow(project string, body map[string]interface{}) (*Workflow, error) {
	var out Workflow
	err := c.post("/api/projects/"+url.PathEscape(project)+"/workflow", body, &out)
	return &out, err
}

// StartWorkflow starts the workflow for a project.
func (c *Client) StartWorkflow(project string) error {
	return c.post("/api/projects/"+url.PathEscape(project)+"/workflow/start", nil, nil)
}

// WorkflowAction sends an action (pause, resume, skip_phase, cancel) to a workflow.
func (c *Client) WorkflowAction(project, action string) error {
	body := map[string]string{"action": action}
	return c.post("/api/projects/"+url.PathEscape(project)+"/workflow/action", body, nil)
}

// DeleteWorkflow removes the workflow from a project.
func (c *Client) DeleteWorkflow(project string) error {
	return c.delete("/api/projects/" + url.PathEscape(project) + "/workflow")
}
