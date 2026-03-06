package tui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/scoady/claudectl/internal/api"
)

// WidgetDetailModel holds the state for the widget detail view.
type WidgetDetailModel struct {
	Widget   *api.Widget
	Contract *api.DashboardContract
	Scroll   int
}

// RenderWidgetDetail renders a detailed view of a single widget.
func RenderWidgetDetail(m *WidgetDetailModel, width, height int) string {
	if m.Widget == nil {
		return Class("dim").Render("  No widget selected.")
	}

	w := m.Widget
	ly := NewLayout(width, height)
	contentWidth := ly.DetailContentWidth

	var b strings.Builder

	// ── Widget metadata card ──
	nameStyle := Class("h1")
	kvKeyStyle := lipgloss.NewStyle().Foreground(Dim).Width(14)
	kvValStyle := Class("body")

	var info strings.Builder
	info.WriteString(nameStyle.Render(w.Title) + "\n\n")

	info.WriteString(kvKeyStyle.Render("ID") + kvValStyle.Render(w.ID) + "\n")
	info.WriteString(kvKeyStyle.Render("Project") + kvValStyle.Render(w.Project) + "\n")

	tmpl := w.TemplateID
	if tmpl == "" {
		tmpl = "-"
	}
	tmplColor := Dim
	switch {
	case strings.Contains(tmpl, "terminal"):
		tmplColor = Amber
	case strings.Contains(tmpl, "constellation"):
		tmplColor = Cyan
	case strings.Contains(tmpl, "kanban"):
		tmplColor = Purple
	}
	info.WriteString(kvKeyStyle.Render("Template") + lipgloss.NewStyle().Foreground(tmplColor).Render(tmpl) + "\n")

	info.WriteString(kvKeyStyle.Render("Size") + kvValStyle.Render(fmt.Sprintf("%dx%d", w.GSW, w.GSH)) + "\n")

	pos := "-"
	if w.GSX != nil && w.GSY != nil {
		pos = fmt.Sprintf("(%d, %d)", *w.GSX, *w.GSY)
	}
	info.WriteString(kvKeyStyle.Render("Position") + kvValStyle.Render(pos) + "\n")

	tab := w.Tab
	if tab == "" {
		tab = "default"
	}
	info.WriteString(kvKeyStyle.Render("Tab") + kvValStyle.Render(tab) + "\n")

	if w.CreatedAt != "" {
		info.WriteString(kvKeyStyle.Render("Created") + kvValStyle.Render(w.CreatedAt) + "\n")
	}
	if w.UpdatedAt != "" {
		info.WriteString(kvKeyStyle.Render("Updated") + kvValStyle.Render(w.UpdatedAt) + "\n")
	}

	infoBox := Class("card").Width(contentWidth).Render(info.String())
	b.WriteString(infoBox + "\n\n")

	// ── Grid position visualization ──
	b.WriteString(Class("section-title").Render("  Grid Position") + "\n")
	b.WriteString(renderMiniGrid(w, contentWidth) + "\n")

	// ── Data contract info ──
	if m.Contract != nil {
		for _, cw := range m.Contract.Widgets {
			if cw.ID == w.ID {
				b.WriteString(Class("section-title").Render("  Data Contract") + "\n")

				var contractInfo strings.Builder
				contractInfo.WriteString(kvKeyStyle.Render("Schema ID") + kvValStyle.Render(cw.ID) + "\n")
				contractInfo.WriteString(kvKeyStyle.Render("Title") + kvValStyle.Render(cw.Title) + "\n")

				if len(cw.Schema) > 0 {
					contractInfo.WriteString(kvKeyStyle.Render("Fields") + "\n")
					for key, val := range cw.Schema {
						contractInfo.WriteString("  " + lipgloss.NewStyle().Foreground(Cyan).Render(key) +
							" " + Class("dim").Render(fmt.Sprintf("%v", val)) + "\n")
					}
				}

				contractBox := Class("card").Width(contentWidth).Render(contractInfo.String())
				b.WriteString(contractBox + "\n")
				break
			}
		}
	}

	return b.String()
}

// renderMiniGrid renders a small 12-col grid highlighting where this widget sits.
func renderMiniGrid(w *api.Widget, maxWidth int) string {
	const gridCols = 12
	cellWidth := 3
	if maxWidth > 0 {
		cellWidth = (maxWidth - 4) / gridCols
		if cellWidth < 2 {
			cellWidth = 2
		}
		if cellWidth > 6 {
			cellWidth = 6
		}
	}

	wx := 0
	wy := 0
	if w.GSX != nil {
		wx = *w.GSX
	}
	if w.GSY != nil {
		wy = *w.GSY
	}

	totalRows := wy + w.GSH + 1
	if totalRows > 12 {
		totalRows = 12
	}

	var b strings.Builder

	for r := 0; r < totalRows; r++ {
		b.WriteString("  ")
		for c := 0; c < gridCols; c++ {
			inWidget := c >= wx && c < wx+w.GSW && r >= wy && r < wy+w.GSH
			if inWidget {
				b.WriteString(lipgloss.NewStyle().
					Background(BadgeCyanBg).
					Foreground(Cyan).
					Render(strings.Repeat("█", cellWidth)))
			} else {
				b.WriteString(lipgloss.NewStyle().
					Foreground(Muted).
					Render(strings.Repeat("·", cellWidth)))
			}
		}
		b.WriteString("\n")
	}

	return b.String()
}
