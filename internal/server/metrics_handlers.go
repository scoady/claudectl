package server

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/scoady/claudectl/internal/api"
	"github.com/scoady/claudectl/internal/tui"
)

// Metric series names recorded by broker callbacks.
const (
	metricAgentsActive    = "agents.active"
	metricAgentsSpawned   = "agents.spawned"
	metricAgentsDone      = "agents.done"
	metricAgentsError     = "agents.error"
	metricCostIncremental = "cost.incremental"
	metricTasksStarted    = "tasks.started"
	metricTasksCompleted  = "tasks.completed"
	metricTasksFailed     = "tasks.failed"
	metricTurns           = "turns"
	metricToolCall        = "tool.call"
)

// parseMetricsParams extracts since and resolution query params with defaults.
func parseMetricsParams(r *http.Request) (since time.Time, resolution time.Duration) {
	since = time.Now().Add(-1 * time.Hour)
	resolution = time.Minute

	if s := r.URL.Query().Get("since"); s != "" {
		if t, err := time.Parse(time.RFC3339, s); err == nil {
			since = t
		}
	}
	if s := r.URL.Query().Get("resolution"); s != "" {
		if d, err := time.ParseDuration(s); err == nil {
			resolution = d
		}
	}
	return
}

// handleMetricsAgents returns time-series of active/idle/done/error agent counts.
func (s *Server) handleMetricsAgents(w http.ResponseWriter, r *http.Request) {
	since, resolution := parseMetricsParams(r)

	activePoints := s.Metrics.Snapshot(metricAgentsActive, since, resolution)
	donePoints := s.Metrics.Snapshot(metricAgentsDone, since, resolution)
	errorPoints := s.Metrics.Snapshot(metricAgentsError, since, resolution)

	// Build a time-keyed map to merge series
	type bucket struct {
		active, idle, done, errorC int
	}
	buckets := make(map[string]*bucket)
	order := make([]string, 0)

	addBucket := func(t time.Time) *bucket {
		key := t.UTC().Format(time.RFC3339)
		if b, ok := buckets[key]; ok {
			return b
		}
		b := &bucket{}
		buckets[key] = b
		order = append(order, key)
		return b
	}

	for _, p := range activePoints {
		addBucket(p.Time).active += int(p.Value)
	}
	for _, p := range donePoints {
		addBucket(p.Time).done += int(p.Value)
	}
	for _, p := range errorPoints {
		addBucket(p.Time).errorC += int(p.Value)
	}

	// Include current live state as the latest point
	if s.Broker != nil {
		active, idle := s.Broker.CountByStatus()
		now := time.Now().UTC().Format(time.RFC3339)
		if _, ok := buckets[now]; !ok {
			order = append(order, now)
		}
		buckets[now] = &bucket{active: active, idle: idle}
	}

	result := make([]api.AgentMetrics, 0, len(order))
	for _, key := range order {
		b := buckets[key]
		result = append(result, api.AgentMetrics{
			Time:   key,
			Active: b.active,
			Idle:   b.idle,
			Done:   b.done,
			Error:  b.errorC,
		})
	}

	writeJSON(w, http.StatusOK, result)
}

// handleMetricsCosts returns cumulative and incremental cost over time.
func (s *Server) handleMetricsCosts(w http.ResponseWriter, r *http.Request) {
	since, resolution := parseMetricsParams(r)

	points := s.Metrics.Snapshot(metricCostIncremental, since, resolution)

	cumulative := 0.0
	result := make([]api.CostMetrics, 0, len(points))
	for _, p := range points {
		cumulative += p.Value
		result = append(result, api.CostMetrics{
			Time:        p.Time.UTC().Format(time.RFC3339),
			Cumulative:  cumulative,
			Incremental: p.Value,
		})
	}

	writeJSON(w, http.StatusOK, result)
}

// handleMetricsTasks returns tasks started/completed/failed over time.
func (s *Server) handleMetricsTasks(w http.ResponseWriter, r *http.Request) {
	since, resolution := parseMetricsParams(r)

	startedPts := s.Metrics.Snapshot(metricTasksStarted, since, resolution)
	completedPts := s.Metrics.Snapshot(metricTasksCompleted, since, resolution)
	failedPts := s.Metrics.Snapshot(metricTasksFailed, since, resolution)

	type bucket struct {
		started, completed, failed int
	}
	buckets := make(map[string]*bucket)
	order := make([]string, 0)

	addBucket := func(t time.Time) *bucket {
		key := t.UTC().Format(time.RFC3339)
		if b, ok := buckets[key]; ok {
			return b
		}
		b := &bucket{}
		buckets[key] = b
		order = append(order, key)
		return b
	}

	for _, p := range startedPts {
		addBucket(p.Time).started += int(p.Value)
	}
	for _, p := range completedPts {
		addBucket(p.Time).completed += int(p.Value)
	}
	for _, p := range failedPts {
		addBucket(p.Time).failed += int(p.Value)
	}

	result := make([]api.TaskMetrics, 0, len(order))
	for _, key := range order {
		b := buckets[key]
		result = append(result, api.TaskMetrics{
			Time:      key,
			Started:   b.started,
			Completed: b.completed,
			Failed:    b.failed,
		})
	}

	writeJSON(w, http.StatusOK, result)
}

