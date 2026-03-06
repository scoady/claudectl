package tui

import (
	"fmt"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/scoady/claudectl/internal/api"
)

// ── Messages ─────────────────────────────────────────────────────────────────

// CanvasDataMsg carries refreshed canvas data.
type CanvasDataMsg struct {
	Widgets   []api.Widget
	Templates []api.WidgetTemplate
	Catalog   []api.CatalogTemplate
	Contract  *api.DashboardContract
	Err       error
}

// CanvasActionResultMsg carries the result of a canvas action.
type CanvasActionResultMsg struct {
	Message string
	Err     error
}

// ── Model ────────────────────────────────────────────────────────────────────

// CanvasModel is the canvas management screen model.
type CanvasModel struct {
	ProjectName string
	Widgets     []api.Widget
	Templates   []api.WidgetTemplate
	Catalog     []api.CatalogTemplate
	Contract    *api.DashboardContract
	Panel       int // 0=widgets, 1=templates, 2=catalog, 3=layout
	Selected    int
}

// panelItemCount returns the number of items in the current panel.
func (m *CanvasModel) panelItemCount() int {
	switch m.Panel {
	case 0:
		return len(m.Widgets)
	case 1:
		return len(m.Templates)
	case 2:
		return len(m.Catalog)
	case 3:
		return len(m.Widgets) // layout shows widgets
	}
	return 0
}

// ClampSelection keeps selection in bounds.
func (m *CanvasModel) ClampSelection() {
	n := m.panelItemCount()
	if m.Selected < 0 {
		m.Selected = 0
	}
	if n > 0 && m.Selected >= n {
		m.Selected = n - 1
	}
}

// SelectedWidget returns the currently selected widget, if on the widgets panel.
func (m *CanvasModel) SelectedWidget() *api.Widget {
	if m.Panel == 0 && m.Selected >= 0 && m.Selected < len(m.Widgets) {
		w := m.Widgets[m.Selected]
		return &w
	}
	return nil
}

// SelectedTemplate returns the currently selected template, if on the templates panel.
func (m *CanvasModel) SelectedTemplate() *api.WidgetTemplate {
	if m.Panel == 1 && m.Selected >= 0 && m.Selected < len(m.Templates) {
		t := m.Templates[m.Selected]
		return &t
	}
	return nil
}

// SelectedCatalogItem returns the currently selected catalog item.
func (m *CanvasModel) SelectedCatalogItem() *api.CatalogTemplate {
	if m.Panel == 2 && m.Selected >= 0 && m.Selected < len(m.Catalog) {
		c := m.Catalog[m.Selected]
		return &c
	}
	return nil
}

// ── Fetch command ────────────────────────────────────────────────────────────

// FetchCanvasDataCmd fetches all canvas-related data.
func FetchCanvasDataCmd(client *api.Client, project string) tea.Cmd {
	return func() tea.Msg {
		msg := CanvasDataMsg{}

		widgets, err := client.GetWidgets(project)
		if err != nil {
			msg.Err = err
			return msg
		}
		msg.Widgets = widgets

		templates, _ := client.GetWidgetTemplates()
		msg.Templates = templates

		catalog, _ := client.GetCatalogTemplates()
		msg.Catalog = catalog

		contract, _ := client.GetDashboardContract(project)
		msg.Contract = contract

		return msg
	}
}

// ── Render ───────────────────────────────────────────────────────────────────

// RenderCanvas renders the canvas management screen.
func RenderCanvas(m *CanvasModel, width, height int) string {
	var b strings.Builder

	// ── Title card ──
	ly := NewLayout(width, height)
	contentWidth := ly.CanvasMaxWidth
	titleContent := Class("h1").Render(m.ProjectName) +
		Class("dim").Render(" / Canvas")
	widgetCount := fmt.Sprintf("%d widgets", len(m.Widgets))
	tmplCount := fmt.Sprintf("%d templates", len(m.Templates))
	catCount := fmt.Sprintf("%d catalog", len(m.Catalog))
	titleContent += "\n" +
		Pill(" "+widgetCount+" ", Cyan, BadgeCyanBg) + "  " +
		Pill(" "+tmplCount+" ", Purple, BadgePurpleBg) + "  " +
		Pill(" "+catCount+" ", Amber, BadgeAmberBg)

	infoBox := Class("card").Width(contentWidth).Render(titleContent)
	b.WriteString(infoBox + "\n\n")

	// ── Tab bar ──
	tabLabels := []struct {
		label string
		count int
	}{
		{"Widgets", len(m.Widgets)},
		{"Templates", len(m.Templates)},
		{"Catalog", len(m.Catalog)},
		{"Layout", len(m.Widgets)},
	}
	tabLine := ""
	for i, t := range tabLabels {
		label := fmt.Sprintf("%s (%d)", t.label, t.count)
		if i == m.Panel {
			tabLine += Class("tab-active").Render(label)
		} else {
			tabLine += Class("tab-inactive").Render(label)
		}
		if i < len(tabLabels)-1 {
			tabLine += Class("tab-separator").Render(" ")
		}
	}
	b.WriteString(tabLine + "\n")

	remaining := height - 12
	if remaining < 5 {
		remaining = 5
	}

	switch m.Panel {
	case 0:
		b.WriteString(renderCanvasWidgets(m, width, remaining))
	case 1:
		b.WriteString(renderCanvasTemplates(m, width, remaining))
	case 2:
		b.WriteString(renderCanvasCatalog(m, width, remaining))
	case 3:
		b.WriteString(renderCanvasLayout(m, width, remaining))
	}

	return b.String()
}

