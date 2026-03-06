package tui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/scoady/claudectl/internal/api"
)

// TemplateBrowserModel is the state for the catalog template detail view.
type TemplateBrowserModel struct {
	Template *api.CatalogTemplate
}

// RenderTemplateBrowser renders a detailed view of a catalog template.
func RenderTemplateBrowser(m *TemplateBrowserModel, width, height int) string {
	if m.Template == nil {
		return DimStyle.Render("  No template selected.")
	}

	t := m.Template
	contentWidth := minInt(width-4, 100)

	var b strings.Builder

	// ── Template metadata card ──
	nameStyle := lipgloss.NewStyle().Foreground(White).Bold(true)
	kvKeyStyle := lipgloss.NewStyle().Foreground(Dim).Width(14)
	kvValStyle := lipgloss.NewStyle().Foreground(SubText)

	var info strings.Builder
	info.WriteString(nameStyle.Render(t.Title) + "\n\n")

	info.WriteString(kvKeyStyle.Render("Template ID") + lipgloss.NewStyle().Foreground(Cyan).Render(t.TemplateID) + "\n")

	desc := t.Description
	if desc == "" {
		desc = "No description"
	}
	info.WriteString(kvKeyStyle.Render("Description") + kvValStyle.Render(desc) + "\n")

	paramCount := fmt.Sprintf("%d", len(t.Parameters))
	info.WriteString(kvKeyStyle.Render("Parameters") + kvValStyle.Render(paramCount) + "\n")

	infoBox := CardStyle.Width(contentWidth).Render(info.String())
	b.WriteString(infoBox + "\n\n")

	// ── Parameters list ──
	if len(t.Parameters) > 0 {
		b.WriteString(SectionStyle.Render("  Parameters") + "\n")
		b.WriteString(HLine(contentWidth, Muted) + "\n")

		// Table header
		header := "   " +
			TableHeaderStyle.Width(20).Render("NAME") +
			TableHeaderStyle.Width(12).Render("TYPE") +
			TableHeaderStyle.Width(36).Render("DESCRIPTION") +
			TableHeaderStyle.Width(20).Render("DEFAULT")
		b.WriteString(header + "\n")

		for _, p := range t.Parameters {
			defVal := p.Default
			if defVal == "" {
				defVal = "-"
			}
			paramDesc := p.Description
			if paramDesc == "" {
				paramDesc = "-"
			}

			// Type badge
			typeColor := SubText
			switch p.Type {
			case "string":
				typeColor = Green
			case "number", "int", "float":
				typeColor = Amber
			case "boolean", "bool":
				typeColor = Purple
			case "array", "list":
				typeColor = Cyan
			}

			row := "   " +
				lipgloss.NewStyle().Foreground(White).Padding(0, 1).Width(20).Render(p.Name) +
				lipgloss.NewStyle().Foreground(typeColor).Padding(0, 1).Width(12).Render(p.Type) +
				TableCellStyle.Width(36).Render(truncate(paramDesc, 34)) +
				DimStyle.Padding(0, 1).Width(20).Render(truncate(defVal, 18))

			b.WriteString(row + "\n")
		}
	} else {
		b.WriteString("\n" + DimStyle.Render("  No parameters — this template can be deployed as-is.") + "\n")
	}

	// ── Preview data ──
	if len(t.PreviewData) > 0 {
		b.WriteString("\n" + SectionStyle.Render("  Preview Data") + "\n")
		b.WriteString(HLine(contentWidth, Muted) + "\n")

		for key, val := range t.PreviewData {
			b.WriteString("   " +
				lipgloss.NewStyle().Foreground(Cyan).Width(20).Padding(0, 1).Render(key) +
				DimStyle.Render(fmt.Sprintf("%v", val)) + "\n")
		}
	}

	return b.String()
}
