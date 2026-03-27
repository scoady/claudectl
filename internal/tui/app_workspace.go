package tui

import (
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
)

func (a *App) workspaceOpenDockCmd() tea.Cmd {
	cur := a.workspace.Current()
	projectName := ""
	if cur != nil {
		projectName = cur.Name
	}
	canEdit := a.workspace.CanEditPreviewFile()
	editorLabel := "Enter IDE Mode"
	if a.workspace.EditorActive {
		editorLabel = "Stop Editing"
	}
	saveDisabled := !a.workspace.EditorActive || !a.workspace.EditorDirty || projectName == "" || a.workspace.PreviewPath == ""

	var items []MenuItem
	items = append(items,
		MenuItem{
			Label: "Dispatch Task",
			Icon:  "▸",
			Action: func() tea.Msg {
				return ShowDispatchMsg{ProjectName: projectName}
			},
			Disabled: projectName == "",
		},
		MenuItem{
			Label: editorLabel,
			Icon:  "✎",
			Action: func() tea.Msg {
				return executeCommandMsg{Command: "workspace.toggle-editor"}
			},
			Disabled: !canEdit && !a.workspace.EditorActive,
		},
		MenuItem{
			Label: "Save File",
			Icon:  "⇪",
			Action: func() tea.Msg {
				return executeCommandMsg{Command: "workspace.save-file"}
			},
			Disabled: saveDisabled,
		},
		MenuItem{
			Label: "Inspect Selected Task",
			Icon:  "◉",
			Action: func() tea.Msg {
				return executeCommandMsg{Command: "workspace.preview-agent"}
			},
			Disabled: a.workspace.SelectedAgentRef() == nil,
		},
		MenuItem{
			Label: "Message Controller Lane",
			Icon:  "▹",
			Action: func() tea.Msg {
				ag := a.workspace.TerminalAgentRef()
				if ag == nil {
					return nil
				}
				return ShowInjectMsg{SessionID: ag.SessionID}
			},
			Disabled: a.workspace.TerminalAgentRef() == nil,
		},
		MenuItem{
			Label: "Clear Terminal View",
			Icon:  "⌫",
			Action: func() tea.Msg {
				a.workspace.ClearTerminalView()
				return nil
			},
		},
		MenuItem{
			Label: "Watch Selected Task",
			Icon:  "↗",
			Action: func() tea.Msg {
				ag := a.workspace.SelectedAgentRef()
				if ag == nil {
					return nil
				}
				return NavigateMsg{Screen: ScreenWatch, Agent: ag}
			},
			Disabled: a.workspace.SelectedAgentRef() == nil,
		},
		MenuItem{
			Label: "Open Project Detail",
			Icon:  "▣",
			Action: func() tea.Msg {
				if cur == nil {
					return nil
				}
				return NavigateMsg{Screen: ScreenProject, Project: cur}
			},
			Disabled: cur == nil,
		},
	)
	return a.showAppMenuCmd("Workspace Dock", items)
}

func (a *App) workspaceOpenProjectSelectorCmd() tea.Cmd {
	a.workspace.OpenProjectPicker()
	return nil
}

func (a *App) workspaceOpenExplorerMenuCmd(baseDir string, anchorX, anchorY int) tea.Cmd {
	cur := a.workspace.Current()
	items := []MenuItem{
		{
			Label: "New File",
			Key:   "f",
			Icon:  "📄",
			Action: func() tea.Msg {
				if cur == nil {
					return nil
				}
				return ShowWorkspaceEntryMsg{Kind: "file", ProjectName: cur.Name, BaseDir: baseDir}
			},
			Disabled: cur == nil,
		},
		{
			Label: "New Folder",
			Key:   "d",
			Icon:  "📁",
			Action: func() tea.Msg {
				if cur == nil {
					return nil
				}
				return ShowWorkspaceEntryMsg{Kind: "folder", ProjectName: cur.Name, BaseDir: baseDir}
			},
			Disabled: cur == nil,
		},
	}
	return func() tea.Msg {
		return ShowContextMenuMsg{
			Title:   "Explorer",
			Items:   items,
			AnchorX: anchorX,
			AnchorY: anchorY,
		}
	}
}

