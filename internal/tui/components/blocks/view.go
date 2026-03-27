package blocks

import (
	"sort"
	"strings"

	"github.com/charmbracelet/lipgloss"
	zone "github.com/lrstanley/bubblezone"
)

func RenderCard(block Block, width, height int, hovered, selected bool) string {
	header := block.BlockHeader()
	headLeft := titleStyle(header.Accent).Render(header.Title)
	headRight := ""
	if strings.TrimSpace(header.Badge) != "" {
		headRight = badgeStyle(header.Accent).Render(header.Badge)
	}
	lines := []string{
		alignedRow(headLeft, headRight, max(12, width-4)),
	}
	bodyH := max(3, height-3)
	lines = append(lines, padOrTrim(block.RenderBody(max(12, width-4), bodyH), bodyH)...)
	view := chromeStyle(width, height, header.Accent, hovered, selected).Render(strings.Join(lines, "\n"))
	if strings.TrimSpace(header.ZoneID) != "" {
		return zone.Mark(header.ZoneID, view)
	}
	return view
}

func RenderCanvas(canvas Canvas, width, height int, hovered map[string]bool) string {
	if len(canvas.Blocks) == 0 || width <= 0 || height <= 0 {
		return ""
	}

	rows := map[int][]Block{}
	rowOrder := make([]int, 0)
	for _, block := range canvas.Blocks {
		row := block.BlockPlacement().Row
		if _, ok := rows[row]; !ok {
			rowOrder = append(rowOrder, row)
		}
		rows[row] = append(rows[row], block)
	}
	sort.Ints(rowOrder)

	gap := canvas.Gap
	if gap < 0 {
		gap = 0
	}
	colW := max(8, (width-(canvas.Columns-1)*gap)/canvas.Columns)
	rowGap := 1
	rowHeights := make([]int, 0, len(rowOrder))
	totalBody := height - max(0, len(rowOrder)-1)*rowGap
	for _, row := range rowOrder {
		rowH := 0
		for _, block := range rows[row] {
			sizing := block.BlockSizing()
			rowH = max(rowH, max(sizing.MinHeight, sizing.PreferredHeight))
		}
		if rowH == 0 {
			rowH = 8
		}
		rowHeights = append(rowHeights, rowH)
	}
	if len(rowHeights) > 0 {
		sum := 0
		for _, h := range rowHeights {
			sum += h
		}
		if sum != totalBody && totalBody > 0 {
			rowHeights[len(rowHeights)-1] += totalBody - sum
		}
	}

	renderedRows := make([]string, 0, len(rowOrder))
	for i, row := range rowOrder {
		blocks := rows[row]
		sort.Slice(blocks, func(a, b int) bool {
			return blocks[a].BlockPlacement().Col < blocks[b].BlockPlacement().Col
		})
		parts := make([]string, 0, len(blocks))
		for _, block := range blocks {
			span := max(1, block.BlockPlacement().ColSpan)
			blockW := colW*span + gap*(span-1)
			blockID := block.BlockID()
			parts = append(parts, RenderCard(block, blockW, max(6, rowHeights[i]), hovered[blockID], false))
		}
		renderedRows = append(renderedRows, lipgloss.JoinHorizontal(lipgloss.Top, interleave(parts, strings.Repeat(" ", gap))...))
	}
	return strings.Join(renderedRows, strings.Repeat("\n", rowGap))
}

func alignedRow(left, right string, width int) string {
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
	row := leftRendered + strings.Repeat(" ", max(1, width-lipgloss.Width(leftRendered)-rightW)) + right
	if lipgloss.Width(row) < width {
		row += strings.Repeat(" ", width-lipgloss.Width(row))
	}
	return row
}

func padOrTrim(lines []string, height int) []string {
	if height <= 0 {
		return nil
	}
	out := append([]string(nil), lines...)
	for len(out) < height {
		out = append(out, "")
	}
	if len(out) > height {
		out = out[:height]
	}
	return out
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

func interleave(items []string, sep string) []string {
	if len(items) == 0 {
		return nil
	}
	out := make([]string, 0, len(items)*2-1)
	for i, item := range items {
		if i > 0 {
			out = append(out, sep)
		}
		out = append(out, item)
	}
	return out
}
