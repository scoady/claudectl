package tui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/scoady/claudectl/internal/api"
)

// DashboardModel is the home screen showing project list + stats.
type DashboardModel struct {
	Projects []api.Project
	Agents   []api.Agent
	Stats    *api.StatsResponse
	Selected int
	Filter   string
}

// FilteredProjects returns projects matching the current filter.
func (d *DashboardModel) FilteredProjects() []api.Project {
	if d.Filter == "" {
		return d.Projects
	}
	f := strings.ToLower(d.Filter)
	var out []api.Project
	for _, p := range d.Projects {
		if strings.Contains(strings.ToLower(p.Name), f) ||
			strings.Contains(strings.ToLower(p.Description), f) {
			out = append(out, p)
		}
	}
	return out
}

// SelectedProject returns the currently selected project or nil.
func (d *DashboardModel) SelectedProject() *api.Project {
	filtered := d.FilteredProjects()
	if d.Selected >= 0 && d.Selected < len(filtered) {
		p := filtered[d.Selected]
		return &p
	}
	return nil
}

// ClampSelection ensures selection is within bounds.
func (d *DashboardModel) ClampSelection() {
	filtered := d.FilteredProjects()
	if d.Selected >= len(filtered) {
		d.Selected = len(filtered) - 1
	}
	if d.Selected < 0 {
		d.Selected = 0
	}
}

