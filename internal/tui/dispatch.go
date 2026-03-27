package tui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/scoady/codexctl/internal/api"
)

// Available models for cycling
var availableModels = []string{
	"",
	"gpt-5-codex",
	"gpt-5",
	"codex-mini-latest",
}

// DispatchModel is a modal dialog for dispatching tasks to a project.
type DispatchModel struct {
	projectName string
	taskInput   textinput.Model
	modelIndex  int
	submitting  bool
	result      string
	err         error
	active      bool
	width       int
	height      int
	apiClient   *api.Client
}

// NewDispatchModel creates a dispatch dialog for the given project.
func NewDispatchModel(projectName string, apiClient *api.Client) DispatchModel {
	ti := textinput.New()
	ti.Placeholder = "Describe the task to dispatch..."
	ti.Focus()
	ti.CharLimit = 2000
	ti.Width = 56

	return DispatchModel{
		projectName: projectName,
		taskInput:   ti,
		active:      true,
		apiClient:   apiClient,
	}
}

// Init implements tea.Model.
func (m DispatchModel) Init() tea.Cmd {
	return textinput.Blink
}

// Active returns whether the dialog is currently shown.
func (m DispatchModel) Active() bool {
	return m.active
}

// Update implements tea.Model.
func (m DispatchModel) Update(msg tea.Msg) (DispatchModel, tea.Cmd) {
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
			if m.submitting {
				return m, nil
			}
			task := strings.TrimSpace(m.taskInput.Value())
			if task == "" {
				return m, nil
			}
			m.submitting = true
			model := ""
			if m.modelIndex > 0 && m.modelIndex < len(availableModels) {
				model = availableModels[m.modelIndex]
			}
			return m, DispatchCmd(m.apiClient, m.projectName, task, model)

		case "tab":
			// Cycle model
			m.modelIndex = (m.modelIndex + 1) % len(availableModels)
			return m, nil

		case "shift+tab":
			// Cycle model backward
			m.modelIndex = (m.modelIndex - 1 + len(availableModels)) % len(availableModels)
			return m, nil
		}

	case DispatchCompleteMsg:
		m.submitting = false
		if msg.Err != nil {
			m.err = msg.Err
			m.result = ""
		} else {
			sid := msg.SessionID
			if sid == "" && len(msg.AgentIDs) > 0 {
				sid = msg.AgentIDs[0]
			}
			m.result = sid
			m.err = nil
			// Auto-close after successful dispatch and navigate to watch
			m.active = false
			return m, func() tea.Msg {
				return NavigateMsg{
					Screen: ScreenWatch,
					Agent:  &api.Agent{SessionID: sid, ProjectName: m.projectName, Task: m.taskInput.Value()},
				}
			}
		}
	}

	// Update text input
	var cmd tea.Cmd
	m.taskInput, cmd = m.taskInput.Update(msg)
	return m, cmd
}

// View implements tea.Model.
func (m DispatchModel) View() string {
	if !m.active {
		return ""
	}

	ly := NewLayout(m.width, m.height)

	modelStr := "default"
	if m.modelIndex > 0 && m.modelIndex < len(availableModels) {
		modelStr = availableModels[m.modelIndex]
	}

	var content strings.Builder

	// Title bar
	content.WriteString(Class("dialog-title").Render("  Dispatch Task") + "\n\n")

	// Project field
	content.WriteString(fmt.Sprintf("%s %s\n",
		Class("dialog-label").Render("Project"),
		Class("dialog-value").Render(m.projectName),
	))

	// Model field with cycling indicator
	modelPill := Pill(" "+modelStr+" ", Amber, BadgeAmberBg)
	content.WriteString(fmt.Sprintf("%s %s  %s\n",
		Class("dialog-label").Render("Model"),
		modelPill,
		Class("dialog-hint").Render("Tab to cycle"),
	))

	// Separator
	content.WriteString("\n" + HLine(ly.DispatchWidth-8, Muted) + "\n\n")

	// Task input (required -- emphasized label)
	content.WriteString(Class("h1").Render("Task") +
		lipgloss.NewStyle().Foreground(Rose).Render(" *") + "\n")
	content.WriteString(m.taskInput.View() + "\n")

	// Status messages
	if m.submitting {
		content.WriteString("\n" + Class("dim").Render("  Dispatching..."))
	}
	if m.err != nil {
		content.WriteString("\n" + Class("dialog-error").Render(" Error: "+m.err.Error()+" "))
	}
	if m.result != "" {
		content.WriteString("\n" + Class("dialog-success").Render("  Dispatched: "+truncate(m.result, 24)+" "))
	}

	// Action hints
	content.WriteString("\n\n" + Class("dialog-hint").Render("Enter submit  |  Esc cancel  |  Tab cycle model"))

	// Render the dialog overlay
	overlay := Class("dialog").Width(ly.DispatchWidth).Render(content.String())

	// Center the overlay
	if m.width > 0 && m.height > 0 {
		overlay = lipgloss.Place(m.width, m.height, lipgloss.Center, lipgloss.Center, overlay)
	}

	return overlay
}
