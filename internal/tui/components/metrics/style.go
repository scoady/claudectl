package metricscomponent

import "github.com/charmbracelet/lipgloss"

func itemLabelStyle() lipgloss.Style {
	return lipgloss.NewStyle().Foreground(lipgloss.Color("#76839A"))
}

func itemValueStyle() lipgloss.Style {
	return lipgloss.NewStyle().Foreground(lipgloss.Color("#EEF2FF")).Bold(true)
}

func itemSparkStyle(color string) lipgloss.Style {
	return lipgloss.NewStyle().Foreground(lipgloss.Color(color))
}

func rightLabelStyle() lipgloss.Style {
	return lipgloss.NewStyle().Foreground(lipgloss.Color("#EEF2FF")).Bold(true)
}
