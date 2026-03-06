package api

import (
	"fmt"
	"net/url"
)

// Milestone represents an agent milestone event.
type Milestone struct {
	ID        string `json:"id,omitempty"`
	SessionID string `json:"session_id,omitempty"`
	Label     string `json:"label,omitempty"`
	Timestamp string `json:"timestamp,omitempty"`
}

// GetMilestones lists milestones for a project.
func (c *Client) GetMilestones(project string) ([]Milestone, error) {
	var out []Milestone
	err := c.get("/api/projects/"+url.PathEscape(project)+"/milestones", &out)
	return out, err
}

// DeleteMilestone removes a single milestone.
func (c *Client) DeleteMilestone(project string, id string) error {
	return c.delete(fmt.Sprintf("/api/projects/%s/milestones/%s", url.PathEscape(project), url.PathEscape(id)))
}

// ClearMilestones removes all milestones for a project.
func (c *Client) ClearMilestones(project string) error {
	return c.delete("/api/projects/" + url.PathEscape(project) + "/milestones")
}