func (a *App) workspaceExplorerMenuBaseDir() string {
	baseDir := strings.Trim(a.workspace.CurrentDir, "/")
	items := a.workspace.ExplorerItems()
	idx := a.workspace.SidebarList.Index()
	if idx >= 0 && idx < len(items) {
		item := items[idx]
		if item.IsDir && !item.IsParent {
			baseDir = strings.Trim(item.Path, "/")
		}
	}
	return baseDir
}

func (a *App) workspaceLoadDirCmd() tea.Cmd {
	cur := a.workspace.Current()
	if cur == nil {
		return nil
	}
	return tea.Batch(
		FetchWorkspaceFilesCmd(a.client, cur.Name, a.workspace.CurrentDir),
		FetchWorkspaceCanvasCmd(a.client, cur.Name),
		FetchWorkspaceGitStatusCmd(a.client, cur.Name),
		FetchWorkspaceGitBranchCmd(a.client, cur.Name),
	)
}

func (a *App) workspaceOpenExplorerSelection() tea.Cmd {
	cur := a.workspace.Current()
	if cur == nil {
		return nil
	}
	loadDir, previewFile := a.workspace.OpenExplorerSelection()
	if loadDir != "" {
		return FetchWorkspaceFilesCmd(a.client, cur.Name, loadDir)
	}
	if previewFile != "" {
		return FetchWorkspaceFilePreviewCmd(a.client, cur.Name, previewFile)
	}
	return nil
}

func (a *App) workspaceOpenSelectedFileTabCmd() tea.Cmd {
	cur := a.workspace.Current()
	if cur == nil {
		return nil
	}
	item, ok := a.workspace.SelectedExplorerItem()
	if !ok {
		return nil
	}
	if item.IsDir {
		a.statusMsg = "Select a file to edit"
		a.statusTime = time.Now()
		return nil
	}
	a.workspace.SetDockMode(workspaceDockFiles)
	a.workspace.StartOpenFileTab(item.Path)
	return FetchWorkspaceFilePreviewCmd(a.client, cur.Name, item.Path)
}

func (a *App) workspaceLoadSelectedAgentPreviewCmd() tea.Cmd {
	ag := a.workspace.SelectedAgentRef()
	if ag == nil {
		a.statusMsg = "No agents in current workspace"
		a.statusTime = time.Now()
		return nil
	}
	return FetchWorkspaceAgentPreviewCmd(a.client, ag.SessionID)
}

func (a *App) workspaceLoadTerminalCmd() tea.Cmd {
	sessionID := a.workspace.ActiveSessionID()
	if sessionID == "" {
		a.workspace.SetTerminalPreview("", nil, nil)
		return nil
	}
	return FetchWorkspaceTerminalPreviewCmd(a.client, sessionID)
}

func (a *App) workspaceSaveCurrentFileCmd() tea.Cmd {
	cur := a.workspace.Current()
	if cur == nil || !a.workspace.EditorActive || a.workspace.PreviewPath == "" {
		return nil
	}
	return SaveWorkspaceFileCmd(a.client, cur.Name, a.workspace.PreviewPath, a.workspace.Editor.Value())
}

func (a *App) workspaceSubmitComposeCmd() tea.Cmd {
	if a.client == nil {
		return nil
	}
	message := a.workspace.ComposerValue()
	if message == "" || a.workspace.SessionTurnBusy {
		return nil
	}
	cur := a.workspace.Current()
	if cur == nil {
		a.statusMsg = "No active workspace"
		a.statusTime = time.Now()
		return nil
	}
	composeMessage := a.workspace.ComposeControllerMessage(message)
	a.workspace.AppendLocalUserMessage(message)
	a.workspace.ClearComposer()
	a.workspace.StartSessionTurn()
	return tea.Batch(
		func() tea.Msg {
			return a.workspace.ComposerSpinner.Tick()
		},
		WorkspaceComposeCmd(a.client, cur.Name, a.workspace.ActiveSessionID(), composeMessage),
	)
}

