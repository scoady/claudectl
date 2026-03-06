package tui

import (
	"fmt"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/scoady/claudectl/internal/api"
)

// Mode represents the input mode.
type Mode int

const (
	ModeNormal Mode = iota
	ModeCommand
	ModeFilter
)


// ── Messages ─────────────────────────────────────────────────────────────────

// TickMsg is sent periodically to trigger data refresh.
type TickMsg time.Time

// DataMsg carries refreshed data from the API.
type DataMsg struct {
	Projects []api.Project
	Agents   []api.Agent
	Stats    *api.StatsResponse
	Health   *api.HealthResponse
	Tasks    []api.Task   // for project detail
	Widgets  []api.Widget // for project detail
	Err      error
}

// KillResultMsg is the result of killing an agent.
type KillResultMsg struct {
	SessionID string
	Err       error
}

// DeleteProjectResultMsg is the result of deleting a project.
type DeleteProjectResultMsg struct {
	ProjectName string
	Err         error
}

// ── App Model ────────────────────────────────────────────────────────────────

// App is the main bubbletea model.
type App struct {
	client *api.Client
	width  int
	height int

	screen     Screen
	mode       Mode
	cmdInput   string
	showHelp   bool
	statusMsg  string
	statusTime time.Time

	// Data
	health *api.HealthResponse
	stats  *api.StatsResponse

	// Screen models
	dashboard DashboardModel
	project   ProjectModel
	agents    AgentsModel
	watch     WatchModel

	// Overlays
	dispatch      DispatchModel
	inject        InjectModel
	createProject CreateProjectModel
	confirm       ConfirmModel
	contextMenu   ContextMenuModel

	// WebSocket
	wsClient *WSClient
	program  *tea.Program

	// Navigation
	projectName string // which project we're viewing
}

// NewApp creates a new TUI app.
func NewApp(apiURL string) *App {
	return &App{
		client: api.NewClient(apiURL),
		screen: ScreenDashboard,
		mode:   ModeNormal,
	}
}

// Init initializes the app.
func (a *App) Init() tea.Cmd {
	return tea.Batch(
		a.fetchData(),
		a.tickCmd(),
	)
}

func (a *App) tickCmd() tea.Cmd {
	return tea.Tick(2*time.Second, func(t time.Time) tea.Msg {
		return TickMsg(t)
	})
}

func (a *App) fetchData() tea.Cmd {
	return func() tea.Msg {
		msg := DataMsg{}

		health, err := a.client.Health()
		if err != nil {
			msg.Health = &api.HealthResponse{Status: "unreachable"}
		} else {
			msg.Health = health
		}

		projects, err := a.client.GetProjects()
		if err == nil {
			msg.Projects = projects
		}

		agents, err := a.client.GetAgents()
		if err == nil {
			msg.Agents = agents
		}

		stats, err := a.client.Stats()
		if err == nil {
			msg.Stats = stats
		}

		// If viewing a project, fetch tasks and widgets
		if a.screen == ScreenProject && a.projectName != "" {
			tasks, err := a.client.GetTasks(a.projectName)
			if err == nil {
				msg.Tasks = tasks
			}
			widgets, err := a.client.GetWidgets(a.projectName)
			if err == nil {
				msg.Widgets = widgets
			}
		}

		return msg
	}
}

func (a *App) killAgent(sessionID string) tea.Cmd {
	return func() tea.Msg {
		err := a.client.KillAgent(sessionID)
		return KillResultMsg{SessionID: sessionID, Err: err}
	}
}

func (a *App) deleteProject(name string) tea.Cmd {
	return func() tea.Msg {
		err := a.client.DeleteProject(name)
		return DeleteProjectResultMsg{ProjectName: name, Err: err}
	}
}

