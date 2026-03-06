package tui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/scoady/claudectl/internal/api"
)

// AgentsModel is the all-agents list screen.
type AgentsModel struct {
	Agents   []api.Agent
	Selected int
	Filter   string
}

// FilteredAgents returns agents matching the current filter.
func (a *AgentsModel) FilteredAgents() []api.Agent {
	if a.Filter == "" {
		return a.Agents
	}
	f := strings.ToLower(a.Filter)
	var out []api.Agent
	for _, ag := range a.Agents {
		if strings.Contains(strings.ToLower(ag.SessionID), f) ||
			strings.Contains(strings.ToLower(ag.ProjectName), f) ||
			strings.Contains(strings.ToLower(ag.Task), f) ||
			strings.Contains(strings.ToLower(ag.Status), f) {
			out = append(out, ag)
		}
	}
	return out
}

// SelectedAgent returns the currently selected agent or nil.
func (a *AgentsModel) SelectedAgent() *api.Agent {
	filtered := a.FilteredAgents()
	if a.Selected >= 0 && a.Selected < len(filtered) {
		ag := filtered[a.Selected]
		return &ag
	}
	return nil
}

// ClampSelection ensures selection is within bounds.
func (a *AgentsModel) ClampSelection() {
	filtered := a.FilteredAgents()
	if a.Selected >= len(filtered) {
		a.Selected = len(filtered) - 1
	}
	if a.Selected < 0 {
		a.Selected = 0
	}
}

