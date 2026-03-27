package tui

import (
	"strings"

	"github.com/charmbracelet/lipgloss"
	zone "github.com/lrstanley/bubblezone"
)

type zoneCardSpec struct {
	ZoneID   string
	Icon     string
	Title    string
	Badge    string
	Accent   lipgloss.Color
	Width    int
	Height   int
	Hovered  bool
	Selected bool
	Body     []string
}

func renderZoneCard(spec zoneCardSpec) string {
	titleColor := White
	borderColor := BorderColor
	bgColor := workspaceShellPanelBg
	if spec.Selected {
		borderColor = spec.Accent
		bgColor = lipgloss.Color("#111926")
	}
	if spec.Hovered {
		borderColor = spec.Accent
		bgColor = lipgloss.Color("#101824")
	}

	headLeft := lipgloss.NewStyle().Foreground(spec.Accent).Bold(true).Render(spec.Icon + " " + spec.Title)
	headRight := ""
	if strings.TrimSpace(spec.Badge) != "" {
		headRight = lipgloss.NewStyle().Foreground(spec.Accent).Render(spec.Badge)
	}
	header := workspaceShellAlignedRow(headLeft, headRight, max(12, spec.Width-4), lipgloss.NewStyle().Foreground(titleColor), lipgloss.NewStyle().Foreground(spec.Accent))
	bodyLines := padOrTrimLines(spec.Body, max(3, spec.Height-4))
	content := append([]string{header, ""}, bodyLines...)
	style := lipgloss.NewStyle().
		Width(spec.Width).
		Height(spec.Height).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(borderColor).
		Padding(0, 1).
		Background(bgColor)
	return zone.Mark(spec.ZoneID, style.Render(strings.Join(content, "\n")))
}
