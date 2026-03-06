// Package tui provides the interactive terminal UI for c9s.
package tui

import "github.com/charmbracelet/lipgloss"

// ── Color palette — space/constellation theme ────────────────────────────────

var (
	// Primary accents
	Cyan   = lipgloss.Color("#67e8f9")
	Amber  = lipgloss.Color("#fbbf24")
	Purple = lipgloss.Color("#a78bfa")
	Green  = lipgloss.Color("#34d399")
	Rose   = lipgloss.Color("#f43f5e")
	Blue   = lipgloss.Color("#60a5fa")

	// Text tiers
	White    = lipgloss.Color("#e2e8f0")
	SubText  = lipgloss.Color("#94a3b8")
	Dim      = lipgloss.Color("#64748b")
	Faint    = lipgloss.Color("#475569")
	Muted    = lipgloss.Color("#334155")

	// Surface / depth layers
	Glass       = lipgloss.Color("#0a0f19") // deepest background
	Surface0    = lipgloss.Color("#0f172a") // panels, overlays
	Surface1    = lipgloss.Color("#1e293b") // selected rows, footer bar
	Surface2    = lipgloss.Color("#334155") // hover, secondary panels
	BorderColor = lipgloss.Color("#1e3a5f") // subtle blue-tinted borders
	GlowBorder  = lipgloss.Color("#38bdf8") // bright glow for focus

	// Badge backgrounds (muted tints)
	BadgeCyanBg   = lipgloss.Color("#164e63")
	BadgeAmberBg  = lipgloss.Color("#713f12")
	BadgePurpleBg = lipgloss.Color("#3b1f7e")
	BadgeGreenBg  = lipgloss.Color("#064e3b")
	BadgeRoseBg   = lipgloss.Color("#4c0519")
	BadgeBlueBg   = lipgloss.Color("#1e3a5f")
)

// ── Reusable styles ──────────────────────────────────────────────────────────