// Update handles messages.
func (a *App) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {

	case tea.WindowSizeMsg:
		a.width = msg.Width
		a.height = msg.Height
		if a.screen == ScreenWatch {
			a.watch, _ = a.watch.Update(msg)
		}
		return a, nil

	case TickMsg:
		return a, tea.Batch(a.fetchData(), a.tickCmd())

	case DataMsg:
		a.health = msg.Health
		if msg.Stats != nil {
			a.stats = msg.Stats
		}
		if msg.Projects != nil {
			a.dashboard.Projects = msg.Projects
			a.dashboard.Stats = a.stats
			a.dashboard.ClampSelection()
		}
		if msg.Agents != nil {
			a.dashboard.Agents = msg.Agents
			a.agents.Agents = msg.Agents

			// Update project agents
			if a.screen == ScreenProject && a.projectName != "" {
				var pa []api.Agent
				for _, ag := range msg.Agents {
					if ag.ProjectName == a.projectName {
						pa = append(pa, ag)
					}
				}
				a.project.Agents = pa
			}

			a.agents.ClampSelection()
		}
		if a.screen == ScreenProject {
			if msg.Tasks != nil {
				a.project.Tasks = msg.Tasks
			}
			if msg.Widgets != nil {
				a.project.Widgets = msg.Widgets
			}
		}
		return a, nil

	case KillResultMsg:
		if msg.Err != nil {
			a.statusMsg = "Kill failed: " + msg.Err.Error()
		} else {
			a.statusMsg = "Killed agent " + truncate(msg.SessionID, 16)
		}
		a.statusTime = time.Now()
		return a, a.fetchData()

	case DeleteProjectResultMsg:
		if msg.Err != nil {
			a.statusMsg = "Delete failed: " + msg.Err.Error()
		} else {
			a.statusMsg = "Deleted project " + msg.ProjectName
		}
		a.statusTime = time.Now()
		return a, a.fetchData()

	case wsStartMsg:
		if a.wsClient != nil && a.program != nil {
			return a, a.wsClient.Connect(a.program, msg.sessionID)
		}
		return a, nil

	case NavigateMsg:
		return a.handleNavigate(msg)

	case ShowDispatchMsg:
		a.dispatch = NewDispatchModel(msg.ProjectName, a.client)
		return a, a.dispatch.Init()

	case ShowInjectMsg:
		a.inject = NewInjectModel(msg.SessionID, a.client)
		return a, a.inject.Init()

	case ShowCreateProjectMsg:
		a.createProject = NewCreateProjectModel(a.client)
		return a, a.createProject.Init()

	case ShowConfirmMsg:
		a.confirm = NewConfirmModel(msg)
		return a, a.confirm.Init()

	case ShowContextMenuMsg:
		a.contextMenu = NewContextMenuModel(msg)
		return a, a.contextMenu.Init()

	case DispatchCompleteMsg:
		if a.dispatch.Active() {
			a.dispatch, _ = a.dispatch.Update(msg)
			return a, nil
		}

	case InjectCompleteMsg:
		if a.inject.Active() {
			a.inject, _ = a.inject.Update(msg)
			return a, nil
		}

	case CreateProjectCompleteMsg:
		if a.createProject.Active() {
			var cmd tea.Cmd
			a.createProject, cmd = a.createProject.Update(msg)
			return a, cmd
		}

	// WS events — forward to watch model when in watch screen
	case WSConnectedMsg, WSDisconnectedMsg, WSTextChunkMsg,
		WSMilestoneMsg, WSAgentDoneMsg, WSPhaseChangeMsg,
		WSAgentSpawnedMsg, WSErrorMsg:
		if a.screen == ScreenWatch {
			var cmd tea.Cmd
			a.watch, cmd = a.watch.Update(msg)
			return a, cmd
		}

	case tea.KeyMsg:
		// Overlays get priority (in order)
		if a.contextMenu.Active() {
			var cmd tea.Cmd
			a.contextMenu, cmd = a.contextMenu.Update(msg)
			return a, cmd
		}
		if a.confirm.Active() {
			var cmd tea.Cmd
			a.confirm, cmd = a.confirm.Update(msg)
			return a, cmd
		}
		if a.createProject.Active() {
			var cmd tea.Cmd
			a.createProject, cmd = a.createProject.Update(msg)
			return a, cmd
		}
		if a.dispatch.Active() {
			var cmd tea.Cmd
			a.dispatch, cmd = a.dispatch.Update(msg)
			return a, cmd
		}
		if a.inject.Active() {
			var cmd tea.Cmd
			a.inject, cmd = a.inject.Update(msg)
			return a, cmd
		}
		// Watch screen gets its own key handling
		if a.screen == ScreenWatch {
			var cmd tea.Cmd
			a.watch, cmd = a.watch.Update(msg)
			return a, cmd
		}
		return a.handleKey(msg)
	}

	return a, nil
}

