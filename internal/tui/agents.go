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

	if len(filtered) == 0 {
		if a.Filter != "" {
			return DimStyle.Render("  No agents matching filter.\n")
		}
		return DimStyle.Render("  No agents.\n")
	}

	var b strings.Builder

	// Column widths
	colSID := 18
	colProject := 18
	colTask := 25
	colStatus := 10
	colPhase := 12
	colModel := 12
	colTurns := 8
	colMilestones := 4
	colElapsed := 10

	header := TableHeaderStyle.Width(colSID).Render("SESSION") +
		TableHeaderStyle.Width(colProject).Render("PROJECT") +
		TableHeaderStyle.Width(colTask).Render("TASK") +
		TableHeaderStyle.Width(colStatus).Render("STATUS") +
		TableHeaderStyle.Width(colPhase).Render("PHASE") +
		TableHeaderStyle.Width(colModel).Render("MODEL") +
		TableHeaderStyle.Width(colTurns).Render("TURNS") +
		TableHeaderStyle.Width(colMilestones).Render("MS") +
		TableHeaderStyle.Width(colElapsed).Render("ELAPSED")
	b.WriteString(header + "\n")
	b.WriteString(DimStyle.Render(strings.Repeat("─", minInt(width, 130))) + "\n")

	maxVisible := height - 8
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

		sid := ag.SessionID
		if len(sid) > colSID-2 {
			sid = sid[:colSID-5] + "..."
		}

		task := ag.Task
		if ag.IsController {
			task = "[ctrl] " + task
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

		cellStyle := TableCellStyle
		if i == a.Selected {
			cellStyle = TableSelectedStyle
		}

		row := cellStyle.Width(colSID).Render(StatusIcon(ag.Status)+" "+sid) +
			cellStyle.Width(colProject).Render(truncate(ag.ProjectName, colProject-2)) +
			cellStyle.Width(colTask).Render(task) +
			cellStyle.Width(colStatus).Render(StatusColor(ag.Status).Render(ag.Status)) +
			cellStyle.Width(colPhase).Render(StatusColor(ag.Phase).Render(ag.Phase)) +
			cellStyle.Width(colModel).Render(model) +
			cellStyle.Width(colTurns).Render(fmt.Sprintf("%d", ag.TurnCount)) +
			cellStyle.Width(colMilestones).Render(fmt.Sprintf("%d", len(ag.Milestones))) +
			cellStyle.Width(colElapsed).Render(ag.ElapsedString())

		if i == a.Selected {
			row = lipgloss.NewStyle().
				Background(lipgloss.Color("#1e293b")).
				Width(minInt(width, 130)).
				Render(row)
		}

		b.WriteString(row + "\n")
	}

	if len(filtered) > maxVisible {
		scrollPct := float64(a.Selected) / float64(len(filtered)-1) * 100
		b.WriteString(DimStyle.Render(fmt.Sprintf("\n  ↕ %d/%d (%.0f%%)", a.Selected+1, len(filtered), scrollPct)) + "\n")
	}

	return b.String()
}
