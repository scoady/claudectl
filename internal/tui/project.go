package tui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/scoady/claudectl/internal/api"
)

// ProjectModel is the project detail screen.
type ProjectModel struct {
	Project  *api.Project
	Agents   []api.Agent
	Tasks    []api.Task
	Widgets  []api.Widget
	Selected int
	Panel    int // 0=agents, 1=tasks, 2=widgets
}

// RenderProject renders the project detail screen.
func RenderProject(p *ProjectModel, width, height int) string {
	if p.Project == nil {
		return DimStyle.Render("  Loading project...")
	}

	var b strings.Builder

	// Project info header
	infoStyle := lipgloss.NewStyle().Foreground(White)
	b.WriteString(BoldStyle.Render(p.Project.Name) + "\n")
	b.WriteString(DimStyle.Render("  path: ") + infoStyle.Render(p.Project.Path) + "\n")

	model := p.Project.Config.Model
	if model == "" {
		model = "default"
	}
	b.WriteString(DimStyle.Render("  parallelism: ") + infoStyle.Render(fmt.Sprintf("%d", p.Project.Config.Parallelism)))
	b.WriteString(DimStyle.Render("  model: ") + infoStyle.Render(model) + "\n")
	b.WriteString("\n")

	// Panel tabs
	tabs := []string{"Agents", "Tasks", "Widgets"}
	tabLine := ""
	for i, t := range tabs {
		style := DimStyle
		if i == p.Panel {
			style = lipgloss.NewStyle().Foreground(Cyan).Bold(true).Underline(true)
		}
		if i > 0 {
			tabLine += DimStyle.Render(" | ")
		}
		tabLine += style.Render(t)
	}
	b.WriteString(tabLine + "\n")
	b.WriteString(DimStyle.Render(strings.Repeat("─", minInt(width, 100))) + "\n")

	remaining := height - 10
	if remaining < 5 {
		remaining = 5
	}

	switch p.Panel {
	case 0:
		b.WriteString(renderAgentPanel(p, width, remaining))
	case 1:
		b.WriteString(renderTaskPanel(p, width, remaining))
	case 2:
		b.WriteString(renderWidgetPanel(p, width, remaining))
	}

	return b.String()
}

func renderAgentPanel(p *ProjectModel, width, maxRows int) string {
	if len(p.Agents) == 0 {
		return DimStyle.Render("  No agents.\n")
	}

	var b strings.Builder

	colSID := 18
	colTask := 30
	colStatus := 10
	colPhase := 12
	colModel := 12
	colTurns := 8
	colElapsed := 10

	header := TableHeaderStyle.Width(colSID).Render("SESSION") +
		TableHeaderStyle.Width(colTask).Render("TASK") +
		TableHeaderStyle.Width(colStatus).Render("STATUS") +
		TableHeaderStyle.Width(colPhase).Render("PHASE") +
		TableHeaderStyle.Width(colModel).Render("MODEL") +
		TableHeaderStyle.Width(colTurns).Render("TURNS") +
		TableHeaderStyle.Width(colElapsed).Render("ELAPSED")
	b.WriteString(header + "\n")

	for i, a := range p.Agents {
		if i >= maxRows {
			break
		}

		sid := a.SessionID
		if len(sid) > colSID-2 {
			sid = sid[:colSID-5] + "..."
		}

		task := a.Task
		if a.IsController {
			task = "[ctrl] " + task
		}
		if len(task) > colTask-2 {
			task = task[:colTask-5] + "..."
		}

		model := a.Model
		if model == "" {
			model = "-"
		}
		if len(model) > colModel-2 {
			model = model[:colModel-5] + "..."
		}

		cellStyle := TableCellStyle
		if p.Panel == 0 && i == p.Selected {
			cellStyle = TableSelectedStyle
		}

		row := cellStyle.Width(colSID).Render(StatusIcon(a.Status)+" "+sid) +
			cellStyle.Width(colTask).Render(task) +
			cellStyle.Width(colStatus).Render(StatusColor(a.Status).Render(a.Status)) +
			cellStyle.Width(colPhase).Render(StatusColor(a.Phase).Render(a.Phase)) +
			cellStyle.Width(colModel).Render(model) +
			cellStyle.Width(colTurns).Render(fmt.Sprintf("%d", a.TurnCount)) +
			cellStyle.Width(colElapsed).Render(a.ElapsedString())

		if p.Panel == 0 && i == p.Selected {
			row = lipgloss.NewStyle().
				Background(lipgloss.Color("#1e293b")).
				Width(minInt(width, 120)).
				Render(row)
		}

		b.WriteString(row + "\n")
	}

	return b.String()
}

func renderTaskPanel(p *ProjectModel, width, maxRows int) string {
	if len(p.Tasks) == 0 {
		return DimStyle.Render("  No tasks.\n")
	}

	var b strings.Builder

	header := TableHeaderStyle.Width(6).Render("#") +
		TableHeaderStyle.Width(14).Render("STATUS") +
		TableHeaderStyle.Width(width - 24).Render("TASK")
	b.WriteString(header + "\n")

	for i, t := range p.Tasks {
		if i >= maxRows {
			break
		}

		statusIcon := DimStyle.Render("○")
		switch strings.ToLower(t.Status) {
		case "done", "complete", "completed":
			statusIcon = StatusDoneStyle.Render("✓")
		case "in_progress", "in-progress", "running":
			statusIcon = StatusWorkingStyle.Render("▶")
		}

		cellStyle := TableCellStyle
		if p.Panel == 1 && i == p.Selected {
			cellStyle = TableSelectedStyle
		}

		text := t.Text
		maxText := width - 24
		if len(text) > maxText {
			text = text[:maxText-3] + "..."
		}

		row := cellStyle.Width(6).Render(fmt.Sprintf("%d", i)) +
			cellStyle.Width(14).Render(statusIcon+" "+StatusColor(t.Status).Render(t.Status)) +
			cellStyle.Width(maxText).Render(text)

		b.WriteString(row + "\n")
	}

	return b.String()
}

func renderWidgetPanel(p *ProjectModel, width, maxRows int) string {
	if len(p.Widgets) == 0 {
		return DimStyle.Render("  No widgets.\n")
	}

	var b strings.Builder

	header := TableHeaderStyle.Width(22).Render("ID") +
		TableHeaderStyle.Width(20).Render("TITLE") +
		TableHeaderStyle.Width(16).Render("TEMPLATE") +
		TableHeaderStyle.Width(10).Render("SIZE") +
		TableHeaderStyle.Width(12).Render("TAB")
	b.WriteString(header + "\n")

	for i, w := range p.Widgets {
		if i >= maxRows {
			break
		}

		cellStyle := TableCellStyle
		if p.Panel == 2 && i == p.Selected {
			cellStyle = TableSelectedStyle
		}

		wid := w.ID
		if len(wid) > 20 {
			wid = wid[:17] + "..."
		}
		tmpl := w.TemplateID
		if tmpl == "" {
			tmpl = "-"
		}

		row := cellStyle.Width(22).Render(wid) +
			cellStyle.Width(20).Render(truncate(w.Title, 18)) +
			cellStyle.Width(16).Render(truncate(tmpl, 14)) +
			cellStyle.Width(10).Render(fmt.Sprintf("%dx%d", w.GSW, w.GSH)) +
			cellStyle.Width(12).Render(w.Tab)

		b.WriteString(row + "\n")
	}

	return b.String()
}
