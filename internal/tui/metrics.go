package tui

import (
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/NimbleMarkets/ntcharts/barchart"
	"github.com/NimbleMarkets/ntcharts/linechart/timeserieslinechart"
	"github.com/NimbleMarkets/ntcharts/sparkline"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/scoady/claudectl/internal/api"
)

// ── Time range presets ──────────────────────────────────────────────────────

var metricsTimeRanges = []time.Duration{
	15 * time.Minute,
	1 * time.Hour,
	6 * time.Hour,
	24 * time.Hour,
}

func metricsRangeLabel(d time.Duration) string {
	if d < time.Hour {
		return fmt.Sprintf("%dm", int(d.Minutes()))
	}
	return fmt.Sprintf("%dh", int(d.Hours()))
}

// ── Metrics model ───────────────────────────────────────────────────────────

// MetricsModel holds the metrics screen state.
type MetricsModel struct {
	RangeIdx    int // index into metricsTimeRanges
	FocusPanel  int // 0-5 panel cycling
	Expanded    bool
	Width       int
	Height      int
}

// NewMetricsModel creates a fresh metrics model.
func NewMetricsModel() MetricsModel {
	return MetricsModel{
		RangeIdx:   1, // default 1h
		FocusPanel: 0,
	}
}

// handleMetricsKey processes key input for the metrics screen.
func (a *App) handleMetricsKey(key string) (tea.Model, tea.Cmd) {
	switch key {
	case "q", "esc":
		if a.metrics.Expanded {
			a.metrics.Expanded = false
			return a, nil
		}
		a.screen = ScreenDashboard
		return a, nil
	case "]":
		// Cycle time range forward
		if a.metrics.RangeIdx < len(metricsTimeRanges)-1 {
			a.metrics.RangeIdx++
		}
		return a, nil
	case "[":
		// Cycle time range backward
		if a.metrics.RangeIdx > 0 {
			a.metrics.RangeIdx--
		}
		return a, nil
	case "tab":
		a.metrics.FocusPanel = (a.metrics.FocusPanel + 1) % 6
		return a, nil
	case "shift+tab":
		a.metrics.FocusPanel = (a.metrics.FocusPanel + 5) % 6
		return a, nil
	case "enter":
		a.metrics.Expanded = !a.metrics.Expanded
		return a, nil
	case "?":
		a.showHelp = !a.showHelp
		return a, nil
	case ":":
		a.mode = ModeCommand
		a.cmdInput = ""
		return a, nil
	}
	return a, nil
}

// ── Rendering ───────────────────────────────────────────────────────────────

// RenderMetrics renders the full metrics dashboard screen.
func RenderMetrics(m *MetricsModel, store *MetricsStore, history *AgentHistory,
	agents []api.Agent, health *api.HealthResponse, width, height int) string {

	m.Width = width
	m.Height = height

	var b strings.Builder

	// ── Header bar ──
	titleLeft := Class("section-title").Render("  Metrics Dashboard")
	rangePill := Pill(fmt.Sprintf(" %s ", metricsRangeLabel(metricsTimeRanges[m.RangeIdx])), Cyan, BadgeCyanBg)
	refreshDot := lipgloss.NewStyle().Foreground(Green).Bold(true).Render("●")
	panelNames := []string{"Activity", "Cost", "Throughput", "Models", "Projects", "Health"}
	focusLabel := lipgloss.NewStyle().Foreground(Amber).Bold(true).Render(panelNames[m.FocusPanel])
	titleRight := rangePill + "  " + refreshDot + " live  " + focusLabel

	titleGap := width - lipgloss.Width(titleLeft) - lipgloss.Width(titleRight) - 2
	if titleGap < 1 {
		titleGap = 1
	}
	b.WriteString(titleLeft + repeatStr(" ", titleGap) + titleRight + "\n")
	b.WriteString(HLine(width, Muted) + "\n")

	window := metricsTimeRanges[m.RangeIdx]

	// If expanded, render only the focused panel
	if m.Expanded {
		contentH := height - 4
		panel := renderMetricsPanel(m.FocusPanel, store, history, agents, health, width-4, contentH, window)
		b.WriteString(panel)
		return b.String()
	}

	// ── 2x3 grid layout ──
	panelW := (width - 6) / 2
	if panelW < 30 {
		panelW = 30
	}
	panelH := (height - 6) / 3
	if panelH < 6 {
		panelH = 6
	}

	// Row 1: Activity + Cost
	p0 := renderMetricsPanelBox(0, m.FocusPanel, store, history, agents, health, panelW, panelH, window)
	p1 := renderMetricsPanelBox(1, m.FocusPanel, store, history, agents, health, panelW, panelH, window)
	b.WriteString(lipgloss.JoinHorizontal(lipgloss.Top, p0, "  ", p1) + "\n")

	// Row 2: Throughput + Models
	p2 := renderMetricsPanelBox(2, m.FocusPanel, store, history, agents, health, panelW, panelH, window)
	p3 := renderMetricsPanelBox(3, m.FocusPanel, store, history, agents, health, panelW, panelH, window)
	b.WriteString(lipgloss.JoinHorizontal(lipgloss.Top, p2, "  ", p3) + "\n")

	// Row 3: Projects + Health
	p4 := renderMetricsPanelBox(4, m.FocusPanel, store, history, agents, health, panelW, panelH, window)
	p5 := renderMetricsPanelBox(5, m.FocusPanel, store, history, agents, health, panelW, panelH, window)
	b.WriteString(lipgloss.JoinHorizontal(lipgloss.Top, p4, "  ", p5))

	return b.String()
}

