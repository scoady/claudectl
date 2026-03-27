package blocks

import "github.com/charmbracelet/lipgloss"

var (
	blockBG         = lipgloss.Color("#05080d")
	blockHoverBG    = lipgloss.Color("#0a0f16")
	blockSelectedBG = lipgloss.Color("#101725")
	blockBorder     = lipgloss.Color("#163247")
	blockMutedFG    = lipgloss.Color("#738196")
	blockBodyFG     = lipgloss.Color("#d6dde8")
)

func titleStyle(accent lipgloss.Color) lipgloss.Style {
	return lipgloss.NewStyle().Foreground(accent).Bold(true)
}

func badgeStyle(accent lipgloss.Color) lipgloss.Style {
	return lipgloss.NewStyle().Foreground(accent).Bold(true)
}

func bodyStyle() lipgloss.Style {
	return lipgloss.NewStyle().Foreground(blockBodyFG)
}

func mutedStyle() lipgloss.Style {
	return lipgloss.NewStyle().Foreground(blockMutedFG)
}

func chromeStyle(width, height int, accent lipgloss.Color, hovered, selected bool) lipgloss.Style {
	bg := blockBG
	border := blockBorder
	if hovered {
		bg = blockHoverBG
		border = accent
	}
	if selected {
		bg = blockSelectedBG
		border = accent
	}
	return lipgloss.NewStyle().
		Width(width).
		Height(height).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(border).
		Padding(0, 1).
		Background(bg)
}

func accentColor(hex string) lipgloss.Color {
	if hex == "" {
		return lipgloss.Color("#6ad1ff")
	}
	return lipgloss.Color(hex)
}
