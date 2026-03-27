package tui

import (
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/charmbracelet/lipgloss"
	"github.com/scoady/codexctl/internal/api"
)

const workspaceContextBudgetTokens = 128000

func renderWorkspaceTopStrip(m *WorkspaceShellModel, stats *api.StatsResponse, health *api.HealthResponse, store *MetricsStore, host workspaceHostMetrics, width int) string {
	if width <= 0 {
		return ""
	}

	metricWidth := Clamp(4, width/18, 8)
	parts := []string{
		renderWorkspaceMiniMetric("cpu", formatPercent(host.CPUPercent), workspaceSparklineFromSeries(store, "host.cpu", metricWidth, Cyan), Cyan),
		renderWorkspaceMiniMetric("mem", formatPercent(host.MemoryPercent), workspaceSparklineFromSeries(store, "host.mem", metricWidth, Purple), Purple),
		renderWorkspaceMiniMetric("dsk", formatPercent(host.DiskPercent), workspaceSparklineFromSeries(store, "host.disk", metricWidth, Amber), Amber),
		renderWorkspaceMiniMetric("net", formatNetRate(host.NetKBps), workspaceSparklineFromSeries(store, "host.net", metricWidth, Green), Green),
	}
	if stats != nil {
		parts = append(parts, renderWorkspaceMiniMetric("ag", fmt.Sprintf("%d/%d", stats.WorkingAgents, stats.IdleAgents), workspaceSparklineFromSeries(store, "agents.active", metricWidth, Blue), Blue))
	}
	if health != nil {
		parts = append(parts, renderWorkspaceMiniMetric("ws", fmt.Sprintf("%d", health.WSConnections), workspaceSparklineFromSeries(store, "host.net", max(3, metricWidth/2), Rose), Rose))
	}
	left := strings.Join(parts, "  ")
	clock := lipgloss.NewStyle().Foreground(White).Bold(true).Render(time.Now().Format("Mon 3:04 PM"))
	return workspaceShellAlignedRow(left, clock, width, lipgloss.NewStyle().Foreground(SubText), lipgloss.NewStyle().Foreground(White))
}

func renderWorkspaceBottomStrip(m *WorkspaceShellModel, width int) string {
	if width <= 0 {
		return ""
	}

	summary := workspaceContextSummary(m)
	left := fmt.Sprintf("ctx %s  •  %s  •  %s", formatTokenCount(summary.TotalTokens), summary.UsageLabel, summary.BloatLabel)
	return workspaceShellAlignedRow(left, summary.Hint, width, lipgloss.NewStyle().Foreground(Dim), lipgloss.NewStyle().Foreground(SubText))
}

type workspaceContextSummaryInfo struct {
	TotalTokens int
	UsageLabel  string
	BloatLabel  string
	Hint        string
}

func workspaceContextSummary(m *WorkspaceShellModel) workspaceContextSummaryInfo {
	transcriptTokens := estimateTokenCount(m.TranscriptPlainText())
	editorTokens := estimateTokenCount(m.FileBuffers[m.ActiveFileTab])
	promptTokens := estimateTokenCount(m.ComposerValue())

	toolTokens := 0
	for _, msg := range m.TerminalMessages {
		if msg.Type == "tool_use" {
			toolTokens += estimateTokenCount(workspaceShellToolLabel(msg))
		}
	}
	for _, msg := range m.LocalSystemMessages {
		toolTokens += estimateTokenCount(msg.Content)
	}

	total := transcriptTokens + editorTokens + promptTokens + toolTokens
	pct := int(math.Round((float64(total) / workspaceContextBudgetTokens) * 100))
	if pct < 1 && total > 0 {
		pct = 1
	}

	parts := map[string]int{
		"transcript":   transcriptTokens,
		"tool chatter": toolTokens,
		"editor":       editorTokens,
		"prompt":       promptTokens,
	}
	topName := "transcript"
	topValue := parts[topName]
	for name, value := range parts {
		if value > topValue {
			topName = name
			topValue = value
		}
	}

	hint := "summarize older transcript"
	switch topName {
	case "tool chatter":
		hint = "clear noisy command output"
	case "editor":
		hint = "close the heavy file tab"
	case "prompt":
		hint = "trim the current prompt"
	}
	if total < 4000 {
		hint = "healthy headroom"
	}

	return workspaceContextSummaryInfo{
		TotalTokens: total,
		UsageLabel:  fmt.Sprintf("%d%% of 128k", pct),
		BloatLabel:  fmt.Sprintf("bloat %s %s", topName, formatTokenCount(topValue)),
		Hint:        hint,
	}
}

func renderWorkspaceMiniMetric(label, value, spark string, color lipgloss.Color) string {
	if strings.TrimSpace(spark) == "" {
		spark = lipgloss.NewStyle().Foreground(Faint).Render("▁")
	}
	return lipgloss.NewStyle().Foreground(Dim).Render(label+" ") +
		lipgloss.NewStyle().Foreground(White).Bold(true).Render(value+" ") +
		lipgloss.NewStyle().Foreground(color).Render(spark)
}

func workspaceSparklineFromSeries(store *MetricsStore, name string, width int, color lipgloss.Color) string {
	if store == nil {
		return ""
	}
	points := store.Query(name, time.Now().Add(-30*time.Minute))
	if len(points) == 0 {
		return ""
	}
	values := make([]int, 0, len(points))
	for _, point := range points {
		values = append(values, int(math.Round(point.Value)))
	}
	return RenderSparklineStyled(values, width, color)
}

func estimateTokenCount(text string) int {
	text = strings.TrimSpace(text)
	if text == "" {
		return 0
	}
	return int(math.Ceil(float64(len([]rune(text))) / 4.0))
}

func formatTokenCount(tokens int) string {
	if tokens >= 1000 {
		return fmt.Sprintf("%.1fk tok", float64(tokens)/1000.0)
	}
	return fmt.Sprintf("%d tok", tokens)
}

func formatPercent(v float64) string {
	if v <= 0 {
		return "--"
	}
	return fmt.Sprintf("%d%%", int(math.Round(v)))
}

func formatNetRate(v float64) string {
	if v <= 0 {
		return "0k/s"
	}
	if v >= 1024 {
		return fmt.Sprintf("%.1fm/s", v/1024.0)
	}
	return fmt.Sprintf("%.0fk/s", v)
}
