package tui

import (
	"fmt"

	"github.com/charmbracelet/lipgloss"
	"github.com/scoady/claudectl/internal/api"
)

// RenderHeader renders the top bar with logo, status, and stats.
func RenderHeader(width int, health *api.HealthResponse, stats *api.StatsResponse, screen string) string {
	logo := LogoStyle.Render("⋆ c9s")

	// Backend status
	status := HeaderStatusErr.Render("● disconnected")
	if health != nil && health.Status == "ok" {
		status = HeaderStatusOK.Render("● connected")
	}

	// Agent count
	agentCount := ""
	if stats != nil {
		agentCount = HeaderDim.Render(fmt.Sprintf("  agents:%d", stats.TotalAgents))
	}

	// Uptime
	uptime := ""
	if health != nil {
		uptime = HeaderDim.Render(fmt.Sprintf("  up:%s", formatUptime(health.Uptime)))
	}

	// Screen indicator
	screenLabel := HeaderDim.Render("  [" + screen + "]")

	left := logo + "  " + status + agentCount + uptime
	right := screenLabel

	// Fill middle with spaces
	leftWidth := lipgloss.Width(left)
	rightWidth := lipgloss.Width(right)
	gap := width - leftWidth - rightWidth
	if gap < 1 {
		gap = 1
	}
	filler := HeaderDim.Render(repeatStr(" ", gap))

	bar := lipgloss.NewStyle().
		Background(lipgloss.Color("#0f172a")).
		Width(width).
		Render(left + filler + right)

	return bar
}

func formatUptime(seconds float64) string {
	if seconds < 60 {
		return fmt.Sprintf("%.0fs", seconds)
	}
	if seconds < 3600 {
		return fmt.Sprintf("%.0fm", seconds/60)
	}
	hours := int(seconds) / 3600
	mins := (int(seconds) % 3600) / 60
	return fmt.Sprintf("%dh%dm", hours, mins)
}

func repeatStr(s string, n int) string {
	if n <= 0 {
		return ""
	}
	out := ""
	for i := 0; i < n; i++ {
		out += s
	}
	return out
}
