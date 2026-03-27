package tui

import (
	"fmt"
	"path/filepath"
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/scoady/codexctl/internal/api"
)

type ShowWorkspaceEntryMsg struct {
	Kind        string
	ProjectName string
	BaseDir     string
}

type WorkspaceEntryCompleteMsg struct {
	Kind string
	Path string
	Err  error
}

type WorkspaceEntryModel struct {
	kind       string
	project    string
	baseDir    string
	input      textinput.Model
	submitting bool
	err        error
	active     bool
	width      int
	height     int
	apiClient  *api.Client
}

func NewWorkspaceEntryModel(msg ShowWorkspaceEntryMsg, apiClient *api.Client) WorkspaceEntryModel {
	input := textinput.New()
	input.CharLimit = 240
	input.Focus()
	if msg.Kind == "folder" {
		input.Placeholder = "new-folder"
	} else {
		input.Placeholder = "new-file.txt"
	}
	input.Width = 44
	return WorkspaceEntryModel{
		kind:      msg.Kind,
		project:   msg.ProjectName,
		baseDir:   strings.Trim(strings.TrimSpace(msg.BaseDir), "/"),
		input:     input,
		active:    true,
		apiClient: apiClient,
	}
}

func (m WorkspaceEntryModel) Active() bool { return m.active }

func (m WorkspaceEntryModel) Init() tea.Cmd { return textinput.Blink }

func (m WorkspaceEntryModel) Update(msg tea.Msg) (WorkspaceEntryModel, tea.Cmd) {
	if !m.active {
		return m, nil
	}
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		m.input.Width = Clamp(36, Pct(msg.Width, 38), 72)
	case tea.KeyMsg:
		switch msg.String() {
		case "esc":
			m.active = false
			return m, nil
		case "enter":
			if m.submitting {
				return m, nil
			}
			path := strings.TrimSpace(m.input.Value())
			if path == "" {
				return m, nil
			}
			m.submitting = true
			return m, m.submitCmd(path)
		}
	case WorkspaceEntryCompleteMsg:
		m.submitting = false
		m.err = msg.Err
		if msg.Err == nil {
			m.active = false
		}
		return m, nil
	}
	var cmd tea.Cmd
	m.input, cmd = m.input.Update(msg)
	return m, cmd
}

func (m WorkspaceEntryModel) View() string {
	if !m.active {
		return ""
	}
	ly := NewLayout(m.width, m.height)
	dialogWidth := max(ly.DialogWidth, Clamp(54, Pct(ly.Width, 50), 84))
	m.input.Width = Clamp(36, dialogWidth-10, 72)

	title := "New File"
	hint := "Create an empty file in the selected workspace folder."
	if m.kind == "folder" {
		title = "New Folder"
		hint = "Create a directory in the selected workspace folder."
	}

	var content strings.Builder
	content.WriteString(Class("dialog-title").Render("  " + title))
	content.WriteString("\n\n")
	content.WriteString(Class("body").Render(hint))
	content.WriteString("\n\n")
	content.WriteString(Class("h1").Render("Path"))
	content.WriteString("\n")
	content.WriteString(m.input.View())
	if m.baseDir != "" {
		content.WriteString("\n\n" + Class("dim").Render("Base: "+m.baseDir))
	}
	if m.submitting {
		content.WriteString("\n\n" + Class("dim").Render("Creating..."))
	}
	if m.err != nil {
		content.WriteString("\n\n" + Class("dialog-error").Render(" Create failed "))
		content.WriteString("\n" + Class("body").Render(m.err.Error()))
	}
	content.WriteString("\n\n" + Class("dialog-hint").Render("Enter create  |  Esc cancel"))

	overlay := Class("dialog").Width(dialogWidth).Render(content.String())
	if m.width > 0 && m.height > 0 {
		overlay = lipgloss.Place(m.width, m.height, lipgloss.Center, lipgloss.Center, overlay)
	}
	return overlay
}

func (m WorkspaceEntryModel) submitCmd(name string) tea.Cmd {
	path := workspaceEntryJoin(m.baseDir, name)
	return func() tea.Msg {
		if m.apiClient == nil {
			return WorkspaceEntryCompleteMsg{Kind: m.kind, Path: path, Err: fmt.Errorf("no API client")}
		}
		var err error
		if m.kind == "folder" {
			err = m.apiClient.CreateDir(m.project, path)
		} else {
			err = m.apiClient.WriteFile(m.project, path, "")
		}
		return WorkspaceEntryCompleteMsg{Kind: m.kind, Path: path, Err: err}
	}
}

func workspaceEntryJoin(baseDir, name string) string {
	cleanName := strings.Trim(strings.TrimSpace(name), "/")
	if cleanName == "" {
		return strings.Trim(strings.TrimSpace(baseDir), "/")
	}
	if strings.TrimSpace(baseDir) == "" {
		return filepath.Clean(cleanName)
	}
	return filepath.Clean(filepath.Join(baseDir, cleanName))
}
