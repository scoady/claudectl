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

	// Quick stats bar
	if d.Stats != nil {
		statsLine := fmt.Sprintf(
			" %s projects   %s agents (%s working, %s idle)",
			BoldStyle.Render(fmt.Sprintf("%d", d.Stats.TotalProjects)),
			BoldStyle.Render(fmt.Sprintf("%d", d.Stats.TotalAgents)),
			StatusWorkingStyle.Render(fmt.Sprintf("%d", d.Stats.WorkingAgents)),
			StatusIdleStyle.Render(fmt.Sprintf("%d", d.Stats.IdleAgents)),
		)
		b.WriteString(DimStyle.Render(statsLine) + "\n\n")
	}

	// Build agent count map
	agentsByProject := make(map[string][]api.Agent)
	for _, a := range d.Agents {
		agentsByProject[a.ProjectName] = append(agentsByProject[a.ProjectName], a)
	}

	// Project table
	filtered := d.FilteredProjects()

	if len(filtered) == 0 {
		if d.Filter != "" {
			b.WriteString(DimStyle.Render("  No projects matching filter.") + "\n")
		} else {
			b.WriteString(DimStyle.Render("  No projects found.") + "\n")
		}
		return b.String()
	}

	// Column widths
	colNum := 4
	colName := 24
	colAgents := 10
	colStatus := 16
	colDesc := width - colNum - colName - colAgents - colStatus - 12
	if colDesc < 20 {
		colDesc = 20
	}

	// Header
	header := TableHeaderStyle.Width(colNum).Render("#") +
		TableHeaderStyle.Width(colName).Render("PROJECT") +
		TableHeaderStyle.Width(colAgents).Render("AGENTS") +
		TableHeaderStyle.Width(colStatus).Render("STATUS") +
		TableHeaderStyle.Width(colDesc).Render("DESCRIPTION")
	b.WriteString(header + "\n")
	b.WriteString(DimStyle.Render(strings.Repeat("─", minInt(width, 120))) + "\n")

	// Calculate visible range for scrolling
	maxVisible := height - 10 // Reserve for header, stats, footer
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

		// Status string
		statusStr := StatusIdleStyle.Render("idle")
		if working > 0 {
			statusStr = StatusWorkingStyle.Render(fmt.Sprintf("%d working", working))
		}
		if len(pa) == 0 {
			statusStr = DimStyle.Render("no agents")
		}

		// Description
		desc := p.Description
		if desc == "" && p.Goal != "" {
			lines := strings.SplitN(p.Goal, "\n", 2)
			desc = strings.TrimPrefix(strings.TrimSpace(lines[0]), "# ")
		}
		if len(desc) > colDesc-2 {
			desc = desc[:colDesc-5] + "..."
		}

		// Row style
		cellStyle := TableCellStyle
		if i == d.Selected {
			cellStyle = TableSelectedStyle
		}

		numStr := fmt.Sprintf("%d", i+1)
		row := cellStyle.Width(colNum).Render(numStr) +
			cellStyle.Width(colName).Render(truncate(p.Name, colName-2)) +
			cellStyle.Width(colAgents).Render(fmt.Sprintf("%d", len(pa))) +
			cellStyle.Width(colStatus).Render(statusStr) +
			cellStyle.Width(colDesc).Render(desc)

		if i == d.Selected {
			// Highlight the entire row
			row = lipgloss.NewStyle().
				Background(lipgloss.Color("#1e293b")).
				Width(minInt(width, 120)).
				Render(row)
		}

		b.WriteString(row + "\n")
	}

	// Scroll indicator
	if len(filtered) > maxVisible {
		scrollPct := float64(d.Selected) / float64(len(filtered)-1) * 100
		b.WriteString(DimStyle.Render(fmt.Sprintf("\n  ↕ %d/%d (%.0f%%)", d.Selected+1, len(filtered), scrollPct)) + "\n")
	}

	return b.String()
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
