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

	// Settings
	settings SettingsModel

	// Mission control
	mission MissionModel

	// Timeline
	timeline TimelineModel
	history  *AgentHistory
	// Canvas
	canvas         CanvasModel
	widgetDetail   WidgetDetailModel
	templateBrowse TemplateBrowserModel

	// Overlays
	dispatch      DispatchModel
	inject        InjectModel
	createProject CreateProjectModel
	confirm       ConfirmModel
	contextMenu   ContextMenuModel
	palette       PaletteModel

	// WebSocket
	wsClient *WSClient
	program  *tea.Program

	// Navigation
	projectName string // which project we're viewing
}

// NewApp creates a new TUI app.
func NewApp(apiURL string) *App {
	// Load persisted theme
	cfg := LoadConfig()
	ApplyTheme(ThemeByName(cfg.Theme))

	return &App{
		client:   api.NewClient(apiURL),
		screen:   ScreenDashboard,
		mode:     ModeNormal,
		settings: NewSettingsModel(),
		history:  NewAgentHistory(),
		timeline: NewTimelineModel(),
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
		if a.screen == ScreenMission {
			a.mission, _ = a.mission.Update(msg)
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

			// Feed timeline history
			if a.history != nil {
				a.history.Update(msg.Agents)
			}
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

	case CanvasDataMsg:
		if msg.Err == nil {
			a.canvas.Widgets = msg.Widgets
			a.canvas.Templates = msg.Templates
			a.canvas.Catalog = msg.Catalog
			a.canvas.Contract = msg.Contract
			a.canvas.ClampSelection()
		}
		return a, nil

	case CanvasActionResultMsg:
		if msg.Err != nil {
			a.statusMsg = "Canvas error: " + msg.Err.Error()
		} else {
			a.statusMsg = msg.Message
		}
		a.statusTime = time.Now()
		if a.screen == ScreenCanvas {
			return a, FetchCanvasDataCmd(a.client, a.canvas.ProjectName)
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

	case showHelpMsg:
		a.showHelp = true
		return a, nil

	case executeCommandMsg:
		return a.executeCommand(msg.Command)

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

	// WS events — forward to watch/mission model
	case WSConnectedMsg, WSDisconnectedMsg, WSTextChunkMsg,
		WSMilestoneMsg, WSAgentDoneMsg, WSPhaseChangeMsg,
		WSAgentSpawnedMsg, WSErrorMsg:
		if a.screen == ScreenWatch {
			var cmd tea.Cmd
			a.watch, cmd = a.watch.Update(msg)
			return a, cmd
		}
		if a.screen == ScreenMission {
			var cmd tea.Cmd
			a.mission, cmd = a.mission.Update(msg)
			return a, cmd
		}

	case tea.KeyMsg:
		// Palette open trigger — works from anywhere (except other text inputs)
		if !a.palette.Active() && (msg.String() == "ctrl+p" || msg.String() == "ctrl+k") {
			// Don't open palette when in command/filter mode or text overlays
			if a.mode == ModeNormal && !a.dispatch.Active() && !a.inject.Active() && !a.createProject.Active() {
				actions := BuildPaletteActions(a.dashboard.Projects, a.dashboard.Agents, a.client)
				a.palette.Open(actions)
				a.palette.width = a.width
				a.palette.height = a.height
				return a, nil
			}
		}

		// Overlays get priority (in order)
		if a.palette.Active() {
			var cmd tea.Cmd
			a.palette, cmd = a.palette.Update(msg)
			return a, cmd
		}
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
		// Mission control gets its own key handling
		if a.screen == ScreenMission {
			var cmd tea.Cmd
			a.mission, cmd = a.mission.Update(msg)
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

	// Timeline screen key handling
	if a.screen == ScreenTimeline {
		return a.handleTimelineKey(key)
	}

	// Settings screen has its own key handling
	if a.screen == ScreenSettings {
		return a.handleSettingsKey(key)
	}

	// Normal mode
	switch key {
	case "q", "ctrl+c":
		if a.screen != ScreenDashboard {
			// Canvas sub-screens go back to canvas
			if a.screen == ScreenWidgetDetail || a.screen == ScreenTemplateBrowse {
				a.screen = ScreenCanvas
				return a, nil
			}
			// Canvas goes back to project
			if a.screen == ScreenCanvas {
				a.screen = ScreenProject
				return a, nil
			}
			if (a.screen == ScreenWatch || a.screen == ScreenMission) && a.wsClient != nil {
				a.wsClient.Close()
				a.wsClient = nil
			}
			a.screen = ScreenDashboard
			return a, nil
		}
		return a, tea.Quit

	case "esc":
		if a.screen != ScreenDashboard {
			// Canvas sub-screens go back to canvas
			if a.screen == ScreenWidgetDetail || a.screen == ScreenTemplateBrowse {
				a.screen = ScreenCanvas
				return a, nil
			}
			// Canvas goes back to project
			if a.screen == ScreenCanvas {
				a.screen = ScreenProject
				return a, nil
			}
			if (a.screen == ScreenWatch || a.screen == ScreenMission) && a.wsClient != nil {
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

	case "s":
		// Open settings (dashboard only)
		if a.screen == ScreenDashboard {
			a.screen = ScreenSettings
			a.settings = NewSettingsModel()
			// Pre-select the currently active theme
			for i, t := range a.settings.Themes {
				if t.Name == ActiveThemeName {
					a.settings.Selected = i
					break
				}
			}
			return a, nil
		}

	case "t":
		// Open timeline (dashboard only)
		if a.screen == ScreenDashboard {
			a.screen = ScreenTimeline
			a.timeline = NewTimelineModel()
			return a, nil
		}

	case "c":
		// Create project (dashboard only)
		if a.screen == ScreenDashboard {
			return a, func() tea.Msg { return ShowCreateProjectMsg{} }
		}

	case "m":
		// Mission control (dashboard or agents screen)
		if a.screen == ScreenDashboard || a.screen == ScreenAgents {
			return a.navigateToMission()
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

	case "w":
		// Open canvas screen from project detail
		if a.screen == ScreenProject && a.projectName != "" {
			return a.navigateToCanvas(a.projectName)
		}

	case "tab":
		if a.screen == ScreenProject {
			a.project.Panel = (a.project.Panel + 1) % 3
			a.project.Selected = 0
			return a, nil
		}
		if a.screen == ScreenCanvas {
			a.canvas.Panel = (a.canvas.Panel + 1) % 4
			a.canvas.Selected = 0
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
	case "settings":
		a.screen = ScreenSettings
		a.settings = NewSettingsModel()
		for i, t := range a.settings.Themes {
			if t.Name == ActiveThemeName {
				a.settings.Selected = i
				break
			}
		}
		return a, nil
	case "timeline":
		a.screen = ScreenTimeline
		a.timeline = NewTimelineModel()
		return a, nil
	case "create":
		return a, func() tea.Msg { return ShowCreateProjectMsg{} }
	case "mission":
		return a.navigateToMission()
	default:
		// :canvas <project> command
		if strings.HasPrefix(cmd, "canvas ") {
			projectName := strings.TrimSpace(strings.TrimPrefix(cmd, "canvas "))
			if projectName != "" {
				return a.navigateToCanvas(projectName)
			}
		}
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
	case ScreenTimeline:
		a.timeline.Selected += delta
		// Clamp is handled in render
	case ScreenCanvas:
		a.canvas.Selected += delta
		a.canvas.ClampSelection()
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
	case ScreenCanvas:
		return a.showCanvasMenu()
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

func (a *App) navigateToCanvas(projectName string) (tea.Model, tea.Cmd) {
	a.screen = ScreenCanvas
	a.canvas = CanvasModel{
		ProjectName: projectName,
		Panel:       0,
		Selected:    0,
	}
	return a, FetchCanvasDataCmd(a.client, projectName)
}

func (a *App) showCanvasMenu() (tea.Model, tea.Cmd) {
	projectName := a.canvas.ProjectName
	switch a.canvas.Panel {
	case 0: // Widgets panel
		w := a.canvas.SelectedWidget()
		if w == nil {
			return a, nil
		}
		widget := *w
		widgetID := widget.ID
		return a, func() tea.Msg {
			return ShowContextMenuMsg{
				Title: widget.Title,
				Items: []MenuItem{
					{Label: "View Details", Key: "d", Icon: "◉", Action: func() tea.Msg {
						return NavigateMsg{Screen: ScreenWidgetDetail}
					}},
					{Label: "Delete Widget", Key: "x", Icon: "✗",
						Style: lipgloss.NewStyle().Foreground(Rose),
						Action: func() tea.Msg {
							return ShowConfirmMsg{
								Title:       "Delete Widget",
								Description: "Delete widget \"" + widget.Title + "\"?",
								Destructive: true,
								OnConfirm: func() tea.Msg {
									err := a.client.DeleteWidget(projectName, widgetID)
									if err != nil {
										return CanvasActionResultMsg{Err: err}
									}
									return CanvasActionResultMsg{Message: "Widget deleted: " + widgetID}
								},
							}
						}},
				},
			}
		}
	case 1: // Templates panel
		t := a.canvas.SelectedTemplate()
		if t == nil {
			return a, nil
		}
		tmpl := *t
		return a, func() tea.Msg {
			return ShowContextMenuMsg{
				Title: tmpl.Title,
				Items: []MenuItem{
					{Label: "Deploy to Canvas", Key: "d", Icon: "▸", Action: func() tea.Msg {
						body := map[string]interface{}{
							"template_id": tmpl.Filename,
						}
						_, err := a.client.CreateWidget(projectName, body)
						if err != nil {
							return CanvasActionResultMsg{Err: err}
						}
						return CanvasActionResultMsg{Message: "Template deployed: " + tmpl.Filename}
					}},
				},
			}
		}
	case 2: // Catalog panel
		ct := a.canvas.SelectedCatalogItem()
		if ct == nil {
			return a, nil
		}
		catItem := *ct
		return a, func() tea.Msg {
			return ShowContextMenuMsg{
				Title: catItem.Title,
				Items: []MenuItem{
					{Label: "View Details", Key: "d", Icon: "◉", Action: func() tea.Msg {
						return NavigateMsg{Screen: ScreenTemplateBrowse}
					}},
					{Label: "Deploy to Canvas", Key: "p", Icon: "▸", Action: func() tea.Msg {
						body := map[string]interface{}{
							"template_id": catItem.TemplateID,
						}
						_, err := a.client.CreateWidget(projectName, body)
						if err != nil {
							return CanvasActionResultMsg{Err: err}
						}
						return CanvasActionResultMsg{Message: "Catalog template deployed: " + catItem.TemplateID}
					}},
					{Label: "Delete from Catalog", Key: "x", Icon: "✗",
						Style: lipgloss.NewStyle().Foreground(Rose),
						Action: func() tea.Msg {
							return ShowConfirmMsg{
								Title:       "Delete Catalog Template",
								Description: "Delete \"" + catItem.Title + "\" from catalog?",
								Destructive: true,
								OnConfirm: func() tea.Msg {
									err := a.client.DeleteCatalogTemplate(catItem.TemplateID)
									if err != nil {
										return CanvasActionResultMsg{Err: err}
									}
									return CanvasActionResultMsg{Message: "Catalog template deleted: " + catItem.TemplateID}
								},
							}
						}},
				},
			}
		}
	case 3: // Layout panel — no context menu
		return a, nil
	}
	return a, nil
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
		// If coming back from watch/mission, clean up WS
		if (a.screen == ScreenWatch || a.screen == ScreenMission) && a.wsClient != nil {
			a.wsClient.Close()
			a.wsClient = nil
		}
		a.screen = ScreenDashboard
		return a, nil

	case ScreenAgents:
		if (a.screen == ScreenWatch || a.screen == ScreenMission) && a.wsClient != nil {
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

	case ScreenSettings:
		a.screen = ScreenSettings
		a.settings = NewSettingsModel()
		for i, t := range a.settings.Themes {
			if t.Name == ActiveThemeName {
				a.settings.Selected = i
				break
			}
		}
		return a, nil

	case ScreenCanvas:
		if a.canvas.ProjectName != "" {
			return a.navigateToCanvas(a.canvas.ProjectName)
		}
		return a, nil

	case ScreenWidgetDetail:
		// Navigate to widget detail from canvas
		w := a.canvas.SelectedWidget()
		if w != nil {
			a.screen = ScreenWidgetDetail
			a.widgetDetail = WidgetDetailModel{
				Widget:   w,
				Contract: a.canvas.Contract,
			}
		}
		return a, nil

	case ScreenTemplateBrowse:
		// Navigate to catalog template detail from canvas
		ct := a.canvas.SelectedCatalogItem()
		if ct != nil {
			a.screen = ScreenTemplateBrowse
			a.templateBrowse = TemplateBrowserModel{
				Template: ct,
			}
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

func (a *App) navigateToMission() (tea.Model, tea.Cmd) {
	// Clean up any previous WS connection
	if a.wsClient != nil {
		a.wsClient.Close()
	}
	a.screen = ScreenMission
	a.wsClient = NewWSClient(a.client.BaseURL)
	a.mission = NewMissionModel(a.dashboard.Agents, a.wsClient, a.client)

	return a, tea.Batch(
		func() tea.Msg {
			return tea.WindowSizeMsg{Width: a.width, Height: a.height}
		},
		// Connect WS with empty session filter to receive ALL agent events
		a.startWSWatch(""),
	)
}

// View renders the UI.
func (a *App) View() string {
	if a.width == 0 || a.height == 0 {
		return "Loading..."
	}

	var b strings.Builder

	// Overlays render on top of everything
	if a.palette.Active() {
		return a.palette.View()
	}
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

	// Mission control has its own full layout
	if a.screen == ScreenMission {
		return a.mission.View()
	}

	// Screen name for header
	screenName := "dashboard"
	switch a.screen {
	case ScreenProject:
		screenName = "project:" + a.projectName
	case ScreenAgents:
		screenName = "agents"
	case ScreenSettings:
		screenName = "settings"
	case ScreenTimeline:
		screenName = "timeline"
	case ScreenCanvas:
		screenName = "canvas:" + a.canvas.ProjectName
	case ScreenWidgetDetail:
		screenName = "widget-detail"
	case ScreenTemplateBrowse:
		screenName = "catalog-detail"
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
		case ScreenSettings:
			content = RenderSettings(&a.settings, a.width, contentHeight)
		case ScreenTimeline:
			content = RenderTimeline(&a.timeline, a.history, a.width, contentHeight)
		case ScreenCanvas:
			content = RenderCanvas(&a.canvas, a.width, contentHeight)
		case ScreenWidgetDetail:
			content = RenderWidgetDetail(&a.widgetDetail, a.width, contentHeight)
		case ScreenTemplateBrowse:
			content = RenderTemplateBrowser(&a.templateBrowse, a.width, contentHeight)
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
			{"Ctrl+P", "Palette"},
			{"m", "Mission"},
			{"c", "Create"},
			{"s", "Settings"},
			{"/", "Filter"},
			{":", "Cmd"},
			{"?", "Help"},
			{"q", "Quit"},
		}
	case ScreenProject:
		hints = []KeyHint{
			{"Enter", "Actions"},
			{"Ctrl+P", "Palette"},
			{"Tab", "Panel"},
			{"w", "Canvas"},
			{"Ctrl+D", "Dispatch"},
			{"Esc", "Back"},
			{"?", "Help"},
		}
	case ScreenAgents:
		hints = []KeyHint{
			{"Enter", "Actions"},
			{"Ctrl+P", "Palette"},
			{"/", "Filter"},
			{"Esc", "Back"},
			{"?", "Help"},
		}
	case ScreenSettings:
		hints = []KeyHint{
			{"j/k", "Navigate"},
			{"Enter", "Apply"},
			{"Esc", "Back"},
		}
	case ScreenTimeline:
		hints = []KeyHint{
			{"h/l", "Zoom"},
			{"Left/Right", "Cursor"},
			{"j/k", "Select"},
			{"Esc", "Back"},
			{"?", "Help"},
		}
	case ScreenCanvas:
		hints = []KeyHint{
			{"Enter", "Actions"},
			{"Tab", "Panel"},
			{"Esc", "Back"},
			{"?", "Help"},
		}
	case ScreenWidgetDetail, ScreenTemplateBrowse:
		hints = []KeyHint{
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
