package tui

import (
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// SettingsModel represents the settings screen state.
type SettingsModel struct {
	Selected int
	Themes   []Theme
}

// NewSettingsModel creates a new settings model.
func NewSettingsModel() SettingsModel {
	return SettingsModel{
		Themes: BuiltinThemes,
	}
}

// ThemeAppliedMsg signals that a theme was applied and persisted.
type ThemeAppliedMsg struct {
	ThemeName string
}

// ── Rendering ────────────────────────────────────────────────────────────────

// RenderSettings renders the settings screen.
func RenderSettings(m *SettingsModel, width, height int) string {
	var b strings.Builder

	// Title
	title := Class("h2").Render("Settings")
	subtitle := Class("dim").Render(" / Theme")
	b.WriteString("  " + title + subtitle + "\n")
	b.WriteString("  " + HLine(width-4, Muted) + "\n\n")

	for i, theme := range m.Themes {
		isActive := theme.Name == ActiveThemeName
		isSelected := i == m.Selected

		// Build the theme card line
		var line strings.Builder

		// Selection indicator
		if isSelected {
			line.WriteString(lipgloss.NewStyle().Foreground(Cyan).Bold(true).Render("  > "))
		} else {
			line.WriteString("    ")
		}

		// Active checkmark
		if isActive {
			line.WriteString(lipgloss.NewStyle().Foreground(Green).Bold(true).Render("[*] "))
		} else {
			line.WriteString(lipgloss.NewStyle().Foreground(Dim).Render("[ ] "))
		}

		// Theme name
		name := themeDisplayName(theme.Name)
		if isSelected {
			line.WriteString(lipgloss.NewStyle().Foreground(White).Bold(true).Render(name))
		} else if isActive {
			line.WriteString(lipgloss.NewStyle().Foreground(Green).Render(name))
		} else {
			line.WriteString(lipgloss.NewStyle().Foreground(SubText).Render(name))
		}

		// Color swatches — show sample of the theme's accent colors
		line.WriteString("  ")
		line.WriteString(renderSwatches(theme))

		b.WriteString(line.String() + "\n")

		// Description line
		desc := themeDescription(theme.Name)
		if isSelected {
			b.WriteString("        " + lipgloss.NewStyle().Foreground(Dim).Italic(true).Render(desc) + "\n")
		}
		b.WriteString("\n")
	}

	// Footer hints
	b.WriteString("\n")
	b.WriteString("  " + Class("dim").Render("j/k navigate  Enter apply  Esc back"))

	return b.String()
}

// renderSwatches renders colored block characters showing a theme's palette.
func renderSwatches(t Theme) string {
	colors := []lipgloss.Color{t.Cyan, t.Amber, t.Purple, t.Green, t.Rose, t.Blue}
	var s strings.Builder
	for _, c := range colors {
		s.WriteString(lipgloss.NewStyle().Foreground(c).Render("\u2588\u2588"))
		s.WriteString(" ")
	}

	// Show surface tones too
	s.WriteString(" ")
	surfaces := []lipgloss.Color{t.Glass, t.Surface0, t.Surface1, t.Surface2}
	for _, c := range surfaces {
		s.WriteString(lipgloss.NewStyle().Background(c).Render("  "))
	}

	return s.String()
}

func themeDisplayName(name string) string {
	switch name {
	case "constellation":
		return "Constellation"
	case "midnight":
		return "Midnight"
	case "solarized-dark":
		return "Solarized Dark"
	case "cyberpunk":
		return "Cyberpunk"
	case "light":
		return "Light"
	default:
		return name
	}
}

func themeDescription(name string) string {
	switch name {
	case "constellation":
		return "Default space theme -- cyan/purple/amber accents on deep navy"
	case "midnight":
		return "Deeper blacks with blue-shifted accents, minimal and cool"
	case "solarized-dark":
		return "Classic warm palette -- yellows/oranges on dark teal"
	case "cyberpunk":
		return "Neon pink, electric green, and cyan on deep purple"
	case "light":
		return "Light background with rich dark text for daytime use"
	default:
		return ""
	}
}

// handleSettingsKey processes key events for the settings screen.
func (a *App) handleSettingsKey(key string) (tea.Model, tea.Cmd) {
	switch key {
	case "j", "down":
		a.settings.Selected++
		if a.settings.Selected >= len(a.settings.Themes) {
			a.settings.Selected = len(a.settings.Themes) - 1
		}
	case "k", "up":
		a.settings.Selected--
		if a.settings.Selected < 0 {
			a.settings.Selected = 0
		}
	case "enter":
		// Apply the selected theme
		theme := a.settings.Themes[a.settings.Selected]
		ApplyTheme(theme)
		cfg := LoadConfig()
		cfg.Theme = theme.Name
		_ = SaveConfig(cfg)
		a.statusMsg = "Theme: " + themeDisplayName(theme.Name)
		a.statusTime = time.Now()
	case "esc", "q":
		a.screen = ScreenDashboard
	}
	return a, nil
}
