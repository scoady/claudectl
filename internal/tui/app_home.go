package tui

import tea "github.com/charmbracelet/bubbletea"

func (a *App) navigateToWorkspaceShell(projectName string) (tea.Model, tea.Cmd) {
	if a.wsClient != nil {
		a.wsClient.Close()
	}
	a.screen = ScreenWorkspace
	a.wsClient = NewWSClient(a.client.BaseURL)
	a.workspace.Projects = a.dashboard.Projects
	a.workspace.Agents = a.dashboard.Agents
	if projectName == "" {
		if p := a.dashboard.SelectedProject(); p != nil {
			projectName = p.Name
		}
	}
	a.workspace.CurrentProject = projectName
	a.workspace.Sync()
	return a, tea.Batch(
		a.workspace.InitCmd(),
		a.workspaceLoadDirCmd(),
		a.workspaceLoadTerminalCmd(),
		a.startWSWatch(""),
		a.workspaceFilesPollCmd(),
		FetchHostMetricsCmd(a.hostMetrics),
	)
}

func (a *App) handleHomeMouse(msg tea.MouseMsg) (tea.Model, tea.Cmd) {
	contentY := msg.Y - 3
	if contentY < 0 || contentY >= a.layout.ContentHeight {
		return a, nil
	}
	if msg.Action != tea.MouseActionPress {
		return a, nil
	}
	zoneMsg := msg
	zoneMsg.Y = contentY

	switch {
	case zoneInBounds(homeCardWorkspaces, zoneMsg):
		return a.navigateToWorkspaceShell("")
	case zoneInBounds(homeCardMetrics, zoneMsg):
		return a, func() tea.Msg { return NavigateMsg{Screen: ScreenMetrics} }
	case zoneInBounds(homeCardTools, zoneMsg):
		return a.navigateToTools()
	case zoneInBounds(homeCardCreate, zoneMsg):
		return a, func() tea.Msg { return ShowCreateProjectMsg{} }
	default:
		return a, nil
	}
}
