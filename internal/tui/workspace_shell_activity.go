package tui

import (
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	zone "github.com/lrstanley/bubblezone"
	tuistyle "github.com/scoady/codexctl/internal/tui/style"
)

func renderWorkspaceActivityPane(m *WorkspaceShellModel, rect workspaceShellRect, mouse MousePoint) string {
	iconColors := map[string]lipgloss.Color{
		workspaceDockChat:    Cyan,
		workspaceDockFiles:   Cyan,
		workspaceDockCanvas:  Green,
		workspaceDockTasks:   Green,
		workspaceDockMetrics: Purple,
		workspaceDockTools:   Amber,
	}

	mouseMsg := teaMouseFromPoint(mouse)
	contentH := max(6, rect.H-2)
	lines := make([]string, contentH)
	lines[0] = tuistyle.RenderWorkspaceActivityBrand(max(3, rect.W-2), Cyan)

	for _, slot := range workspaceShellDockSlots(contentH) {
		var item workspaceDockItem
		for _, candidate := range workspaceDockItems() {
			if candidate.Mode == slot.Mode {
				item = candidate
				break
			}
		}
		color := iconColors[slot.Mode]
		icon := item.Icon
		hovered := zoneInBounds(workspaceActivityZoneID(slot.Mode), mouseMsg)
		active := slot.Mode == m.DockMode

		cell := tuistyle.RenderWorkspaceActivityCell(
			icon,
			max(3, rect.W-2),
			color,
			Purple,
			tuistyle.WorkspaceHoverLn,
			tuistyle.WorkspaceMutedFG,
			White,
			active,
			hovered,
		)

		if slot.IconLine >= 0 && slot.IconLine < len(lines) {
			lines[slot.IconLine] = zone.Mark(workspaceActivityZoneID(slot.Mode), cell)
		}
	}

	return lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(focusBorder(m.FocusPane == 0)).
		Padding(0, 1).
		Width(rect.W).
		Height(rect.H).
		Background(workspaceShellDockBg).
		Render(joinAndFill(lines))
}

func workspaceActivityActionAt(msg tea.MouseMsg) (string, bool) {
	for _, item := range workspaceDockItems() {
		if zoneInBounds(workspaceActivityZoneID(item.Mode), msg) {
			return item.Mode, true
		}
	}
	return "", false
}

func workspaceActivityZoneID(mode string) string {
	return "workspace:activity:" + mode
}

func joinAndFill(lines []string) string {
	for i, line := range lines {
		if line == "" {
			lines[i] = " "
		}
	}
	return lipgloss.JoinVertical(lipgloss.Left, lines...)
}
