// Package tui provides the interactive terminal UI for c9s.
package tui

import "github.com/charmbracelet/lipgloss"

// Theme defines all colors used across the TUI.
type Theme struct {
	Name string

	// Primary accents
	Cyan   lipgloss.Color
	Amber  lipgloss.Color
	Purple lipgloss.Color
	Green  lipgloss.Color
	Rose   lipgloss.Color
	Blue   lipgloss.Color

	// Text tiers
	White   lipgloss.Color
	SubText lipgloss.Color
	Dim     lipgloss.Color
	Faint   lipgloss.Color
	Muted   lipgloss.Color

	// Surfaces
	Glass       lipgloss.Color
	Surface0    lipgloss.Color
	Surface1    lipgloss.Color
	Surface2    lipgloss.Color
	BorderColor lipgloss.Color
	GlowBorder  lipgloss.Color

	// Badge backgrounds
	BadgeCyanBg   lipgloss.Color
	BadgeAmberBg  lipgloss.Color
	BadgePurpleBg lipgloss.Color
	BadgeGreenBg  lipgloss.Color
	BadgeRoseBg   lipgloss.Color
	BadgeBlueBg   lipgloss.Color
}

// BuiltinThemes is an ordered list of all built-in themes.
var BuiltinThemes = []Theme{
	ThemeConstellation,
	ThemeMidnight,
	ThemeSolarizedDark,
	ThemeCyberpunk,
	ThemeLight,
}

// ThemeByName returns a theme by name (case-insensitive match on first chars).
// Returns ThemeConstellation if not found.
func ThemeByName(name string) Theme {
	for _, t := range BuiltinThemes {
		if t.Name == name {
			return t
		}
	}
	return ThemeConstellation
}

// ── Built-in themes ──────────────────────────────────────────────────────────

// ThemeConstellation is the default space/dark theme with cyan/purple/amber accents.
var ThemeConstellation = Theme{
	Name:   "constellation",
	Cyan:   lipgloss.Color("#67e8f9"),
	Amber:  lipgloss.Color("#fbbf24"),
	Purple: lipgloss.Color("#a78bfa"),
	Green:  lipgloss.Color("#34d399"),
	Rose:   lipgloss.Color("#f43f5e"),
	Blue:   lipgloss.Color("#60a5fa"),

	White:   lipgloss.Color("#e2e8f0"),
	SubText: lipgloss.Color("#94a3b8"),
	Dim:     lipgloss.Color("#64748b"),
	Faint:   lipgloss.Color("#475569"),
	Muted:   lipgloss.Color("#334155"),

	Glass:       lipgloss.Color("#0a0f19"),
	Surface0:    lipgloss.Color("#0f172a"),
	Surface1:    lipgloss.Color("#1e293b"),
	Surface2:    lipgloss.Color("#334155"),
	BorderColor: lipgloss.Color("#1e3a5f"),
	GlowBorder:  lipgloss.Color("#38bdf8"),

	BadgeCyanBg:   lipgloss.Color("#164e63"),
	BadgeAmberBg:  lipgloss.Color("#713f12"),
	BadgePurpleBg: lipgloss.Color("#3b1f7e"),
	BadgeGreenBg:  lipgloss.Color("#064e3b"),
	BadgeRoseBg:   lipgloss.Color("#4c0519"),
	BadgeBlueBg:   lipgloss.Color("#1e3a5f"),
}

// ThemeMidnight is a deeper black theme with blue accents, more minimal.
var ThemeMidnight = Theme{
	Name:   "midnight",
	Cyan:   lipgloss.Color("#7dd3fc"),
	Amber:  lipgloss.Color("#93c5fd"),
	Purple: lipgloss.Color("#818cf8"),
	Green:  lipgloss.Color("#6ee7b7"),
	Rose:   lipgloss.Color("#fb7185"),
	Blue:   lipgloss.Color("#60a5fa"),

	White:   lipgloss.Color("#e2e8f0"),
	SubText: lipgloss.Color("#94a3b8"),
	Dim:     lipgloss.Color("#64748b"),
	Faint:   lipgloss.Color("#475569"),
	Muted:   lipgloss.Color("#1e293b"),

	Glass:       lipgloss.Color("#020617"),
	Surface0:    lipgloss.Color("#0f172a"),
	Surface1:    lipgloss.Color("#1e293b"),
	Surface2:    lipgloss.Color("#334155"),
	BorderColor: lipgloss.Color("#1e293b"),
	GlowBorder:  lipgloss.Color("#3b82f6"),

	BadgeCyanBg:   lipgloss.Color("#0c4a6e"),
	BadgeAmberBg:  lipgloss.Color("#1e3a5f"),
	BadgePurpleBg: lipgloss.Color("#312e81"),
	BadgeGreenBg:  lipgloss.Color("#064e3b"),
	BadgeRoseBg:   lipgloss.Color("#4c0519"),
	BadgeBlueBg:   lipgloss.Color("#1e3a5f"),
}

