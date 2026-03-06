package tui

import "github.com/charmbracelet/lipgloss"

// KeyHint represents a key binding hint for the footer.
type KeyHint struct {
	Key  string
	Desc string
}

// RenderFooter renders the key hints footer bar.
func RenderFooter(width int, hints []KeyHint) string {
	// Separator line above footer
	sep := HLine(width, Muted)

	// Build key hint pills
	parts := ""
	for i, h := range hints {
		if i > 0 {
			parts += "  "
		}
		// Key as a pill badge
		keyPill := Class("footer-key").Render(h.Key)
		desc := Class("footer-desc").Render(" " + h.Desc)
		parts += keyPill + desc
	}

	// Pad to full width with background
	barWidth := lipgloss.Width(parts)
	pad := width - barWidth - 1
	if pad < 0 {
		pad = 0
	}

	bar := Class("footer-bar").
		Width(width).
		Render(" " + parts + repeatStr(" ", pad))

	return sep + "\n" + bar
}