// RenderAgents renders the agents list screen.
func RenderAgents(a *AgentsModel, width, height int) string {
	filtered := a.FilteredAgents()

	// ── Status summary badges ──
	var working, idle, done, errCount int
	for _, ag := range filtered {
		switch ag.Status {
		case "working", "active":
			working++
		case "idle":
			idle++
		case "done", "complete":
			done++
		case "error", "disconnected", "cancelled":
			errCount++
		}
	}

	var summary strings.Builder
	summary.WriteString(" ")
	if working > 0 {
		summary.WriteString(Pill(fmt.Sprintf(" %d active ", working), Amber, BadgeAmberBg) + "  ")
	}
	if idle > 0 {
		summary.WriteString(Pill(fmt.Sprintf(" %d idle ", idle), Cyan, BadgeCyanBg) + "  ")
	}
	if done > 0 {
		summary.WriteString(Pill(fmt.Sprintf(" %d done ", done), Green, BadgeGreenBg) + "  ")
	}
	if errCount > 0 {
		summary.WriteString(Pill(fmt.Sprintf(" %d error ", errCount), Rose, BadgeRoseBg) + "  ")
	}
	if len(filtered) == 0 {
		summary.WriteString(DimStyle.Render("no agents"))
	}

	var b strings.Builder
	b.WriteString(summary.String() + "\n")
	b.WriteString(HLine(minInt(width, 130), Muted) + "\n")

	if len(filtered) == 0 {
		if a.Filter != "" {
			b.WriteString("\n" + DimStyle.Render("  No agents matching filter.") + "\n")
		} else {
			b.WriteString("\n" + DimStyle.Render("  No agents running.") + "\n")
		}
		return b.String()
	}

	// Column widths
	colIndicator := 3
	colSID := 16
	colProject := 16
	colTask := 24
	colStatus := 10
	colPhase := 12
	colModel := 12
	colTurns := 7
	colMilestones := 4
	colElapsed := 9
	colCost := 10

	// Header
	headerPad := repeatStr(" ", colIndicator)
	header := headerPad +
		TableHeaderStyle.Width(colSID).Render("SESSION") +
		TableHeaderStyle.Width(colProject).Render("PROJECT") +
		TableHeaderStyle.Width(colTask).Render("TASK") +
		TableHeaderStyle.Width(colStatus).Render("STATUS") +
		TableHeaderStyle.Width(colPhase).Render("PHASE") +
		TableHeaderStyle.Width(colModel).Render("MODEL") +
		TableHeaderStyle.Width(colTurns).Render("TRNS") +
		TableHeaderStyle.Width(colMilestones).Render("MS") +
		TableHeaderStyle.Width(colElapsed).Render("ELAPSED") +
		TableHeaderStyle.Width(colCost).Render("COST")
	b.WriteString(header + "\n")

	maxVisible := height - 10
	if maxVisible < 5 {
		maxVisible = 5
	}

	startIdx := 0
	if a.Selected >= maxVisible {
		startIdx = a.Selected - maxVisible + 1
	}
	endIdx := startIdx + maxVisible
	if endIdx > len(filtered) {
		endIdx = len(filtered)
	}

	for i := startIdx; i < endIdx; i++ {
		ag := filtered[i]

		// Session ID — monospaced and dimmed
		sid := ag.SessionID
		if len(sid) > colSID-2 {
			sid = sid[:colSID-5] + "..."
		}

		// Task text — visual focus
		task := ag.Task
		if ag.IsController {
			task = lipgloss.NewStyle().Foreground(Purple).Render("[C]") + " " + task
		}
		if len(task) > colTask-2 {
			task = task[:colTask-5] + "..."
		}

		model := ag.Model
		if model == "" {
			model = "-"
		}
		if len(model) > colModel-2 {
			model = model[:colModel-5] + "..."
		}

		// Status-colored left border
		var borderColor lipgloss.Color
		switch ag.Status {
		case "working", "active":
			borderColor = Amber
		case "idle":
			borderColor = Cyan
		case "done", "complete":
			borderColor = Green
		default:
			borderColor = Dim
		}

		// Selection indicator
		indicator := lipgloss.NewStyle().Foreground(borderColor).Render("▎") + "  "
		if i == a.Selected {
			indicator = lipgloss.NewStyle().Foreground(borderColor).Bold(true).Render("▌") +
				lipgloss.NewStyle().Foreground(Cyan).Bold(true).Render("> ")
		}

		// Styles per row
		cellStyle := TableCellStyle
		sidStyle := lipgloss.NewStyle().Foreground(Faint).Padding(0, 1) // dimmed monospace metadata
		taskStyle := lipgloss.NewStyle().Foreground(White).Padding(0, 1) // task is the visual focus
		if i == a.Selected {
			cellStyle = TableSelectedStyle
			sidStyle = lipgloss.NewStyle().Foreground(Dim).Background(Surface1).Padding(0, 1)
			taskStyle = lipgloss.NewStyle().Foreground(White).Bold(true).Background(Surface1).Padding(0, 1)
		}

		row := indicator +
			sidStyle.Width(colSID).Render(sid) +
			cellStyle.Width(colProject).Render(truncate(ag.ProjectName, colProject-2)) +
			taskStyle.Width(colTask).Render(task) +
			cellStyle.Width(colStatus).Render(StatusColor(ag.Status).Render(ag.Status)) +
			cellStyle.Width(colPhase).Render(StatusColor(ag.Phase).Render(ag.Phase)) +
			cellStyle.Width(colModel).Render(model) +
			cellStyle.Width(colTurns).Render(fmt.Sprintf("%d", ag.TurnCount)) +
			cellStyle.Width(colMilestones).Render(fmt.Sprintf("%d", len(ag.Milestones))) +
			cellStyle.Width(colElapsed).Render(ag.ElapsedString()) +
			lipgloss.NewStyle().Foreground(Amber).Padding(0, 1).Width(colCost).Render(FormatCost(EstimateCost(ag.Model, ag.TurnCount)))

		if i == a.Selected {
			row = lipgloss.NewStyle().
				Background(Surface1).
				Width(minInt(width, 140)).
				Render(row)
		}

		b.WriteString(row + "\n")
	}

	if len(filtered) > maxVisible {
		scrollPct := float64(a.Selected) / float64(len(filtered)-1) * 100
		scrollInfo := DimStyle.Render(fmt.Sprintf("  ↕ %d/%d  %.0f%%", a.Selected+1, len(filtered), scrollPct))
		b.WriteString("\n" + scrollInfo + "\n")
	}

	return b.String()
}