func (a *App) handleKey(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	key := msg.String()

	// Help toggle (works in all modes)
	if key == "?" && a.mode == ModeNormal {
		a.showHelp = !a.showHelp
		return a, nil
	}

	// Dismiss help
	if a.showHelp {
		if key == "esc" || key == "?" || key == "q" {
			a.showHelp = false
		}
		return a, nil
	}

	// Command mode input
	if a.mode == ModeCommand {
		return a.handleCommandInput(key)
	}

	// Filter mode input
	if a.mode == ModeFilter {
		return a.handleFilterInput(key)
	}

	// Normal mode
	switch key {
	case "q", "ctrl+c":
		if a.screen != ScreenDashboard {
			if a.screen == ScreenWatch && a.wsClient != nil {
				a.wsClient.Close()
				a.wsClient = nil
			}
			a.screen = ScreenDashboard
			return a, nil
		}
		return a, tea.Quit

	case "esc":
		if a.screen != ScreenDashboard {
			if a.screen == ScreenWatch && a.wsClient != nil {
				a.wsClient.Close()
				a.wsClient = nil
			}
			a.screen = ScreenDashboard
			return a, nil
		}
		return a, nil

	case ":":
		a.mode = ModeCommand
		a.cmdInput = ""
		return a, nil

	case "/":
		a.mode = ModeFilter
		return a, nil

	case "j", "down":
		a.moveSelection(1)
		return a, nil

	case "k", "up":
		a.moveSelection(-1)
		return a, nil

	case "enter":
		return a.handleEnter()

	case "d":
		return a.handleDetail()

	case "c":
		// Create project (dashboard only)
		if a.screen == ScreenDashboard {
			return a, func() tea.Msg { return ShowCreateProjectMsg{} }
		}

	case "x", "delete":
		// Delete with confirmation
		return a.handleDelete()

	case "ctrl+d":
		// Open dispatch dialog for current project
		projectName := ""
		if a.screen == ScreenProject {
			projectName = a.projectName
		} else if a.screen == ScreenDashboard {
			p := a.dashboard.SelectedProject()
			if p != nil {
				projectName = p.Name
			}
		}
		if projectName != "" {
			return a, func() tea.Msg { return ShowDispatchMsg{ProjectName: projectName} }
		}
		a.statusMsg = "Select a project first"
		a.statusTime = time.Now()
		return a, nil

	case "tab":
		if a.screen == ScreenProject {
			a.project.Panel = (a.project.Panel + 1) % 3
			a.project.Selected = 0
			return a, nil
		}

	case "1", "2", "3", "4", "5", "6", "7", "8", "9":
		idx := int(key[0]-'0') - 1
		if a.screen == ScreenDashboard {
			filtered := a.dashboard.FilteredProjects()
			if idx < len(filtered) {
				a.dashboard.Selected = idx
				return a.navigateToProject(filtered[idx].Name)
			}
		}
	}

	// 'l' for logs — open watch view for selected agent
	if key == "l" {
		if a.screen == ScreenAgents {
			ag := a.agents.SelectedAgent()
			if ag != nil {
				return a, func() tea.Msg {
					return NavigateMsg{Screen: ScreenWatch, Agent: ag}
				}
			}
		} else if a.screen == ScreenProject {
			if a.project.Panel == 0 && len(a.project.Agents) > 0 {
				if a.project.Selected >= 0 && a.project.Selected < len(a.project.Agents) {
					ag := a.project.Agents[a.project.Selected]
					return a, func() tea.Msg {
						return NavigateMsg{Screen: ScreenWatch, Agent: &ag}
					}
				}
			}
		}
		return a, nil
	}

	// 'K' for kill
	if key == "K" { // capital K to avoid conflict with up movement
		return a.handleKill()
	}

	return a, nil
}

