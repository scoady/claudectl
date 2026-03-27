package tui

import (
	"fmt"
	"strings"

	"github.com/atotto/clipboard"
	tea "github.com/charmbracelet/bubbletea"
)

func copyTextToClipboardCmd(label, text string) tea.Cmd {
	text = strings.TrimSpace(text)
	if text == "" {
		return func() tea.Msg {
			return ClipboardWriteMsg{Label: label, Err: fmt.Errorf("nothing to copy")}
		}
	}
	return func() tea.Msg {
		return ClipboardWriteMsg{Label: label, Err: clipboard.WriteAll(text)}
	}
}
