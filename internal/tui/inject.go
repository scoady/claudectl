package tui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/scoady/claudectl/internal/api"
)

// ── Inject dialog styles ────────────────────────────────────────────────────

var (
	injectOverlay = lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(Cyan).
			Padding(1, 2).
			Background(lipgloss.Color("#0f172a")).
			Width(64)

	injectTitle = lipgloss.NewStyle().
			Bold(true).
			Foreground(Cyan).
			MarginBottom(1)

	injectSuccess = lipgloss.NewStyle().
			Foreground(Green).
			Bold(true)

	injectError = lipgloss.NewStyle().
			Foreground(Rose).
			Bold(true)
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

	sid := m.sessionID
	if len(sid) > 20 {
		sid = sid[:20] + "..."
	}

	var content strings.Builder

	content.WriteString(injectTitle.Render("Inject Message"))
	content.WriteByte('\n')
	content.WriteString(fmt.Sprintf("%s %s\n\n",
		DimStyle.Render("Agent:"),
		BoldStyle.Render(sid),
	))
	content.WriteString(DimStyle.Render("Message:"))
	content.WriteByte('\n')
	content.WriteString(m.input.View())
	content.WriteByte('\n')

	if m.sending {
		content.WriteString(DimStyle.Render("\nSending..."))
	}
	if m.err != nil {
		content.WriteString("\n" + injectError.Render("Error: "+m.err.Error()))
	}
	if m.result != "" {
		content.WriteString("\n" + injectSuccess.Render(m.result))
	}

	content.WriteByte('\n')
	content.WriteString(DimStyle.Render("Enter send  |  Esc cancel"))

	rendered := injectOverlay.Render(content.String())

	if m.width > 0 && m.height > 0 {
		rendered = lipgloss.Place(m.width, m.height, lipgloss.Center, lipgloss.Center, rendered)
	}

	return rendered
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
