package tui

import (
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/scoady/claudectl/internal/api"
)

// ── Agent history ring buffer ──────────────────────────────────────────────────

// AgentSpan records a single agent session's time range.
type AgentSpan struct {
	SessionID   string
	ProjectName string
	Task        string
	Model       string
	Status      string // last known status
	StartedAt   time.Time
	EndedAt     time.Time // zero if still active
	TurnCount   int
}

// AgentHistory maintains a rolling 24h history of agent sessions.
type AgentHistory struct {
	mu    sync.Mutex
	spans []AgentSpan
	seen  map[string]int // sessionID -> index in spans
}

// NewAgentHistory creates a new history tracker.
func NewAgentHistory() *AgentHistory {
	return &AgentHistory{
		spans: make([]AgentSpan, 0, 256),
		seen:  make(map[string]int),
	}
}

// Update ingests the current list of agents and updates the history.
func (h *AgentHistory) Update(agents []api.Agent) {
	h.mu.Lock()
	defer h.mu.Unlock()

	// Mark which sessions are currently present
	active := make(map[string]bool)
	for _, ag := range agents {
		active[ag.SessionID] = true

		if idx, ok := h.seen[ag.SessionID]; ok {
			// Update existing span
			h.spans[idx].Status = ag.Status
			h.spans[idx].TurnCount = ag.TurnCount
			if ag.Model != "" {
				h.spans[idx].Model = ag.Model
			}
		} else {
			// New agent — parse start time
			started := time.Now()
			for _, layout := range []string{
				time.RFC3339,
				time.RFC3339Nano,
				"2006-01-02T15:04:05",
				"2006-01-02 15:04:05",
			} {
				if t, err := time.Parse(layout, ag.StartedAt); err == nil {
					started = t
					break
				}
			}

			span := AgentSpan{
				SessionID:   ag.SessionID,
				ProjectName: ag.ProjectName,
				Task:        ag.Task,
				Model:       ag.Model,
				Status:      ag.Status,
				StartedAt:   started,
				TurnCount:   ag.TurnCount,
			}
			h.seen[ag.SessionID] = len(h.spans)
			h.spans = append(h.spans, span)
		}
	}

	// Mark disappeared agents as ended
	for sid, idx := range h.seen {
		if !active[sid] && h.spans[idx].EndedAt.IsZero() {
			h.spans[idx].EndedAt = time.Now()
			// Also mark done if still "working"
			if h.spans[idx].Status == "working" || h.spans[idx].Status == "active" {
				h.spans[idx].Status = "done"
			}
		}
	}

	// Prune spans older than 24h
	cutoff := time.Now().Add(-24 * time.Hour)
	pruned := make([]AgentSpan, 0, len(h.spans))
	newSeen := make(map[string]int)
	for _, s := range h.spans {
		end := s.EndedAt
		if end.IsZero() {
			end = time.Now()
		}
		if end.After(cutoff) {
			newSeen[s.SessionID] = len(pruned)
			pruned = append(pruned, s)
		}
	}
	h.spans = pruned
	h.seen = newSeen
}

// Spans returns a copy of all tracked spans.
func (h *AgentHistory) Spans() []AgentSpan {
	h.mu.Lock()
	defer h.mu.Unlock()
	out := make([]AgentSpan, len(h.spans))
	copy(out, h.spans)
	return out
}

// ── Timeline zoom levels ───────────────────────────────────────────────────────

var zoomLevels = []time.Duration{
	15 * time.Minute,
	30 * time.Minute,
	1 * time.Hour,
	2 * time.Hour,
	4 * time.Hour,
	8 * time.Hour,
	24 * time.Hour,
}

func zoomLabel(d time.Duration) string {
	if d < time.Hour {
		return fmt.Sprintf("%dm", int(d.Minutes()))
	}
	return fmt.Sprintf("%dh", int(d.Hours()))
}

// ── Timeline model ─────────────────────────────────────────────────────────────

// TimelineModel manages timeline screen state.
type TimelineModel struct {
	ZoomIdx    int // index into zoomLevels
	CursorCol  int // column position of vertical cursor (0-based)
	Selected   int // which project row is highlighted
	Width      int
	Height     int
}

