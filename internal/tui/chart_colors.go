// Package tui provides the interactive terminal UI for c9s.
package tui

import "github.com/charmbracelet/lipgloss"

// ChartPalette returns a sequence of theme-aware colors for multi-series charts.
// Colors are ordered for maximum visual distinction between adjacent series.
func ChartPalette() []lipgloss.Color {
	return []lipgloss.Color{Cyan, Amber, Purple, Green, Rose, Blue}
}

// ChartColor returns the theme-aware color for a given series index,
// cycling through the palette.
func ChartColor(seriesIdx int) lipgloss.Color {
	palette := ChartPalette()
	return palette[seriesIdx%len(palette)]
}

// ChartStyle returns a lipgloss.Style for a given chart series index.
func ChartStyle(seriesIdx int) lipgloss.Style {
	return lipgloss.NewStyle().Foreground(ChartColor(seriesIdx))
}

// HeatMapColorScale returns a theme-aware color gradient for heatmaps,
// going from surface/dim tones through accent colors to bright highlights.
func HeatMapColorScale() []lipgloss.Color {
	return []lipgloss.Color{
		Surface0,
		Surface1,
		Surface2,
		Muted,
		Faint,
		Dim,
		lipgloss.Color("#1e6091"),
		lipgloss.Color("#2380b9"),
		lipgloss.Color("#2a9fd6"),
		Blue,
		Cyan,
		Green,
		Amber,
		Rose,
	}
}
