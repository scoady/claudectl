package api

import (
	"fmt"
	"net/url"
)

// CronJob represents a scheduled task.
type CronJob struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Schedule string `json:"schedule"`
	Task     string `json:"task"`
	Enabled  bool   `json:"enabled"`
	LastRun  string `json:"last_run,omitempty"`
	NextRun  string `json:"next_run,omitempty"`
}

// GetCronJobs lists cron jobs for a project.
func (c *Client) GetCronJobs(project string) ([]CronJob, error) {
	var out []CronJob
	err := c.get("/api/projects/"+url.PathEscape(project)+"/cron", &out)
	return out, err
}

// CreateCronJob creates a new cron job.
func (c *Client) CreateCronJob(project string, body map[string]interface{}) (*CronJob, error) {
	var out CronJob
	err := c.post("/api/projects/"+url.PathEscape(project)+"/cron", body, &out)
	return &out, err
}

// UpdateCronJob updates an existing cron job.
func (c *Client) UpdateCronJob(project, jobID string, body map[string]interface{}) (*CronJob, error) {
	var out CronJob
	err := c.put(fmt.Sprintf("/api/projects/%s/cron/%s", url.PathEscape(project), url.PathEscape(jobID)), body, &out)
	return &out, err
}

// DeleteCronJob removes a cron job.
func (c *Client) DeleteCronJob(project, jobID string) error {
	return c.delete(fmt.Sprintf("/api/projects/%s/cron/%s", url.PathEscape(project), url.PathEscape(jobID)))
}

// TriggerCronJob manually triggers a cron job.
func (c *Client) TriggerCronJob(project, jobID string) error {
	return c.post(fmt.Sprintf("/api/projects/%s/cron/%s/trigger", url.PathEscape(project), url.PathEscape(jobID)), nil, nil)
}