var (
	// ── Header bar ──
	LogoStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(Cyan)

	LogoAccent = lipgloss.NewStyle().
			Bold(true).
			Foreground(Purple)

	HeaderBarStyle = lipgloss.NewStyle().
			Background(Surface0)

	HeaderStatusOK = lipgloss.NewStyle().
			Foreground(Green).
			Bold(true)

	HeaderStatusErr = lipgloss.NewStyle().
			Foreground(Rose).
			Bold(true)

	HeaderDim = lipgloss.NewStyle().
			Foreground(Dim)

	HeaderBadge = lipgloss.NewStyle().
			Foreground(Cyan).
			Background(BadgeCyanBg).
			Bold(true).
			Padding(0, 1)

	HeaderScreenBadge = lipgloss.NewStyle().
				Foreground(Purple).
				Background(BadgePurpleBg).
				Bold(true).
				Padding(0, 1)

	// ── Footer ──
	FooterKeyStyle = lipgloss.NewStyle().
			Foreground(Surface0).
			Background(Cyan).
			Bold(true).
			Padding(0, 1)

	FooterDescStyle = lipgloss.NewStyle().
			Foreground(SubText)

	FooterBarStyle = lipgloss.NewStyle().
			Background(Surface1)

	FooterSep = lipgloss.NewStyle().
			Foreground(Muted)

	// ── Table styles ──
	TableHeaderStyle = lipgloss.NewStyle().
				Bold(true).
				Foreground(Purple).
				Padding(0, 1)

	TableCellStyle = lipgloss.NewStyle().
			Foreground(SubText).
			Padding(0, 1)

	TableSelectedStyle = lipgloss.NewStyle().
				Background(Surface1).
				Foreground(Cyan).
				Bold(true).
				Padding(0, 1)

	TableDivider = lipgloss.NewStyle().
			Foreground(Muted)

	// ── Status styles ──
	StatusWorkingStyle = lipgloss.NewStyle().Foreground(Amber).Bold(true)
	StatusIdleStyle    = lipgloss.NewStyle().Foreground(Cyan)
	StatusDoneStyle    = lipgloss.NewStyle().Foreground(Green)
	StatusErrorStyle   = lipgloss.NewStyle().Foreground(Rose).Bold(true)

	// ── Card / panel styles ──
	CardStyle = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(BorderColor).
			Padding(0, 1).
			Background(Surface0)

	CardTitleStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(White)

	CardSubtitle = lipgloss.NewStyle().
			Foreground(Dim).
			Italic(true)

	// ── Tab bar ──
	TabActiveStyle = lipgloss.NewStyle().
			Foreground(Cyan).
			Background(Surface1).
			Bold(true).
			Padding(0, 2).
			Border(lipgloss.Border{Bottom: "▀"}, false, false, true, false).
			BorderForeground(Cyan)

	TabInactiveStyle = lipgloss.NewStyle().
				Foreground(Dim).
				Padding(0, 2)

	TabBarSeparator = lipgloss.NewStyle().
			Foreground(Muted)

	// ── Section header ──
	SectionStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(Purple)

	// ── Command bar ──
	CmdBarStyle = lipgloss.NewStyle().
			Foreground(Cyan).
			Bold(true)

	CmdInputStyle = lipgloss.NewStyle().
			Foreground(White)

	// ── Help overlay ──
	HelpOverlayStyle = lipgloss.NewStyle().
				Border(lipgloss.RoundedBorder()).
				BorderForeground(Purple).
				Padding(1, 3).
				Background(Surface0)

	HelpKeyStyle = lipgloss.NewStyle().
			Foreground(Cyan).
			Bold(true).
			Width(16)

	HelpDescStyle = lipgloss.NewStyle().
			Foreground(SubText)

	HelpTitleStyle = lipgloss.NewStyle().
			Foreground(Purple).
			Bold(true).
			MarginBottom(1)

	HelpSectionStyle = lipgloss.NewStyle().
				Foreground(Amber).
				Bold(true).
				MarginTop(1).
				MarginBottom(0)

	// ── Dialog / overlay styles ──
	DialogStyle = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(GlowBorder).
			Padding(1, 2).
			Background(Surface0)

	DialogTitleBar = lipgloss.NewStyle().
			Background(BadgeCyanBg).
			Foreground(Cyan).
			Bold(true).
			Padding(0, 2).
			MarginBottom(1)

	DialogLabel = lipgloss.NewStyle().
			Foreground(Dim).
			Width(12)

	DialogValue = lipgloss.NewStyle().
			Foreground(White).
			Bold(true)

	DialogSuccess = lipgloss.NewStyle().
			Foreground(Green).
			Background(BadgeGreenBg).
			Bold(true).
			Padding(0, 1)

	DialogError = lipgloss.NewStyle().
			Foreground(Rose).
			Background(BadgeRoseBg).
			Bold(true).
			Padding(0, 1)

	DialogHint = lipgloss.NewStyle().
			Foreground(Dim)

	// ── Misc ──
	BoldStyle = lipgloss.NewStyle().Bold(true).Foreground(White)
	DimStyle  = lipgloss.NewStyle().Foreground(Dim)
	FaintStyle = lipgloss.NewStyle().Foreground(Faint)
	MutedStyle = lipgloss.NewStyle().Foreground(Muted)
	SubStyle   = lipgloss.NewStyle().Foreground(SubText)

	// ── Filter bar ──
	FilterStyle = lipgloss.NewStyle().
			Foreground(Amber).
			Bold(true)

	// ── Pill badge helper ──
	PillStyle = lipgloss.NewStyle().
			Padding(0, 1).
			Bold(true)

	// ── Indicator for selected row ──
	SelectionIndicator = lipgloss.NewStyle().
				Foreground(Cyan).
				Bold(true)

	// ── Activity sparkline chars ──
	SparkStyle = lipgloss.NewStyle().Foreground(Green)
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
		return s.Render("·")
	}
}

// Pill renders text as a colored pill badge.
func Pill(text string, fg, bg lipgloss.Color) string {
	return PillStyle.Foreground(fg).Background(bg).Render(text)
}

// StatusPill returns a pill-styled status badge.
func StatusPill(status string) string {
	switch status {
	case "working", "active":
		return Pill(" ● "+status+" ", Amber, BadgeAmberBg)
	case "idle":
		return Pill(" ◌ "+status+" ", Cyan, BadgeCyanBg)
	case "done", "complete":
		return Pill(" ✓ "+status+" ", Green, BadgeGreenBg)
	case "error", "disconnected", "cancelled":
		return Pill(" ✗ "+status+" ", Rose, BadgeRoseBg)
	default:
		return Pill(" "+status+" ", Dim, Surface2)
	}
}

// Sparkline renders a mini activity bar from an agent count.
// More agents = more bars. Max 8 levels.
func Sparkline(count int) string {
	bars := []string{"▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"}
	if count <= 0 {
		return FaintStyle.Render("▁")
	}
	idx := count - 1
	if idx >= len(bars) {
		idx = len(bars) - 1
	}
	return SparkStyle.Render(bars[idx])
}

// HLine renders a horizontal line of given width using a thin unicode char.
func HLine(width int, color lipgloss.Color) string {
	if width <= 0 {
		return ""
	}
	s := ""
	for i := 0; i < width; i++ {
		s += "─"
	}
	return lipgloss.NewStyle().Foreground(color).Render(s)
}