// renderMetricsPanelBox wraps a panel in a bordered card.
func renderMetricsPanelBox(panelIdx, focusIdx int, store *MetricsStore, history *AgentHistory,
	agents []api.Agent, health *api.HealthResponse, w, h int, window time.Duration) string {

	titles := []string{
		"Agent Activity",
		"Cost Accumulation",
		"Task Throughput",
		"Model Usage",
		"Project Activity",
		"System Health",
	}
	icons := []string{"◉", "$", "▸", "◆", "⚡", "♥"}
	colors := []lipgloss.Color{Amber, Amber, Green, Purple, Cyan, Green}

	titleStyle := lipgloss.NewStyle().Bold(true).Foreground(colors[panelIdx])
	title := titleStyle.Render(icons[panelIdx] + " " + titles[panelIdx])

	// Inner content dimensions
	innerW := w - 4
	innerH := h - 4
	if innerW < 10 {
		innerW = 10
	}
	if innerH < 3 {
		innerH = 3
	}

	content := renderMetricsPanel(panelIdx, store, history, agents, health, innerW, innerH, window)

	// Pad/clamp content lines
	lines := strings.Split(content, "\n")
	for len(lines) < innerH {
		lines = append(lines, "")
	}
	if len(lines) > innerH {
		lines = lines[:innerH]
	}
	body := strings.Join(lines, "\n")

	// Choose border color
	borderCol := BorderColor
	if panelIdx == focusIdx {
		borderCol = GlowBorder
	}

	box := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(borderCol).
		Padding(0, 1).
		Width(w).
		Height(h).
		Render(title + "\n" + body)

	return box
}

// renderMetricsPanel renders the inner content of a single panel.
func renderMetricsPanel(idx int, store *MetricsStore, history *AgentHistory,
	agents []api.Agent, health *api.HealthResponse, w, h int, window time.Duration) string {

	switch idx {
	case 0:
		return renderAgentActivityChart(store, history, w, h, window)
	case 1:
		return renderCostChart(store, history, w, h, window)
	case 2:
		return renderThroughputChart(store, history, w, h, window)
	case 3:
		return renderModelUsageChart(agents, history, w, h)
	case 4:
		return renderProjectSparklines(store, history, agents, w, h)
	case 5:
		return renderHealthGauges(store, health, agents, w, h)
	default:
		return ""
	}
}

// ── Panel 0: Agent Activity (Time Series Line Chart) ────────────────────────

func renderAgentActivityChart(store *MetricsStore, history *AgentHistory, w, h int, window time.Duration) string {
	if w < 10 || h < 3 {
		return Class("dim").Render("(too small)")
	}

	now := time.Now()
	since := now.Add(-window)

	// Build time series from history snapshots
	activePoints := store.Query("agents.active", since)
	donePoints := store.Query("agents.done", since)
	errorPoints := store.Query("agents.error", since)

	// If no data, show placeholder
	if len(activePoints) == 0 && len(donePoints) == 0 && len(errorPoints) == 0 {
		return Class("dim").Render("Collecting data...") + "\n" +
			Class("faint").Render("Metrics populate as agents run")
	}

	chartW := w
	chartH := h - 1
	if chartH < 2 {
		chartH = 2
	}

	chart := timeserieslinechart.New(chartW, chartH,
		timeserieslinechart.WithTimeRange(since, now),
		timeserieslinechart.WithDataSetStyle("active", lipgloss.NewStyle().Foreground(Amber)),
		timeserieslinechart.WithDataSetStyle("done", lipgloss.NewStyle().Foreground(Green)),
		timeserieslinechart.WithDataSetStyle("error", lipgloss.NewStyle().Foreground(Rose)),
	)

	for _, p := range activePoints {
		chart.PushDataSet("active", timeserieslinechart.TimePoint{Time: p.Time, Value: p.Value})
	}
	for _, p := range donePoints {
		chart.PushDataSet("done", timeserieslinechart.TimePoint{Time: p.Time, Value: p.Value})
	}
	for _, p := range errorPoints {
		chart.PushDataSet("error", timeserieslinechart.TimePoint{Time: p.Time, Value: p.Value})
	}

	chart.DrawBrailleAll()

	// Legend
	legend := lipgloss.NewStyle().Foreground(Amber).Render("● active") + "  " +
		lipgloss.NewStyle().Foreground(Green).Render("● done") + "  " +
		lipgloss.NewStyle().Foreground(Rose).Render("● error")

	return chart.View() + "\n" + legend
}