func renderCanvasWidgets(m *CanvasModel, width, maxRows int) string {
	if len(m.Widgets) == 0 {
		return "\n" + Class("dim").Render("  No widgets on canvas.") + "\n" +
			Class("faint").Render("  Use the Catalog or Templates panel to deploy widgets.") + "\n"
	}

	var b strings.Builder

	th := Class("th")
	header := "   " +
		th.Width(22).Render("ID") +
		th.Width(20).Render("TITLE") +
		th.Width(16).Render("TEMPLATE") +
		th.Width(10).Render("SIZE") +
		th.Width(10).Render("POS") +
		th.Width(12).Render("TAB")
	b.WriteString(header + "\n")

	for i, w := range m.Widgets {
		if i >= maxRows {
			break
		}

		indicator := "   "
		if m.Panel == 0 && i == m.Selected {
			indicator = Class("selection-indicator").Render(" > ")
		}

		cellStyle := Class("td")
		if m.Panel == 0 && i == m.Selected {
			cellStyle = Class("td-selected")
		}

		wid := w.ID
		if len(wid) > 20 {
			wid = wid[:17] + "..."
		}
		tmpl := w.TemplateID
		if tmpl == "" {
			tmpl = "-"
		}

		pos := "-"
		if w.GSX != nil && w.GSY != nil {
			pos = fmt.Sprintf("(%d,%d)", *w.GSX, *w.GSY)
		}

		// Color-code template name
		tmplStyle := cellStyle
		switch {
		case strings.Contains(tmpl, "terminal"):
			tmplStyle = lipgloss.NewStyle().Foreground(Amber).Padding(0, 1)
		case strings.Contains(tmpl, "constellation"):
			tmplStyle = lipgloss.NewStyle().Foreground(Cyan).Padding(0, 1)
		case strings.Contains(tmpl, "kanban"):
			tmplStyle = lipgloss.NewStyle().Foreground(Purple).Padding(0, 1)
		}
		if m.Panel == 0 && i == m.Selected {
			tmplStyle = tmplStyle.Background(Surface1)
		}

		row := indicator +
			lipgloss.NewStyle().Foreground(Faint).Padding(0, 1).Width(22).Render(wid) +
			cellStyle.Width(20).Render(truncate(w.Title, 18)) +
			tmplStyle.Width(16).Render(truncate(tmpl, 14)) +
			cellStyle.Width(10).Render(fmt.Sprintf("%dx%d", w.GSW, w.GSH)) +
			cellStyle.Width(10).Render(pos) +
			cellStyle.Width(12).Render(w.Tab)

		b.WriteString(row + "\n")
	}

	return b.String()
}

func renderCanvasTemplates(m *CanvasModel, width, maxRows int) string {
	if len(m.Templates) == 0 {
		return "\n" + Class("dim").Render("  No saved templates.") + "\n" +
			Class("faint").Render("  Right-click a widget in the web UI to save as template.") + "\n"
	}

	var b strings.Builder

	th := Class("th")
	header := "   " +
		th.Width(30).Render("FILENAME") +
		th.Width(30).Render("TITLE") +
		th.Width(12).Render("HAS JS") +
		th.Width(12).Render("HAS CSS") +
		th.Width(12).Render("HAS HTML")
	b.WriteString(header + "\n")

	for i, t := range m.Templates {
		if i >= maxRows {
			break
		}

		indicator := "   "
		if m.Panel == 1 && i == m.Selected {
			indicator = Class("selection-indicator").Render(" > ")
		}

		cellStyle := Class("td")
		if m.Panel == 1 && i == m.Selected {
			cellStyle = Class("td-selected")
		}

		hasJS := Class("dim").Render("--")
		if t.JS != "" {
			hasJS = lipgloss.NewStyle().Foreground(Green).Render("yes")
		}
		hasCSS := Class("dim").Render("--")
		if t.CSS != "" {
			hasCSS = lipgloss.NewStyle().Foreground(Green).Render("yes")
		}
		hasHTML := Class("dim").Render("--")
		if t.HTML != "" {
			hasHTML = lipgloss.NewStyle().Foreground(Green).Render("yes")
		}

		title := t.Title
		if title == "" {
			title = "-"
		}

		row := indicator +
			cellStyle.Width(30).Render(truncate(t.Filename, 28)) +
			cellStyle.Width(30).Render(truncate(title, 28)) +
			cellStyle.Width(12).Render(hasJS) +
			cellStyle.Width(12).Render(hasCSS) +
			cellStyle.Width(12).Render(hasHTML)

		b.WriteString(row + "\n")
	}

	return b.String()
}

