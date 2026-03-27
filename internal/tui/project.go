package tui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/scoady/codexctl/internal/api"
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
		return Class("dim").Render("  Loading project...")
	}

	ly := NewLayout(width, height)
	var b strings.Builder

	// ── Project info card ──
	contentWidth := ly.CardMaxWidth
	infoContent := renderProjectInfo(p, contentWidth)
	infoBox := Class("card").Width(contentWidth).Render(infoContent)
	b.WriteString(infoBox + "\n\n")

	// ── Tab bar ──
	tabs := []struct {
		label string
		count int
	}{
		{"Agents", len(p.Agents)},
		{"Tasks", len(p.Tasks)},
		{"Widgets", len(p.Widgets)},
	}

	tabLine := ""
	for i, t := range tabs {
		label := fmt.Sprintf("%s (%d)", t.label, t.count)
		if i == p.Panel {
			tabLine += Class("tab-active").Render(label)
		} else {
			tabLine += Class("tab-inactive").Render(label)
		}
		if i < len(tabs)-1 {
			tabLine += Class("tab-separator").Render(" ")
		}
	}
	b.WriteString(tabLine + "\n")

	remaining := height - 12
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

func renderProjectInfo(p *ProjectModel, maxWidth int) string {
	nameStyle := Class("h1")
	kvKeyStyle := Class("dim")
	kvValStyle := Class("body")

	model := p.Project.Config.Model
	if model == "" {
		model = "default"
	}

	// Title line
	title := nameStyle.Render(p.Project.Name)

	// Path (dimmed)
	pathLine := kvKeyStyle.Render("path ") + kvValStyle.Render(p.Project.Path)

	// Config line with pills
	parallelism := Pill(fmt.Sprintf(" %dx ", p.Project.Config.Parallelism), Amber, BadgeAmberBg)
	modelPill := Pill(" "+model+" ", Blue, BadgeBlueBg)
	configLine := kvKeyStyle.Render("config ") + parallelism + "  " + modelPill

	// Cost estimate for project agents
	var totalCost float64
	for _, ag := range p.Agents {
		totalCost += EstimateCost(ag.Model, ag.TurnCount)
	}
	costLine := ""
	if totalCost > 0 {
		costLine = "\n" + kvKeyStyle.Render("cost ") +
			lipgloss.NewStyle().Foreground(Amber).Render(FormatCost(totalCost)+" today (est)")
	}

	return title + "\n" + pathLine + "\n" + configLine + costLine
}

func renderAgentPanel(p *ProjectModel, width, maxRows int) string {
	if len(p.Agents) == 0 {
		return "\n" + Class("dim").Render("  No agents running.") + "\n" +
			Class("faint").Render("  Press Ctrl+D to dispatch a task.") + "\n"
	}

	ly := NewLayout(width, 0)
	var b strings.Builder

	colStatus := 3
	colSID := ly.ProjAgentColSID
	colTask := ly.ProjAgentColTask
	colPhase := ly.ProjAgentColPhase
	colModel := ly.ProjAgentColModel
	colTurns := ly.ProjAgentColTurns
	colElapsed := ly.ProjAgentColElapsed
	colCost := ly.ProjAgentColCost

	th := Class("th")
	td := Class("td")
	tdSel := Class("td-selected")

	// Header
	pad := "   "
	header := pad +
		th.Width(colSID).Render("SESSION") +
		th.Width(colTask).Render("TASK") +
		th.Width(colPhase).Render("PHASE") +
		th.Width(colModel).Render("MODEL") +
		th.Width(colTurns).Render("TURNS") +
		th.Width(colElapsed).Render("ELAPSED") +
		th.Width(colCost).Render("COST")
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
			task = lipgloss.NewStyle().Foreground(Purple).Render("[ctrl]") + " " + task
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

		// Status-colored left border
		var borderColor lipgloss.Color
		switch a.Status {
		case "working", "active":
			borderColor = Amber
		case "idle":
			borderColor = Cyan
		case "done", "complete":
			borderColor = Green
		default:
			borderColor = Dim
		}
		_ = colStatus

		// Selection indicator with colored bar
		indicator := lipgloss.NewStyle().Foreground(borderColor).Render("▎") + "  "
		if p.Panel == 0 && i == p.Selected {
			indicator = lipgloss.NewStyle().Foreground(borderColor).Bold(true).Render("▌") +
				lipgloss.NewStyle().Foreground(Cyan).Bold(true).Render("> ")
		}

		cellStyle := td
		sidStyle := Class("td-muted")
		if p.Panel == 0 && i == p.Selected {
			cellStyle = tdSel
			sidStyle = lipgloss.NewStyle().Foreground(Dim).Background(Surface1).Padding(0, 1)
		}

		row := indicator +
			sidStyle.Width(colSID).Render(sid) +
			cellStyle.Width(colTask).Render(task) +
			cellStyle.Width(colPhase).Render(StatusColor(a.Phase).Render(a.Phase)) +
			cellStyle.Width(colModel).Render(model) +
			cellStyle.Width(colTurns).Render(fmt.Sprintf("%d", a.TurnCount)) +
			cellStyle.Width(colElapsed).Render(a.ElapsedString()) +
			lipgloss.NewStyle().Foreground(Amber).Padding(0, 1).Width(colCost).Render(FormatCost(EstimateCost(a.Model, a.TurnCount)))

		if p.Panel == 0 && i == p.Selected {
			row = lipgloss.NewStyle().
				Background(Surface1).
				Width(ly.SelectedRowWidth).
				Render(row)
		}

		b.WriteString(row + "\n")
	}

	return b.String()
}

