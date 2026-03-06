package tui

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/NimbleMarkets/ntcharts/sparkline"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/scoady/claudectl/internal/api"
)

// ── Health status constants ─────────────────────────────────────────────────

type HealthStatus int

const (
	HealthUp HealthStatus = iota
	HealthDown
	HealthUnknown
)

// ── Targets model ───────────────────────────────────────────────────────────

// TargetEntry represents a single agent rendered as a Prometheus-style target.
type TargetEntry struct {
	Agent  api.Agent
	Health HealthStatus
	Spark  sparkline.Model
}

// TargetGroup groups agents by project.
type TargetGroup struct {
	Project   string
	Targets   []TargetEntry
	Collapsed bool
}

// TargetsModel holds state for the targets health screen.
type TargetsModel struct {
	Groups   []TargetGroup
	Agents   []api.Agent
	Selected int  // flat index across all visible targets
	GroupIdx int  // which group is selected (for Tab jumping)
	Expanded int  // flat index of expanded target (-1 = none)

	lastRefresh time.Time
}

// NewTargetsModel creates a fresh targets model from the current agent list.
func NewTargetsModel(agents []api.Agent) TargetsModel {
	m := TargetsModel{
		Agents:   agents,
		Selected: 0,
		Expanded: -1,
	}
	m.rebuildGroups()
	return m
}

// UpdateAgents refreshes the agent data and rebuilds groups.
func (m *TargetsModel) UpdateAgents(agents []api.Agent) {
	m.Agents = agents
	m.rebuildGroups()
	m.lastRefresh = time.Now()
}

func (m *TargetsModel) rebuildGroups() {
	// Group agents by project
	groupMap := make(map[string][]api.Agent)
	var order []string
	for _, ag := range m.Agents {
		proj := ag.ProjectName
		if proj == "" {
			proj = "(unknown)"
		}
		if _, exists := groupMap[proj]; !exists {
			order = append(order, proj)
		}
		groupMap[proj] = append(groupMap[proj], ag)
	}
	sort.Strings(order)

	// Preserve collapsed state from old groups
	oldCollapsed := make(map[string]bool)
	for _, g := range m.Groups {
		oldCollapsed[g.Project] = g.Collapsed
	}

	m.Groups = nil
	for _, proj := range order {
		agents := groupMap[proj]
		var targets []TargetEntry
		for _, ag := range agents {
			targets = append(targets, TargetEntry{
				Agent:  ag,
				Health: classifyHealth(ag),
				Spark:  buildSparkline(ag),
			})
		}
		m.Groups = append(m.Groups, TargetGroup{
			Project:   proj,
			Targets:   targets,
			Collapsed: oldCollapsed[proj],
		})
	}
}

// classifyHealth maps agent status to a health classification.
func classifyHealth(ag api.Agent) HealthStatus {
	switch ag.Status {
	case "working", "active":
		return HealthUp
	case "idle":
		return HealthUp
	case "done", "complete":
		return HealthUp
	case "error", "disconnected", "cancelled":
		return HealthDown
	default:
		return HealthUnknown
	}
}

// buildSparkline creates an ntcharts sparkline from turn count data.
func buildSparkline(ag api.Agent) sparkline.Model {
	width := 8
	height := 1
	s := sparkline.New(width, height)
	s.Style = lipgloss.NewStyle().Foreground(Green)

	// Simulate activity curve from turn count + milestones
	turns := ag.TurnCount
	milestones := len(ag.Milestones)
	if turns <= 0 {
		turns = 1
	}

	// Generate a simple activity pattern based on available data
	points := width
	for i := 0; i < points; i++ {
		// Create a rising curve pattern
		progress := float64(i+1) / float64(points)
		val := progress * float64(turns) / float64(points)
		// Add some variation from milestone count
		if milestones > 0 && i%2 == 0 {
			val += float64(milestones) / float64(points)
		}
		if val < 0.1 {
			val = 0.1
		}
		s.Push(val)
	}
	s.Draw()
	return s
}

// TotalVisible returns the total number of navigable items.
func (m *TargetsModel) TotalVisible() int {
	count := 0
	for _, g := range m.Groups {
		if !g.Collapsed {
			count += len(g.Targets)
		}
	}
	return count
}

// ClampSelection keeps selection in bounds.
func (m *TargetsModel) ClampSelection() {
	total := m.TotalVisible()
	if m.Selected >= total {
		m.Selected = total - 1
	}
	if m.Selected < 0 {
		m.Selected = 0
	}
}

// SelectedTarget returns the currently selected target or nil.
func (m *TargetsModel) SelectedTarget() *TargetEntry {
	idx := 0
	for gi := range m.Groups {
		if m.Groups[gi].Collapsed {
			continue
		}
		for ti := range m.Groups[gi].Targets {
			if idx == m.Selected {
				return &m.Groups[gi].Targets[ti]
			}
			idx++
		}
	}
	return nil
}

