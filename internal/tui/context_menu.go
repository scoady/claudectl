package tui

import (
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// MenuItem represents a single action in a context menu.
type MenuItem struct {
	Label    string // Display text
	Key      string // Shortcut key hint (e.g., "l", "K")
	Icon     string // Left icon
	Style    lipgloss.Style
	Disabled bool
	Action   func() tea.Msg // What happens when selected
}

// ShowContextMenuMsg triggers the context menu overlay.
type ShowContextMenuMsg struct {
	Title string
	Items []MenuItem
	// Anchor position (row offset from top of content area)
	AnchorX int
	AnchorY int
}

// ContextMenuModel is a floating context menu overlay.
type ContextMenuModel struct {
	title    string
	items    []MenuItem
	selected int
	active   bool
	anchorX  int
	anchorY  int
	width    int
	height   int
}

// NewContextMenuModel creates a context menu from a message.
func NewContextMenuModel(msg ShowContextMenuMsg) ContextMenuModel {
	// Skip to first non-disabled item
	sel := 0
	for i, item := range msg.Items {
		if !item.Disabled {
			sel = i
			break
		}
	}
	return ContextMenuModel{
		title:    msg.Title,
		items:    msg.Items,
		selected: sel,
		active:   true,
		anchorX:  msg.AnchorX,
		anchorY:  msg.AnchorY,
	}
}

// Active returns whether the menu is visible.
func (m ContextMenuModel) Active() bool {
	return m.active
}

// Init implements tea.Model.
func (m ContextMenuModel) Init() tea.Cmd {
	return nil
}

// Update implements tea.Model.
func (m ContextMenuModel) Update(msg tea.Msg) (ContextMenuModel, tea.Cmd) {
	if !m.active {
		return m, nil
	}

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height

	case tea.KeyMsg:
		switch msg.String() {
		case "esc", "q":
			m.active = false
			return m, nil

		case "j", "down":
			m.moveSelection(1)
			return m, nil

		case "k", "up":
			m.moveSelection(-1)
			return m, nil

		case "enter":
			if m.selected >= 0 && m.selected < len(m.items) {
				item := m.items[m.selected]
				if !item.Disabled && item.Action != nil {
					m.active = false
					return m, func() tea.Msg { return item.Action() }
				}
			}
			return m, nil

		default:
			// Check shortcut keys
			key := msg.String()
			for _, item := range m.items {
				if item.Key != "" && strings.EqualFold(item.Key, key) && !item.Disabled && item.Action != nil {
					m.active = false
					return m, func() tea.Msg { return item.Action() }
				}
			}
		}
	}

	return m, nil
}

func (m *ContextMenuModel) moveSelection(delta int) {
	n := len(m.items)
	if n == 0 {
		return
	}
	// Move, skipping disabled items
	for i := 0; i < n; i++ {
		m.selected = (m.selected + delta + n) % n
		if !m.items[m.selected].Disabled {
			return
		}
	}
}

// View renders the context menu as a floating overlay.
func (m ContextMenuModel) View() string {
	if !m.active || len(m.items) == 0 {
		return ""
	}

	// Menu styles
	menuBorder := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(BorderColor).
		Background(Surface0).
		Padding(0, 0)

	titleStyle := lipgloss.NewStyle().
		Foreground(Cyan).
		Bold(true).
		Background(Surface0).
		Padding(0, 2).
		MarginBottom(0)

	itemStyle := Class("palette-result")

	selectedItemStyle := Class("palette-selected")

	disabledStyle := lipgloss.NewStyle().
		Foreground(Muted).
		Background(Surface0).
		Padding(0, 2)

	// Calculate menu width from longest item
	maxWidth := lipgloss.Width(m.title) + 4
	for _, item := range m.items {
		w := lipgloss.Width(item.Icon+" "+item.Label) + 6
		if item.Key != "" {
			w += len(item.Key) + 3
		}
		if w > maxWidth {
			maxWidth = w
		}
	}
	if maxWidth < 24 {
		maxWidth = 24
	}
	innerWidth := maxWidth

	var b strings.Builder

	// Title
	b.WriteString(titleStyle.Width(innerWidth).Render(m.title))
	b.WriteString("\n")
	b.WriteString(lipgloss.NewStyle().Foreground(Muted).Background(Surface0).Width(innerWidth).Render(strings.Repeat("─", innerWidth)))
	b.WriteString("\n")

	// Items
	for i, item := range m.items {
		icon := item.Icon
		if icon == "" {
			icon = " "
		}

		label := icon + " " + item.Label

		// Right-aligned shortcut hint
		hint := ""
		if item.Key != "" {
			hint = item.Key
		}

		// Calculate padding between label and hint
		labelWidth := lipgloss.Width(label)
		hintWidth := lipgloss.Width(hint)
		padding := innerWidth - labelWidth - hintWidth - 4
		if padding < 1 {
			padding = 1
		}

		var row string
		if item.Disabled {
			row = disabledStyle.Width(innerWidth).Render(
				label + strings.Repeat(" ", padding) + hint,
			)
		} else if i == m.selected {
			row = selectedItemStyle.Width(innerWidth).Render(
				"▸ " + icon + " " + item.Label + strings.Repeat(" ", padding-2) + hint,
			)
		} else {
			row = itemStyle.Width(innerWidth).Render(
				"  " + label + strings.Repeat(" ", padding-2) + hint,
			)
		}

		b.WriteString(row)
		if i < len(m.items)-1 {
			b.WriteString("\n")
		}
	}

	menu := menuBorder.Render(b.String())

	// Position the menu -- center it on screen
	if m.width > 0 && m.height > 0 {
		menu = lipgloss.Place(m.width, m.height, lipgloss.Center, lipgloss.Center, menu)
	}

	return menu
}
