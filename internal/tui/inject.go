package tui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/scoady/codexctl/internal/api"
)

// InjectModel is a modal dialog for injecting a message into a running agent.
type InjectModel struct {
	sessionID string
	input     textinput.Model
	sending   bool
	result    string
	err       error
	active    bool
	width     int
	height    int
	apiClient *api.Client
}

// NewInjectModel creates an inject message dialog.
func NewInjectModel(sessionID string, apiClient *api.Client) InjectModel {
	ti := textinput.New()
	ti.Placeholder = "Type a message to inject..."
	ti.Focus()
	ti.CharLimit = 2000
	ti.Width = 52

	return InjectModel{
		sessionID: sessionID,
		input:     ti,
		active:    true,
		apiClient: apiClient,
	}
}

// Active returns whether the dialog is visible.
func (m InjectModel) Active() bool {
	return m.active
}

// Init implements tea.Model.
func (m InjectModel) Init() tea.Cmd {
	return textinput.Blink
}

// Update implements tea.Model.
func (m InjectModel) Update(msg tea.Msg) (InjectModel, tea.Cmd) {
	if !m.active {
		return m, nil
	}

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height

	case tea.KeyMsg:
		switch msg.String() {
		case "esc":
			m.active = false
			return m, nil

		case "enter":
			if m.sending {
				return m, nil
			}
			text := strings.TrimSpace(m.input.Value())
			if text == "" {
				return m, nil
			}
			m.sending = true
			return m, m.injectCmd(text)
		}

	case InjectCompleteMsg:
		m.sending = false
		if msg.Err != nil {
			m.err = msg.Err
			m.result = ""
		} else {
			m.result = "Message injected"
			m.err = nil
			// Auto-close after short display
			m.active = false
		}
	}

	var cmd tea.Cmd
	m.input, cmd = m.input.Update(msg)
	return m, cmd
}

// View implements tea.Model.
func (m InjectModel) View() string {
	if !m.active {
		return ""
	}

	ly := NewLayout(m.width, m.height)

	sid := m.sessionID
	if len(sid) > 20 {
		sid = sid[:20] + "..."
	}

	var content strings.Builder

	// Title bar
	content.WriteString(Class("dialog-title").Render("  Inject Message") + "\n\n")

	// Agent field
	content.WriteString(fmt.Sprintf("%s %s\n",
		Class("dialog-label").Render("Agent"),
		lipgloss.NewStyle().Foreground(Faint).Render(sid),
	))

	// Separator
	content.WriteString("\n" + HLine(ly.InjectWidth-8, Muted) + "\n\n")

	// Message input
	content.WriteString(Class("h1").Render("Message") + "\n")
	content.WriteString(m.input.View() + "\n")

	// Status messages
	if m.sending {
		content.WriteString("\n" + Class("dim").Render("  Sending..."))
	}
	if m.err != nil {
		content.WriteString("\n" + Class("dialog-error").Render(" Error: "+m.err.Error()+" "))
	}
	if m.result != "" {
		content.WriteString("\n" + Class("dialog-success").Render("  "+m.result+" "))
	}

	// Action hints
	content.WriteString("\n\n" + Class("dialog-hint").Render("Enter send  |  Esc cancel"))

	// Render dialog overlay
	overlay := Class("dialog").Width(ly.InjectWidth).Render(content.String())

	if m.width > 0 && m.height > 0 {
		overlay = lipgloss.Place(m.width, m.height, lipgloss.Center, lipgloss.Center, overlay)
	}

	return overlay
}

func (m InjectModel) injectCmd(message string) tea.Cmd {
	return func() tea.Msg {
		if m.apiClient == nil {
			return InjectCompleteMsg{Err: fmt.Errorf("no API client")}
		}
		err := m.apiClient.InjectMessage(m.sessionID, message)
		return InjectCompleteMsg{Err: err}
	}
}