// handleMetricsModels returns model usage breakdown aggregated from broker sessions.
func (s *Server) handleMetricsModels(w http.ResponseWriter, r *http.Request) {
	if s.Broker == nil {
		writeJSON(w, http.StatusOK, []api.ModelUsage{})
		return
	}

	sessions := s.Broker.GetAllSessions()

	type modelAgg struct {
		count      int
		totalTurns int
	}
	agg := make(map[string]*modelAgg)

	for _, sess := range sessions {
		sess.mu.RLock()
		model := sess.Model
		turns := sess.TurnCount
		sess.mu.RUnlock()

		if model == "" {
			model = "unknown"
		}
		a, ok := agg[model]
		if !ok {
			a = &modelAgg{}
			agg[model] = a
		}
		a.count++
		a.totalTurns += turns
	}

	result := make([]api.ModelUsage, 0, len(agg))
	for model, a := range agg {
		result = append(result, api.ModelUsage{
			Model:         model,
			Count:         a.count,
			TotalTurns:    a.totalTurns,
			EstimatedCost: tui.EstimateCost(model, a.totalTurns),
		})
	}

	writeJSON(w, http.StatusOK, result)
}

// handleMetricsProjects returns per-project activity aggregated from broker sessions.
func (s *Server) handleMetricsProjects(w http.ResponseWriter, r *http.Request) {
	if s.Broker == nil {
		writeJSON(w, http.StatusOK, map[string][]api.ProjectActivity{})
		return
	}

	sessions := s.Broker.GetAllSessions()

	type projAgg struct {
		agentCount int
		turnCount  int
	}
	agg := make(map[string]*projAgg)

	for _, sess := range sessions {
		sess.mu.RLock()
		project := sess.ProjectName
		turns := sess.TurnCount
		sess.mu.RUnlock()

		a, ok := agg[project]
		if !ok {
			a = &projAgg{}
			agg[project] = a
		}
		a.agentCount++
		a.turnCount += turns
	}

	now := time.Now().UTC().Format(time.RFC3339)
	result := make(map[string][]api.ProjectActivity, len(agg))
	for project, a := range agg {
		result[project] = []api.ProjectActivity{
			{
				Time:       now,
				AgentCount: a.agentCount,
				TurnCount:  a.turnCount,
			},
		}
	}

	writeJSON(w, http.StatusOK, result)
}

// handleMetricsHealth returns a system health snapshot.
func (s *Server) handleMetricsHealth(w http.ResponseWriter, r *http.Request) {
	uptime := time.Since(s.StartedAt)
	since := time.Time{} // all time

	active, idle := 0, 0
	errorCount := 0
	totalTurns := 0
	totalSpawned := s.Metrics.Count(metricAgentsSpawned, since)

	if s.Broker != nil {
		active, idle = s.Broker.CountByStatus()
		for _, sess := range s.Broker.GetAllSessions() {
			sess.mu.RLock()
			phase := sess.Phase
			turns := sess.TurnCount
			sess.mu.RUnlock()
			totalTurns += turns
			if phase == PhaseError {
				errorCount++
			}
		}
	}

	cumulativeCost := s.Metrics.Sum(metricCostIncremental, since)

	wsCount := 0
	if s.Hub != nil {
		wsCount = s.Hub.ClientCount()
	}

	writeJSON(w, http.StatusOK, api.SystemHealth{
		Uptime:             formatDuration(uptime),
		UptimeSeconds:      uptime.Seconds(),
		TotalAgentsSpawned: totalSpawned,
		ActiveAgents:       active,
		IdleAgents:         idle,
		ErrorAgents:        errorCount,
		ActiveWS:           wsCount,
		TotalTurns:         totalTurns,
		CumulativeCost:     cumulativeCost,
		SnapshotCount:      s.Metrics.Count(metricAgentsActive, since),
	})
}

