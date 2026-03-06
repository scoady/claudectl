package tui

import (
	"fmt"

	"github.com/charmbracelet/lipgloss"
	"github.com/scoady/claudectl/internal/api"
)

// RenderHeader renders the top bar with logo, status, and stats.
func RenderHeader(width int, health *api.HealthResponse, stats *api.StatsResponse, screen string) string {
	// ── Logo ──
	logo := Class("logo").Render("  c9s") + Class("logo-accent").Render(" ") + Class("dim").Render("claudectl")

	// ── Connection status dot ──
	var statusDot string
	if health != nil && health.Status == "ok" {
		statusDot = Class("header-status-ok").Render("●") +
			lipgloss.NewStyle().Foreground(Green).Render(" connected")
	} else {
		statusDot = Class("header-status-err").Render("○") +
			lipgloss.NewStyle().Foreground(Rose).Render(" disconnected")
	}

	// ── Agent count badge ──
	agentBadge := ""
	if stats != nil && stats.TotalAgents > 0 {
		working := stats.WorkingAgents
		total := stats.TotalAgents
		label := fmt.Sprintf(" %d agents ", total)
		if working > 0 {
			label = fmt.Sprintf(" %d/%d active ", working, total)
		}
		agentBadge = Pill(label, Cyan, BadgeCyanBg)
	}

	// ── Uptime ──
	uptime := ""
	if health != nil && health.Uptime > 0 {
		uptime = Class("dim").Render("up " + formatUptime(health.Uptime))
	}

	// ── Screen breadcrumb pill ──
	screenBadge := Class("header-screen-badge").Render(" " + screen + " ")

	// Compose left side
	left := logo + "  " + statusDot
	if agentBadge != "" {
		left += "  " + agentBadge
	}
	if uptime != "" {
		left += "  " + uptime
	}

	right := screenBadge

	// Fill middle with spaces
	leftWidth := lipgloss.Width(left)
	rightWidth := lipgloss.Width(right)
	gap := width - leftWidth - rightWidth
	if gap < 1 {
		gap = 1
	}
	filler := repeatStr(" ", gap)

	bar := Class("header").
		Width(width).
		Render(left + filler + right)

	// Separator line
	sep := HLine(width, Muted)

	return bar + "\n" + sep
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