// ThemeSolarizedDark is a warm yellows/oranges theme on dark teal backgrounds.
var ThemeSolarizedDark = Theme{
	Name:   "solarized-dark",
	Cyan:   lipgloss.Color("#2aa198"),
	Amber:  lipgloss.Color("#b58900"),
	Purple: lipgloss.Color("#6c71c4"),
	Green:  lipgloss.Color("#859900"),
	Rose:   lipgloss.Color("#dc322f"),
	Blue:   lipgloss.Color("#268bd2"),

	White:   lipgloss.Color("#fdf6e3"),
	SubText: lipgloss.Color("#93a1a1"),
	Dim:     lipgloss.Color("#657b83"),
	Faint:   lipgloss.Color("#586e75"),
	Muted:   lipgloss.Color("#073642"),

	Glass:       lipgloss.Color("#002b36"),
	Surface0:    lipgloss.Color("#073642"),
	Surface1:    lipgloss.Color("#073642"),
	Surface2:    lipgloss.Color("#586e75"),
	BorderColor: lipgloss.Color("#586e75"),
	GlowBorder:  lipgloss.Color("#2aa198"),

	BadgeCyanBg:   lipgloss.Color("#003d42"),
	BadgeAmberBg:  lipgloss.Color("#3d2e00"),
	BadgePurpleBg: lipgloss.Color("#2e2e52"),
	BadgeGreenBg:  lipgloss.Color("#2d3600"),
	BadgeRoseBg:   lipgloss.Color("#420e0e"),
	BadgeBlueBg:   lipgloss.Color("#0e2d45"),
}

// ThemeCyberpunk is a hot pink/neon green/electric blue theme on deep purple.
var ThemeCyberpunk = Theme{
	Name:   "cyberpunk",
	Cyan:   lipgloss.Color("#00fff5"),
	Amber:  lipgloss.Color("#ffe156"),
	Purple: lipgloss.Color("#bd00ff"),
	Green:  lipgloss.Color("#39ff14"),
	Rose:   lipgloss.Color("#ff2079"),
	Blue:   lipgloss.Color("#00d4ff"),

	White:   lipgloss.Color("#f0e6ff"),
	SubText: lipgloss.Color("#b794f6"),
	Dim:     lipgloss.Color("#7c5cbf"),
	Faint:   lipgloss.Color("#5a3d8a"),
	Muted:   lipgloss.Color("#2d1b4e"),

	Glass:       lipgloss.Color("#0d0221"),
	Surface0:    lipgloss.Color("#150934"),
	Surface1:    lipgloss.Color("#1a0a3e"),
	Surface2:    lipgloss.Color("#2d1b4e"),
	BorderColor: lipgloss.Color("#4a1d96"),
	GlowBorder:  lipgloss.Color("#ff2079"),

	BadgeCyanBg:   lipgloss.Color("#003333"),
	BadgeAmberBg:  lipgloss.Color("#3d3200"),
	BadgePurpleBg: lipgloss.Color("#2d004d"),
	BadgeGreenBg:  lipgloss.Color("#0a3300"),
	BadgeRoseBg:   lipgloss.Color("#4d0024"),
	BadgeBlueBg:   lipgloss.Color("#002e3d"),
}

// ThemeLight is a light background with dark text for daytime use.
var ThemeLight = Theme{
	Name:   "light",
	Cyan:   lipgloss.Color("#0891b2"),
	Amber:  lipgloss.Color("#d97706"),
	Purple: lipgloss.Color("#7c3aed"),
	Green:  lipgloss.Color("#059669"),
	Rose:   lipgloss.Color("#e11d48"),
	Blue:   lipgloss.Color("#2563eb"),

	White:   lipgloss.Color("#1e293b"),
	SubText: lipgloss.Color("#475569"),
	Dim:     lipgloss.Color("#64748b"),
	Faint:   lipgloss.Color("#94a3b8"),
	Muted:   lipgloss.Color("#cbd5e1"),

	Glass:       lipgloss.Color("#f8fafc"),
	Surface0:    lipgloss.Color("#f1f5f9"),
	Surface1:    lipgloss.Color("#e2e8f0"),
	Surface2:    lipgloss.Color("#cbd5e1"),
	BorderColor: lipgloss.Color("#94a3b8"),
	GlowBorder:  lipgloss.Color("#0891b2"),

	BadgeCyanBg:   lipgloss.Color("#cffafe"),
	BadgeAmberBg:  lipgloss.Color("#fef3c7"),
	BadgePurpleBg: lipgloss.Color("#ede9fe"),
	BadgeGreenBg:  lipgloss.Color("#d1fae5"),
	BadgeRoseBg:   lipgloss.Color("#ffe4e6"),
	BadgeBlueBg:   lipgloss.Color("#dbeafe"),
}
