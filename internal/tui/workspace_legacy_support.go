package tui

import (
	"strings"

	"github.com/charmbracelet/lipgloss"
)

type workspaceExplorerItem struct {
	Label    string
	Path     string
	IsDir    bool
	IsParent bool
}

type workspaceRect struct {
	X int
	Y int
	W int
	H int
}

func (r workspaceRect) contains(x, y int) bool {
	return x >= r.X && x < r.X+r.W && y >= r.Y && y < r.Y+r.H
}

type workspaceLayout struct {
	Dock    workspaceRect
	Sidebar workspaceRect
	Main    workspaceRect
}

func renderWorkspacePanelBox(title, body string, w, h int, focused bool) string {
	borderCol := BorderColor
	if focused {
		borderCol = GlowBorder
	}
	return lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(borderCol).
		Padding(0, 1).
		Width(w).
		Height(h).
		Render(lipgloss.NewStyle().Bold(true).Foreground(White).Render(title) + "\n" + body)
}

func clampLines(lines []string, h int) string {
	if h < 1 {
		h = 1
	}
	for len(lines) < h {
		lines = append(lines, "")
	}
	if len(lines) > h {
		lines = lines[:h]
	}
	return strings.Join(lines, "\n")
}
