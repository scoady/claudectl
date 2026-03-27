package tui

import (
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	zone "github.com/lrstanley/bubblezone"
	tuistyle "github.com/scoady/codexctl/internal/tui/style"
)

func workspaceShellTabActionAt(m *WorkspaceShellModel, msg tea.MouseMsg) (workspaceTabAction, bool) {
	if zoneInBounds(workspaceProjectTabAddZoneID(), msg) {
		return workspaceTabAction{kind: "add"}, true
	}
	for _, tab := range m.OpenProjectTabs {
		if zoneInBounds(workspaceProjectTabCloseZoneID(tab), msg) {
			return workspaceTabAction{kind: "close", name: tab}, true
		}
		if zoneInBounds(workspaceProjectTabZoneID(tab), msg) {
			return workspaceTabAction{kind: "activate", name: tab}, true
		}
	}
	return workspaceTabAction{}, false
}

func workspaceShellFileTabActionAt(m *WorkspaceShellModel, msg tea.MouseMsg) (workspaceTabAction, bool) {
	for _, path := range m.OpenFileTabs {
		if zoneInBounds(workspaceFileTabCloseZoneID(path), msg) {
			return workspaceTabAction{kind: "close", name: path}, true
		}
		if zoneInBounds(workspaceFileTabZoneID(path), msg) {
			return workspaceTabAction{kind: "activate", name: path}, true
		}
	}
	return workspaceTabAction{}, false
}

func workspaceShellCanvasTabActionAt(m *WorkspaceShellModel, msg tea.MouseMsg) (string, bool) {
	for _, tab := range m.CanvasTabs {
		if zoneInBounds(workspaceCanvasTabZoneID(tab), msg) {
			return tab, true
		}
	}
	return "", false
}

func workspaceShellRenderFileTabLine(m *WorkspaceShellModel, width int, mouse MousePoint) string {
	return workspaceRenderTabStrip(m.OpenFileTabs, width, func(name string) workspaceRenderedTab {
		return workspaceRenderedTab{
			ID:       workspaceFileTabZoneID(name),
			CloseID:  workspaceFileTabCloseZoneID(name),
			Title:    truncate(filepathBase(name), 24) + dirtySuffixForPath(m, name),
			Active:   name == m.ActiveFileTab,
			Closable: true,
			Hovered:  zoneInBounds(workspaceFileTabZoneID(name), teaMouseFromPoint(mouse)),
			Accent:   Cyan,
		}
	}, "")
}

func workspaceShellRenderTabLine(m *WorkspaceShellModel, width int, mouse MousePoint) string {
	return workspaceRenderTabStrip(m.OpenProjectTabs, width, func(name string) workspaceRenderedTab {
		return workspaceRenderedTab{
			ID:       workspaceProjectTabZoneID(name),
			CloseID:  workspaceProjectTabCloseZoneID(name),
			Title:    truncate(name, 24),
			Active:   name == m.CurrentProject,
			Closable: true,
			Hovered:  zoneInBounds(workspaceProjectTabZoneID(name), teaMouseFromPoint(mouse)),
			Accent:   Purple,
		}
	}, workspaceRenderAddProjectTabCell(zoneInBounds(workspaceProjectTabAddZoneID(), teaMouseFromPoint(mouse))))
}

func workspaceShellRenderCanvasTabLine(m *WorkspaceShellModel, width int, mouse MousePoint) string {
	return workspaceRenderTabStrip(m.CanvasTabs, width, func(name string) workspaceRenderedTab {
		return workspaceRenderedTab{
			ID:      workspaceCanvasTabZoneID(name),
			Title:   truncate(name, 20),
			Active:  name == m.ActiveCanvas,
			Hovered: zoneInBounds(workspaceCanvasTabZoneID(name), teaMouseFromPoint(mouse)),
			Accent:  Green,
		}
	}, "")
}

type workspaceRenderedTab struct {
	ID       string
	CloseID  string
	Title    string
	Active   bool
	Closable bool
	Hovered  bool
	Accent   lipgloss.Color
}

func workspaceRenderTabStrip(names []string, width int, build func(string) workspaceRenderedTab, addCell string) string {
	addW := 0
	if addCell != "" {
		addW = lipgloss.Width(addCell) + 1
	}
	laneW := max(8, width-addW)
	widths := workspaceTabCellWidths(laneW, len(names))
	parts := make([]string, 0, len(names)+1)
	for i, name := range names {
		parts = append(parts, workspaceRenderTabCell(build(name), widths[i]))
	}
	line := strings.Join(parts, " ")
	if lipgloss.Width(line) < laneW {
		line += strings.Repeat(" ", laneW-lipgloss.Width(line))
	}
	if addCell != "" {
		if line != "" {
			line += " "
		}
		line += addCell
	}
	if lipgloss.Width(line) < width {
		line += strings.Repeat(" ", width-lipgloss.Width(line))
	}
	return line
}

func workspaceTabCellWidths(width, count int) []int {
	if count <= 0 || width <= 0 {
		return nil
	}
	widths := make([]int, count)
	base := width / count
	rem := width % count
	for i := 0; i < count; i++ {
		widths[i] = max(10, base)
		if rem > 0 {
			widths[i]++
			rem--
		}
	}
	return widths
}

func workspaceRenderTabCell(tab workspaceRenderedTab, width int) string {
	width = max(10, width)
	bg, fg := tuistyle.WorkspaceTabColors(BadgePurpleBg, White, SubText, White, tab.Active, tab.Hovered)

	closeChunk := ""
	closeW := 0
	if tab.Closable {
		closeW = 2
		closeChunk = zone.Mark(tab.CloseID, lipgloss.NewStyle().
			Foreground(fg).
			Background(bg).
			Align(lipgloss.Center).
			Width(closeW).
			Bold(true).
			Render("×"))
	}
	titleW := max(4, width-closeW)
	title := lipgloss.NewStyle().
		Foreground(fg).
		Background(bg).
		Bold(tab.Active).
		Width(titleW).
		Render(truncate(tab.Title, titleW))
	cell := title + closeChunk
	return zone.Mark(tab.ID, lipgloss.NewStyle().Background(bg).Render(cell))
}

func workspaceRenderAddProjectTabCell(hovered bool) string {
	bg, fg := tuistyle.WorkspaceTabColors(BadgePurpleBg, White, Purple, White, false, hovered)
	return zone.Mark(workspaceProjectTabAddZoneID(), lipgloss.NewStyle().
		Foreground(fg).
		Background(bg).
		Bold(true).
		Width(3).
		Align(lipgloss.Center).
		Render("+"))
}

func workspaceProjectTabZoneID(name string) string      { return "workspace:project-tab:" + name }
func workspaceProjectTabCloseZoneID(name string) string { return "workspace:project-tab-close:" + name }
func workspaceProjectTabAddZoneID() string              { return "workspace:project-tab:add" }

func workspaceFileTabZoneID(path string) string      { return "workspace:file-tab:" + path }
func workspaceFileTabCloseZoneID(path string) string { return "workspace:file-tab-close:" + path }
func workspaceCanvasTabZoneID(name string) string    { return "workspace:canvas-tab:" + name }