// ── Panel 1: Cost Accumulation ──────────────────────────────────────────────

func renderCostChart(store *MetricsStore, history *AgentHistory, w, h int, window time.Duration) string {
	if w < 10 || h < 3 {
		return Class("dim").Render("(too small)")
	}

	now := time.Now()
	since := now.Add(-window)

	costPoints := store.Query("cost.cumulative", since)
	if len(costPoints) == 0 {
		// Build from history
		spans := history.Spans()
		var cumCost float64
		for _, s := range spans {
			cumCost += EstimateCost(s.Model, s.TurnCount)
		}
		if cumCost > 0 {
			return lipgloss.NewStyle().Foreground(Amber).Bold(true).Render(
				fmt.Sprintf("Total estimated: %s", FormatCost(cumCost))) + "\n" +
				Class("faint").Render("Accumulating time series data...")
		}
		return Class("dim").Render("No cost data yet")
	}

	chartW := w
	chartH := h - 1
	if chartH < 2 {
		chartH = 2
	}

	chart := timeserieslinechart.New(chartW, chartH,
		timeserieslinechart.WithTimeRange(since, now),
		timeserieslinechart.WithStyle(lipgloss.NewStyle().Foreground(Amber)),
	)

	for _, p := range costPoints {
		chart.Push(timeserieslinechart.TimePoint{Time: p.Time, Value: p.Value})
	}

	chart.DrawBraille()

	current := costPoints[len(costPoints)-1].Value
	label := lipgloss.NewStyle().Foreground(Amber).Bold(true).Render(FormatCost(current))

	return chart.View() + "\n" + label
}

// ── Panel 2: Task Throughput (Bar Chart) ────────────────────────────────────

func renderThroughputChart(store *MetricsStore, history *AgentHistory, w, h int, window time.Duration) string {
	if w < 10 || h < 3 {
		return Class("dim").Render("(too small)")
	}

	now := time.Now()
	since := now.Add(-window)
	spans := history.Spans()

	// Bucket completions by time interval
	bucketCount := w / 4
	if bucketCount < 4 {
		bucketCount = 4
	}
	if bucketCount > 24 {
		bucketCount = 24
	}
	bucketDur := window / time.Duration(bucketCount)

	buckets := make([]float64, bucketCount)
	for _, s := range spans {
		if s.EndedAt.IsZero() || s.EndedAt.Before(since) {
			continue
		}
		idx := int(s.EndedAt.Sub(since) / bucketDur)
		if idx >= bucketCount {
			idx = bucketCount - 1
		}
		if idx < 0 {
			idx = 0
		}
		buckets[idx]++
	}

	chartH := h - 1
	if chartH < 2 {
		chartH = 2
	}

	bc := barchart.New(w, chartH,
		barchart.WithBarGap(1),
		barchart.WithStyles(
			lipgloss.NewStyle().Foreground(Dim),
			lipgloss.NewStyle().Foreground(Dim),
		),
		barchart.WithNoAxis(),
	)

	for i, v := range buckets {
		label := ""
		if i == 0 {
			label = metricsRangeLabel(window) + " ago"
		} else if i == bucketCount-1 {
			label = "now"
		}
		bc.Push(barchart.BarData{
			Label: label,
			Values: []barchart.BarValue{
				{
					Name:  "completed",
					Value: v,
					Style: lipgloss.NewStyle().Foreground(Green),
				},
			},
		})
	}
	bc.Draw()

	// Summary
	var total float64
	for _, v := range buckets {
		total += v
	}
	summary := lipgloss.NewStyle().Foreground(Green).Render(fmt.Sprintf("%.0f completed", total)) +
		Class("dim").Render(fmt.Sprintf(" in %s", metricsRangeLabel(window)))

	return bc.View() + "\n" + summary
}

