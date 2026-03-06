package api

import (
	"fmt"
	"net/url"
)

// ── Metrics types ────────────────────────────────────────────────────────────

// AgentMetrics represents a single time-series data point for agent activity.
type AgentMetrics struct {
	Time   string `json:"time"`
	Active int    `json:"active"`
	Idle   int    `json:"idle"`
	Done   int    `json:"done"`
	Error  int    `json:"error"`
}

// CostMetrics represents a single time-series data point for cost data.
type CostMetrics struct {
	Time        string  `json:"time"`
	Cumulative  float64 `json:"cumulative"`
	Incremental float64 `json:"incremental"`
}

// TaskMetrics represents a single time-series data point for task throughput.
type TaskMetrics struct {
	Time      string `json:"time"`
	Started   int    `json:"started"`
	Completed int    `json:"completed"`
	Failed    int    `json:"failed"`
}

// ModelUsage represents usage stats for a single model.
type ModelUsage struct {
	Model         string  `json:"model"`
	Count         int     `json:"count"`
	TotalTurns    int     `json:"total_turns"`
	EstimatedCost float64 `json:"estimated_cost"`
}

// ProjectActivity represents a single time-series data point for a project.
type ProjectActivity struct {
	Time       string `json:"time"`
	AgentCount int    `json:"agent_count"`
	TurnCount  int    `json:"turn_count"`
}

// SystemHealth represents current system health stats.
type SystemHealth struct {
	Uptime             string  `json:"uptime"`
	UptimeSeconds      float64 `json:"uptime_seconds"`
	TotalAgentsSpawned int     `json:"total_agents_spawned"`
	ActiveAgents       int     `json:"active_agents"`
	IdleAgents         int     `json:"idle_agents"`
	ErrorAgents        int     `json:"error_agents"`
	ActiveWS           int     `json:"active_ws_connections"`
	TotalTurns         int     `json:"total_turns"`
	CumulativeCost     float64 `json:"cumulative_cost"`
	SnapshotCount      int     `json:"snapshot_count"`
}

// MetricsSummary is a quick overview of system metrics.
type MetricsSummary struct {
	Uptime              string         `json:"uptime"`
	UptimeSeconds       float64        `json:"uptime_seconds"`
	TotalAgentsSpawned  int            `json:"total_agents_spawned"`
	ActiveAgents        int            `json:"active_agents"`
	IdleAgents          int            `json:"idle_agents"`
	TotalTurns          int            `json:"total_turns"`
	CumulativeCost      float64        `json:"cumulative_cost"`
	ActiveWS            int            `json:"active_ws_connections"`
	TotalTasksStarted   int            `json:"total_tasks_started"`
	TotalTasksCompleted int            `json:"total_tasks_completed"`
	TotalTasksFailed    int            `json:"total_tasks_failed"`
	ModelBreakdown      map[string]int `json:"model_breakdown"`
	ProjectAgentCounts  map[string]int `json:"project_agent_counts"`
}

// ── API methods ─────────────────────────────────────────────────────────────

// GetAgentMetrics fetches time-series agent activity data.
func (c *Client) GetAgentMetrics(since, resolution string) ([]AgentMetrics, error) {
	var out []AgentMetrics
	path := fmt.Sprintf("/api/metrics/agents?since=%s&resolution=%s",
		url.QueryEscape(since), url.QueryEscape(resolution))
	err := c.get(path, &out)
	return out, err
}

// GetCostMetrics fetches time-series cost accumulation data.
func (c *Client) GetCostMetrics(since, resolution string) ([]CostMetrics, error) {
	var out []CostMetrics
	path := fmt.Sprintf("/api/metrics/costs?since=%s&resolution=%s",
		url.QueryEscape(since), url.QueryEscape(resolution))
	err := c.get(path, &out)
	return out, err
}

// GetTaskMetrics fetches time-series task throughput data.
func (c *Client) GetTaskMetrics(since, resolution string) ([]TaskMetrics, error) {
	var out []TaskMetrics
	path := fmt.Sprintf("/api/metrics/tasks?since=%s&resolution=%s",
		url.QueryEscape(since), url.QueryEscape(resolution))
	err := c.get(path, &out)
	return out, err
}

// GetModelUsage fetches model usage breakdown.
func (c *Client) GetModelUsage(since string) ([]ModelUsage, error) {
	var out []ModelUsage
	path := fmt.Sprintf("/api/metrics/models?since=%s", url.QueryEscape(since))
	err := c.get(path, &out)
	return out, err
}

// GetProjectMetrics fetches per-project activity time-series.
func (c *Client) GetProjectMetrics(since, resolution string) (map[string][]ProjectActivity, error) {
	var out map[string][]ProjectActivity
	path := fmt.Sprintf("/api/metrics/projects?since=%s&resolution=%s",
		url.QueryEscape(since), url.QueryEscape(resolution))
	err := c.get(path, &out)
	return out, err
}

// GetSystemHealth fetches current system health stats.
func (c *Client) GetSystemHealth() (*SystemHealth, error) {
	var out SystemHealth
	err := c.get("/api/metrics/health", &out)
	return &out, err
}

// GetMetricsSummary fetches a quick metrics summary.
func (c *Client) GetMetricsSummary() (*MetricsSummary, error) {
	var out MetricsSummary
	err := c.get("/api/metrics/summary", &out)
	return &out, err
}
