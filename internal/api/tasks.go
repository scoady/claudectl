package api

import (
	"fmt"
	"net/url"
)

// Task represents a project task.
type Task struct {
	Text   string `json:"text"`
	Status string `json:"status"`
	Index  int    `json:"index,omitempty"`
}

// GetTasks lists tasks for a project.
func (c *Client) GetTasks(project string) ([]Task, error) {
	var out []Task
	err := c.get("/api/projects/"+url.PathEscape(project)+"/tasks", &out)
	return out, err
}

// AddTask adds a new task to a project.
func (c *Client) AddTask(project, text string) error {
	body := map[string]string{"text": text}
	return c.post("/api/projects/"+url.PathEscape(project)+"/tasks", body, nil)
}

// UpdateTask updates a task's status.
func (c *Client) UpdateTask(project string, index int, status string) error {
	body := map[string]string{"status": status}
	return c.put(fmt.Sprintf("/api/projects/%s/tasks/%d", url.PathEscape(project), index), body, nil)
}

// DeleteTask removes a task by index.
func (c *Client) DeleteTask(project string, index int) error {
	return c.delete(fmt.Sprintf("/api/projects/%s/tasks/%d", url.PathEscape(project), index))
}

// StartTask marks a task as started.
func (c *Client) StartTask(project string, index int) error {
	return c.post(fmt.Sprintf("/api/projects/%s/tasks/%d/start", url.PathEscape(project), index), nil, nil)
}

// CompleteTask marks a task as complete with an optional summary.
func (c *Client) CompleteTask(project string, index int, summary string) error {
	var body interface{}
	if summary != "" {
		body = map[string]string{"summary": summary}
	}
	return c.post(fmt.Sprintf("/api/projects/%s/tasks/%d/complete", url.PathEscape(project), index), body, nil)
}
