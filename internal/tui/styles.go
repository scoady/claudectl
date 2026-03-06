// Package tui provides the interactive terminal UI for c9s.
package tui

import "github.com/charmbracelet/lipgloss"

// ── Color palette (matches claude-manager web dashboard) ─────────────────────

var (
	Cyan   = lipgloss.Color("#67e8f9")
	Amber  = lipgloss.Color("#fbbf24")
	Purple = lipgloss.Color("#a78bfa")
	Green  = lipgloss.Color("#34d399")
	Rose   = lipgloss.Color("#f43f5e")
	Dim    = lipgloss.Color("#64748b")
	Glass  = lipgloss.Color("#0a0f19")
	White  = lipgloss.Color("#e2e8f0")
	Blue   = lipgloss.Color("#60a5fa")
)

// ── Reusable styles ──────────────────────────────────────────────────────────

var (
	// Header bar styles
	LogoStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(Cyan)

	HeaderStatusOK = lipgloss.NewStyle().
			Foreground(Green).
			Bold(true)

	HeaderStatusErr = lipgloss.NewStyle().
			Foreground(Rose).
			Bold(true)

	HeaderDim = lipgloss.NewStyle().
			Foreground(Dim)

	// Footer key hints
	FooterKeyStyle = lipgloss.NewStyle().
			Foreground(Cyan).
			Bold(true)

	FooterDescStyle = lipgloss.NewStyle().
			Foreground(Dim)

	FooterBarStyle = lipgloss.NewStyle().
			Background(lipgloss.Color("#1e293b"))

	// Table styles
	TableHeaderStyle = lipgloss.NewStyle().
				Bold(true).
				Foreground(Purple).
				Padding(0, 1)

	TableCellStyle = lipgloss.NewStyle().
			Foreground(White).
			Padding(0, 1)

	TableSelectedStyle = lipgloss.NewStyle().
				Background(lipgloss.Color("#1e293b")).
				Foreground(Cyan).
				Bold(true).
				Padding(0, 1)

	// Status styles
	StatusWorkingStyle = lipgloss.NewStyle().Foreground(Amber).Bold(true)
	StatusIdleStyle    = lipgloss.NewStyle().Foreground(Cyan)
	StatusDoneStyle    = lipgloss.NewStyle().Foreground(Green)
	StatusErrorStyle   = lipgloss.NewStyle().Foreground(Rose).Bold(true)

	// Section header
	SectionStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(Purple)

	// Command bar
	CmdBarStyle = lipgloss.NewStyle().
			Foreground(Cyan).
			Bold(true)

	CmdInputStyle = lipgloss.NewStyle().
			Foreground(White)

	// Help overlay
	HelpOverlayStyle = lipgloss.NewStyle().
				Border(lipgloss.RoundedBorder()).
				BorderForeground(Purple).
				Padding(1, 2).
				Background(lipgloss.Color("#0f172a"))

	HelpKeyStyle = lipgloss.NewStyle().
			Foreground(Cyan).
			Bold(true).
			Width(14)

	HelpDescStyle = lipgloss.NewStyle().
			Foreground(White)

	HelpTitleStyle = lipgloss.NewStyle().
			Foreground(Purple).
			Bold(true).
			MarginBottom(1)

	// Misc
	BoldStyle = lipgloss.NewStyle().Bold(true).Foreground(White)
	DimStyle  = lipgloss.NewStyle().Foreground(Dim)

	// Filter bar
	FilterStyle = lipgloss.NewStyle().
			Foreground(Amber).
			Bold(true)
)

// StatusColor returns the style for a given status.
func StatusColor(status string) lipgloss.Style {
	switch status {
	case "working", "active":
		return StatusWorkingStyle
	case "idle":
		return StatusIdleStyle
	case "done", "complete":
		return StatusDoneStyle
	case "error", "disconnected", "cancelled":
		return StatusErrorStyle
	default:
		return DimStyle
	}
}

// StatusIcon returns a colored dot for a status.
func StatusIcon(status string) string {
	s := StatusColor(status)
	switch status {
	case "working", "active":
		return s.Render("●")
	case "idle":
		return s.Render("◌")
	case "done", "complete":
		return s.Render("✓")
	case "error", "disconnected", "cancelled":
		return s.Render("✗")
	default:
		return s.Render("?")
	}
}
