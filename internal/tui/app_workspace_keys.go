package tui

import (
	"time"

	tea "github.com/charmbracelet/bubbletea"
)

func (a *App) handleWorkspaceKey(key string) (tea.Model, tea.Cmd) {
	switch key {
	case "q":
		a.screen = ScreenDashboard
		return a, nil
	case "p":
		a.workspace.OpenProjectPicker()
		return a, nil
	case "esc":
		if a.workspace.ProjectPickerOpen {
			a.workspace.CloseProjectPicker()
			return a, nil
		}
		if a.workspace.FocusPane == 3 {
			a.workspace.BlurSystemComposer()
			a.workspace.FocusComposer()
			return a, nil
		}
		if a.workspace.EditorActive {
			a.workspace.StopEditingPreview()
			return a, nil
		}
		if a.workspace.FocusPane == 2 {
			a.workspace.BlurComposer()
			a.workspace.FocusPane = 0
			return a, nil
		}
		return a, a.workspaceOpenDockCmd()
	case ":":
		if a.workspace.ProjectPickerOpen {
			a.workspace.CloseProjectPicker()
		}
		a.mode = ModeCommand
		a.cmdInput = ""
		return a, nil
	case "ctrl+s":
		return a, a.workspaceSaveCurrentFileCmd()
	case "ctrl+z":
		if a.workspace.UndoPreviewEdit() {
			return a, nil
		}
		return a, nil
	case "e":
		if a.workspace.FocusPane == 1 && a.workspace.DockMode == workspaceDockFiles {
			return a, a.workspaceOpenSelectedFileTabCmd()
		}
		if a.workspace.EditorActive {
			a.workspace.FocusPane = 2
			return a, nil
		}
		if a.workspace.BeginEditingPreview() {
			return a, nil
		}
		a.statusMsg = "Select a file from the explorer"
		a.statusTime = time.Now()
		return a, nil
	case "i":
		if a.workspace.DockMode == workspaceDockCanvas {
			a.workspace.FocusPane = 1
			return a, nil
		}
		if a.workspace.DockMode == workspaceDockFiles {
			a.workspace.FocusPane = 2
			return a, nil
		}
		a.workspace.BlurSystemComposer()
		a.workspace.FocusComposer()
		return a, nil
	case "x":
		if a.workspace.DockMode != workspaceDockChat {
			return a, nil
		}
		a.workspace.ToggleSystemDrawer()
		return a, nil
	case "n":
		if a.workspace.FocusPane == 1 && a.workspace.DockMode == workspaceDockFiles {
			return a, a.workspaceOpenExplorerMenuCmd(a.workspaceExplorerMenuBaseDir(), 0, 0)
		}
		return a, nil
	case "y":
		return a, copyWorkspaceTranscriptCmd(a.workspace.TranscriptPlainText())
	case "tab":
		a.workspace.BlurComposer()
		a.workspace.BlurSystemComposer()
		a.workspace.FocusPane = nextWorkspacePane(a.workspace.FocusPane, a.workspace.SystemDrawerOpen && a.workspace.DockMode == workspaceDockChat)
		if a.workspace.FocusPane == 2 && a.workspace.DockMode == workspaceDockChat {
			a.workspace.FocusComposer()
		}
		if a.workspace.FocusPane == 3 && a.workspace.DockMode == workspaceDockChat {
			a.workspace.FocusSystemComposer()
		}
		return a, nil
	case "shift+tab":
		a.workspace.BlurComposer()
		a.workspace.BlurSystemComposer()
		a.workspace.FocusPane = prevWorkspacePane(a.workspace.FocusPane, a.workspace.SystemDrawerOpen && a.workspace.DockMode == workspaceDockChat)
		if a.workspace.FocusPane == 2 && a.workspace.DockMode == workspaceDockChat {
			a.workspace.FocusComposer()
		}
		if a.workspace.FocusPane == 3 && a.workspace.DockMode == workspaceDockChat {
			a.workspace.FocusSystemComposer()
		}
		return a, nil
	case "l", "right":
		switch a.workspace.FocusPane {
		case 0:
			a.workspace.StepDockMode(1)
		case 2:
			if a.workspace.DockMode == workspaceDockCanvas {
				a.workspace.StepCanvasTab(1)
			}
		}
		return a, nil
	case "h", "left":
		switch a.workspace.FocusPane {
		case 0:
			a.workspace.StepDockMode(-1)
		case 2:
			if a.workspace.DockMode == workspaceDockCanvas {
				a.workspace.StepCanvasTab(-1)
			}
		}
		return a, nil
	case "j", "down":
		if a.workspace.ProjectPickerOpen {
			a.workspace.MoveProjectPicker(1)
			return a, nil
		}
		switch a.workspace.FocusPane {
		case 1:
			switch a.workspace.DockMode {
			case workspaceDockFiles:
				a.workspace.SidebarList.CursorDown()
				a.workspace.SetExplorerIndex(a.workspace.SidebarList.Index())
			case workspaceDockCanvas:
				a.workspace.SidebarList.CursorDown()
				a.workspace.SetCanvasWidgetIndex(a.workspace.SidebarList.Index())
			case workspaceDockTasks:
				a.workspace.SidebarList.CursorDown()
				if a.workspace.SetSelectedAgentIndex(a.workspace.SidebarList.Index()) {
					return a, a.workspaceLoadSelectedAgentPreviewCmd()
				}
			case workspaceDockMetrics:
				return a, nil
			}
		case 2:
			a.workspace.FollowSessionTail = false
			a.workspace.SessionViewport.LineDown(1)
		case 3:
			a.workspace.FollowSystemTail = false
			a.workspace.SystemViewport.LineDown(1)
		}
		return a, nil
	case "k", "up":
		if a.workspace.ProjectPickerOpen {
			a.workspace.MoveProjectPicker(-1)
			return a, nil
		}
		switch a.workspace.FocusPane {
		case 1:
			switch a.workspace.DockMode {
			case workspaceDockFiles:
				a.workspace.SidebarList.CursorUp()
				a.workspace.SetExplorerIndex(a.workspace.SidebarList.Index())
			case workspaceDockCanvas:
				a.workspace.SidebarList.CursorUp()
				a.workspace.SetCanvasWidgetIndex(a.workspace.SidebarList.Index())
			case workspaceDockTasks:
				a.workspace.SidebarList.CursorUp()
				if a.workspace.SetSelectedAgentIndex(a.workspace.SidebarList.Index()) {
					return a, a.workspaceLoadSelectedAgentPreviewCmd()
				}
			case workspaceDockMetrics:
				return a, nil
			}
		case 2:
			a.workspace.FollowSessionTail = false
			a.workspace.SessionViewport.LineUp(1)
		case 3:
			a.workspace.FollowSystemTail = false
			a.workspace.SystemViewport.LineUp(1)
		}
		return a, nil
	case "pgdown", "ctrl+f":
		if a.workspace.FocusPane == 2 {
			a.workspace.FollowSessionTail = false
			a.workspace.SessionViewport.HalfViewDown()
			return a, nil
		}
		if a.workspace.FocusPane == 3 {
			a.workspace.FollowSystemTail = false
			a.workspace.SystemViewport.HalfViewDown()
			return a, nil
		}
	case "pgup", "ctrl+b":
		if a.workspace.FocusPane == 2 {
			a.workspace.FollowSessionTail = false
			a.workspace.SessionViewport.HalfViewUp()
			return a, nil
		}
		if a.workspace.FocusPane == 3 {
			a.workspace.FollowSystemTail = false
			a.workspace.SystemViewport.HalfViewUp()
			return a, nil
		}
	case "end", "G":
		if a.workspace.FocusPane == 2 {
			a.workspace.FollowSessionTail = true
			a.workspace.SessionViewport.GotoBottom()
			return a, nil
		}
		if a.workspace.FocusPane == 3 {
			a.workspace.FollowSystemTail = true
			a.workspace.SystemViewport.GotoBottom()
			return a, nil
		}
	case "home", "g":
		if a.workspace.FocusPane == 2 {
			a.workspace.FollowSessionTail = false
			a.workspace.SessionViewport.GotoTop()
			return a, nil
		}
		if a.workspace.FocusPane == 3 {
			a.workspace.FollowSystemTail = false
			a.workspace.SystemViewport.GotoTop()
			return a, nil
		}
	case "enter":
		if a.workspace.ProjectPickerOpen {
			if a.workspace.SelectedProjectPickerAction() == "create" {
				a.workspace.CloseProjectPicker()
				return a, func() tea.Msg { return ShowCreateProjectMsg{} }
			}
			projectName := a.workspace.SelectedProjectPickerName()
			if projectName != "" && a.workspace.SetProjectByName(projectName) {
				return a, tea.Batch(a.workspaceLoadDirCmd(), a.workspaceLoadTerminalCmd())
			}
			a.workspace.CloseProjectPicker()
			return a, nil
		}
		switch a.workspace.FocusPane {
		case 1:
			switch a.workspace.DockMode {
			case workspaceDockFiles:
				return a, a.workspaceOpenSelectedFileTabCmd()
			case workspaceDockCanvas:
				return a, nil
			case workspaceDockTasks:
				return a, a.workspaceLoadSelectedAgentPreviewCmd()
			default:
				return a, nil
			}
		case 3:
			return a, a.workspaceSubmitSystemComposeCmd()
		}
		return a, nil
	}
	return a, nil
}