func (a *App) handleCommandInput(key string) (tea.Model, tea.Cmd) {
	switch key {
	case "esc":
		a.mode = ModeNormal
		a.cmdInput = ""
		return a, nil

	case "enter":
		cmd := strings.TrimSpace(a.cmdInput)
		a.mode = ModeNormal
		a.cmdInput = ""
		return a.executeCommand(cmd)

	case "backspace":
		if len(a.cmdInput) > 0 {
			a.cmdInput = a.cmdInput[:len(a.cmdInput)-1]
		}
		return a, nil

	default:
		if len(key) == 1 {
			a.cmdInput += key
		}
		return a, nil
	}
}

func (a *App) handleFilterInput(key string) (tea.Model, tea.Cmd) {
	switch key {
	case "esc":
		a.mode = ModeNormal
		// Clear filter
		switch a.screen {
		case ScreenDashboard:
			a.dashboard.Filter = ""
		case ScreenAgents:
			a.agents.Filter = ""
		}
		return a, nil

	case "enter":
		a.mode = ModeNormal
		return a, nil

	case "backspace":
		switch a.screen {
		case ScreenDashboard:
			if len(a.dashboard.Filter) > 0 {
				a.dashboard.Filter = a.dashboard.Filter[:len(a.dashboard.Filter)-1]
				a.dashboard.Selected = 0
			}
		case ScreenAgents:
			if len(a.agents.Filter) > 0 {
				a.agents.Filter = a.agents.Filter[:len(a.agents.Filter)-1]
				a.agents.Selected = 0
			}
		}
		return a, nil

	default:
		if len(key) == 1 {
			switch a.screen {
			case ScreenDashboard:
				a.dashboard.Filter += key
				a.dashboard.Selected = 0
			case ScreenAgents:
				a.agents.Filter += key
				a.agents.Selected = 0
			}
		}
		return a, nil
	}
}

func (a *App) executeCommand(cmd string) (tea.Model, tea.Cmd) {
	switch cmd {
	case "q", "quit":
		return a, tea.Quit
	case "agents":
		a.screen = ScreenAgents
		a.agents.Selected = 0
		return a, nil
	case "projects", "dashboard", "home":
		a.screen = ScreenDashboard
		return a, nil
	case "create":
		return a, func() tea.Msg { return ShowCreateProjectMsg{} }
	default:
		// Try as project name
		for _, p := range a.dashboard.Projects {
			if strings.EqualFold(p.Name, cmd) {
				return a.navigateToProject(p.Name)
			}
		}
		a.statusMsg = "Unknown command: " + cmd
		a.statusTime = time.Now()
		return a, nil
	}
}

func (a *App) moveSelection(delta int) {
	switch a.screen {
	case ScreenDashboard:
		a.dashboard.Selected += delta
		a.dashboard.ClampSelection()
	case ScreenProject:
		a.project.Selected += delta
		maxItems := 0
		switch a.project.Panel {
		case 0:
			maxItems = len(a.project.Agents)
		case 1:
			maxItems = len(a.project.Tasks)
		case 2:
			maxItems = len(a.project.Widgets)
		}
		if a.project.Selected < 0 {
			a.project.Selected = 0
		}
		if a.project.Selected >= maxItems {
			a.project.Selected = maxItems - 1
		}
		if a.project.Selected < 0 {
			a.project.Selected = 0
		}
	case ScreenAgents:
		a.agents.Selected += delta
		a.agents.ClampSelection()
	}
}

