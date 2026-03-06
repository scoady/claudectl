// Package tui provides the interactive terminal UI for c9s.
package tui

import "github.com/charmbracelet/lipgloss"

// styleRegistry holds all named styles, rebuilt on theme change.
var styleRegistry map[string]lipgloss.Style

func init() {
	rebuildClasses()
}

// Class returns a named style from the registry.
// Unknown names return an empty style.
func Class(name string) lipgloss.Style {
	if s, ok := styleRegistry[name]; ok {
		return s
	}
	return lipgloss.NewStyle()
}

// rebuildClasses regenerates all named styles from the current color vars.
// Called from ApplyTheme and at init time.
func rebuildClasses() {
	styleRegistry = map[string]lipgloss.Style{

		// ── Typography ───────────────────────────────────────────────────
		"h1":     lipgloss.NewStyle().Bold(true).Foreground(White),
		"h2":     lipgloss.NewStyle().Bold(true).Foreground(Purple),
		"body":   lipgloss.NewStyle().Foreground(SubText),
		"dim":    lipgloss.NewStyle().Foreground(Dim),
		"faint":  lipgloss.NewStyle().Foreground(Faint),
		"muted":  lipgloss.NewStyle().Foreground(Muted),
		"bold":   lipgloss.NewStyle().Bold(true).Foreground(White),
		"italic": lipgloss.NewStyle().Italic(true).Foreground(SubText),
		"sub":    lipgloss.NewStyle().Foreground(SubText),

		// ── Badges / Pills ───────────────────────────────────────────────
		"badge-cyan":   lipgloss.NewStyle().Foreground(Cyan).Background(BadgeCyanBg).Bold(true).Padding(0, 1),
		"badge-green":  lipgloss.NewStyle().Foreground(Green).Background(BadgeGreenBg).Bold(true).Padding(0, 1),
		"badge-amber":  lipgloss.NewStyle().Foreground(Amber).Background(BadgeAmberBg).Bold(true).Padding(0, 1),
		"badge-rose":   lipgloss.NewStyle().Foreground(Rose).Background(BadgeRoseBg).Bold(true).Padding(0, 1),
		"badge-purple": lipgloss.NewStyle().Foreground(Purple).Background(BadgePurpleBg).Bold(true).Padding(0, 1),
		"badge-blue":   lipgloss.NewStyle().Foreground(Blue).Background(BadgeBlueBg).Bold(true).Padding(0, 1),

		// ── Table ────────────────────────────────────────────────────────
		"th":          lipgloss.NewStyle().Bold(true).Foreground(Purple).Padding(0, 1),
		"td":          lipgloss.NewStyle().Foreground(SubText).Padding(0, 1),
		"td-selected": lipgloss.NewStyle().Background(Surface1).Foreground(Cyan).Bold(true).Padding(0, 1),
		"td-muted":    lipgloss.NewStyle().Foreground(Faint).Padding(0, 1),
		"td-divider":  lipgloss.NewStyle().Foreground(Muted),

		// ── Cards ────────────────────────────────────────────────────────
		"card":        lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).BorderForeground(BorderColor).Padding(0, 1).Background(Surface0),
		"card-header": lipgloss.NewStyle().Bold(true).Foreground(White),
		"card-body":   lipgloss.NewStyle().Foreground(Dim).Italic(true),

		// ── Inputs ───────────────────────────────────────────────────────
		"input":             lipgloss.NewStyle().Foreground(White),
		"input-focused":     lipgloss.NewStyle().Foreground(Cyan).Bold(true),
		"input-placeholder": lipgloss.NewStyle().Foreground(Dim),

		// ── Overlays / Dialogs ───────────────────────────────────────────
		"dialog":         lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).BorderForeground(GlowBorder).Padding(1, 2).Background(Surface0),
		"dialog-title":   lipgloss.NewStyle().Background(BadgeCyanBg).Foreground(Cyan).Bold(true).Padding(0, 2).MarginBottom(1),
		"dialog-label":   lipgloss.NewStyle().Foreground(Dim).Width(12),
		"dialog-value":   lipgloss.NewStyle().Foreground(White).Bold(true),
		"dialog-hint":    lipgloss.NewStyle().Foreground(Dim),
		"dialog-error":   lipgloss.NewStyle().Foreground(Rose).Background(BadgeRoseBg).Bold(true).Padding(0, 1),
		"dialog-success": lipgloss.NewStyle().Foreground(Green).Background(BadgeGreenBg).Bold(true).Padding(0, 1),

		// ── Tabs ─────────────────────────────────────────────────────────
		"tab-active": lipgloss.NewStyle().Foreground(Cyan).Background(Surface1).Bold(true).Padding(0, 2).
			Border(lipgloss.Border{Bottom: "\u2580"}, false, false, true, false).BorderForeground(Cyan),
		"tab-inactive":  lipgloss.NewStyle().Foreground(Dim).Padding(0, 2),
		"tab-separator": lipgloss.NewStyle().Foreground(Muted),

		// ── Status ───────────────────────────────────────────────────────
		"status-active": lipgloss.NewStyle().Foreground(Amber).Bold(true),
		"status-idle":   lipgloss.NewStyle().Foreground(Cyan),
		"status-done":   lipgloss.NewStyle().Foreground(Green),
		"status-error":  lipgloss.NewStyle().Foreground(Rose).Bold(true),

		// ── Palette ──────────────────────────────────────────────────────
		"palette-input":    lipgloss.NewStyle().Foreground(Cyan).Bold(true),
		"palette-result":   lipgloss.NewStyle().Foreground(SubText).Background(Surface0).Padding(0, 2),
		"palette-selected": lipgloss.NewStyle().Foreground(Cyan).Background(Surface1).Bold(true).Padding(0, 2),
		"palette-category": lipgloss.NewStyle().Foreground(Dim).Background(Surface0).Italic(true),

		// ── Mission panes ────────────────────────────────────────────────
		"pane-focused":   lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).BorderForeground(GlowBorder).Background(Surface0),
		"pane-unfocused": lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).BorderForeground(BorderColor).Background(Surface0),
		"pane-done":      lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).BorderForeground(Green).Background(Surface0),

		// ── Layout / Chrome ──────────────────────────────────────────────
		"header":              lipgloss.NewStyle().Background(Surface0),
		"header-badge":        lipgloss.NewStyle().Foreground(Cyan).Background(BadgeCyanBg).Bold(true).Padding(0, 1),
		"header-screen-badge": lipgloss.NewStyle().Foreground(Purple).Background(BadgePurpleBg).Bold(true).Padding(0, 1),
		"footer-key":          lipgloss.NewStyle().Foreground(Surface0).Background(Cyan).Bold(true).Padding(0, 1),
		"footer-desc":         lipgloss.NewStyle().Foreground(SubText),
		"footer-bar":          lipgloss.NewStyle().Background(Surface1),
		"footer-sep":          lipgloss.NewStyle().Foreground(Muted),
		"section-title":       lipgloss.NewStyle().Bold(true).Foreground(Purple),
		"selection-indicator":  lipgloss.NewStyle().Foreground(Cyan).Bold(true),

		// ── Help overlay ─────────────────────────────────────────────────
		"help-overlay":  lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).BorderForeground(Purple).Padding(1, 3).Background(Surface0),
		"help-key":      lipgloss.NewStyle().Foreground(Cyan).Bold(true).Width(16),
		"help-desc":     lipgloss.NewStyle().Foreground(SubText),
		"help-title":    lipgloss.NewStyle().Foreground(Purple).Bold(true).MarginBottom(1),
		"help-section":  lipgloss.NewStyle().Foreground(Amber).Bold(true).MarginTop(1).MarginBottom(0),

		// ── Watch view ───────────────────────────────────────────────────
		"watch-header":     lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).BorderForeground(BorderColor).Padding(0, 1).Background(Surface0),
		"watch-header-key": lipgloss.NewStyle().Foreground(Dim).Width(10),
		"watch-header-val": lipgloss.NewStyle().Foreground(White).Bold(true),
		"watch-done":       lipgloss.NewStyle().Bold(true).Foreground(Green).Border(lipgloss.RoundedBorder()).BorderForeground(Green).Background(BadgeGreenBg).Padding(0, 3).Align(lipgloss.Center),
		"watch-scroll":     lipgloss.NewStyle().Foreground(Dim),
		"watch-follow":     lipgloss.NewStyle().Foreground(Surface0).Background(Green).Bold(true).Padding(0, 1),
		"watch-paused":     lipgloss.NewStyle().Foreground(Surface0).Background(Amber).Bold(true).Padding(0, 1),

		// ── Logo ─────────────────────────────────────────────────────────
		"logo":        lipgloss.NewStyle().Bold(true).Foreground(Cyan),
		"logo-accent": lipgloss.NewStyle().Bold(true).Foreground(Purple),

		// ── Header status ────────────────────────────────────────────────
		"header-status-ok":  lipgloss.NewStyle().Foreground(Green).Bold(true),
		"header-status-err": lipgloss.NewStyle().Foreground(Rose).Bold(true),
		"header-dim":        lipgloss.NewStyle().Foreground(Dim),

		// ── Command / Filter bar ─────────────────────────────────────────
		"cmd-bar":    lipgloss.NewStyle().Foreground(Cyan).Bold(true),
		"cmd-input":  lipgloss.NewStyle().Foreground(White),
		"filter-bar": lipgloss.NewStyle().Foreground(Amber).Bold(true),

		// ── Pill ─────────────────────────────────────────────────────────
		"pill": lipgloss.NewStyle().Padding(0, 1).Bold(true),

		// ── Spark ────────────────────────────────────────────────────────
		"spark": lipgloss.NewStyle().Foreground(Green),
	}
}