func renderCanvasCatalog(m *CanvasModel, width, maxRows int) string {
	if len(m.Catalog) == 0 {
		return "\n" + Class("dim").Render("  No catalog templates available.") + "\n"
	}

	var b strings.Builder

	th := Class("th")
	header := "   " +
		th.Width(24).Render("TEMPLATE ID") +
		th.Width(24).Render("TITLE") +
		th.Width(36).Render("DESCRIPTION") +
		th.Width(10).Render("PARAMS")
	b.WriteString(header + "\n")

	for i, ct := range m.Catalog {
		if i >= maxRows {
			break
		}

		indicator := "   "
		if m.Panel == 2 && i == m.Selected {
			indicator = Class("selection-indicator").Render(" > ")
		}

		cellStyle := Class("td")
		if m.Panel == 2 && i == m.Selected {
			cellStyle = Class("td-selected")
		}

		desc := ct.Description
		if desc == "" {
			desc = "-"
		}

		paramCount := fmt.Sprintf("%d", len(ct.Parameters))

		row := indicator +
			lipgloss.NewStyle().Foreground(Cyan).Padding(0, 1).Width(24).Render(truncate(ct.TemplateID, 22)) +
			cellStyle.Width(24).Render(truncate(ct.Title, 22)) +
			cellStyle.Width(36).Render(truncate(desc, 34)) +
			cellStyle.Width(10).Render(paramCount)

		b.WriteString(row + "\n")
	}

	return b.String()
}

// renderCanvasLayout renders an ASCII grid showing widget positions.
func renderCanvasLayout(m *CanvasModel, width, maxRows int) string {
	if len(m.Widgets) == 0 {
		return "\n" + Class("dim").Render("  No widgets to display layout for.") + "\n"
	}

	return "\n" + RenderGridLayout(m.Widgets, width, maxRows)
}

// ── ASCII Grid Layout Renderer ───────────────────────────────────────────────