// NewTimelineModel creates a fresh timeline.
func NewTimelineModel() TimelineModel {
	return TimelineModel{
		ZoomIdx:   2, // default 1h
		CursorCol: -1,
	}
}



// handleTimelineKey processes key input for the timeline screen.
func (a *App) handleTimelineKey(key string) (tea.Model, tea.Cmd) {
	switch key {
	case "q", "esc":
		a.screen = ScreenDashboard
		return a, nil
	case "h":
		// Zoom out (wider window)
		if a.timeline.ZoomIdx < len(zoomLevels)-1 {
			a.timeline.ZoomIdx++
		}
		return a, nil
	case "l":
		// Zoom in (narrower window)
		if a.timeline.ZoomIdx > 0 {
			a.timeline.ZoomIdx--
		}
		return a, nil
	case "left":
		// Move cursor left
		if a.timeline.CursorCol < 0 {
			a.timeline.CursorCol = a.layout.TimelineBarWidth - 1
		} else if a.timeline.CursorCol > 0 {
			a.timeline.CursorCol--
		}
		return a, nil
	case "right":
		// Move cursor right
		barWidth := a.layout.TimelineBarWidth
		if a.timeline.CursorCol < 0 {
			a.timeline.CursorCol = 0
		} else if a.timeline.CursorCol < barWidth-1 {
			a.timeline.CursorCol++
		}
		return a, nil
	case "j", "down":
		a.timeline.Selected++
		return a, nil
	case "k", "up":
		if a.timeline.Selected > 0 {
			a.timeline.Selected--
		}
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

// ── Rendering ──────────────────────────────────────────────────────────────────

// RenderTimeline renders the timeline screen.
func RenderTimeline(tm *TimelineModel, history *AgentHistory, width, height int) string {
	tm.Width = width
	tm.Height = height

	spans := history.Spans()
	window := zoomLevels[tm.ZoomIdx]
	now := time.Now()
	windowStart := now.Add(-window)

	// Group spans by project
	projectSpans := make(map[string][]AgentSpan)
	projectOrder := make([]string, 0)
	for _, s := range spans {
		end := s.EndedAt
		if end.IsZero() {
			end = now
		}
		// Skip spans entirely outside the window
		if end.Before(windowStart) || s.StartedAt.After(now) {
			continue
		}
		if _, ok := projectSpans[s.ProjectName]; !ok {
			projectOrder = append(projectOrder, s.ProjectName)
		}
		projectSpans[s.ProjectName] = append(projectSpans[s.ProjectName], s)
	}
	sort.Strings(projectOrder)

	// Clamp selection
	if tm.Selected >= len(projectOrder) {
		tm.Selected = len(projectOrder) - 1
	}
	if tm.Selected < 0 {
		tm.Selected = 0
	}

	// Timeline bar width from responsive layout
	ly := NewLayout(width, height)
	nameCol := ly.TimelineNameCol
	barWidth := ly.TimelineBarWidth

	// Clamp cursor
	if tm.CursorCol >= barWidth {
		tm.CursorCol = barWidth - 1
	}

	var b strings.Builder

	// ── Title bar ──
	titleLeft := Class("section-title").Render("  Project Timeline")
	zoomPill := Pill(fmt.Sprintf(" %s ", zoomLabel(window)), Cyan, BadgeCyanBg)
	nowIndicator := lipgloss.NewStyle().Foreground(Amber).Bold(true).Render("Now")
	titleRight := zoomPill + "  " + nowIndicator + " " +
		lipgloss.NewStyle().Foreground(Amber).Render("▼")

	titleGap := width - lipgloss.Width(titleLeft) - lipgloss.Width(titleRight) - 2
	if titleGap < 1 {
		titleGap = 1
	}
	b.WriteString(titleLeft + repeatStr(" ", titleGap) + titleRight + "\n")

	// Top ruler
	b.WriteString(repeatStr(" ", nameCol+2) + HLine(barWidth, Muted) + "\n")

	if len(projectOrder) == 0 {
		b.WriteString("\n" + Class("dim").Render("  No agent activity in the last "+zoomLabel(window)+".") + "\n")
		b.WriteString(Class("faint").Render("  Dispatch tasks to see timeline activity.") + "\n")
		return b.String()
	}

	// ── Render each project row ──
	maxRows := height - 8
	if maxRows < 3 {
		maxRows = 3
	}

	// Tooltip for cursor hover
	var tooltipSpan *AgentSpan

	for ri, projName := range projectOrder {
		if ri >= maxRows {
			break
		}

		// Project name
		nameStyle := lipgloss.NewStyle().Foreground(White).Bold(true)
		indicator := "  "
		if ri == tm.Selected {
			nameStyle = lipgloss.NewStyle().Foreground(Cyan).Bold(true)
			indicator = lipgloss.NewStyle().Foreground(Cyan).Bold(true).Render("▌ ")
		}

		name := projName
		if len(name) > nameCol-3 {
			name = name[:nameCol-6] + "..."
		}
		nameRendered := indicator + nameStyle.Width(nameCol-2).Render(name)

		// Build the timeline bar
		pSpans := projectSpans[projName]
		bar := renderTimelineBar(pSpans, windowStart, now, barWidth)

		// Overlay cursor if in this row
		if tm.CursorCol >= 0 && ri == tm.Selected {
			cursorTime := windowStart.Add(time.Duration(float64(tm.CursorCol) / float64(barWidth) * float64(window)))
			// Check if cursor is over a span
			for _, s := range pSpans {
				end := s.EndedAt
				if end.IsZero() {
					end = now
				}
				if !cursorTime.Before(s.StartedAt) && cursorTime.Before(end) {
					ts := s
					tooltipSpan = &ts
					break
				}
			}
		}

		b.WriteString(nameRendered + bar + "\n")

		// Agent labels row (dimmed, below the bar)
		labelRow := renderAgentLabels(pSpans, windowStart, now, barWidth, nameCol)
		if labelRow != "" {
			b.WriteString(labelRow + "\n")
		}
	}

	// Bottom ruler
	b.WriteString(repeatStr(" ", nameCol+2) + HLine(barWidth, Muted) + "\n")

	// Time axis
	axisRow := renderTimeAxis(windowStart, now, barWidth, nameCol)
	b.WriteString(axisRow + "\n")

	// ── Cursor tooltip ──
	if tm.CursorCol >= 0 && tooltipSpan != nil {
		b.WriteString("\n")
		b.WriteString(renderSpanTooltip(tooltipSpan, now))
	} else if tm.CursorCol >= 0 {
		cursorTime := windowStart.Add(time.Duration(float64(tm.CursorCol) / float64(barWidth) * float64(window)))
		b.WriteString("\n")
		b.WriteString(Class("dim").Render(fmt.Sprintf("  %s  (no activity)", cursorTime.Format("15:04:05"))))
	}

	// ── Aggregate activity sparkline (ntcharts braille) ──
	remaining := height - (len(projectOrder)*2 + 10)
	if remaining > 2 && barWidth > 10 {
		activityData := buildActivityBuckets(spans, windowStart, now, barWidth)
		activityChart := RenderSparklineBraille(activityData, barWidth, 2, Cyan)
		b.WriteString(repeatStr(" ", nameCol+2) + activityChart + "\n")
		b.WriteString(repeatStr(" ", nameCol+2) +
			Class("faint").Render("agent activity") + "\n")
	}

	// ── Session stats summary ──
	if remaining > 5 && len(spans) > 0 {
		b.WriteString("\n")
		b.WriteString(renderSessionStats(spans, now))
	}

	return b.String()
}

// buildActivityBuckets computes per-column agent counts for the activity sparkline.
// Each column represents a time slice; the value is how many agents were active.
func buildActivityBuckets(spans []AgentSpan, windowStart, now time.Time, bucketCount int) []int {
	window := now.Sub(windowStart)
	if window <= 0 || bucketCount <= 0 {
		return nil
	}
	buckets := make([]int, bucketCount)
	sliceDur := window / time.Duration(bucketCount)

	for _, s := range spans {
		start := s.StartedAt
		if start.Before(windowStart) {
			start = windowStart
		}
		end := s.EndedAt
		if end.IsZero() {
			end = now
		}
		if end.After(now) {
			end = now
		}
		startCol := int(start.Sub(windowStart) / sliceDur)
		endCol := int(end.Sub(windowStart) / sliceDur)
		if startCol < 0 {
			startCol = 0
		}
		if endCol >= bucketCount {
			endCol = bucketCount - 1
		}
		for c := startCol; c <= endCol; c++ {
			buckets[c]++
		}
	}
	return buckets
}

// renderTimelineBar builds the bar string for a project.
func renderTimelineBar(spans []AgentSpan, windowStart, now time.Time, barWidth int) string {
	window := now.Sub(windowStart)
	cells := make([]rune, barWidth)
	cellStatus := make([]string, barWidth)

	// Initialize to gap
	for i := range cells {
		cells[i] = '░'
		cellStatus[i] = ""
	}

	// Fill in spans
	for _, s := range spans {
		start := s.StartedAt
		if start.Before(windowStart) {
			start = windowStart
		}
		end := s.EndedAt
		if end.IsZero() {
			end = now
		}
		if end.After(now) {
			end = now
		}

		startCol := int(float64(start.Sub(windowStart)) / float64(window) * float64(barWidth))
		endCol := int(float64(end.Sub(windowStart)) / float64(window) * float64(barWidth))
		if startCol < 0 {
			startCol = 0
		}
		if endCol > barWidth {
			endCol = barWidth
		}

		for c := startCol; c < endCol; c++ {
			if s.EndedAt.IsZero() {
				// Active
				cells[c] = '█'
				cellStatus[c] = s.Status
			} else {
				// Completed
				cells[c] = '▓'
				cellStatus[c] = s.Status
			}
		}

		// Active right edge marker
		if s.EndedAt.IsZero() && endCol > 0 && endCol <= barWidth {
			idx := endCol - 1
			if idx >= 0 && idx < barWidth {
				cells[idx] = '▶'
				cellStatus[idx] = s.Status
			}
		}
	}

	// Render with colors
	var result strings.Builder
	for i, ch := range cells {
		st := cellStatus[i]
		charStr := string(ch)
		switch {
		case ch == '░':
			result.WriteString(lipgloss.NewStyle().Foreground(Muted).Render(charStr))
		case st == "working" || st == "active":
			result.WriteString(lipgloss.NewStyle().Foreground(Amber).Bold(true).Render(charStr))
		case st == "done" || st == "complete":
			result.WriteString(lipgloss.NewStyle().Foreground(Green).Render(charStr))
		case st == "error" || st == "disconnected" || st == "cancelled":
			result.WriteString(lipgloss.NewStyle().Foreground(Rose).Render(charStr))
		default:
			result.WriteString(lipgloss.NewStyle().Foreground(Dim).Render(charStr))
		}
	}

	return result.String()
}

// renderAgentLabels draws dimmed session ID snippets below the bar.
func renderAgentLabels(spans []AgentSpan, windowStart, now time.Time, barWidth, nameCol int) string {
	window := now.Sub(windowStart)
	if window <= 0 {
		return ""
	}

	type label struct {
		col  int
		text string
	}

	var labels []label
	for _, s := range spans {
		start := s.StartedAt
		if start.Before(windowStart) {
			start = windowStart
		}
		end := s.EndedAt
		if end.IsZero() {
			end = now
		}

		startCol := int(float64(start.Sub(windowStart)) / float64(window) * float64(barWidth))
		endCol := int(float64(end.Sub(windowStart)) / float64(window) * float64(barWidth))
		midCol := (startCol + endCol) / 2

		sid := s.SessionID
		if len(sid) > 10 {
			sid = sid[:10]
		}

		// Only show if there's room
		spanWidth := endCol - startCol
		if spanWidth >= 3 {
			labels = append(labels, label{col: midCol, text: sid})
		}
	}

	if len(labels) == 0 {
		return ""
	}

	// Render into a line buffer
	line := make([]byte, barWidth+nameCol+4)
	for i := range line {
		line[i] = ' '
	}

	for _, lb := range labels {
		pos := lb.col + nameCol + 2
		text := lb.text
		// Don't overflow
		if pos+len(text) > len(line) {
			continue
		}
		if pos < 0 {
			continue
		}
		copy(line[pos:], text)
	}

	return Class("faint").Render(string(line))
}

// renderTimeAxis draws the time axis at the bottom.
func renderTimeAxis(windowStart, now time.Time, barWidth, nameCol int) string {
	window := now.Sub(windowStart)
	pad := repeatStr(" ", nameCol+2)

	// Choose tick count based on bar width
	ticks := 5
	if barWidth < 40 {
		ticks = 3
	}

	line := make([]byte, barWidth)
	for i := range line {
		line[i] = ' '
	}

	labels := make([]string, 0, ticks+1)
	positions := make([]int, 0, ticks+1)

	for i := 0; i <= ticks; i++ {
		frac := float64(i) / float64(ticks)
		t := windowStart.Add(time.Duration(frac * float64(window)))
		col := int(frac * float64(barWidth-1))

		var label string
		elapsed := now.Sub(t)
		if elapsed < time.Minute {
			label = "now"
		} else if elapsed < time.Hour {
			label = fmt.Sprintf("%dm ago", int(elapsed.Minutes()))
		} else {
			label = fmt.Sprintf("%dh%dm", int(elapsed.Hours()), int(elapsed.Minutes())%60)
		}

		labels = append(labels, label)
		positions = append(positions, col)
	}

	// Build the axis string
	axisLine := make([]byte, barWidth)
	for i := range axisLine {
		axisLine[i] = ' '
	}

	for i, label := range labels {
		pos := positions[i]
		// Center label around position
		start := pos - len(label)/2
		if start < 0 {
			start = 0
		}
		if start+len(label) > barWidth {
			start = barWidth - len(label)
		}
		if start < 0 {
			continue
		}
		copy(axisLine[start:], label)
	}

	return pad + Class("dim").Render(string(axisLine))
}

// renderSpanTooltip renders detail info for the hovered span.
func renderSpanTooltip(s *AgentSpan, now time.Time) string {
	var b strings.Builder

	labelStyle := lipgloss.NewStyle().Foreground(Dim).Width(14)
	valStyle := lipgloss.NewStyle().Foreground(White)

	sid := s.SessionID
	if len(sid) > 24 {
		sid = sid[:24] + "..."
	}

	b.WriteString("  " + labelStyle.Render("Session") + valStyle.Render(sid) + "\n")
	b.WriteString("  " + labelStyle.Render("Project") + valStyle.Render(s.ProjectName) + "\n")

	task := s.Task
	if len(task) > 50 {
		task = task[:47] + "..."
	}
	b.WriteString("  " + labelStyle.Render("Task") + valStyle.Render(task) + "\n")

	b.WriteString("  " + labelStyle.Render("Status") + StatusColor(s.Status).Render(s.Status) + "\n")

	if s.Model != "" {
		b.WriteString("  " + labelStyle.Render("Model") + valStyle.Render(s.Model) + "\n")
	}

	// Duration
	end := s.EndedAt
	if end.IsZero() {
		end = now
	}
	dur := end.Sub(s.StartedAt)
	b.WriteString("  " + labelStyle.Render("Duration") + valStyle.Render(formatDuration(dur)) + "\n")

	// Time range
	timeRange := s.StartedAt.Format("15:04:05") + " - "
	if s.EndedAt.IsZero() {
		timeRange += "now"
	} else {
		timeRange += s.EndedAt.Format("15:04:05")
	}
	b.WriteString("  " + labelStyle.Render("Time") + Class("faint").Render(timeRange) + "\n")

	// Turns + cost estimate
	b.WriteString("  " + labelStyle.Render("Turns") + valStyle.Render(fmt.Sprintf("%d", s.TurnCount)) + "\n")
	cost := EstimateCost(s.Model, s.TurnCount)
	if cost > 0 {
		b.WriteString("  " + labelStyle.Render("Est. Cost") + lipgloss.NewStyle().Foreground(Amber).Render(FormatCost(cost)+" (est)") + "\n")
	}

	return b.String()
}

// renderSessionStats renders aggregate stats from all spans.
func renderSessionStats(spans []AgentSpan, now time.Time) string {
	var b strings.Builder

	b.WriteString("  " + Class("section-title").Render("Session Stats") + "\n")
	b.WriteString("  " + HLine(40, Muted) + "\n")

	labelStyle := lipgloss.NewStyle().Foreground(Dim).Width(22)
	valStyle := lipgloss.NewStyle().Foreground(White).Bold(true)

	// Filter to today
	today := time.Now().Truncate(24 * time.Hour)
	var todaySpans []AgentSpan
	activeCount := 0
	for _, s := range spans {
		if s.StartedAt.After(today) || s.EndedAt.IsZero() {
			todaySpans = append(todaySpans, s)
		}
		if s.EndedAt.IsZero() {
			activeCount++
		}
	}

	b.WriteString("  " + labelStyle.Render("Total sessions today:") + valStyle.Render(fmt.Sprintf("%d", len(todaySpans))) + "\n")
	b.WriteString("  " + labelStyle.Render("Active now:") + valStyle.Render(fmt.Sprintf("%d", activeCount)) + "\n")

	// Average duration (completed only)
	var totalDur time.Duration
	var longestDur time.Duration
	var longestSID string
	completed := 0
	totalTurns := 0

	// Project counts
	projectSessions := make(map[string]int)

	for _, s := range todaySpans {
		projectSessions[s.ProjectName]++
		totalTurns += s.TurnCount

		end := s.EndedAt
		if end.IsZero() {
			end = now
		}
		dur := end.Sub(s.StartedAt)
		totalDur += dur
		completed++

		if dur > longestDur {
			longestDur = dur
			longestSID = s.SessionID
		}
	}

	if completed > 0 {
		avg := totalDur / time.Duration(completed)
		b.WriteString("  " + labelStyle.Render("Avg duration:") + valStyle.Render(formatDuration(avg)) + "\n")

		longestLabel := formatDuration(longestDur)
		if longestSID != "" {
			sid := longestSID
			if len(sid) > 12 {
				sid = sid[:12] + "..."
			}
			longestLabel += " (" + sid + ")"
		}
		b.WriteString("  " + labelStyle.Render("Longest session:") + valStyle.Render(longestLabel) + "\n")
	}

	b.WriteString("  " + labelStyle.Render("Total tool calls:") + valStyle.Render(fmt.Sprintf("%d", totalTurns)) + "\n")

	// Most active project
	if len(projectSessions) > 0 {
		var maxProj string
		var maxCount int
		for p, c := range projectSessions {
			if c > maxCount {
				maxCount = c
				maxProj = p
			}
		}
		b.WriteString("  " + labelStyle.Render("Most active project:") +
			valStyle.Render(fmt.Sprintf("%s (%d sessions)", maxProj, maxCount)) + "\n")
	}

	// Total cost estimate
	var totalCost float64
	for _, s := range todaySpans {
		totalCost += EstimateCost(s.Model, s.TurnCount)
	}
	if totalCost > 0 {
		b.WriteString("  " + labelStyle.Render("Est. cost today:") +
			lipgloss.NewStyle().Foreground(Amber).Bold(true).Render(FormatCost(totalCost)+" (est)") + "\n")
	}

	return b.String()
}

// formatDuration formats a duration as "4m 23s" style.
func formatDuration(d time.Duration) string {
	if d < time.Second {
		return "0s"
	}
	d = d.Round(time.Second)
	if d < time.Minute {
		return fmt.Sprintf("%ds", int(d.Seconds()))
	}
	mins := int(d.Minutes())
	secs := int(d.Seconds()) % 60
	if mins >= 60 {
		hours := mins / 60
		mins = mins % 60
		return fmt.Sprintf("%dh %dm %ds", hours, mins, secs)
	}
	return fmt.Sprintf("%dm %ds", mins, secs)
}