func (a *App) workspaceSubmitSystemComposeCmd() tea.Cmd {
	if a.client == nil {
		return nil
	}
	message := a.workspace.SystemComposerValue()
	if message == "" || a.workspace.SessionTurnBusy {
		return nil
	}
	cur := a.workspace.Current()
	if cur == nil {
		a.statusMsg = "No active workspace"
		a.statusTime = time.Now()
		return nil
	}
	a.workspace.ClearSystemComposer()
	a.workspace.StartSessionTurn()
	a.workspace.AppendExecCommand(message)
	return WorkspaceExecCmd(a.client, cur.Name, message)
}

func (a *App) workspacePreviewWidth() int {
	ly := computeWorkspaceShellAppLayout(a.width, a.layout.ContentHeight, a.workspace.SystemDrawerOpen, a.workspace.DockMode)
	if ly.Main.W > 6 {
		return ly.Main.W - 4
	}
	return a.width
}

func (a *App) workspacePreviewHeight() int {
	ly := computeWorkspaceShellAppLayout(a.width, a.layout.ContentHeight, a.workspace.SystemDrawerOpen, a.workspace.DockMode)
	if ly.Main.H > 8 {
		return ly.Main.H - 8
	}
	return a.layout.ContentHeight
}

func (a *App) handleWorkspaceMouse(msg tea.MouseMsg) (tea.Model, tea.Cmd) {
	contentY := msg.Y - 3
	if contentY < 0 || contentY >= a.layout.ContentHeight {
		return a, nil
	}
	ly := computeWorkspaceShellAppLayout(a.width, a.layout.ContentHeight, a.workspace.SystemDrawerOpen, a.workspace.DockMode)
	x := msg.X
	y := contentY
	zoneMsg := msg
	zoneMsg.Y = contentY

	if msg.Action != tea.MouseActionPress {
		return a, nil
	}

	if a.workspace.ProjectPickerOpen {
		if row, ok := workspaceProjectPickerIndexAt(zoneMsg, &a.workspace); ok {
			a.workspace.ProjectPicker.Select(row)
			if a.workspace.SelectedProjectPickerAction() == "create" {
				a.workspace.CloseProjectPicker()
				return a, func() tea.Msg { return ShowCreateProjectMsg{} }
			}
			projectName := a.workspace.SelectedProjectPickerName()
			if projectName != "" && a.workspace.SetProjectByName(projectName) {
				return a, tea.Batch(a.workspaceLoadDirCmd(), a.workspaceLoadTerminalCmd())
			}
			return a, nil
		}
		if !ly.Picker.contains(x, y) {
			a.workspace.CloseProjectPicker()
		}
		return a, nil
	}

	switch {
	case ly.Activity.contains(x, y):
		a.workspace.FocusPane = 0
		a.workspace.BlurComposer()
		a.workspace.BlurSystemComposer()
		if mode, ok := workspaceActivityActionAt(zoneMsg); ok {
			a.workspace.SetDockMode(mode)
			return a, nil
		}
		if idx := workspaceShellDockIndexAt(y, ly.Activity); idx >= 0 {
			a.workspace.SetDockMode(workspaceDockItems()[idx].Mode)
		}
		return a, nil

	case ly.Sidebar.contains(x, y):
		a.workspace.FocusPane = 1
		a.workspace.BlurComposer()
		a.workspace.BlurSystemComposer()
		switch a.workspace.DockMode {
		case workspaceDockFiles:
			row := y - ly.Sidebar.Y - 4
			items := a.workspace.ExplorerItems()
			if row >= 0 && row < len(items) {
				a.workspace.SetExplorerIndex(row)
				if msg.Button == tea.MouseButtonRight {
					baseDir := strings.Trim(a.workspace.CurrentDir, "/")
					if items[row].IsDir && !items[row].IsParent {
						baseDir = strings.Trim(items[row].Path, "/")
					}
					return a, a.workspaceOpenExplorerMenuCmd(baseDir, msg.X, contentY)
				}
				item := items[row]
				if item.IsDir {
					return a, nil
				}
				if a.workspace.DockMode == workspaceDockFiles {
					return a, a.workspaceOpenSelectedFileTabCmd()
				}
				doubleClick := a.workspace.RegisterExplorerClick(item.Path, time.Now())
				if doubleClick {
					return a, a.workspaceOpenSelectedFileTabCmd()
				}
				return a, nil
			}
			if msg.Button == tea.MouseButtonRight {
				return a, a.workspaceOpenExplorerMenuCmd(strings.Trim(a.workspace.CurrentDir, "/"), msg.X, contentY)
			}
		case workspaceDockCanvas:
			row := y - ly.Sidebar.Y - 4
			widgets := a.workspace.CanvasWidgetsForActiveTab()
			if row >= 0 && row < len(widgets) {
				a.workspace.SetCanvasWidgetIndex(row)
				return a, nil
			}
		case workspaceDockTasks:
			row := y - ly.Sidebar.Y - 4
			agents := a.workspace.SubagentsForCurrent()
			if row >= 0 && row < len(agents) {
				a.workspace.SetSelectedAgentIndex(row)
				return a, a.workspaceLoadSelectedAgentPreviewCmd()
			}
		default:
			return a, nil
		}
		return a, nil

	case ly.Main.contains(x, y):
		if a.workspace.DockMode == workspaceDockChat && zoneInBounds(workspaceSystemDrawerToggleZoneID(), zoneMsg) {
			a.workspace.ToggleSystemDrawer()
			return a, nil
		}
		if a.workspace.DockMode == workspaceDockCanvas {
			if tab, ok := workspaceShellCanvasTabActionAt(&a.workspace, zoneMsg); ok {
				a.workspace.SetCanvasTab(tab)
				return a, nil
			}
		}
		if a.workspace.DockMode == workspaceDockCanvas {
			a.workspace.FocusPane = 2
			a.workspace.BlurComposer()
			a.workspace.BlurSystemComposer()
			return a, nil
		}
		if a.workspace.SystemDrawerOpen && ly.Drawer.contains(x, y) {
			a.workspace.BlurComposer()
			a.workspace.FocusSystemComposer()
			switch msg.Button {
			case tea.MouseButtonWheelUp:
				a.workspace.FollowSystemTail = false
				a.workspace.SystemViewport.LineUp(3)
				return a, nil
			case tea.MouseButtonWheelDown:
				a.workspace.FollowSystemTail = false
				a.workspace.SystemViewport.LineDown(3)
				return a, nil
			}
			return a, nil
		}
		if ly.Transcript.contains(x, y) {
			a.workspace.FocusPane = 2
			a.workspace.BlurSystemComposer()
			switch msg.Button {
			case tea.MouseButtonWheelUp:
				a.workspace.FollowSessionTail = false
				a.workspace.SessionViewport.LineUp(3)
				return a, nil
			case tea.MouseButtonWheelDown:
				a.workspace.FollowSessionTail = false
				a.workspace.SessionViewport.LineDown(3)
				return a, nil
			}
		}
		if !a.workspace.EditorActive && a.workspace.DockMode == workspaceDockChat {
			if action, ok := workspaceShellTabActionAt(&a.workspace, zoneMsg); ok {
				switch action.kind {
				case "add":
					a.workspace.OpenProjectPicker()
					return a, nil
				case "close":
					if a.workspace.CloseProjectTab(action.name) {
						if a.workspace.CurrentProject != "" {
							return a, tea.Batch(a.workspaceLoadDirCmd(), a.workspaceLoadTerminalCmd())
						}
						return a, nil
					}
					return a, nil
				case "activate":
					if a.workspace.SetProjectByName(action.name) {
						return a, tea.Batch(a.workspaceLoadDirCmd(), a.workspaceLoadTerminalCmd())
					}
					return a, nil
				}
			}
		}
		if a.workspace.EditorActive {
			a.workspace.FocusPane = 2
			a.workspace.BlurSystemComposer()
			if action, ok := workspaceShellFileTabActionAt(&a.workspace, zoneMsg); ok {
				switch action.kind {
				case "close":
					a.workspace.CloseFileTab(action.name)
				case "activate":
					a.workspace.ActivateFileTab(action.name)
				}
				return a, nil
			}
			return a, nil
		}
		a.workspace.BlurSystemComposer()
		a.workspace.FocusComposer()
		return a, nil
	}
	return a, nil
}