func (a *App) handleEnter() (tea.Model, tea.Cmd) {
	switch a.screen {
	case ScreenDashboard:
		return a.showDashboardMenu()
	case ScreenProject:
		return a.showProjectMenu()
	case ScreenAgents:
		return a.showAgentsMenu()
	}
	return a, nil
}

// ── Context menu builders ────────────────────────────────────────────────────

func (a *App) showDashboardMenu() (tea.Model, tea.Cmd) {
	p := a.dashboard.SelectedProject()
	if p == nil {
		return a, nil
	}
	projectName := p.Name
	return a, func() tea.Msg {
		return ShowContextMenuMsg{
			Title: projectName,
			Items: []MenuItem{
				{Label: "Open", Key: "o", Icon: "▸", Action: func() tea.Msg {
					return NavigateMsg{Screen: ScreenProject, Project: &api.Project{Name: projectName}}
				}},
				{Label: "Dispatch Task", Key: "d", Icon: "⚡", Action: func() tea.Msg {
					return ShowDispatchMsg{ProjectName: projectName}
				}},
				{Label: "View Agents", Key: "a", Icon: "●", Action: func() tea.Msg {
					return NavigateMsg{Screen: ScreenAgents}
				}},
				{Label: "Delete Project", Key: "x", Icon: "✗",
					Style: lipgloss.NewStyle().Foreground(Rose),
					Action: func() tea.Msg {
						return ShowConfirmMsg{
							Title:       "Delete Project",
							Description: "Delete \"" + projectName + "\"?\nThis cannot be undone.",
							Destructive: true,
							OnConfirm: func() tea.Msg {
								err := a.client.DeleteProject(projectName)
								return DeleteProjectResultMsg{ProjectName: projectName, Err: err}
							},
						}
					}},
			},
		}
	}
}

func (a *App) showProjectMenu() (tea.Model, tea.Cmd) {
	switch a.project.Panel {
	case 0: // Agents panel
		if a.project.Selected >= 0 && a.project.Selected < len(a.project.Agents) {
			ag := a.project.Agents[a.project.Selected]
			sid := ag.SessionID
			return a, func() tea.Msg {
				return ShowContextMenuMsg{
					Title: "Agent " + truncate(sid, 16),
					Items: []MenuItem{
						{Label: "Watch Logs", Key: "l", Icon: "◉", Action: func() tea.Msg {
							return NavigateMsg{Screen: ScreenWatch, Agent: &ag}
						}},
						{Label: "Inject Message", Key: "i", Icon: "▹", Action: func() tea.Msg {
							return ShowInjectMsg{SessionID: sid}
						}},
						{Label: "Kill Agent", Key: "K", Icon: "✗",
							Style: lipgloss.NewStyle().Foreground(Rose),
							Action: func() tea.Msg {
								return ShowConfirmMsg{
									Title:       "Kill Agent",
									Description: "Kill agent " + truncate(sid, 20) + "?",
									Destructive: true,
									OnConfirm: func() tea.Msg {
										err := a.client.KillAgent(sid)
										return KillResultMsg{SessionID: sid, Err: err}
									},
								}
							}},
					},
				}
			}
		}
	case 1: // Tasks panel
		if a.project.Selected >= 0 && a.project.Selected < len(a.project.Tasks) {
			task := a.project.Tasks[a.project.Selected]
			idx := a.project.Selected
			projectName := a.projectName
			isDone := strings.EqualFold(task.Status, "done") || strings.EqualFold(task.Status, "complete") || strings.EqualFold(task.Status, "completed")
			isRunning := strings.EqualFold(task.Status, "in_progress") || strings.EqualFold(task.Status, "in-progress") || strings.EqualFold(task.Status, "running")
			return a, func() tea.Msg {
				return ShowContextMenuMsg{
					Title: "Task #" + fmt.Sprintf("%d", idx),
					Items: []MenuItem{
						{Label: "Start Task", Key: "s", Icon: "▶",
							Disabled: isRunning || isDone,
							Action: func() tea.Msg {
								_ = a.client.StartTask(projectName, idx)
								return TickMsg{}
							}},
						{Label: "Complete Task", Key: "c", Icon: "✓",
							Disabled: isDone,
							Action: func() tea.Msg {
								_ = a.client.CompleteTask(projectName, idx, "")
								return TickMsg{}
							}},
						{Label: "Delete Task", Key: "x", Icon: "✗",
							Style: lipgloss.NewStyle().Foreground(Rose),
							Action: func() tea.Msg {
								_ = a.client.DeleteTask(projectName, idx)
								return TickMsg{}
							}},
					},
				}
			}
		}
	case 2: // Widgets panel
		if a.project.Selected >= 0 && a.project.Selected < len(a.project.Widgets) {
			widget := a.project.Widgets[a.project.Selected]
			widgetID := widget.ID
			projectName := a.projectName
			return a, func() tea.Msg {
				return ShowContextMenuMsg{
					Title: widget.Title,
					Items: []MenuItem{
						{Label: "Delete Widget", Key: "x", Icon: "✗",
							Style: lipgloss.NewStyle().Foreground(Rose),
							Action: func() tea.Msg {
								_ = a.client.DeleteWidget(projectName, widgetID)
								return TickMsg{}
							}},
					},
				}
			}
		}
	}
	return a, nil
}