func renderTaskPanel(p *ProjectModel, width, maxRows int) string {
	if len(p.Tasks) == 0 {
		return "\n" + Class("dim").Render("  No tasks defined.") + "\n"
	}

	var b strings.Builder

	maxText := width - 30
	if maxText < 20 {
		maxText = 20
	}

	th := Class("th")
	td := Class("td")
	tdSel := Class("td-selected")

	// Header
	header := "   " +
		th.Width(6).Render("#") +
		th.Width(14).Render("STATUS") +
		th.Width(maxText).Render("TASK")
	b.WriteString(header + "\n")

	for i, t := range p.Tasks {
		if i >= maxRows {
			break
		}

		// Checkbox-style icons
		var statusIcon string
		switch strings.ToLower(t.Status) {
		case "done", "complete", "completed":
			statusIcon = Class("status-done").Render("✓")
		case "in_progress", "in-progress", "running":
			statusIcon = Class("status-active").Render("▶")
		default:
			statusIcon = Class("dim").Render("○")
		}

		// Detect subtask indent
		indent := ""
		text := t.Text
		if strings.HasPrefix(text, "  ") || strings.HasPrefix(text, "\t") {
			indent = "  "
			text = strings.TrimSpace(text)
		}

		// Status pill
		statusText := StatusPill(t.Status)

		if len(text) > maxText-4 {
			text = text[:maxText-7] + "..."
		}

		// Selection indicator
		indicator := "   "
		if p.Panel == 1 && i == p.Selected {
			indicator = Class("selection-indicator").Render(" > ")
		}

		cellStyle := td
		if p.Panel == 1 && i == p.Selected {
			cellStyle = tdSel
		}

		row := indicator +
			cellStyle.Width(6).Render(fmt.Sprintf("%d", i+1)) +
			cellStyle.Width(14).Render(statusIcon+" "+statusText) +
			cellStyle.Width(maxText).Render(indent+text)

		b.WriteString(row + "\n")
	}

	return b.String()
}

func renderWidgetPanel(p *ProjectModel, width, maxRows int) string {
	if len(p.Widgets) == 0 {
		return "\n" + Class("dim").Render("  No widgets configured.") + "\n"
	}

	var b strings.Builder

	th := Class("th")
	td := Class("td")
	tdSel := Class("td-selected")

	// Header
	header := "   " +
		th.Width(22).Render("ID") +
		th.Width(20).Render("TITLE") +
		th.Width(16).Render("TEMPLATE") +
		th.Width(10).Render("SIZE") +
		th.Width(12).Render("TAB")
	b.WriteString(header + "\n")

	for i, w := range p.Widgets {
		if i >= maxRows {
			break
		}

		// Selection indicator
		indicator := "   "
		if p.Panel == 2 && i == p.Selected {
			indicator = Class("selection-indicator").Render(" > ")
		}

		cellStyle := td
		if p.Panel == 2 && i == p.Selected {
			cellStyle = tdSel
		}

		wid := w.ID
		if len(wid) > 20 {
			wid = wid[:17] + "..."
		}
		tmpl := w.TemplateID
		if tmpl == "" {
			tmpl = "-"
		}

		// Template badge with color coding
		tmplStyle := cellStyle
		switch {
		case strings.Contains(tmpl, "terminal"):
			tmplStyle = lipgloss.NewStyle().Foreground(Amber).Padding(0, 1)
		case strings.Contains(tmpl, "constellation"):
			tmplStyle = lipgloss.NewStyle().Foreground(Cyan).Padding(0, 1)
		case strings.Contains(tmpl, "kanban"):
			tmplStyle = lipgloss.NewStyle().Foreground(Purple).Padding(0, 1)
		}
		if p.Panel == 2 && i == p.Selected {
			tmplStyle = tmplStyle.Background(Surface1)
		}

		row := indicator +
			lipgloss.NewStyle().Foreground(Faint).Padding(0, 1).Width(22).Render(wid) +
			cellStyle.Width(20).Render(truncate(w.Title, 18)) +
			tmplStyle.Width(16).Render(truncate(tmpl, 14)) +
			cellStyle.Width(10).Render(fmt.Sprintf("%dx%d", w.GSW, w.GSH)) +
			cellStyle.Width(12).Render(w.Tab)

		b.WriteString(row + "\n")
	}

	return b.String()
}