// handleMetricsSummary returns a combined metrics summary.
func (s *Server) handleMetricsSummary(w http.ResponseWriter, r *http.Request) {
	uptime := time.Since(s.StartedAt)
	since := time.Time{} // all time

	active, idle := 0, 0
	totalTurns := 0

	modelBreakdown := make(map[string]int)
	projectCounts := make(map[string]int)

	if s.Broker != nil {
		active, idle = s.Broker.CountByStatus()
		for _, sess := range s.Broker.GetAllSessions() {
			sess.mu.RLock()
			model := sess.Model
			project := sess.ProjectName
			turns := sess.TurnCount
			sess.mu.RUnlock()
			totalTurns += turns
			if model == "" {
				model = "unknown"
			}
			modelBreakdown[model]++
			projectCounts[project]++
		}
	}

	wsCount := 0
	if s.Hub != nil {
		wsCount = s.Hub.ClientCount()
	}

	writeJSON(w, http.StatusOK, api.MetricsSummary{
		Uptime:              formatDuration(uptime),
		UptimeSeconds:       uptime.Seconds(),
		TotalAgentsSpawned:  s.Metrics.Count(metricAgentsSpawned, since),
		ActiveAgents:        active,
		IdleAgents:          idle,
		TotalTurns:          totalTurns,
		CumulativeCost:      s.Metrics.Sum(metricCostIncremental, since),
		ActiveWS:            wsCount,
		TotalTasksStarted:   s.Metrics.Count(metricTasksStarted, since),
		TotalTasksCompleted: s.Metrics.Count(metricTasksCompleted, since),
		TotalTasksFailed:    s.Metrics.Count(metricTasksFailed, since),
		ModelBreakdown:      modelBreakdown,
		ProjectAgentCounts:  projectCounts,
	})
}

// formatDuration returns a human-friendly duration string.
func formatDuration(d time.Duration) string {
	h := int(d.Hours())
	m := int(d.Minutes()) % 60
	sec := int(d.Seconds()) % 60
	if h > 0 {
		return fmt.Sprintf("%dh%dm%ds", h, m, sec)
	}
	if m > 0 {
		return fmt.Sprintf("%dm%ds", m, sec)
	}
	return fmt.Sprintf("%ds", sec)
}

// wireMetricsCallbacks hooks broker lifecycle events into the MetricsStore
// so that the metrics handlers have data to serve.
func (s *Server) wireMetricsCallbacks() {
	if s.Broker == nil || s.Metrics == nil {
		return
	}

	// On spawn
	s.Broker.OnSessionSpawn = func(sessionID string) {
		s.Metrics.Record(metricAgentsSpawned, 1)
		s.Metrics.Record(metricAgentsActive, 1)
		s.Metrics.Record(metricTasksStarted, 1)
		if s.OTelInstruments != nil {
			s.OTelInstruments.RecordAgentSpawned(context.Background())
		}
	}

	// On tool call
	s.Broker.OnToolCall = func(sessionID, toolName string) {
		s.Metrics.Record(metricToolCall, 1, "tool", toolName)
		if s.OTelInstruments != nil {
			s.OTelInstruments.RecordToolInvocation(context.Background(), toolName)
		}
	}

	// On turn complete
	s.Broker.OnTurnComplete = func(sessionID string, turnCount int) {
		s.Metrics.Record(metricTurns, 1)
		if s.OTelInstruments != nil {
			s.OTelInstruments.RecordTurn(context.Background())
		}
	}

	origOnSessionDone := s.Broker.OnSessionDone

	s.Broker.OnSessionDone = func(sessionID, reason string) {
		// Record to metrics store
		switch reason {
		case "idle":
			s.Metrics.Record(metricTasksCompleted, 1)
		case "error":
			s.Metrics.Record(metricAgentsError, 1)
			s.Metrics.Record(metricTasksFailed, 1)
		default:
			s.Metrics.Record(metricAgentsDone, 1)
			s.Metrics.Record(metricTasksCompleted, 1)
		}

		// Compute cost for this session
		sess := s.Broker.GetSession(sessionID)
		if sess != nil {
			sess.mu.RLock()
			model := sess.Model
			turns := sess.TurnCount
			startedAt := sess.StartedAt
			sess.mu.RUnlock()

			cost := tui.EstimateCost(model, turns)
			if cost > 0 {
				s.Metrics.Record(metricCostIncremental, cost)
			}

			// Record task duration
			if st, err := time.Parse(time.RFC3339, startedAt); err == nil {
				duration := time.Since(st).Seconds()
				s.Metrics.Record("task.duration", duration)

				// Record to OTel if instruments are set
				if s.OTelInstruments != nil {
					s.OTelInstruments.RecordTaskDuration(context.Background(), duration)
				}
			}
		}

		// Record to OTel instruments
		if s.OTelInstruments != nil {
			s.OTelInstruments.RecordAgentDone(context.Background())
		}

		// Chain to the original callback (operator wiring)
		if origOnSessionDone != nil {
			origOnSessionDone(sessionID, reason)
		}
	}
}
