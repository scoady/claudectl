package tui

import (
	tea "github.com/charmbracelet/bubbletea"
	"github.com/scoady/codexctl/internal/api"
)

const (
	workspacePreviewTerminal = "terminal"
	workspacePreviewFile     = "file"
	workspacePreviewAgent    = "agent"

	workspaceDockChat    = "chat"
	workspaceDockFiles   = "files"
	workspaceDockCanvas  = "canvas"
	workspaceDockTasks   = "tasks"
	workspaceDockMetrics = "metrics"
	workspaceDockTools   = "tools"
)

type WorkspaceFilesMsg struct {
	Project string
	Path    string
	Entries []api.FileEntry
	Err     error
}

type WorkspaceFilePreviewMsg struct {
	Project string
	Path    string
	Content *api.FileContent
	Err     error
}

type WorkspaceAgentPreviewMsg struct {
	SessionID string
	Messages  []api.Message
	Err       error
}

type WorkspaceTerminalPreviewMsg struct {
	SessionID string
	Messages  []api.Message
	Err       error
}

type WorkspaceSaveFileMsg struct {
	Project string
	Path    string
	Content string
	Err     error
}

func FetchWorkspaceFilesCmd(client *api.Client, project, path string) tea.Cmd {
	if client == nil || project == "" {
		return nil
	}
	return func() tea.Msg {
		entries, err := client.ListFiles(project, path)
		return WorkspaceFilesMsg{
			Project: project,
			Path:    path,
			Entries: entries,
			Err:     err,
		}
	}
}

func FetchWorkspaceFilePreviewCmd(client *api.Client, project, path string) tea.Cmd {
	if client == nil || project == "" || path == "" {
		return nil
	}
	return func() tea.Msg {
		content, err := client.ReadFile(project, path)
		return WorkspaceFilePreviewMsg{
			Project: project,
			Path:    path,
			Content: content,
			Err:     err,
		}
	}
}

func FetchWorkspaceAgentPreviewCmd(client *api.Client, sessionID string) tea.Cmd {
	if client == nil || sessionID == "" {
		return nil
	}
	return func() tea.Msg {
		messages, err := client.GetAgentMessages(sessionID)
		return WorkspaceAgentPreviewMsg{
			SessionID: sessionID,
			Messages:  messages,
			Err:       err,
		}
	}
}

func FetchWorkspaceTerminalPreviewCmd(client *api.Client, sessionID string) tea.Cmd {
	if client == nil || sessionID == "" {
		return nil
	}
	return func() tea.Msg {
		messages, err := client.GetAgentMessages(sessionID)
		return WorkspaceTerminalPreviewMsg{
			SessionID: sessionID,
			Messages:  messages,
			Err:       err,
		}
	}
}

func SaveWorkspaceFileCmd(client *api.Client, project, path, content string) tea.Cmd {
	if client == nil || project == "" || path == "" {
		return nil
	}
	return func() tea.Msg {
		err := client.WriteFile(project, path, content)
		return WorkspaceSaveFileMsg{
			Project: project,
			Path:    path,
			Content: content,
			Err:     err,
		}
	}
}

type workspaceDockItem struct {
	Mode  string
	Icon  string
	Label string
}

func workspaceDockItems() []workspaceDockItem {
	return []workspaceDockItem{
		{Mode: workspaceDockChat, Icon: "💬", Label: "Agent Chat"},
		{Mode: workspaceDockFiles, Icon: "📁", Label: "Files"},
		{Mode: workspaceDockCanvas, Icon: "🎨", Label: "Canvas"},
		{Mode: workspaceDockTasks, Icon: "🧠", Label: "Tasks"},
		{Mode: workspaceDockMetrics, Icon: "📈", Label: "Metrics"},
		{Mode: workspaceDockTools, Icon: "🧰", Label: "Tools"},
	}
}
