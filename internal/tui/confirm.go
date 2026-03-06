package tui

import (
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
)

// ShowConfirmMsg triggers the confirm dialog overlay.
type ShowConfirmMsg struct {
	Title       string
	Description string
	Destructive bool
	OnConfirm   tea.Cmd // command to execute if confirmed
}

// ConfirmResultMsg carries the result of a confirmation dialog.
type ConfirmResultMsg struct {
	Confirmed bool
	Action    tea.Cmd
}

// ConfirmModel is a generic confirmation dialog for destructive actions.
type ConfirmModel struct {
	title       string
	description string
	destructive bool
	onConfirm   tea.Cmd
	active      bool
	width       int
	height      int
}

// NewConfirmModel creates a new confirm dialog.
func NewConfirmModel(msg ShowConfirmMsg) ConfirmModel {
	return ConfirmModel{
		title:       msg.Title,
		description: msg.Description,
		destructive: msg.Destructive,
		onConfirm:   msg.OnConfirm,
		active:      true,
	}
}

// Active returns whether the dialog is visible.
func (m ConfirmModel) Active() bool {
	return m.active
}

// Init implements tea.Model.
func (m ConfirmModel) Init() tea.Cmd {
	return nil
}

// Update implements tea.Model.
func (m ConfirmModel) Update(msg tea.Msg) (ConfirmModel, tea.Cmd) {
	if !m.active {
		return m, nil
	}

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height

	case tea.KeyMsg:
		switch msg.String() {
		case "y", "Y":
			m.active = false
			return m, m.onConfirm
		case "n", "N", "esc":
			m.active = false
			return m, nil
		}
	}

	return m, nil
}

// View implements tea.Model.
func (m ConfirmModel) View() string {
	if !m.active {
		return ""
	}

	// Pick border color based on destructive flag
	borderColor := GlowBorder
	if m.destructive {
		borderColor = Rose
	}

	dialogBox := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(borderColor).
		Padding(1, 3).
		Background(Surface0).
		Width(50)

	// Title
	titleStyle := lipgloss.NewStyle().Foreground(White).Bold(true)
	if m.destructive {
		titleStyle = lipgloss.NewStyle().Foreground(Rose).Bold(true)
	}

	content := titleStyle.Render(m.title) + "\n\n"
	content += SubStyle.Render(m.description) + "\n\n"

	// Y/N hints
	yStyle := lipgloss.NewStyle().Foreground(Surface0).Background(Green).Bold(true).Padding(0, 1)
	nStyle := lipgloss.NewStyle().Foreground(Surface0).Background(Rose).Bold(true).Padding(0, 1)
	if m.destructive {
		yStyle = lipgloss.NewStyle().Foreground(Surface0).Background(Rose).Bold(true).Padding(0, 1)
		nStyle = lipgloss.NewStyle().Foreground(Surface0).Background(Dim).Bold(true).Padding(0, 1)
	}

	content += yStyle.Render("Y") + DimStyle.Render(" confirm  ") +
		nStyle.Render("N") + DimStyle.Render(" cancel")

	overlay := dialogBox.Render(content)

	if m.width > 0 && m.height > 0 {
		overlay = lipgloss.Place(m.width, m.height, lipgloss.Center, lipgloss.Center, overlay)
	}

	return overlay
}