func (a *App) showAgentsMenu() (tea.Model, tea.Cmd) {
	ag := a.agents.SelectedAgent()
	if ag == nil {
		return a, nil
	}
	sid := ag.SessionID
	projectName := ag.ProjectName
	return a, func() tea.Msg {
		return ShowContextMenuMsg{
			Title: "Agent " + truncate(sid, 16),
			Items: []MenuItem{
				{Label: "Watch Logs", Key: "l", Icon: "◉", Action: func() tea.Msg {
					return NavigateMsg{Screen: ScreenWatch, Agent: ag}
				}},
				{Label: "Inject Message", Key: "i", Icon: "▹", Action: func() tea.Msg {
					return ShowInjectMsg{SessionID: sid}
				}},
				{Label: "Open Project", Key: "p", Icon: "▸", Action: func() tea.Msg {
					return NavigateMsg{Screen: ScreenProject, Project: &api.Project{Name: projectName}}
				}},
				{Label: "Kill Agent", Key: "K", Icon: "✗",
					Style: lipgloss.NewStyle().Foreground(Rose),
					Action: func() tea.Msg {
						return ShowConfirmMsg{
							Title:       "Kill Agent",
							Description: "Kill agent " + truncate(sid, 20) + "?",
							Destructive: true,
							OnConfirm: func() tea.Msg {
								err := a.client.KillAgent(sid)
								return KillResultMsg{SessionID: sid, Err: err}
							},
						}
					}},
			},
		}
	}
}

func (a *App) handleDetail() (tea.Model, tea.Cmd) {
	switch a.screen {
	case ScreenDashboard:
		p := a.dashboard.SelectedProject()
		if p != nil {
			return a.navigateToProject(p.Name)
		}
	}
	return a, nil
}

func (a *App) handleKill() (tea.Model, tea.Cmd) {
	switch a.screen {
	case ScreenAgents:
		ag := a.agents.SelectedAgent()
		if ag != nil {
			return a, a.killAgent(ag.SessionID)
		}
	case ScreenProject:
		if a.project.Panel == 0 && len(a.project.Agents) > 0 {
			if a.project.Selected >= 0 && a.project.Selected < len(a.project.Agents) {
				ag := a.project.Agents[a.project.Selected]
				return a, a.killAgent(ag.SessionID)
			}
		}
	}
	return a, nil
}

