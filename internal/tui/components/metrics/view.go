package metricscomponent

import (
	"strings"

	"github.com/charmbracelet/lipgloss"
)

func Render(model Model, width int) string {
	if width <= 0 {
		return ""
	}
	left := renderItems(model.Items)
	right := compactText(model.RightLabel)
	rightW := lipgloss.Width(right)
	leftW := width - rightW
	if right != "" {
		leftW--
	}
	if leftW < 0 {
		leftW = 0
	}
	leftRendered := lipgloss.NewStyle().Width(leftW).Render(truncate(left, leftW))
	if right == "" {
		return lipgloss.NewStyle().Width(width).Render(leftRendered)
	}
	rightRendered := rightLabelStyle().Render(right)
	row := leftRendered + strings.Repeat(" ", max(1, width-lipgloss.Width(leftRendered)-lipgloss.Width(rightRendered))) + rightRendered
	if lipgloss.Width(row) < width {
		row += strings.Repeat(" ", width-lipgloss.Width(row))
	}
	return row
}

func renderItems(items []Item) string {
	parts := make([]string, 0, len(items))
	for _, item := range items {
		parts = append(parts, renderItem(item))
	}
	return compactText(strings.Join(parts, "  "))
}

func renderItem(item Item) string {
	spark := compactText(item.Spark)
	if strings.TrimSpace(spark) == "" {
		spark = itemSparkStyle("#455468").Render("▁")
	} else {
		spark = itemSparkStyle(item.Color).Render(spark)
	}
	return itemLabelStyle().Render(compactText(item.Label)+" ") +
		itemValueStyle().Render(compactText(item.Value)+" ") +
		spark
}

func compactText(s string) string {
	s = strings.ReplaceAll(s, "\r", " ")
	s = strings.ReplaceAll(s, "\n", " ")
	s = strings.TrimSpace(s)
	for strings.Contains(s, "  ") {
		s = strings.ReplaceAll(s, "  ", " ")
	}
	return s
}

func truncate(s string, maxW int) string {
	if maxW <= 0 {
		return ""
	}
	if lipgloss.Width(s) <= maxW {
		return s
	}
	runes := []rune(s)
	if maxW <= 1 {
		return string(runes[:1])
	}
	out := ""
	for _, r := range runes {
		next := out + string(r)
		if lipgloss.Width(next+"…") > maxW {
			break
		}
		out = next
	}
	if out == "" {
		return "…"
	}
	return out + "…"
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
