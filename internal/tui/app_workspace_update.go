package tui

import (
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
)

func (a *App) handleWorkspaceUpdateMessage(msg tea.Msg) (tea.Model, tea.Cmd, bool) {
	switch msg := msg.(type) {
	case WorkspaceFilesPollMsg:
		if a.screen == ScreenWorkspace && a.workspace.Current() != nil {
			return a, tea.Batch(a.workspaceLoadDirCmd(), a.workspaceFilesPollCmd()), true
		}
		return a, a.workspaceFilesPollCmd(), true

	case WorkspaceFilesMsg:
		if msg.Err == nil {
			a.workspace.SetEntries(msg.Project, msg.Path, msg.Entries)
		}
		return a, nil, true

	case WorkspaceGitStatusMsg:
		if msg.Err == nil {
			a.workspace.SetGitStatus(msg.Project, msg.Status)
		}
		return a, nil, true

	case WorkspaceGitBranchMsg:
		if msg.Err == nil {
			a.workspace.SetGitBranch(msg.Project, msg.Branch, msg.Remote, msg.Provider)
		}
		return a, nil, true

	case WorkspaceFilePreviewMsg:
		if msg.Project == a.workspace.CurrentProject {
			a.workspace.SetFilePreview(msg.Path, msg.Content, msg.Err)
		}
		return a, nil, true

	case WorkspaceAgentPreviewMsg:
		if ag := a.workspace.SelectedAgentRef(); ag != nil && ag.SessionID == msg.SessionID {
			a.workspace.SetAgentPreview(msg.SessionID, msg.Messages, msg.Err)
		}
		return a, nil, true

	case WorkspaceTerminalPreviewMsg:
		if ag := a.workspace.TerminalAgentRef(); ag != nil && ag.SessionID == msg.SessionID {
			a.workspace.SetTerminalPreview(msg.SessionID, msg.Messages, msg.Err)
		}
		return a, nil, true

	case WorkspaceSaveFileMsg:
		if msg.Err != nil {
			a.statusMsg = "Save failed: " + msg.Err.Error()
		} else {
			a.workspace.SavedEditorContent(msg.Content)
			a.statusMsg = "Saved " + msg.Path
		}
		a.statusTime = time.Now()
		return a, nil, true

	case WorkspaceSelectProjectMsg:
		if a.screen == ScreenWorkspace && a.workspace.SetProjectByName(msg.ProjectName) {
			a.statusMsg = "Workspace switched to " + msg.ProjectName
			a.statusTime = time.Now()
			return a, tea.Batch(a.workspaceLoadDirCmd(), a.workspaceLoadTerminalCmd()), true
		}
		return a, nil, true

	case WorkspaceCopyTranscriptMsg:
		if msg.Err != nil {
			a.statusMsg = "Copy failed: " + msg.Err.Error()
		} else {
			a.statusMsg = "Transcript copied"
		}
		a.statusTime = time.Now()
		return a, nil, true

	case WorkspaceCanvasDataMsg:
		if msg.Err == nil {
			a.workspace.SetCanvasData(msg.Project, msg.Widgets, msg.Tabs)
		}
		return a, nil, true

	case WorkspaceComposeCompleteMsg:
		if a.screen == ScreenWorkspace {
			if msg.Err != nil {
				a.workspace.FinishSessionTurn("Send failed")
				a.statusMsg = "workspace send failed: " + msg.Err.Error()
				a.statusTime = time.Now()
				return a, nil, true
			}
			if msg.SessionID != "" {
				a.workspace.TerminalSessionID = msg.SessionID
			}
			a.workspace.TerminalStatus = "Queued with controller"
			a.workspace.refreshSessionViewport()
			return a, nil, true
		}
		return a, nil, true

	case WorkspaceExecCompleteMsg:
		if a.screen == ScreenWorkspace {
			a.workspace.FinishSessionTurn("")
			a.workspace.AppendExecResult(msg.Command, msg.Result, msg.Err)
			return a, a.workspaceLoadDirCmd(), true
		}
		return a, nil, true

	case WorkspaceEntryCompleteMsg:
		if a.workspaceEntry.Active() {
			var cmd tea.Cmd
			a.workspaceEntry, cmd = a.workspaceEntry.Update(msg)
			if msg.Err != nil {
				a.statusMsg = "Create failed: " + msg.Err.Error()
				a.statusTime = time.Now()
				return a, cmd, true
			}
			a.statusMsg = "Created " + msg.Path
			a.statusTime = time.Now()
			return a, tea.Batch(cmd, a.workspaceLoadDirCmd()), true
		}
		return a, nil, true

	case WSConnectedMsg, WSDisconnectedMsg, WSTextChunkMsg,
		WSMilestoneMsg, WSAgentDoneMsg, WSPhaseChangeMsg,
		WSAgentSpawnedMsg, WSErrorMsg, WatchHistoryMsg:
		return a.handleWorkspaceStreamMessage(msg)

	case spinner.TickMsg:
		if a.screen == ScreenWorkspace && a.workspace.SessionTurnBusy {
			var cmd tea.Cmd
			a.workspace.ComposerSpinner, cmd = a.workspace.ComposerSpinner.Update(msg)
			a.workspace.refreshSessionViewport()
			return a, cmd, true
		}
	}
	return a, nil, false
}