func (a *App) handleDelete() (tea.Model, tea.Cmd) {
	switch a.screen {
	case ScreenDashboard:
		p := a.dashboard.SelectedProject()
		if p != nil {
			projectName := p.Name
			return a, func() tea.Msg {
				return ShowConfirmMsg{
					Title:       "Delete Project",
					Description: "Are you sure you want to delete \"" + projectName + "\"?\nThis cannot be undone.",
					Destructive: true,
					OnConfirm: func() tea.Msg {
						err := a.client.DeleteProject(projectName)
						return DeleteProjectResultMsg{ProjectName: projectName, Err: err}
					},
				}
			}
		}
	case ScreenAgents:
		ag := a.agents.SelectedAgent()
		if ag != nil {
			sid := ag.SessionID
			return a, func() tea.Msg {
				return ShowConfirmMsg{
					Title:       "Kill Agent",
					Description: "Kill agent " + truncate(sid, 20) + "?",
					Destructive: true,
					OnConfirm: func() tea.Msg {
						err := a.client.KillAgent(sid)
						return KillResultMsg{SessionID: sid, Err: err}
					},
				}
			}
		}
	}
	return a, nil
}

func (a *App) navigateToProject(name string) (tea.Model, tea.Cmd) {
	a.screen = ScreenProject
	a.projectName = name
	a.project = ProjectModel{Selected: 0, Panel: 0}

	// Find project in cached data
	for _, p := range a.dashboard.Projects {
		if p.Name == name {
			pp := p
			a.project.Project = &pp
			break
		}
	}

	// Filter agents
	for _, ag := range a.dashboard.Agents {
		if ag.ProjectName == name {
			a.project.Agents = append(a.project.Agents, ag)
		}
	}

	return a, a.fetchData()
}

func (a *App) handleNavigate(msg NavigateMsg) (tea.Model, tea.Cmd) {
	switch msg.Screen {
	case ScreenWatch:
		if msg.Agent == nil {
			return a, nil
		}
		// Clean up any previous WS connection
		if a.wsClient != nil {
			a.wsClient.Close()
		}
		a.screen = ScreenWatch
		a.wsClient = NewWSClient(a.client.BaseURL)
		a.watch = NewWatchModel(*msg.Agent, a.wsClient, a.client)

		// Need program reference for WS goroutine
		// Send a size message to initialize viewport
		return a, tea.Batch(
			func() tea.Msg {
				return tea.WindowSizeMsg{Width: a.width, Height: a.height}
			},
			a.startWSWatch(msg.Agent.SessionID),
		)

	case ScreenDashboard:
		// If coming back from watch, clean up WS
		if a.screen == ScreenWatch && a.wsClient != nil {
			a.wsClient.Close()
			a.wsClient = nil
		}
		a.screen = ScreenDashboard
		return a, nil

	case ScreenAgents:
		if a.screen == ScreenWatch && a.wsClient != nil {
			a.wsClient.Close()
			a.wsClient = nil
		}
		a.screen = ScreenAgents
		return a, nil

	case ScreenProject:
		if msg.Project != nil {
			return a.navigateToProject(msg.Project.Name)
		}
		return a, nil
	}
	return a, nil
}

func (a *App) startWSWatch(sessionID string) tea.Cmd {
	return func() tea.Msg {
		// We need to use a deferred approach since we don't have the program reference yet.
		// The WS client will be started from the watch model's first update.
		return wsStartMsg{sessionID: sessionID}
	}
}

// wsStartMsg is an internal message to trigger WS connection from within the update loop.
type wsStartMsg struct {
	sessionID string
}