// JumpNextGroup moves selection to the first target of the next group.
func (m *TargetsModel) JumpNextGroup() {
	if len(m.Groups) == 0 {
		return
	}

	// Find which group current selection is in
	idx := 0
	currentGroup := 0
	for gi := range m.Groups {
		if m.Groups[gi].Collapsed {
			continue
		}
		for range m.Groups[gi].Targets {
			if idx == m.Selected {
				currentGroup = gi
			}
			idx++
		}
	}

	// Jump to start of next non-collapsed group
	nextGroup := -1
	for gi := currentGroup + 1; gi < len(m.Groups); gi++ {
		if !m.Groups[gi].Collapsed {
			nextGroup = gi
			break
		}
	}
	// Wrap around
	if nextGroup == -1 {
		for gi := 0; gi <= currentGroup; gi++ {
			if !m.Groups[gi].Collapsed {
				nextGroup = gi
				break
			}
		}
	}
	if nextGroup == -1 {
		return
	}

	// Calculate flat index of first target in that group
	flatIdx := 0
	for gi := 0; gi < nextGroup; gi++ {
		if !m.Groups[gi].Collapsed {
			flatIdx += len(m.Groups[gi].Targets)
		}
	}
	m.Selected = flatIdx
}

// ToggleCollapse toggles the group that contains the current selection.
func (m *TargetsModel) ToggleCollapse() {
	idx := 0
	for gi := range m.Groups {
		if m.Groups[gi].Collapsed {
			continue
		}
		for range m.Groups[gi].Targets {
			if idx == m.Selected {
				m.Groups[gi].Collapsed = !m.Groups[gi].Collapsed
				m.ClampSelection()
				return
			}
			idx++
		}
	}
}

// ToggleExpand toggles expanded detail view for the selected target.
func (m *TargetsModel) ToggleExpand() {
	if m.Expanded == m.Selected {
		m.Expanded = -1
	} else {
		m.Expanded = m.Selected
	}
}

// ── Rendering ───────────────────────────────────────────────────────────────

// RenderTargets renders the targets health screen.
func RenderTargets(m *TargetsModel, width, height int) string {
	var b strings.Builder

	// ── Summary bar ──
	upCount, downCount, unknownCount := 0, 0, 0
	for _, g := range m.Groups {
		for _, t := range g.Targets {
			switch t.Health {
			case HealthUp:
				upCount++
			case HealthDown:
				downCount++
			case HealthUnknown:
				unknownCount++
			}
		}
	}

	summary := "  "
	summary += lipgloss.NewStyle().Foreground(Green).Bold(true).Render("●") + " "
	summary += lipgloss.NewStyle().Foreground(Green).Bold(true).Render(fmt.Sprintf("%d/%d UP", upCount, upCount+downCount+unknownCount))
	summary += "   "
	if downCount > 0 {
		summary += lipgloss.NewStyle().Foreground(Rose).Bold(true).Render("○") + " "
		summary += lipgloss.NewStyle().Foreground(Rose).Bold(true).Render(fmt.Sprintf("%d DOWN", downCount))
		summary += "   "
	}
	if unknownCount > 0 {
		summary += lipgloss.NewStyle().Foreground(Amber).Bold(true).Render("◌") + " "
		summary += lipgloss.NewStyle().Foreground(Amber).Bold(true).Render(fmt.Sprintf("%d UNKNOWN", unknownCount))
		summary += "   "
	}

	// Refresh indicator
	refreshStr := DimStyle.Render("Refresh: 5s")
	if !m.lastRefresh.IsZero() {
		ago := time.Since(m.lastRefresh).Round(time.Second)
		refreshStr = DimStyle.Render(fmt.Sprintf("Last: %s ago", ago))
	}

	// Right-align refresh
	summaryW := lipgloss.Width(summary)
	refreshW := lipgloss.Width(refreshStr)
	gap := width - summaryW - refreshW - 2
	if gap < 1 {
		gap = 1
	}
	b.WriteString(summary + repeatStr(" ", gap) + refreshStr + "\n")
	b.WriteString(HLine(width, Muted) + "\n")

	if len(m.Groups) == 0 {
		b.WriteString("\n" + DimStyle.Render("  No agents found. Dispatch a task to get started.") + "\n")
		return b.String()
	}

	// ── Render groups ──
	cardWidth := width - 6
	if cardWidth < 40 {
		cardWidth = 40
	}
	if cardWidth > width-2 {
		cardWidth = width - 2
	}

	flatIdx := 0
	linesUsed := 3 // summary + hline + blank
	maxLines := height - 2

	for gi := range m.Groups {
		group := &m.Groups[gi]
		if linesUsed >= maxLines {
			break
		}

		// Group header
		collapseIcon := "▾"
		if group.Collapsed {
			collapseIcon = "▸"
		}
		groupHeader := " " +
			lipgloss.NewStyle().Foreground(Purple).Bold(true).Render(collapseIcon) + " " +
			lipgloss.NewStyle().Foreground(White).Bold(true).Render(group.Project) + " " +
			Pill(fmt.Sprintf(" %d agents ", len(group.Targets)), Cyan, BadgeCyanBg)

		b.WriteString("\n" + groupHeader + "\n")
		linesUsed += 2

		if group.Collapsed {
			continue
		}

		// Render target cards within group
		for ti := range group.Targets {
			if linesUsed >= maxLines-3 {
				remaining := m.TotalVisible() - flatIdx
				if remaining > 0 {
					b.WriteString(DimStyle.Render(fmt.Sprintf("  ... %d more targets", remaining)) + "\n")
				}
				return b.String()
			}

			target := &group.Targets[ti]
			isSelected := flatIdx == m.Selected
			isExpanded := flatIdx == m.Expanded

			card := renderTargetCard(target, cardWidth, isSelected, isExpanded)
			b.WriteString(card)

			// Count lines in card
			cardLines := strings.Count(card, "\n")
			linesUsed += cardLines

			flatIdx++
		}
	}

	return b.String()
}