// ── Panel 3: Model Usage (Bar Chart) ────────────────────────────────────────

func renderModelUsageChart(agents []api.Agent, history *AgentHistory, w, h int) string {
	if w < 10 || h < 3 {
		return Class("dim").Render("(too small)")
	}

	// Count model usage from history + active agents
	modelCounts := make(map[string]int)
	spans := history.Spans()
	for _, s := range spans {
		model := normalizeModelName(s.Model)
		modelCounts[model]++
	}
	for _, a := range agents {
		model := normalizeModelName(a.Model)
		modelCounts[model]++
	}

	if len(modelCounts) == 0 {
		return Class("dim").Render("No model usage data")
	}

	// Sort by count descending
	type modelEntry struct {
		Name  string
		Count int
	}
	var entries []modelEntry
	for name, count := range modelCounts {
		entries = append(entries, modelEntry{name, count})
	}
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Count > entries[j].Count
	})

	// Limit to top 6
	if len(entries) > 6 {
		entries = entries[:6]
	}

	chartH := h - 1
	if chartH < 2 {
		chartH = 2
	}

	modelColors := map[string]lipgloss.Color{
		"sonnet":  Cyan,
		"opus":    Purple,
		"haiku":   Green,
		"unknown": Dim,
	}

	bc := barchart.New(w, chartH,
		barchart.WithHorizontalBars(),
		barchart.WithBarGap(0),
		barchart.WithStyles(
			lipgloss.NewStyle().Foreground(Dim),
			lipgloss.NewStyle().Foreground(SubText),
		),
		barchart.WithNoAxis(),
	)

	for _, e := range entries {
		color, ok := modelColors[e.Name]
		if !ok {
			color = Blue
		}
		bc.Push(barchart.BarData{
			Label: e.Name,
			Values: []barchart.BarValue{
				{
					Name:  e.Name,
					Value: float64(e.Count),
					Style: lipgloss.NewStyle().Foreground(color),
				},
			},
		})
	}
	bc.Draw()

	return bc.View()
}

func normalizeModelName(model string) string {
	m := strings.ToLower(model)
	if strings.Contains(m, "opus") {
		return "opus"
	}
	if strings.Contains(m, "haiku") {
		return "haiku"
	}
	if strings.Contains(m, "sonnet") {
		return "sonnet"
	}
	if m == "" {
		return "unknown"
	}
	return m
}

// ── Panel 4: Project Activity (Sparklines) ──────────────────────────────────

func renderProjectSparklines(store *MetricsStore, history *AgentHistory, agents []api.Agent, w, h int) string {
	if w < 10 || h < 3 {
		return Class("dim").Render("(too small)")
	}

	// Gather projects from history + active agents
	projectAgents := make(map[string]int)
	spans := history.Spans()
	for _, s := range spans {
		projectAgents[s.ProjectName]++
	}
	for _, a := range agents {
		projectAgents[a.ProjectName]++
	}

	if len(projectAgents) == 0 {
		return Class("dim").Render("No project activity")
	}

	// Sort by count descending
	type projEntry struct {
		Name  string
		Count int
	}
	var projects []projEntry
	for name, count := range projectAgents {
		projects = append(projects, projEntry{name, count})
	}
	sort.Slice(projects, func(i, j int) bool {
		return projects[i].Count > projects[j].Count
	})

	maxProjects := h - 1
	if maxProjects < 1 {
		maxProjects = 1
	}
	if len(projects) > maxProjects {
		projects = projects[:maxProjects]
	}

	nameColW := 16
	sparkW := w - nameColW - 6
	if sparkW < 8 {
		sparkW = 8
	}

	var b strings.Builder
	for _, proj := range projects {
		// Build activity data from time-series snapshots
		seriesName := "project." + proj.Name + ".agents"
		pts := store.Query(seriesName, time.Now().Add(-1*time.Hour))

		name := proj.Name
		if len(name) > nameColW-2 {
			name = name[:nameColW-5] + "..."
		}

		nameStyle := lipgloss.NewStyle().Foreground(White).Bold(true).Width(nameColW)

		if len(pts) >= 2 {
			sp := sparkline.New(sparkW, 1,
				sparkline.WithStyle(lipgloss.NewStyle().Foreground(Cyan)),
			)
			for _, p := range pts {
				sp.Push(p.Value)
			}
			sp.DrawBraille()
			countStr := lipgloss.NewStyle().Foreground(Dim).Render(fmt.Sprintf(" %d", proj.Count))
			b.WriteString(nameStyle.Render(name) + sp.View() + countStr + "\n")
		} else {
			// Fallback: render a simple bar
			barLen := int(float64(sparkW) * (float64(proj.Count) / float64(projects[0].Count+1)))
			if barLen < 1 {
				barLen = 1
			}
			bar := lipgloss.NewStyle().Foreground(Cyan).Render(repeatStr("▓", barLen))
			countStr := lipgloss.NewStyle().Foreground(Dim).Render(fmt.Sprintf(" %d", proj.Count))
			b.WriteString(nameStyle.Render(name) + bar + countStr + "\n")
		}
	}

	return b.String()
}

