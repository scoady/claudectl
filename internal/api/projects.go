package api

import "net/url"

// Project mirrors the ManagedProject Pydantic model.
type Project struct {
	Name             string   `json:"name"`
	Path             string   `json:"path"`
	Description      string   `json:"description,omitempty"`
	Goal             string   `json:"goal,omitempty"`
	Config           Config   `json:"config"`
	ActiveSessionIDs []string `json:"active_session_ids"`
}

// Config mirrors ProjectConfig.
type Config struct {
	Parallelism     int    `json:"parallelism"`
	Model           string `json:"model,omitempty"`
	MCPConfig       string `json:"mcp_config,omitempty"`
	DashboardPrompt string `json:"dashboard_prompt,omitempty"`
}

// GetProjects lists all managed projects.
func (c *Client) GetProjects() ([]Project, error) {
	var out []Project
	err := c.get("/api/projects", &out)
	return out, err
}

// GetProject fetches a single project by name.
func (c *Client) GetProject(name string) (*Project, error) {
	var out Project
	err := c.get("/api/projects/"+url.PathEscape(name), &out)
	return &out, err
}

// CreateProject creates a new managed project.
func (c *Client) CreateProject(name, description, model string) (*Project, error) {
	body := map[string]string{"name": name}
	if description != "" {
		body["description"] = description
	}
	if model != "" {
		body["model"] = model
	}
	var out Project
	err := c.post("/api/projects/"+url.PathEscape(name), body, &out)
	return &out, err
}

// DeleteProject removes a managed project.
func (c *Client) DeleteProject(name string) error {
	return c.delete("/api/projects/" + url.PathEscape(name))
}

// UpdateConfig updates a project's configuration.
func (c *Client) UpdateConfig(name string, cfg map[string]interface{}) error {
	return c.put("/api/projects/"+url.PathEscape(name)+"/config", cfg, nil)
}
