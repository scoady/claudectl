package tui

import (
	"fmt"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	zone "github.com/lrstanley/bubblezone"
	tuistyle "github.com/scoady/codexctl/internal/tui/style"
)

func renderWorkspaceProjectPicker(m *WorkspaceShellModel, rect workspaceShellRect, mouse MousePoint) string {
	width := max(24, min(rect.W, 56))
	items := m.ProjectPicker.Items()
	lines := []string{
		lipgloss.NewStyle().Foreground(Cyan).Bold(true).Render("Projects"),
		lipgloss.NewStyle().Foreground(Dim).Render("Open, switch, or create a workspace"),
		"",
	}
	if len(items) == 0 {
		lines = append(lines, lipgloss.NewStyle().Foreground(Dim).Render("No projects yet"))
		return strings.Join(lines, "\n")
	}

	mouseMsg := tea.MouseMsg{X: mouse.X, Y: mouse.Y}
	for i, raw := range items {
		item, ok := raw.(workspaceShellListItem)
		if !ok {
			continue
		}
		id := workspaceProjectPickerZoneID(i)
		hovered := zoneInBounds(id, mouseMsg)
		selected := i == m.ProjectPicker.Index()
		lines = append(lines, renderWorkspaceProjectPickerRow(item, width, selected, hovered, id)...)
	}

	return strings.Join(lines, "\n")
}

func renderWorkspaceProjectPickerRow(item workspaceShellListItem, width int, selected, hovered bool, zoneID string) []string {
	rowWidth := max(20, width-2)
	icon := "◌"
	createItem := false
	if item.action == "create" {
		icon = "+"
		createItem = true
	}

	bg, borderColor, titleColor, descColor := tuistyle.WorkspacePickerRowColors(
		Green,
		White,
		Cyan,
		Dim,
		SubText,
		workspaceShellLine,
		GlowBorder,
		selected,
		hovered,
		createItem,
	)

	badge := ""
	if strings.TrimSpace(item.badge) != "" {
		badge = lipgloss.NewStyle().
			Foreground(coalesceColor(item.accent, Cyan)).
			Render(item.badge)
	}

	titleLeft := lipgloss.NewStyle().
		Foreground(titleColor).
		Bold(selected).
		Render(icon + " " + truncate(item.title, max(8, rowWidth-10)))
	titleLine := workspaceShellAlignedRow(
		titleLeft,
		badge,
		rowWidth,
		lipgloss.NewStyle(),
		lipgloss.NewStyle(),
	)
	descLine := lipgloss.NewStyle().
		Width(rowWidth).
		Foreground(descColor).
		Render(truncate(strings.TrimSpace(item.desc), rowWidth))

	style := lipgloss.NewStyle().
		Width(rowWidth + 2).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(borderColor).
		Padding(0, 1).
		Background(bg)

	return strings.Split(zone.Mark(zoneID, style.Render(titleLine+"\n"+descLine)), "\n")
}

func workspaceProjectPickerZoneID(index int) string {
	return fmt.Sprintf("workspace:project-picker:%d", index)
}

func workspaceProjectPickerIndexAt(msg tea.MouseMsg, m *WorkspaceShellModel) (int, bool) {
	for i := range m.ProjectPicker.Items() {
		if zoneInBounds(workspaceProjectPickerZoneID(i), msg) {
			return i, true
		}
	}
	return 0, false
}