func (a *App) handleWorkspaceStreamMessage(msg tea.Msg) (tea.Model, tea.Cmd, bool) {
	if a.screen == ScreenWorkspace {
		switch msg := msg.(type) {
		case WSTextChunkMsg:
			if a.workspace.SessionMatches(msg.SessionID) {
				a.workspace.AppendTerminalChunk(msg.Text)
				return a, nil, true
			}
		case WSMilestoneMsg:
			if a.workspace.SessionMatches(msg.SessionID) {
				a.workspace.AppendTerminalMilestone(strings.TrimSpace(coalesce(msg.Label, msg.ToolName)))
				return a, nil, true
			}
		case WSPhaseChangeMsg:
			if a.workspace.SessionMatches(msg.SessionID) {
				a.workspace.TerminalStatus = "Phase: " + strings.TrimSpace(msg.Phase)
				a.workspace.refreshSessionViewport()
				return a, nil, true
			}
		case WSAgentDoneMsg:
			if a.workspace.SessionMatches(msg.SessionID) {
				a.workspace.FinishSessionTurn("Turn complete")
				return a, a.workspaceLoadTerminalCmd(), true
			}
		case WSErrorMsg:
			a.workspace.FinishSessionTurn("Stream error")
			a.statusMsg = msg.Message
			a.statusTime = time.Now()
			return a, nil, true
		}
	}
	if a.screen == ScreenWatch {
		var cmd tea.Cmd
		a.watch, cmd = a.watch.Update(msg)
		return a, cmd, true
	}
	if a.screen == ScreenMission {
		var cmd tea.Cmd
		a.mission, cmd = a.mission.Update(msg)
		return a, cmd, true
	}
	return a, nil, true
}

func (a *App) handleWorkspaceFocusedInput(msg tea.KeyMsg) (tea.Model, tea.Cmd, bool) {
	if a.screen == ScreenWorkspace && a.workspace.EditorActive && msg.String() != "esc" && msg.String() != "ctrl+s" && msg.String() != "ctrl+z" {
		cmd := a.workspace.UpdateEditor(msg, a.workspacePreviewWidth(), a.workspacePreviewHeight())
		return a, cmd, true
	}
	if a.screen == ScreenWorkspace && a.workspace.DockMode != workspaceDockCanvas && a.workspace.FocusPane == 2 && a.workspace.ComposerFocused && !a.workspace.EditorActive {
		switch msg.String() {
		case "esc", "tab", "shift+tab":
			return a, nil, false
		case "enter":
			return a, a.workspaceSubmitComposeCmd(), true
		default:
			cmd := a.workspace.UpdateComposer(msg, a.workspacePreviewWidth())
			return a, cmd, true
		}
	}
	return a, nil, false
}