// RenderDashboard renders the dashboard screen.
func RenderDashboard(d *DashboardModel, width, height int) string {
	var b strings.Builder

	// ── Stats bar ──
	if d.Stats != nil {
		projCount := Pill(fmt.Sprintf(" %d projects ", d.Stats.TotalProjects), Purple, BadgePurpleBg)
		agentCount := Pill(fmt.Sprintf(" %d agents ", d.Stats.TotalAgents), Cyan, BadgeCyanBg)
		workingCount := Pill(fmt.Sprintf(" %d working ", d.Stats.WorkingAgents), Amber, BadgeAmberBg)
		idleCount := Pill(fmt.Sprintf(" %d idle ", d.Stats.IdleAgents), Green, BadgeGreenBg)

		statsBar := " " + projCount + "  " + agentCount + "  " + workingCount + "  " + idleCount
		b.WriteString(statsBar + "\n")
		b.WriteString(HLine(minInt(width, 120), Muted) + "\n")
	} else {
		b.WriteString("\n")
	}

	// Build agent count map
	agentsByProject := make(map[string][]api.Agent)
	for _, a := range d.Agents {
		agentsByProject[a.ProjectName] = append(agentsByProject[a.ProjectName], a)
	}

	// Project table
	filtered := d.FilteredProjects()

	if len(filtered) == 0 {
		b.WriteString("\n")
		if d.Filter != "" {
			b.WriteString(renderEmptyState(width, "No projects matching \""+d.Filter+"\""))
		} else {
			b.WriteString(renderEmptyState(width, "No projects found"))
		}
		return b.String()
	}

	// Column widths
	colIndicator := 3
	colNum := 4
	colName := 22
	colActivity := 4
	colAgents := 8
	colStatus := 18
	colDesc := width - colIndicator - colNum - colName - colActivity - colAgents - colStatus - 12
	if colDesc < 20 {
		colDesc = 20
	}

	// Header row
	headerPad := repeatStr(" ", colIndicator)
	header := headerPad +
		TableHeaderStyle.Width(colNum).Render("#") +
		TableHeaderStyle.Width(colName).Render("PROJECT") +
		TableHeaderStyle.Width(colActivity).Render("") +
		TableHeaderStyle.Width(colAgents).Render("AGENTS") +
		TableHeaderStyle.Width(colStatus).Render("STATUS") +
		TableHeaderStyle.Width(colDesc).Render("DESCRIPTION")
	b.WriteString(header + "\n")

	// Calculate visible range for scrolling
	maxVisible := height - 10
	if maxVisible < 5 {
		maxVisible = 5
	}

	startIdx := 0
	if d.Selected >= maxVisible {
		startIdx = d.Selected - maxVisible + 1
	}
	endIdx := startIdx + maxVisible
	if endIdx > len(filtered) {
		endIdx = len(filtered)
	}

	for i := startIdx; i < endIdx; i++ {
		p := filtered[i]
		pa := agentsByProject[p.Name]

		// Count working agents
		working := 0
		for _, a := range pa {
			if a.Status == "working" || a.Status == "active" {
				working++
			}
		}

		// Status pill
		var statusStr string
		if working > 0 {
			statusStr = StatusWorkingStyle.Render(fmt.Sprintf("● %d working", working))
		} else if len(pa) > 0 {
			statusStr = StatusIdleStyle.Render("◌ idle")
		} else {
			statusStr = DimStyle.Render("· no agents")
		}

		// Activity sparkline
		activity := Sparkline(len(pa))

		// Description
		desc := p.Description
		if desc == "" && p.Goal != "" {
			lines := strings.SplitN(p.Goal, "\n", 2)
			desc = strings.TrimPrefix(strings.TrimSpace(lines[0]), "# ")
		}
		if len(desc) > colDesc-2 {
			desc = desc[:colDesc-5] + "..."
		}

		// Selection indicator
		indicator := "   "
		if i == d.Selected {
			indicator = SelectionIndicator.Render(" ▌ ")
		}

		// Row style
		cellStyle := TableCellStyle
		numStyle := DimStyle
		if i == d.Selected {
			cellStyle = TableSelectedStyle
			numStyle = lipgloss.NewStyle().Foreground(Cyan).Bold(true)
		}

		// Project name gets emphasis
		nameStyle := cellStyle
		if i == d.Selected {
			nameStyle = lipgloss.NewStyle().Foreground(White).Bold(true).Background(Surface1).Padding(0, 1)
		} else {
			nameStyle = lipgloss.NewStyle().Foreground(White).Padding(0, 1)
		}

		numStr := fmt.Sprintf("%d", i+1)
		row := indicator +
			numStyle.Width(colNum).Render(numStr) +
			nameStyle.Width(colName).Render(truncate(p.Name, colName-2)) +
			cellStyle.Width(colActivity).Render(activity) +
			cellStyle.Width(colAgents).Render(fmt.Sprintf("%d", len(pa))) +
			cellStyle.Width(colStatus).Render(statusStr) +
			cellStyle.Width(colDesc).Render(desc)

		if i == d.Selected {
			row = lipgloss.NewStyle().
				Background(Surface1).
				Width(minInt(width, 140)).
				Render(row)
		}

		b.WriteString(row + "\n")
	}

	// Scroll indicator
	if len(filtered) > maxVisible {
		scrollPct := float64(d.Selected) / float64(len(filtered)-1) * 100
		scrollInfo := DimStyle.Render(fmt.Sprintf("  ↕ %d/%d  %.0f%%", d.Selected+1, len(filtered), scrollPct))

		// Mini scrollbar
		barLen := 10
		pos := int(float64(d.Selected) / float64(len(filtered)-1) * float64(barLen-1))
		scrollBar := ""
		for j := 0; j < barLen; j++ {
			if j == pos {
				scrollBar += lipgloss.NewStyle().Foreground(Cyan).Render("█")
			} else {
				scrollBar += lipgloss.NewStyle().Foreground(Muted).Render("░")
			}
		}

		b.WriteString("\n" + scrollInfo + "  " + scrollBar + "\n")
	}

	return b.String()
}

func renderEmptyState(width int, message string) string {
	art := lipgloss.NewStyle().Foreground(Muted).Render("       ·  ") +
		lipgloss.NewStyle().Foreground(Faint).Render("     .  · ") + "\n" +
		lipgloss.NewStyle().Foreground(Faint).Render("    .    ") +
		lipgloss.NewStyle().Foreground(Dim).Render("  ·   ") +
		lipgloss.NewStyle().Foreground(Muted).Render(" .") + "\n" +
		lipgloss.NewStyle().Foreground(Dim).Render("  ·    ") +
		lipgloss.NewStyle().Foreground(Faint).Render(".    ") +
		lipgloss.NewStyle().Foreground(Muted).Render("·   .") + "\n"

	msg := DimStyle.Render("  " + message)
	hint := FaintStyle.Render("  Press Ctrl+D to dispatch or : to enter a command")

	content := art + "\n" + msg + "\n" + hint

	boxWidth := 50
	if boxWidth > width-4 {
		boxWidth = width - 4
	}

	return lipgloss.NewStyle().
		Padding(1, 2).
		Width(boxWidth).
		Render(content)
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
