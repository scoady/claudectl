package tui

import (
	"fmt"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	zone "github.com/lrstanley/bubblezone"
	tuistyle "github.com/scoady/codexctl/internal/tui/style"
)

func renderWorkspaceExplorerList(m *WorkspaceShellModel, width, height int, mouse MousePoint) string {
	items := m.explorerItems()
	if len(items) == 0 {
		return strings.Join(padOrTrimLines([]string{
			lipgloss.NewStyle().Foreground(Dim).Render("No files yet."),
			lipgloss.NewStyle().Foreground(Dim).Render("Right-click or press n to create one."),
		}, height), "\n")
	}

	mouseMsg := teaMouseFromPoint(mouse)
	lines := make([]string, 0, len(items))
	for i, item := range items {
		lines = append(lines, renderWorkspaceExplorerRow(
			m,
			item,
			max(18, width),
			i == m.Selection.ExplorerItem,
			zoneInBounds(workspaceExplorerZoneID(i), mouseMsg),
			workspaceExplorerZoneID(i),
		))
	}
	return strings.Join(padOrTrimLines(lines, height), "\n")
}

func renderWorkspaceExplorerRow(m *WorkspaceShellModel, item workspaceShellExplorerItem, width int, selected, hovered bool, zoneID string) string {
	accent, badge := m.explorerAccentAndBadge(item)
	rowWidth := max(18, width)

	label := workspaceExplorerDisplayName(item)
	if item.IsDir && !item.IsParent {
		label += "/"
	}

	bg, markerFG, nameColor, metaColor, marker := tuistyle.WorkspaceExplorerRowColors(
		coalesceColor(accent, White),
		workspaceShellLine,
		coalesceColor(accent, SubText),
		GlowBorder,
		coalesceColor(accent, White),
		White,
		Dim,
		SubText,
		selected,
		hovered,
	)
	prefix := lipgloss.NewStyle().
		Foreground(markerFG).
		Background(bg).
		Render(marker)

	depth := workspaceExplorerDepth(item.Path)
	treeLead := strings.Repeat("  ", min(depth, 4))
	glyph := "• "
	if item.IsDir {
		glyph = "▾ "
	}
	if item.IsParent {
		glyph = "↰ "
	}
	icon := lipgloss.NewStyle().
		Foreground(nameColor).
		Background(bg).
		Render(item.Icon)
	rightText := badge

	rightW := lipgloss.Width(strings.TrimSpace(rightText))
	leftW := max(8, rowWidth-4-rightW)
	if rightW > 0 {
		leftW--
	}

	tree := lipgloss.NewStyle().Foreground(metaColor).Background(bg).Render(treeLead + glyph)
	left := tree + icon + " " + lipgloss.NewStyle().
		Foreground(nameColor).
		Background(bg).
		Bold(selected).
		Render(truncate(label, max(8, leftW-lipgloss.Width(treeLead+glyph)-lipgloss.Width(item.Icon)-1)))

	right := lipgloss.NewStyle().Foreground(metaColor).Background(bg).Render(rightText)
	body := left
	if rightW > 0 {
		gap := max(1, rowWidth-2-lipgloss.Width(stripANSI(left))-rightW)
		body += strings.Repeat(" ", gap) + right
	}

	row := lipgloss.NewStyle().
		Width(rowWidth-1).
		Padding(0, 0).
		Background(bg).
		Render(body)

	return zone.Mark(zoneID, prefix+row)
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func stripANSI(s string) string {
	var out []rune
	inEsc := false
	for _, r := range s {
		switch {
		case r == '\x1b':
			inEsc = true
		case inEsc && r == 'm':
			inEsc = false
		case !inEsc:
			out = append(out, r)
		}
	}
	return string(out)
}

func workspaceExplorerZoneID(index int) string {
	return fmt.Sprintf("workspace:explorer:%d", index)
}

func workspaceExplorerIndexAt(msg tea.MouseMsg, m *WorkspaceShellModel) (int, bool) {
	for i := range m.explorerItems() {
		if zoneInBounds(workspaceExplorerZoneID(i), msg) {
			return i, true
		}
	}
	return 0, false
}
