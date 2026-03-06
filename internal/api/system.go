package api

// HealthResponse from /api/health.
type HealthResponse struct {
	Status        string  `json:"status"`
	Uptime        float64 `json:"uptime"`
	Agents        int     `json:"agents"`
	WSConnections int     `json:"ws_connections"`
}

// StatsResponse from /api/stats.
type StatsResponse struct {
	TotalProjects int     `json:"total_projects"`
	TotalAgents   int     `json:"total_agents"`
	WorkingAgents int     `json:"working_agents"`
	IdleAgents    int     `json:"idle_agents"`
	UptimeSeconds float64 `json:"uptime_seconds"`
}

// Health checks the backend health endpoint.
func (c *Client) Health() (*HealthResponse, error) {
	var out HealthResponse
	err := c.get("/api/health", &out)
	return &out, err
}

// Stats fetches global stats.
func (c *Client) Stats() (*StatsResponse, error) {
	var out StatsResponse
	err := c.get("/api/stats", &out)
	return &out, err
}