// renderTargetCard renders a single agent target card.
func renderTargetCard(t *TargetEntry, width int, selected, expanded bool) string {
	ag := t.Agent

	// Choose border style
	borderFg := BorderColor
	bg := Surface0
	if selected {
		borderFg = GlowBorder
		bg = Surface1
	}

	// Health dot
	var healthDot, healthLabel string
	var healthColor lipgloss.Color
	switch t.Health {
	case HealthUp:
		healthDot = "●"
		healthLabel = "UP"
		healthColor = Green
	case HealthDown:
		healthDot = "○"
		healthLabel = "DOWN"
		healthColor = Rose
	case HealthUnknown:
		healthDot = "◌"
		healthLabel = "UNKNOWN"
		healthColor = Amber
	}

	dotStr := lipgloss.NewStyle().Foreground(healthColor).Bold(true).Render(healthDot)
	labelStr := lipgloss.NewStyle().Foreground(healthColor).Bold(true).Render(healthLabel)

	// Session ID (truncated)
	sid := ag.SessionID
	maxSID := 18
	if len(sid) > maxSID {
		sid = sid[:maxSID-2] + ".."
	}
	sidStr := lipgloss.NewStyle().Foreground(Dim).Render(sid)

	// Model name
	model := ag.Model
	if model == "" {
		model = "unknown"
	}
	modelStr := lipgloss.NewStyle().Foreground(SubText).Render(model)

	// Sparkline from ntcharts
	sparkStr := t.Spark.View()

	// Turn count
	turnStr := lipgloss.NewStyle().Foreground(SubText).Render(fmt.Sprintf("%d turns", ag.TurnCount))

	// Cost estimate
	cost := EstimateCost(ag.Model, ag.TurnCount)
	costStr := lipgloss.NewStyle().Foreground(Amber).Render(FormatCost(cost))

	// ── Line 1: health dot + status + SID + model + sparkline + turns + cost ──
	line1 := "  " + dotStr + " " + labelStr + "  " + sidStr + "  " + modelStr + "  " + sparkStr + "  " + turnStr + "  " + costStr

	// ── Line 2: last seen + task ──
	lastSeen := renderLastSeen(ag)
	lastSeenStr := DimStyle.Render("Last seen: " + lastSeen)

	// Task or error on line 2
	taskStr := ""
	if ag.Status == "error" || ag.Status == "disconnected" || ag.Status == "cancelled" {
		errText := "Error: " + ag.Status
		if ag.LastChunk != "" {
			errText = "Error: " + truncateStr(ag.LastChunk, width-30)
		}
		taskStr = lipgloss.NewStyle().Foreground(Rose).Render(errText)
	} else {
		task := ag.Task
		maxTask := width - lipgloss.Width(lastSeenStr) - 16
		if maxTask < 10 {
			maxTask = 10
		}
		if len(task) > maxTask {
			task = task[:maxTask-3] + "..."
		}
		taskStr = DimStyle.Render("Task: " + task)
	}

	line2 := "       " + lastSeenStr + "   " + taskStr

	// Build card content
	var content string
	if expanded {
		content = line1 + "\n" + line2 + "\n" + renderExpandedDetails(ag, width-8)
	} else {
		content = line1 + "\n" + line2
	}

	// Render with border
	cardStyle := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(borderFg).
		Background(bg).
		Width(width - 2).
		Padding(0, 1)

	return "  " + cardStyle.Render(content) + "\n"
}

