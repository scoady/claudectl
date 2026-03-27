package tui

import (
	tea "github.com/charmbracelet/bubbletea"
	zone "github.com/lrstanley/bubblezone"
)

func init() {
	zone.NewGlobal()
}

func zoneInBounds(id string, msg tea.MouseMsg) bool {
	info := zone.Get(id)
	return info != nil && info.InBounds(msg)
}

func teaMouseFromPoint(p MousePoint) tea.MouseMsg {
	return tea.MouseMsg{X: p.X, Y: p.Y}
}
