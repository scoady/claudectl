package tui

import "github.com/charmbracelet/lipgloss"

// KeyHint represents a key binding hint for the footer.
type KeyHint struct {
	Key  string
	Desc string
}

// RenderFooter renders the key hints footer bar.
func RenderFooter(width int, hints []KeyHint) string {
	parts := ""
	for i, h := range hints {
		if i > 0 {
			parts += DimStyle.Render("  ")
		}
		parts += FooterKeyStyle.Render(h.Key) + FooterDescStyle.Render(":"+h.Desc)
	}

	barWidth := lipgloss.Width(parts)
	pad := width - barWidth
	if pad < 0 {
		pad = 0
	}

	return lipgloss.NewStyle().
		Background(lipgloss.Color("#1e293b")).
		Width(width).
		Render(parts + repeatStr(" ", pad))
}