// renderLastSeen returns a human-friendly "X ago" string.
func renderLastSeen(ag api.Agent) string {
	if ag.StartedAt == "" {
		return "unknown"
	}
	for _, layout := range []string{
		time.RFC3339, time.RFC3339Nano,
		"2006-01-02T15:04:05", "2006-01-02 15:04:05",
	} {
		t, err := time.Parse(layout, ag.StartedAt)
		if err == nil {
			d := time.Since(t)
			if d < time.Minute {
				return fmt.Sprintf("%ds ago", int(d.Seconds()))
			}
			if d < time.Hour {
				return fmt.Sprintf("%dm ago", int(d.Minutes()))
			}
			return fmt.Sprintf("%dh%dm ago", int(d.Hours()), int(d.Minutes())%60)
		}
	}
	return "unknown"
}

// renderExpandedDetails renders full detail lines for an expanded target.
func renderExpandedDetails(ag api.Agent, maxWidth int) string {
	var lines []string

	// Full task
	if ag.Task != "" {
		taskLines := wrapText(ag.Task, maxWidth-4)
		lines = append(lines, "")
		lines = append(lines, lipgloss.NewStyle().Foreground(Purple).Bold(true).Render("  Task:"))
		for _, tl := range taskLines {
			lines = append(lines, SubStyle.Render("    "+tl))
		}
	}

	// Phase
	if ag.Phase != "" {
		lines = append(lines, lipgloss.NewStyle().Foreground(Purple).Bold(true).Render("  Phase: ")+SubStyle.Render(ag.Phase))
	}

	// Controller flag
	if ag.IsController {
		lines = append(lines, lipgloss.NewStyle().Foreground(Purple).Bold(true).Render("  Role: ")+
			lipgloss.NewStyle().Foreground(Purple).Render("Controller"))
	}

	// Full session ID
	lines = append(lines, lipgloss.NewStyle().Foreground(Purple).Bold(true).Render("  Session: ")+DimStyle.Render(ag.SessionID))

	// Milestones
	if len(ag.Milestones) > 0 {
		lines = append(lines, lipgloss.NewStyle().Foreground(Purple).Bold(true).Render("  Milestones:"))
		maxMS := 8
		if len(ag.Milestones) < maxMS {
			maxMS = len(ag.Milestones)
		}
		// Show last N milestones
		start := len(ag.Milestones) - maxMS
		for _, ms := range ag.Milestones[start:] {
			msText := ms
			if len(msText) > maxWidth-6 {
				msText = msText[:maxWidth-9] + "..."
			}
			lines = append(lines, FaintStyle.Render("    "+msText))
		}
		if len(ag.Milestones) > maxMS {
			lines = append(lines, DimStyle.Render(fmt.Sprintf("    ... and %d more", len(ag.Milestones)-maxMS)))
		}
	}

	// Last chunk (if error)
	if ag.LastChunk != "" && (ag.Status == "error" || ag.Status == "disconnected") {
		lines = append(lines, lipgloss.NewStyle().Foreground(Rose).Bold(true).Render("  Error:"))
		errLines := wrapText(ag.LastChunk, maxWidth-6)
		for _, el := range errLines {
			lines = append(lines, lipgloss.NewStyle().Foreground(Rose).Render("    "+el))
		}
	}

	return strings.Join(lines, "\n")
}

// handleTargetsKey processes key input for the targets screen.
func (a *App) handleTargetsKey(key string) (tea.Model, tea.Cmd) {
	switch key {
	case "q", "esc":
		a.screen = ScreenDashboard
		return a, nil
	case "j", "down":
		a.targets.Selected++
		a.targets.ClampSelection()
		return a, nil
	case "k", "up":
		if a.targets.Selected > 0 {
			a.targets.Selected--
		}
		return a, nil
	case "tab":
		a.targets.JumpNextGroup()
		return a, nil
	case "enter":
		a.targets.ToggleExpand()
		return a, nil
	case "c":
		a.targets.ToggleCollapse()
		return a, nil
	case "r":
		// Force refresh
		a.targets.UpdateAgents(a.dashboard.Agents)
		a.statusMsg = "Targets refreshed"
		a.statusTime = time.Now()
		return a, a.fetchData()
	case "l":
		// Watch logs for selected target
		t := a.targets.SelectedTarget()
		if t != nil {
			ag := t.Agent
			return a, func() tea.Msg {
				return NavigateMsg{Screen: ScreenWatch, Agent: &ag}
			}
		}
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

// truncateStr truncates a string to max chars with ellipsis.
func truncateStr(s string, max int) string {
	if max <= 3 {
		return s
	}
	if len(s) > max {
		return s[:max-3] + "..."
	}
	return s
}