// ── Panel 5: System Health (Gauges) ─────────────────────────────────────────

func renderHealthGauges(store *MetricsStore, health *api.HealthResponse, agents []api.Agent, w, h int) string {
	if w < 10 || h < 3 {
		return Class("dim").Render("(too small)")
	}

	var b strings.Builder

	gaugeW := w - 20
	if gaugeW < 10 {
		gaugeW = 10
	}

	// Backend connection
	backendStatus := "disconnected"
	backendPct := 0.0
	if health != nil && health.Status == "ok" {
		backendStatus = "connected"
		backendPct = 1.0
	}
	b.WriteString(renderGauge("Backend", backendStatus, backendPct, gaugeW, Green, Rose) + "\n")

	// WebSocket connections
	wsCount := 0
	if health != nil {
		wsCount = health.WSConnections
	}
	wsPct := math.Min(float64(wsCount)/10.0, 1.0)
	b.WriteString(renderGauge("WebSocket", fmt.Sprintf("%d conn", wsCount), wsPct, gaugeW, Cyan, Dim) + "\n")

	// Active agents
	active := 0
	for _, a := range agents {
		if a.Status == "working" || a.Status == "active" {
			active++
		}
	}
	agentPct := math.Min(float64(active)/10.0, 1.0)
	b.WriteString(renderGauge("Agents", fmt.Sprintf("%d active", active), agentPct, gaugeW, Amber, Dim) + "\n")

	// Uptime
	if health != nil && health.Uptime > 0 {
		uptimePct := math.Min(health.Uptime/86400.0, 1.0) // fraction of 24h
		b.WriteString(renderGauge("Uptime", formatUptime(health.Uptime), uptimePct, gaugeW, Purple, Dim) + "\n")
	}

	return b.String()
}

// renderGauge draws a single labeled progress bar gauge.
func renderGauge(label, value string, pct float64, barW int, fillColor, emptyColor lipgloss.Color) string {
	labelStyle := lipgloss.NewStyle().Foreground(SubText).Width(12)
	valueStyle := lipgloss.NewStyle().Foreground(White).Bold(true)

	filled := int(pct * float64(barW))
	if filled < 0 {
		filled = 0
	}
	if filled > barW {
		filled = barW
	}
	empty := barW - filled

	bar := lipgloss.NewStyle().Foreground(fillColor).Render(repeatStr("█", filled)) +
		lipgloss.NewStyle().Foreground(emptyColor).Render(repeatStr("░", empty))

	return labelStyle.Render(label) + bar + " " + valueStyle.Render(value)
}

// ── Feed metrics store from agent data ──────────────────────────────────────

// UpdateMetricsFromAgents should be called on each DataMsg to feed the store.
func UpdateMetricsFromAgents(store *MetricsStore, agents []api.Agent, history *AgentHistory) {
	if store == nil {
		return
	}

	// Count by status
	var active, done, errored float64
	for _, a := range agents {
		switch a.Status {
		case "working", "active":
			active++
		case "done", "complete":
			done++
		case "error", "disconnected", "cancelled":
			errored++
		}
	}
	store.Record("agents.active", active)
	store.Record("agents.done", done)
	store.Record("agents.error", errored)
	store.Record("agents.total", float64(len(agents)))

	// Cumulative cost from history
	if history != nil {
		spans := history.Spans()
		var cumCost float64
		for _, s := range spans {
			cumCost += EstimateCost(s.Model, s.TurnCount)
		}
		store.Record("cost.cumulative", cumCost)
	}

	// Per-project agent counts
	projCounts := make(map[string]float64)
	for _, a := range agents {
		projCounts[a.ProjectName]++
	}
	for proj, count := range projCounts {
		store.Record("project."+proj+".agents", count)
	}
}
