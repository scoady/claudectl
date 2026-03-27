package tui

import (
	"fmt"
	"os/exec"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/scoady/codexctl/internal/api"
	"github.com/scoady/codexctl/internal/tools"
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

// WorkspaceFilesPollMsg refreshes the current workspace file explorer.
type WorkspaceFilesPollMsg time.Time

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

type AppOptions struct {
	WorkspaceUI bool
}

// ── App Model ────────────────────────────────────────────────────────────────

// App is the main bubbletea model.
type App struct {
	client *api.Client
	width  int
	height int
	layout Layout

	screen     Screen
	mode       Mode
	cmdInput   string
	showHelp   bool
	statusMsg  string
	statusTime time.Time
	mousePos   MousePoint

	// Data
	health *api.HealthResponse
	stats  *api.StatsResponse

	// Screen models
	dashboard DashboardModel
	project   ProjectModel
	agents    AgentsModel
	watch     WatchModel
	workspace WorkspaceShellModel
	tools     ToolsModel

	// Settings
	settings SettingsModel

	// Mission control
	mission MissionModel

	// Timeline
	timeline TimelineModel
	history  *AgentHistory

	// Metrics
	metrics      MetricsModel
	metricsStore *MetricsStore
	hostMetrics  workspaceHostMetrics

	// Targets
	targets TargetsModel
	// Canvas
	canvas         CanvasModel
	widgetDetail   WidgetDetailModel
	templateBrowse TemplateBrowserModel

	// Overlays
	dispatch       DispatchModel
	inject         InjectModel
	createProject  CreateProjectModel
	workspaceEntry WorkspaceEntryModel
	toolInstall    ToolInstallModel
	toolConfigure  ToolConfigureModel
	confirm        ConfirmModel
	contextMenu    ContextMenuModel
	palette        PaletteModel

	// WebSocket
	wsClient *WSClient
	program  *tea.Program

	// Navigation
	projectName string // which project we're viewing
}

// NewApp creates a new TUI app.
func NewApp(apiURL string, opts AppOptions) *App {
	// Load persisted theme
	cfg := LoadConfig()
	ApplyTheme(ThemeByName(cfg.Theme))

	app := &App{
		client:       api.NewClient(apiURL),
		screen:       ScreenDashboard,
		mode:         ModeNormal,
		settings:     NewSettingsModel(),
		history:      NewAgentHistory(),
		timeline:     NewTimelineModel(),
		metrics:      NewMetricsModel(),
		metricsStore: NewMetricsStore(),
		workspace:    NewWorkspaceShellModel(),
		tools:        NewToolsModel(),
	}
	if opts.WorkspaceUI {
		app.screen = ScreenWorkspace
		app.wsClient = NewWSClient(apiURL)
	}
	return app
}

// Init initializes the app.
func (a *App) Init() tea.Cmd {
	cmds := []tea.Cmd{
		a.fetchData(),
		a.tickCmd(),
		RefreshToolCatalogCmd(),
	}
	if a.screen == ScreenWorkspace && a.wsClient != nil {
		cmds = append(cmds, a.startWSWatch(""), a.workspace.InitCmd(), a.workspaceFilesPollCmd(), FetchHostMetricsCmd(a.hostMetrics))
	}
	return tea.Batch(cmds...)
}

func (a *App) tickCmd() tea.Cmd {
	return tea.Tick(2*time.Second, func(t time.Time) tea.Msg {
		return TickMsg(t)
	})
}

func (a *App) workspaceFilesPollCmd() tea.Cmd {
	return tea.Tick(10*time.Second, func(t time.Time) tea.Msg {
		return WorkspaceFilesPollMsg(t)
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
	if model, cmd, handled := a.handleWorkspaceUpdateMessage(msg); handled {
		return model, cmd
	}
	if model, cmd, handled := a.handleDataUpdateMessage(msg); handled {
		return model, cmd
	}
	if model, cmd, handled := a.handleToolsUpdateMessage(msg); handled {
		return model, cmd
	}

	switch msg := msg.(type) {

	case tea.WindowSizeMsg:
		a.width = msg.Width
		a.height = msg.Height
		a.layout = NewLayout(msg.Width, msg.Height)
		if a.screen == ScreenWatch {
			a.watch, _ = a.watch.Update(msg)
		}
		if a.screen == ScreenMission {
			a.mission, _ = a.mission.Update(msg)
		}
		return a, nil

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

	case ShowWorkspaceEntryMsg:
		a.workspaceEntry = NewWorkspaceEntryModel(msg, a.client)
		return a, a.workspaceEntry.Init()

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
			if msg.Err == nil && a.screen == ScreenWorkspace {
				return a, a.workspaceLoadTerminalCmd()
			}
			return a, nil
		}

	case CreateProjectCompleteMsg:
		if a.createProject.Active() {
			var cmd tea.Cmd
			a.createProject, cmd = a.createProject.Update(msg)
			return a, cmd
		}

	case tea.KeyMsg:
		// Palette open trigger — works from anywhere (except other text inputs)
		if !a.palette.Active() && (msg.String() == "ctrl+p" || msg.String() == "ctrl+k") {
			// Don't open palette when in command/filter mode or text overlays
			if a.mode == ModeNormal && !a.dispatch.Active() && !a.inject.Active() && !a.createProject.Active() && !a.toolInstall.Active() && !a.toolConfigure.Active() {
				actions := BuildPaletteActions(a.dashboard.Projects, a.dashboard.Agents, a.client)
				a.palette.Open(actions)
				a.palette.width = a.width
				a.palette.height = a.height
				return a, nil
			}
		}

		// Overlays get priority (in order)
		if model, cmd, handled := a.updateActiveOverlay(msg); handled {
			return model, cmd
		}
		if model, cmd, handled := a.handleWorkspaceFocusedInput(msg); handled {
			return model, cmd
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

	case tea.MouseMsg:
		a.mousePos = MousePoint{X: msg.X, Y: msg.Y}
		if a.hasBlockingOverlay() {
			return a, nil
		}
		if a.screen == ScreenWorkspace {
			return a.handleWorkspaceMouse(msg)
		}
		if a.screen == ScreenTools {
			return a.handleToolsMouse(msg)
		}
		if a.screen == ScreenWatch {
			var cmd tea.Cmd
			a.watch, cmd = a.watch.Update(msg)
			return a, cmd
		}
		return a, nil
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

	// Metrics screen key handling
	if a.screen == ScreenMetrics {
		return a.handleMetricsKey(key)
	}

	if a.screen == ScreenWorkspace {
		return a.handleWorkspaceKey(key)
	}

	// Tools screen key handling
	if a.screen == ScreenTools {
		return a.handleToolsKey(key)
	}

	// Targets screen key handling
	if a.screen == ScreenTargets {
		return a.handleTargetsKey(key)
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
		return a.showDashboardMenu()

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

	case "g":
		// Open metrics (dashboard only)
		if a.screen == ScreenDashboard {
			a.screen = ScreenMetrics
			a.metrics = NewMetricsModel()
			return a, nil
		}

	case "T":
		// Open targets (dashboard only)
		if a.screen == ScreenDashboard {
			a.screen = ScreenTargets
			a.targets = NewTargetsModel(a.dashboard.Agents)
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

	case "u":
		// Tool / plugin management
		if a.screen == ScreenDashboard || a.screen == ScreenAgents || a.screen == ScreenProject || a.screen == ScreenWorkspace {
			return a.navigateToTools()
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
		// Open the project-local canvas dock from project detail
		if a.screen == ScreenProject && a.projectName != "" {
			return a.navigateToCanvas(a.projectName)
		}

	case "W":
		prevScreen := a.screen
		a.screen = ScreenWorkspace
		a.workspace.Projects = a.dashboard.Projects
		a.workspace.Agents = a.dashboard.Agents
		if prevScreen == ScreenDashboard {
			if p := a.dashboard.SelectedProject(); p != nil {
				a.workspace.CurrentProject = p.Name
			}
		} else if a.projectName != "" {
			a.workspace.CurrentProject = a.projectName
		}
		a.workspace.Sync()
		return a, tea.Batch(a.workspaceLoadDirCmd(), a.workspaceLoadTerminalCmd())

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

func (a *App) handleToolsKey(key string) (tea.Model, tea.Cmd) {
	switch key {
	case "esc", "q":
		if a.toolInstall.Active() {
			a.toolInstall.active = false
			return a, nil
		}
		a.screen = ScreenDashboard
		return a, nil
	case ":":
		a.mode = ModeCommand
		a.cmdInput = ""
		return a, nil
	case "r":
		return a, tea.Batch(RefreshToolsCmd(), RefreshToolCatalogCmd())
	case "i":
		if catalog := a.tools.CurrentCatalog(); catalog != nil {
			return a, InstallToolCmd(toolCatalogSource(*catalog))
		}
		a.toolInstall = NewToolInstallModel(defaultToolSource)
		return a, a.toolInstall.Init()
	case "u":
		a.toolInstall = NewToolInstallModel(defaultToolSource)
		return a, a.toolInstall.Init()
	case "c":
		if rec := a.tools.SelectedRecord(); rec != nil {
			return a, func() tea.Msg { return ShowToolConfigureMsg{ToolName: rec.Name} }
		}
		return a, nil
	case "s":
		if rec := a.tools.SelectedRecord(); rec != nil {
			return a, SyncToolCmd(rec.Name)
		}
		return a, nil
	case "d":
		if rec := a.tools.SelectedRecord(); rec != nil {
			return a, DoctorToolCmd(rec.Name)
		}
		return a, nil
	case "t":
		if rec := a.tools.SelectedRecord(); rec != nil {
			return a, DoctorToolCmd(rec.Name)
		}
		return a, nil
	case "j", "down":
		a.tools.SelectDelta(1)
		return a, nil
	case "k", "up":
		a.tools.SelectDelta(-1)
		return a, nil
	case "enter":
		return a.showToolsMenu()
	}
	return a, nil
}

func copyWorkspaceTranscriptCmd(text string) tea.Cmd {
	text = strings.TrimSpace(text)
	if text == "" {
		return func() tea.Msg {
			return WorkspaceCopyTranscriptMsg{Err: fmt.Errorf("no transcript to copy")}
		}
	}
	return func() tea.Msg {
		cmd := exec.Command("pbcopy")
		cmd.Stdin = strings.NewReader(text)
		return WorkspaceCopyTranscriptMsg{Err: cmd.Run()}
	}
}

func (a *App) handleToolsMouse(msg tea.MouseMsg) (tea.Model, tea.Cmd) {
	contentY := msg.Y - 3
	if contentY < 0 || contentY >= a.layout.ContentHeight {
		a.tools.SetHovered(-1)
		return a, nil
	}
	width := a.width
	height := a.layout.ContentHeight
	listW := Clamp(28, width/3, 38)
	detailW := width - listW - 2
	if detailW < 30 {
		detailW = 30
		listW = max(24, width-detailW-2)
	}
	panelH := height - 3
	if panelH < 10 {
		panelH = 10
	}
	x := msg.X
	y := contentY - 2
	if y < 0 {
		return a, nil
	}
	if x >= 0 && x < listW {
		idx := toolsListIndexAt(&a.tools, y, panelH)
		a.tools.SetHovered(idx)
		if idx >= 0 {
			a.tools.Selected = idx
		}
		if msg.Action == tea.MouseActionPress && idx >= 0 {
			if catalog := a.tools.CurrentCatalog(); catalog != nil {
				return a, nil
			}
		}
		return a, nil
	}
	a.tools.SetHovered(-1)
	return a, nil
}

func toolsListIndexAt(m *ToolsModel, y, h int) int {
	line := y - 2
	if line < 0 {
		return -1
	}
	cursor := 0
	renderLine := 2
	for range m.Entries {
		if renderLine >= h-6 {
			break
		}
		if line == renderLine {
			return cursor
		}
		renderLine++
		cursor++
	}
	renderLine += 4
	visibleCatalog := m.VisibleCatalog()
	for i := range visibleCatalog {
		if renderLine >= h-2 {
			break
		}
		if line == renderLine {
			return len(m.Entries) + i
		}
		renderLine++
	}
	return -1
}

func nextWorkspacePane(current int) int {
	switch current {
	case 0:
		return 1
	case 1:
		return 2
	default:
		return 0
	}
}

func prevWorkspacePane(current int) int {
	switch current {
	case 2:
		return 1
	case 1:
		return 0
	default:
		return 2
	}
}

func (a *App) navigateToTools() (tea.Model, tea.Cmd) {
	if a.wsClient != nil && (a.screen == ScreenWatch || a.screen == ScreenMission) {
		a.wsClient.Close()
		a.wsClient = nil
	}
	a.screen = ScreenTools
	a.tools.Loading = true
	return a, tea.Batch(RefreshToolsCmd(), RefreshToolCatalogCmd())
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
	case "metrics", "graphs":
		a.screen = ScreenMetrics
		a.metrics = NewMetricsModel()
		return a, nil
	case "workspace", "studio":
		a.screen = ScreenWorkspace
		a.workspace.Projects = a.dashboard.Projects
		a.workspace.Agents = a.dashboard.Agents
		a.workspace.Sync()
		return a, tea.Batch(a.workspaceLoadDirCmd(), a.workspaceLoadTerminalCmd())
	case "tools", "plugins":
		return a.navigateToTools()
	case "targets":
		a.screen = ScreenTargets
		a.targets = NewTargetsModel(a.dashboard.Agents)
		return a, nil
	case "create":
		return a, func() tea.Msg { return ShowCreateProjectMsg{} }
	case "mission":
		return a.navigateToMission()
	case "workspace.toggle-editor":
		if a.workspace.EditorActive {
			a.workspace.StopEditingPreview()
			return a, nil
		}
		if a.workspace.BeginEditingPreview() {
			return a, nil
		}
		a.statusMsg = "Select a text file preview first"
		a.statusTime = time.Now()
		return a, nil
	case "workspace.save-file":
		return a, a.workspaceSaveCurrentFileCmd()
	case "workspace.preview-agent":
		return a, a.workspaceLoadSelectedAgentPreviewCmd()
	case "tools.refresh":
		return a, tea.Batch(RefreshToolsCmd(), RefreshToolCatalogCmd())
	case "tools.install":
		if catalog := a.tools.CurrentCatalog(); catalog != nil {
			return a, InstallToolCmd(toolCatalogSource(*catalog))
		}
		a.toolInstall = NewToolInstallModel(defaultToolSource)
		return a, a.toolInstall.Init()
	case "tools.configure":
		if rec := a.tools.SelectedRecord(); rec != nil {
			return a, func() tea.Msg { return ShowToolConfigureMsg{ToolName: rec.Name} }
		}
		return a, nil
	case "tools.test":
		if rec := a.tools.SelectedRecord(); rec != nil {
			return a, DoctorToolCmd(rec.Name)
		}
		return a, nil
	case "tools.sync":
		if rec := a.tools.SelectedRecord(); rec != nil {
			return a, SyncToolCmd(rec.Name)
		}
		return a, nil
	case "tools.doctor":
		if rec := a.tools.SelectedRecord(); rec != nil {
			return a, DoctorToolCmd(rec.Name)
		}
		return a, nil
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
	case ScreenTargets:
		a.targets.Selected += delta
		a.targets.ClampSelection()
	case ScreenWorkspace:
		if a.workspace.FocusPane == 0 {
			a.workspace.SelectDelta(delta)
		}
	case ScreenTools:
		a.tools.SelectDelta(delta)
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
	case ScreenWorkspace:
		if cur := a.workspace.Current(); cur != nil {
			return a.navigateToProject(cur.Name)
		}
	case ScreenTools:
		return a.showToolsMenu()
	}
	return a, nil
}

// ── Context menu builders ────────────────────────────────────────────────────

func (a *App) showDashboardMenu() (tea.Model, tea.Cmd) {
	p := a.dashboard.SelectedProject()
	title := "Home"
	items := []MenuItem{
		{Label: "Create Project", Key: "c", Icon: "+", Action: func() tea.Msg {
			return ShowCreateProjectMsg{}
		}},
		{Label: "Tools", Key: "u", Icon: "⬢", Action: func() tea.Msg {
			return NavigateMsg{Screen: ScreenTools}
		}},
		{Label: "Metrics", Key: "g", Icon: "◈", Action: func() tea.Msg {
			return NavigateMsg{Screen: ScreenMetrics}
		}},
		{Label: "Targets", Key: "T", Icon: "◎", Action: func() tea.Msg {
			return NavigateMsg{Screen: ScreenTargets}
		}},
		{Label: "Settings", Key: "s", Icon: "⚙", Action: func() tea.Msg {
			return NavigateMsg{Screen: ScreenSettings}
		}},
	}
	if p != nil {
		projectName := p.Name
		title = projectName
		items = append([]MenuItem{
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
		}, items...)
	}
	items = append(items, MenuItem{
		Label: "Quit",
		Key:   "q",
		Icon:  "⏻",
		Style: lipgloss.NewStyle().Foreground(Rose),
		Action: func() tea.Msg {
			return tea.Quit()
		},
	})
	return a, func() tea.Msg {
		return ShowContextMenuMsg{
			Title: title,
			Items: items,
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
	case ScreenWorkspace:
		if cur := a.workspace.Current(); cur != nil {
			return a.navigateToProject(cur.Name)
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
	if a.wsClient != nil {
		a.wsClient.Close()
	}
	a.screen = ScreenWorkspace
	a.wsClient = NewWSClient(a.client.BaseURL)
	a.workspace.Projects = a.dashboard.Projects
	a.workspace.Agents = a.dashboard.Agents
	a.workspace.CurrentProject = projectName
	a.workspace.SetDockMode(workspaceDockCanvas)
	a.workspace.Sync()
	return a, tea.Batch(
		a.workspaceLoadDirCmd(),
		a.workspaceLoadTerminalCmd(),
		a.startWSWatch(""),
	)
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

func (a *App) showToolsMenu() (tea.Model, tea.Cmd) {
	rec := a.tools.SelectedRecord()
	catalog := a.tools.CurrentCatalog()
	canOperate := rec != nil
	return a, func() tea.Msg {
		importAction := func() tea.Msg {
			source := defaultToolSource
			if catalog != nil {
				source = toolCatalogSource(*catalog)
			}
			return ShowToolInstallMsg{Source: source}
		}
		return ShowContextMenuMsg{
			Title: "Tool Dock",
			Items: []MenuItem{
				{
					Label:  "Import Tool From Repo",
					Key:    "i",
					Icon:   "⇪",
					Action: importAction,
				},
				{
					Label:    "Configure plugin",
					Key:      "c",
					Icon:     "⚙",
					Disabled: !canOperate,
					Action: func() tea.Msg {
						if rec == nil {
							return nil
						}
						return executeCommandMsg{Command: "tools.configure"}
					},
				},
				{
					Label:    "Sync exported skills",
					Key:      "s",
					Icon:     "↺",
					Disabled: !canOperate,
					Action: func() tea.Msg {
						if rec == nil {
							return nil
						}
						return executeCommandMsg{Command: "tools.sync"}
					},
				},
				{
					Label:    "Run doctor",
					Key:      "d",
					Icon:     "◉",
					Disabled: !canOperate,
					Action: func() tea.Msg {
						if rec == nil {
							return nil
						}
						return executeCommandMsg{Command: "tools.doctor"}
					},
				},
				{
					Label: "Refresh registry",
					Key:   "r",
					Icon:  "⟳",
					Action: func() tea.Msg {
						return executeCommandMsg{Command: "tools.refresh"}
					},
				},
				{
					Label: "Back to Dashboard",
					Icon:  "←",
					Action: func() tea.Msg {
						return NavigateMsg{Screen: ScreenDashboard}
					},
				},
			},
		}
	}
}

func toolCatalogSource(catalog tools.CatalogEntry) string {
	source := strings.TrimSpace(catalog.RepoURL)
	if source == "" {
		return source
	}
	ref := strings.TrimSpace(catalog.DefaultRef)
	if ref == "" || ref == "local" || !toolsSourceSupportsRef(source) {
		return source
	}
	return source + "@" + ref
}

func toolsSourceSupportsRef(source string) bool {
	v := strings.ToLower(strings.TrimSpace(source))
	return strings.HasPrefix(v, "http://") ||
		strings.HasPrefix(v, "https://") ||
		strings.HasPrefix(v, "ssh://") ||
		strings.HasPrefix(v, "git@")
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
			a.watch.Init(),
			a.startWSWatch(msg.Agent.SessionID),
		)

	case ScreenDashboard:
		// If coming back from watch/mission, clean up WS
		if (a.screen == ScreenWatch || a.screen == ScreenMission || a.screen == ScreenWorkspace) && a.wsClient != nil {
			a.wsClient.Close()
			a.wsClient = nil
		}
		a.screen = ScreenDashboard
		return a, nil

	case ScreenAgents:
		if (a.screen == ScreenWatch || a.screen == ScreenMission || a.screen == ScreenWorkspace) && a.wsClient != nil {
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

	case ScreenTimeline:
		a.screen = ScreenTimeline
		a.timeline = NewTimelineModel()
		return a, nil

	case ScreenMetrics:
		a.screen = ScreenMetrics
		a.metrics = NewMetricsModel()
		return a, nil

	case ScreenWorkspace:
		if a.wsClient != nil {
			a.wsClient.Close()
		}
		a.screen = ScreenWorkspace
		a.wsClient = NewWSClient(a.client.BaseURL)
		a.workspace.Projects = a.dashboard.Projects
		a.workspace.Agents = a.dashboard.Agents
		a.workspace.Sync()
		return a, tea.Batch(a.workspaceLoadDirCmd(), a.workspaceLoadTerminalCmd(), a.startWSWatch(""))

	case ScreenTools:
		return a.navigateToTools()

	case ScreenMission:
		return a.navigateToMission()

	case ScreenTargets:
		a.screen = ScreenTargets
		a.targets = NewTargetsModel(a.dashboard.Agents)
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
	if a.workspaceEntry.Active() {
		return a.workspaceEntry.View()
	}
	if a.toolInstall.Active() {
		return a.toolInstall.View()
	}
	if a.toolConfigure.Active() {
		return a.toolConfigure.View()
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
	case ScreenMetrics:
		screenName = "metrics"
	case ScreenWorkspace:
		screenName = "workspace"
	case ScreenTools:
		screenName = "tools"
	case ScreenTargets:
		screenName = "targets"
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
	contentHeight := a.layout.ContentHeight

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
		case ScreenMetrics:
			content = RenderMetrics(&a.metrics, a.metricsStore, a.history,
				a.dashboard.Agents, a.health, a.width, contentHeight)
		case ScreenWorkspace:
			content = RenderWorkspaceShell(&a.workspace, a.stats, a.health, a.metricsStore, a.hostMetrics, a.width, contentHeight)
		case ScreenTools:
			content = RenderTools(&a.tools, a.width, contentHeight)
		case ScreenTargets:
			content = RenderTargets(&a.targets, a.width, contentHeight)
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
		cmdLine := Class("cmd-bar").Render(":") + Class("cmd-input").Render(a.cmdInput) + lipgloss.NewStyle().Foreground(Cyan).Render("█")
		b.WriteString(cmdLine + "\n")
	case ModeFilter:
		filterText := ""
		switch a.screen {
		case ScreenDashboard:
			filterText = a.dashboard.Filter
		case ScreenAgents:
			filterText = a.agents.Filter
		}
		filterLine := Class("filter-bar").Render("/") + Class("cmd-input").Render(filterText) + lipgloss.NewStyle().Foreground(Amber).Render("█")
		b.WriteString(filterLine + "\n")
	default:
		// Status message (auto-clear after 5 seconds)
		if a.statusMsg != "" && time.Since(a.statusTime) < 5*time.Second {
			b.WriteString(Class("dim").Render("  "+a.statusMsg) + "\n")
		} else {
			b.WriteString("\n")
		}
	}

	// Footer — simplified since context menu handles actions
	var hints []KeyHint
	switch a.screen {
	case ScreenDashboard:
		hints = []KeyHint{
			{"Enter", "Project"},
			{"Esc", "Menu"},
			{"Ctrl+P", "Palette"},
			{"/", "Filter"},
			{":", "Cmd"},
			{"?", "Help"},
		}
	case ScreenProject:
		hints = []KeyHint{
			{"Enter", "Actions"},
			{"Ctrl+P", "Palette"},
			{"Tab", "Panel"},
			{"w", "Canvas Dock"},
			{"u", "Tools"},
			{"Ctrl+D", "Dispatch"},
			{"Esc", "Back"},
			{"?", "Help"},
		}
	case ScreenAgents:
		hints = []KeyHint{
			{"Enter", "Actions"},
			{"Ctrl+P", "Palette"},
			{"/", "Filter"},
			{"u", "Tools"},
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
	case ScreenMetrics:
		hints = []KeyHint{
			{"Tab", "Panel"},
			{"[/]", "Time Range"},
			{"Enter", "Expand"},
			{"Esc", "Back"},
			{"?", "Help"},
		}
	case ScreenWorkspace:
		hints = nil
	case ScreenTools:
		hints = []KeyHint{
			{"j/k", "Select Tool"},
			{"Enter", "Actions"},
			{"i", "Install"},
			{"s", "Sync"},
			{"d", "Doctor"},
			{"r", "Refresh"},
			{"Esc", "Back"},
			{"?", "Help"},
		}
	case ScreenTargets:
		hints = []KeyHint{
			{"j/k", "Navigate"},
			{"Tab", "Jump Group"},
			{"Enter", "Expand"},
			{"r", "Refresh"},
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
func Run(apiURL string, opts AppOptions) error {
	app := NewApp(apiURL, opts)
	p := tea.NewProgram(app, tea.WithAltScreen(), tea.WithMouseCellMotion())
	app.program = p
	_, err := p.Run()
	return err
}