// RenderGridLayout renders an ASCII representation of the 12-column GridStack layout.
func RenderGridLayout(widgets []api.Widget, termWidth, maxLines int) string {
	// Constants for the grid
	const gridCols = 12
	ly := NewLayout(termWidth, 0)
	colWidth := ly.CanvasColWidth
	const rowHeight = 2 // terminal lines per grid row

	// Find the max Y extent
	maxRow := 0
	for _, w := range widgets {
		y := 0
		if w.GSY != nil {
			y = *w.GSY
		}
		end := y + w.GSH
		if end > maxRow {
			maxRow = end
		}
	}
	if maxRow == 0 {
		maxRow = 6
	}

	// Build a 2D grid: grid[row][col] = widget index (-1 = empty)
	grid := make([][]int, maxRow)
	for r := 0; r < maxRow; r++ {
		grid[r] = make([]int, gridCols)
		for c := 0; c < gridCols; c++ {
			grid[r][c] = -1
		}
	}

	for i, w := range widgets {
		x := 0
		y := 0
		if w.GSX != nil {
			x = *w.GSX
		}
		if w.GSY != nil {
			y = *w.GSY
		}
		for dy := 0; dy < w.GSH && y+dy < maxRow; dy++ {
			for dx := 0; dx < w.GSW && x+dx < gridCols; dx++ {
				grid[y+dy][x+dx] = i
			}
		}
	}

	// Color palette for widgets
	widgetColors := []lipgloss.Color{Cyan, Purple, Amber, Green, Blue, Rose}

	var b strings.Builder

	// Column header
	b.WriteString("  ")
	for c := 0; c < gridCols; c++ {
		label := fmt.Sprintf("%d", c)
		pad := colWidth - len(label)
		if pad < 0 {
			pad = 0
		}
		b.WriteString(Class("dim").Render(label + strings.Repeat(" ", pad)))
	}
	b.WriteString("\n")

	linesRendered := 1
	for r := 0; r < maxRow && linesRendered < maxLines-1; r++ {
		// For each grid row, render rowHeight terminal lines

		// Top border line
		b.WriteString("  ")
		for c := 0; c < gridCols; c++ {
			above := -1
			if r > 0 {
				above = grid[r-1][c]
			}
			current := grid[r][c]
			left := -1
			if c > 0 {
				left = grid[r][c-1]
			}

			// Determine corner character
			corner := " "
			if current != above || (c > 0 && grid[r][c-1] != above) {
				corner = "─"
			}
			if c == 0 || current != left || (r > 0 && grid[r-1][c] != grid[r-1][c-1]) {
				if current != above || (c > 0 && left != above) {
					corner = "┼"
				}
			}

			// Determine if we need a horizontal border
			needHBorder := current != above
			needVBorder := c == 0 || current != left

			_ = corner

			if needVBorder && needHBorder {
				ch := "┌"
				if c == 0 && r == 0 {
					ch = "┌"
				} else if r == 0 {
					ch = "┬"
				} else if c == 0 {
					ch = "├"
				} else {
					ch = "┼"
				}
				b.WriteString(lipgloss.NewStyle().Foreground(BorderColor).Render(ch))
			} else if needHBorder {
				b.WriteString(lipgloss.NewStyle().Foreground(BorderColor).Render("─"))
			} else if needVBorder {
				b.WriteString(lipgloss.NewStyle().Foreground(BorderColor).Render("│"))
			} else {
				b.WriteString(" ")
			}

			// Fill rest of column
			fill := colWidth - 1
			if fill < 0 {
				fill = 0
			}
			if needHBorder {
				b.WriteString(lipgloss.NewStyle().Foreground(BorderColor).Render(strings.Repeat("─", fill)))
			} else {
				b.WriteString(strings.Repeat(" ", fill))
			}
		}
		// Right edge
		if r == 0 {
			b.WriteString(lipgloss.NewStyle().Foreground(BorderColor).Render("┐"))
		} else {
			b.WriteString(lipgloss.NewStyle().Foreground(BorderColor).Render("┤"))
		}
		b.WriteString("\n")
		linesRendered++

		// Content line(s) — show widget title in the first cell of each widget
		for line := 0; line < rowHeight-1 && linesRendered < maxLines-1; line++ {
			b.WriteString("  ")
			for c := 0; c < gridCols; c++ {
				current := grid[r][c]
				left := -1
				if c > 0 {
					left = grid[r][c-1]
				}

				// Vertical border
				if c == 0 || current != left {
					b.WriteString(lipgloss.NewStyle().Foreground(BorderColor).Render("│"))
				} else {
					b.WriteString(" ")
				}

				fill := colWidth - 1
				if fill < 0 {
					fill = 0
				}

				if current >= 0 && line == 0 {
					w := widgets[current]
					// Only show label in the top-left cell of the widget
					wx := 0
					if w.GSX != nil {
						wx = *w.GSX
					}
					wy := 0
					if w.GSY != nil {
						wy = *w.GSY
					}
					if c == wx && r == wy {
						// Render widget title
						label := w.Title
						size := fmt.Sprintf(" %dx%d", w.GSW, w.GSH)
						maxLabel := w.GSW*colWidth - 3
						if maxLabel < 4 {
							maxLabel = fill
						}
						fullLabel := label + size
						if len(fullLabel) > maxLabel {
							if len(label) > maxLabel-len(size) {
								label = label[:maxLabel-len(size)-3] + "..."
							}
							fullLabel = label + size
						}
						if len(fullLabel) > fill {
							fullLabel = fullLabel[:fill]
						}

						color := widgetColors[current%len(widgetColors)]
						b.WriteString(lipgloss.NewStyle().Foreground(color).Bold(true).Render(fullLabel))
						pad := fill - len(fullLabel)
						if pad > 0 {
							b.WriteString(strings.Repeat(" ", pad))
						}
					} else {
						b.WriteString(strings.Repeat(" ", fill))
					}
				} else {
					b.WriteString(strings.Repeat(" ", fill))
				}
			}
			b.WriteString(lipgloss.NewStyle().Foreground(BorderColor).Render("│"))
			b.WriteString("\n")
			linesRendered++
		}
	}

	// Bottom border
	if linesRendered < maxLines {
		b.WriteString("  ")
		b.WriteString(lipgloss.NewStyle().Foreground(BorderColor).Render("└"))
		totalWidth := gridCols*colWidth - 1
		b.WriteString(lipgloss.NewStyle().Foreground(BorderColor).Render(strings.Repeat("─", totalWidth)))
		b.WriteString(lipgloss.NewStyle().Foreground(BorderColor).Render("┘"))
		b.WriteString("\n")
	}

	return b.String()
}
