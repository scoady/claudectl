package tui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/scoady/claudectl/internal/api"
)

// ShowCreateProjectMsg triggers the create project dialog overlay.
type ShowCreateProjectMsg struct{}

// CreateProjectCompleteMsg signals a create project request completed.
type CreateProjectCompleteMsg struct {
	ProjectName string
	Err         error
}

// CreateProjectModel is a modal dialog for creating a new project.
type CreateProjectModel struct {
	nameInput textinput.Model
	descInput textinput.Model
	focused   int // 0=name, 1=desc
	submitting bool
	result     string
	err        error
	active     bool
	width      int
	height     int
	apiClient  *api.Client
}

// NewCreateProjectModel creates a new create project dialog.
func NewCreateProjectModel(apiClient *api.Client) CreateProjectModel {
	nameIn := textinput.New()
	nameIn.Placeholder = "my-project"
	nameIn.Focus()
	nameIn.CharLimit = 64
	nameIn.Width = 44

	descIn := textinput.New()
	descIn.Placeholder = "Optional description..."
	descIn.CharLimit = 256
	descIn.Width = 44

	return CreateProjectModel{
		nameInput: nameIn,
		descInput: descIn,
		active:    true,
		apiClient: apiClient,
	}
}

// Active returns whether the dialog is visible.
func (m CreateProjectModel) Active() bool {
	return m.active
}

// Init implements tea.Model.
func (m CreateProjectModel) Init() tea.Cmd {
	return textinput.Blink
}

// Update implements tea.Model.
func (m CreateProjectModel) Update(msg tea.Msg) (CreateProjectModel, tea.Cmd) {
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

		case "tab":
			// Toggle focus between name and description
			if m.focused == 0 {
				m.focused = 1
				m.nameInput.Blur()
				m.descInput.Focus()
			} else {
				m.focused = 0
				m.descInput.Blur()
				m.nameInput.Focus()
			}
			return m, nil

		case "enter":
			if m.submitting {
				return m, nil
			}
			name := strings.TrimSpace(m.nameInput.Value())
			if name == "" {
				return m, nil
			}
			m.submitting = true
			desc := strings.TrimSpace(m.descInput.Value())
			return m, m.createCmd(name, desc)
		}

	case CreateProjectCompleteMsg:
		m.submitting = false
		if msg.Err != nil {
			m.err = msg.Err
			m.result = ""
		} else {
			m.result = msg.ProjectName
			m.err = nil
			m.active = false
			// Navigate to the new project
			return m, func() tea.Msg {
				return NavigateMsg{
					Screen:  ScreenProject,
					Project: &api.Project{Name: msg.ProjectName},
				}
			}
		}
	}

	// Update the focused input
	var cmd tea.Cmd
	if m.focused == 0 {
		m.nameInput, cmd = m.nameInput.Update(msg)
	} else {
		m.descInput, cmd = m.descInput.Update(msg)
	}
	return m, cmd
}

// View implements tea.Model.
func (m CreateProjectModel) View() string {
	if !m.active {
		return ""
	}

	var content strings.Builder

	// Title bar
	content.WriteString(DialogTitleBar.Render("  Create Project") + "\n\n")

	// Name field (required)
	nameLabel := lipgloss.NewStyle().Foreground(White).Bold(true).Render("Name")
	required := lipgloss.NewStyle().Foreground(Rose).Render(" *")
	content.WriteString(nameLabel + required + "\n")
	content.WriteString(m.nameInput.View() + "\n\n")

	// Description field (optional)
	descLabel := lipgloss.NewStyle().Foreground(SubText).Render("Description")
	optional := DimStyle.Render(" (optional)")
	content.WriteString(descLabel + optional + "\n")
	content.WriteString(m.descInput.View() + "\n")

	// Status messages
	if m.submitting {
		content.WriteString("\n" + DimStyle.Render("  Creating..."))
	}
	if m.err != nil {
		content.WriteString("\n" + DialogError.Render(" Error: "+m.err.Error()+" "))
	}
	if m.result != "" {
		content.WriteString("\n" + DialogSuccess.Render("  Created: "+m.result+" "))
	}

	// Action hints
	content.WriteString("\n\n" + DialogHint.Render("Enter create  |  Tab next field  |  Esc cancel"))

	// Render dialog
	overlay := DialogStyle.Width(56).Render(content.String())

	if m.width > 0 && m.height > 0 {
		overlay = lipgloss.Place(m.width, m.height, lipgloss.Center, lipgloss.Center, overlay)
	}

	return overlay
}

func (m CreateProjectModel) createCmd(name, description string) tea.Cmd {
	return func() tea.Msg {
		if m.apiClient == nil {
			return CreateProjectCompleteMsg{Err: fmt.Errorf("no API client")}
		}
		_, err := m.apiClient.CreateProject(name, description, "")
		return CreateProjectCompleteMsg{ProjectName: name, Err: err}
	}
}
