package editor

import (
	"strings"

	"github.com/charmbracelet/lipgloss"
	tuistyle "github.com/scoady/codexctl/internal/tui/style"
)

func RenderEmptyState(width, height int) []string {
	if height <= 0 {
		return nil
	}
	lines := []string{
		lipgloss.NewStyle().Foreground(tuistyle.WorkspaceMutedFG).Render("Open a file from the explorer."),
		lipgloss.NewStyle().Foreground(tuistyle.WorkspaceMutedFG).Render("The editor will stay focused here."),
	}
	for len(lines) < height {
		lines = append(lines, "")
	}
	for i := range lines {
		lines[i] = tuistyle.WorkspaceTerminalSectionStyle().Width(max(1, width)).Render(strings.TrimRight(lines[i], " "))
	}
	return lines[:height]
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
