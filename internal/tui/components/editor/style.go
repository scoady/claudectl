package editor

import (
	"github.com/charmbracelet/bubbles/textarea"
	"github.com/charmbracelet/lipgloss"
	tuistyle "github.com/scoady/codexctl/internal/tui/style"
)

func ApplyWorkspaceTheme(m *textarea.Model) {
	if m == nil {
		return
	}

	base := lipgloss.NewStyle().
		Background(tuistyle.WorkspaceTerminalBG).
		Foreground(tuistyle.WorkspaceTerminalTextFG)

	line := lipgloss.NewStyle().
		Background(tuistyle.WorkspaceTerminalBG).
		Foreground(tuistyle.WorkspaceTerminalTextFG)

	lineNumber := lipgloss.NewStyle().
		Background(tuistyle.WorkspaceTerminalBG).
		Foreground(tuistyle.WorkspaceMutedFG)

	cursorLineNumber := lipgloss.NewStyle().
		Background(tuistyle.WorkspaceTerminalBG).
		Foreground(tuistyle.WorkspaceTerminalMetaFG).
		Bold(true)

	m.FocusedStyle.Base = base
	m.FocusedStyle.Text = line
	m.FocusedStyle.LineNumber = lineNumber
	m.FocusedStyle.CursorLine = line
	m.FocusedStyle.CursorLineNumber = cursorLineNumber
	m.FocusedStyle.EndOfBuffer = lineNumber
	m.FocusedStyle.Placeholder = lineNumber
	m.FocusedStyle.Prompt = lineNumber

	m.BlurredStyle.Base = base
	m.BlurredStyle.Text = line
	m.BlurredStyle.LineNumber = lineNumber
	m.BlurredStyle.CursorLine = line
	m.BlurredStyle.CursorLineNumber = cursorLineNumber
	m.BlurredStyle.EndOfBuffer = lineNumber
	m.BlurredStyle.Placeholder = lineNumber
	m.BlurredStyle.Prompt = lineNumber

	m.Cursor.Style = lipgloss.NewStyle().
		Foreground(tuistyle.WorkspaceTerminalBG).
		Background(tuistyle.WorkspaceTerminalTextFG).
		Bold(true)
	m.Cursor.TextStyle = line
}