// View renders the UI.
func (a *App) View() string {
	if a.width == 0 || a.height == 0 {
		return "Loading..."
	}

	var b strings.Builder

	// Overlays render on top of everything
	if a.contextMenu.Active() {
		return a.contextMenu.View()
	}
	if a.confirm.Active() {
		return a.confirm.View()
	}
	if a.createProject.Active() {
		return a.createProject.View()
	}
	if a.dispatch.Active() {
		return a.dispatch.View()
	}
	if a.inject.Active() {
		return a.inject.View()
	}

	// Watch screen has its own full layout
	if a.screen == ScreenWatch {
		return a.watch.View()
	}

	// Screen name for header
	screenName := "dashboard"
	switch a.screen {
	case ScreenProject:
		screenName = "project:" + a.projectName
	case ScreenAgents:
		screenName = "agents"
	}

	// Header
	b.WriteString(RenderHeader(a.width, a.health, a.stats, screenName))
	b.WriteString("\n")

	// Content area
	contentHeight := a.height - 5 // header(2) + footer(2) + cmd/filter bar + status
	if contentHeight < 5 {
		contentHeight = 5
	}

	// Help overlay
	if a.showHelp {
		b.WriteString(RenderHelp(a.width, contentHeight))
	} else {
		// Screen content
		var content string
		switch a.screen {
		case ScreenDashboard:
			content = RenderDashboard(&a.dashboard, a.width, contentHeight)
		case ScreenProject:
			content = RenderProject(&a.project, a.width, contentHeight)
		case ScreenAgents:
			content = RenderAgents(&a.agents, a.width, contentHeight)
		}

		// Pad content to fill height
		lines := strings.Split(content, "\n")
		for i := 0; i < contentHeight-len(lines); i++ {
			lines = append(lines, "")
		}
		if len(lines) > contentHeight {
			lines = lines[:contentHeight]
		}
		b.WriteString(strings.Join(lines, "\n"))
		b.WriteString("\n")
	}

	// Command/filter bar or status message
	switch a.mode {
	case ModeCommand:
		cmdLine := CmdBarStyle.Render(":") + CmdInputStyle.Render(a.cmdInput) + lipgloss.NewStyle().Foreground(Cyan).Render("█")
		b.WriteString(cmdLine + "\n")
	case ModeFilter:
		filterText := ""
		switch a.screen {
		case ScreenDashboard:
			filterText = a.dashboard.Filter
		case ScreenAgents:
			filterText = a.agents.Filter
		}
		filterLine := FilterStyle.Render("/") + CmdInputStyle.Render(filterText) + lipgloss.NewStyle().Foreground(Amber).Render("█")
		b.WriteString(filterLine + "\n")
	default:
		// Status message (auto-clear after 5 seconds)
		if a.statusMsg != "" && time.Since(a.statusTime) < 5*time.Second {
			b.WriteString(DimStyle.Render("  "+a.statusMsg) + "\n")
		} else {
			b.WriteString("\n")
		}
	}

	// Footer — simplified since context menu handles actions
	var hints []KeyHint
	switch a.screen {
	case ScreenDashboard:
		hints = []KeyHint{
			{"Enter", "Actions"},
			{"c", "Create"},
			{"/", "Filter"},
			{":", "Cmd"},
			{"?", "Help"},
			{"q", "Quit"},
		}
	case ScreenProject:
		hints = []KeyHint{
			{"Enter", "Actions"},
			{"Tab", "Panel"},
			{"Ctrl+D", "Dispatch"},
			{"Esc", "Back"},
			{"?", "Help"},
		}
	case ScreenAgents:
		hints = []KeyHint{
			{"Enter", "Actions"},
			{"/", "Filter"},
			{"Esc", "Back"},
			{"?", "Help"},
		}
	}
	b.WriteString(RenderFooter(a.width, hints))

	return b.String()
}

// Run starts the TUI.
func Run(apiURL string) error {
	app := NewApp(apiURL)
	p := tea.NewProgram(app, tea.WithAltScreen())
	app.program = p
	_, err := p.Run()
	return err
}
