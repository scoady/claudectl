package tui

import (
	"fmt"
	"io"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/cursor"
	"github.com/charmbracelet/bubbles/list"
	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/textarea"
	"github.com/charmbracelet/bubbles/textinput"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/scoady/codexctl/internal/api"
)

type WorkspaceGitStatusMsg struct {
	Project string
	Status  map[string]string
	Err     error
}

type WorkspaceGitBranchMsg struct {
	Project  string
	Branch   string
	Remote   string
	Provider string
	Err      error
}

type WorkspaceCanvasDataMsg struct {
	Project string
	Widgets []api.Widget
	Tabs    []string
	Err     error
}

func FetchWorkspaceGitStatusCmd(client *api.Client, project string) tea.Cmd {
	if client == nil || project == "" {
		return nil
	}
	return func() tea.Msg {
		status, err := client.GetGitStatus(project)
		return WorkspaceGitStatusMsg{Project: project, Status: status, Err: err}
	}
}

func FetchWorkspaceGitBranchCmd(client *api.Client, project string) tea.Cmd {
	if client == nil || project == "" {
		return nil
	}
	return func() tea.Msg {
		info, err := client.GetGitBranch(project)
		if err != nil || info == nil {
			return WorkspaceGitBranchMsg{Project: project, Err: err}
		}
		return WorkspaceGitBranchMsg{Project: project, Branch: info.Branch, Remote: info.Remote, Provider: info.Provider, Err: err}
	}
}

func FetchWorkspaceCanvasCmd(client *api.Client, project string) tea.Cmd {
	if client == nil || project == "" {
		return nil
	}
	return func() tea.Msg {
		widgets, err := client.GetWidgets(project)
		if err != nil {
			return WorkspaceCanvasDataMsg{Project: project, Err: err}
		}
		tabs, tabsErr := client.GetCanvasTabs(project)
		if tabsErr != nil {
			return WorkspaceCanvasDataMsg{Project: project, Widgets: widgets, Err: tabsErr}
		}
		return WorkspaceCanvasDataMsg{Project: project, Widgets: widgets, Tabs: tabs}
	}
}

type WorkspaceShellModel struct {
	Projects []api.Project
	Agents   []api.Agent

	OpenProjectTabs []string
	SelectedProject int
	CurrentProject  string
	CurrentDir      string
	LoadedProject   string
	LoadedDir       string

	FocusPane int
	DockMode  string

	Entries              []api.FileEntry
	SelectedEntry        int
	GitStatus            map[string]string
	GitBranch            string
	GitRemote            string
	GitProvider          string
	GitReady             bool
	CanvasWidgets        []api.Widget
	CanvasTabs           []string
	ActiveCanvas         string
	SelectedCanvasWidget int
	SelectedAgent        int
	LastSync             time.Time

	PreviewPath     string
	PreviewTitle    string
	PreviewKind     string
	PreviewBody     string
	PreviewContent  string
	PreviewReady    bool
	PreviewEditable bool

	OpenFileTabs   []string
	ActiveFileTab  string
	PendingFileTab string
	FileBuffers    map[string]string
	FileSaved      map[string]string

	Editor        textarea.Model
	EditorActive  bool
	EditorDirty   bool
	EditorHistory []string

	Composer            textinput.Model
	ComposerFocused     bool
	ComposerSpinner     spinner.Model
	PassThrough         bool
	SessionTurnBusy     bool
	PendingAssistant    bool
	PendingAssistantAt  string
	TerminalSessionID   string
	TerminalTitle       string
	TerminalStatus      string
	TerminalMessages    []api.Message
	TerminalLines       []string
	TerminalStream      string
	LocalSystemMessages []workspaceShellPendingUserMessage
	PendingUserMessages []workspaceShellPendingUserMessage

	SidebarList       list.Model
	ProjectPicker     list.Model
	ProjectPickerOpen bool
	SessionViewport   viewport.Model
}

type workspaceShellPendingUserMessage struct {
	Content   string
	Timestamp string
}

type workspaceShellListItem struct {
	title     string
	desc      string
	badge     string
	accent    lipgloss.Color
	action    string
	sessionID string
}

func (i workspaceShellListItem) FilterValue() string { return i.title + " " + i.desc + " " + i.badge }
func (i workspaceShellListItem) Title() string       { return i.title }
func (i workspaceShellListItem) Description() string { return i.desc }

type workspaceShellDelegate struct {
	compact bool
}

func (d workspaceShellDelegate) Height() int {
	if d.compact {
		return 1
	}
	return 2
}

func (d workspaceShellDelegate) Spacing() int                            { return 0 }
func (d workspaceShellDelegate) Update(_ tea.Msg, _ *list.Model) tea.Cmd { return nil }
func (d workspaceShellDelegate) Render(wr io.Writer, m list.Model, index int, item list.Item) {
	it, ok := item.(workspaceShellListItem)
	if !ok {
		return
	}

	w := max(8, m.Width())
	selected := index == m.Index()
	base := lipgloss.NewStyle().
		Width(w).
		Padding(0, 1).
		Foreground(SubText)
	if selected {
		base = base.
			Foreground(White).
			Bold(true).
			BorderLeft(true).
			BorderForeground(GlowBorder)
	}

	titleW := w - 2
	if it.badge != "" {
		titleW -= len([]rune(it.badge)) + 1
	}
	titleW = max(8, titleW)

	row := lipgloss.NewStyle().
		Width(titleW).
		Foreground(coalesceColor(it.accent, White)).
		Render(truncate(it.title, titleW))
	if it.badge != "" {
		row = lipgloss.JoinHorizontal(
			lipgloss.Top,
			row,
			lipgloss.NewStyle().Foreground(coalesceColor(it.accent, Cyan)).Render(" "+it.badge),
		)
	}
	if !d.compact && strings.TrimSpace(it.desc) != "" {
		row = lipgloss.JoinVertical(
			lipgloss.Left,
			row,
			lipgloss.NewStyle().Foreground(Dim).Render(truncate(it.desc, w-2)),
		)
		base = base.Height(2)
	}

	fmt.Fprint(wr, base.Render(row))
}

func NewWorkspaceShellModel() WorkspaceShellModel {
	sidebar := list.New([]list.Item{}, workspaceShellDelegate{}, 30, 18)
	sidebar.SetShowHelp(false)
	sidebar.SetShowTitle(false)
	sidebar.SetShowStatusBar(false)
	sidebar.SetShowPagination(false)
	sidebar.SetFilteringEnabled(false)
	sidebar.DisableQuitKeybindings()

	picker := list.New([]list.Item{}, workspaceShellDelegate{compact: true}, 34, 8)
	picker.SetShowHelp(false)
	picker.SetShowTitle(false)
	picker.SetShowStatusBar(false)
	picker.SetShowPagination(false)
	picker.SetFilteringEnabled(false)
	picker.DisableQuitKeybindings()

	composer := textinput.New()
	composer.Prompt = "› "
	composer.Placeholder = "Message the controller"
	composer.CharLimit = 12000
	composer.Focus()
	composer.PromptStyle = lipgloss.NewStyle().Foreground(SubText)
	composer.TextStyle = lipgloss.NewStyle().Foreground(White)
	composer.PlaceholderStyle = lipgloss.NewStyle().Foreground(Dim)
	composer.Cursor.Style = lipgloss.NewStyle().Foreground(Glass).Background(Cyan).Bold(true)
	composer.Cursor.TextStyle = lipgloss.NewStyle().Foreground(White)
	composer.Cursor.SetMode(cursor.CursorStatic)

	editor := textarea.New()
	editor.Prompt = ""
	editor.ShowLineNumbers = true
	editor.Blur()

	spin := spinner.New(
		spinner.WithSpinner(spinner.MiniDot),
		spinner.WithStyle(lipgloss.NewStyle().Foreground(Cyan).Bold(true)),
	)

	vp := viewport.New(80, 20)
	vp.MouseWheelEnabled = true

	return WorkspaceShellModel{
		FocusPane:       2,
		DockMode:        workspaceDockFiles,
		GitStatus:       map[string]string{},
		TerminalTitle:   "Controller",
		TerminalStatus:  "Ready",
		SidebarList:     sidebar,
		ProjectPicker:   picker,
		SessionViewport: vp,
		Composer:        composer,
		ComposerFocused: true,
		ComposerSpinner: spin,
		Editor:          editor,
		EditorHistory:   []string{""},
		FileBuffers:     map[string]string{},
		FileSaved:       map[string]string{},
	}
}

func (w *WorkspaceShellModel) InitCmd() tea.Cmd {
	return w.Composer.Focus()
}

func (w *WorkspaceShellModel) Sync() {
	if len(w.Projects) == 0 {
		w.OpenProjectTabs = nil
		w.CurrentProject = ""
		w.SelectedProject = 0
		w.CurrentDir = ""
		w.LoadedProject = ""
		w.LoadedDir = ""
		w.Entries = nil
		w.GitStatus = map[string]string{}
		w.GitBranch = ""
		w.GitRemote = ""
		w.GitProvider = ""
		w.GitReady = false
		w.resetCanvas()
		w.SelectedEntry = 0
		w.SelectedAgent = 0
		w.resetPreview()
		w.resetTerminal()
		w.syncProjectPicker()
		w.rebuildSidebarList()
		w.refreshSessionViewport()
		return
	}

	if w.SelectedProject < 0 {
		w.SelectedProject = 0
	}
	if w.SelectedProject >= len(w.Projects) {
		w.SelectedProject = len(w.Projects) - 1
	}

	projectChanged := false
	if w.CurrentProject == "" {
		w.CurrentProject = w.Projects[w.SelectedProject].Name
		projectChanged = true
	} else {
		found := false
		for i, p := range w.Projects {
			if p.Name == w.CurrentProject {
				w.SelectedProject = i
				found = true
				break
			}
		}
		if !found {
			w.CurrentProject = w.Projects[w.SelectedProject].Name
			projectChanged = true
		}
	}

	if len(w.OpenProjectTabs) == 0 && w.CurrentProject != "" {
		w.OpenProjectTabs = []string{w.CurrentProject}
	}
	w.pruneProjectTabs()
	if w.CurrentProject != "" {
		w.ensureProjectTab(w.CurrentProject)
	}
	if w.CurrentProject == "" && len(w.OpenProjectTabs) > 0 {
		w.CurrentProject = w.OpenProjectTabs[0]
		projectChanged = true
	}

	if projectChanged || w.LoadedProject != w.CurrentProject {
		w.CurrentDir = ""
		w.LoadedProject = ""
		w.LoadedDir = ""
		w.Entries = nil
		w.GitStatus = map[string]string{}
		w.GitBranch = ""
		w.GitRemote = ""
		w.GitProvider = ""
		w.GitReady = false
		w.resetCanvas()
		w.SelectedEntry = 0
		w.SelectedAgent = 0
		w.resetPreview()
		w.resetTerminal()
	}

	w.syncProjectPicker()
	w.rebuildSidebarList()
	w.refreshSessionViewport()
}

func (w *WorkspaceShellModel) Current() *api.Project {
	for i := range w.Projects {
		if w.Projects[i].Name == w.CurrentProject {
			return &w.Projects[i]
		}
	}
	if len(w.Projects) == 0 {
		return nil
	}
	return &w.Projects[w.SelectedProject]
}

func (w *WorkspaceShellModel) SelectDelta(delta int) bool {
	return w.StepDockMode(delta)
}

func (w *WorkspaceShellModel) SetProjectByName(name string) bool {
	for i, p := range w.Projects {
		if p.Name != name {
			continue
		}
		changed := w.CurrentProject != name || w.SelectedProject != i
		w.ensureProjectTab(name)
		w.SelectedProject = i
		w.CurrentProject = name
		w.ProjectPickerOpen = false
		w.Sync()
		return changed
	}
	return false
}

func (w *WorkspaceShellModel) AddProjectTab(name string) bool {
	return w.SetProjectByName(name)
}

func (w *WorkspaceShellModel) CloseProjectTab(name string) bool {
	idx := -1
	for i, tab := range w.OpenProjectTabs {
		if tab == name {
			idx = i
			break
		}
	}
	if idx < 0 {
		return false
	}
	w.OpenProjectTabs = append(w.OpenProjectTabs[:idx], w.OpenProjectTabs[idx+1:]...)
	if len(w.OpenProjectTabs) == 0 {
		w.CurrentProject = ""
		w.SelectedProject = 0
		w.CurrentDir = ""
		w.LoadedProject = ""
		w.LoadedDir = ""
		w.Entries = nil
		w.GitStatus = map[string]string{}
		w.GitBranch = ""
		w.GitRemote = ""
		w.GitProvider = ""
		w.GitReady = false
		w.resetCanvas()
		w.resetTerminal()
		w.syncProjectPicker()
		w.rebuildSidebarList()
		w.refreshSessionViewport()
		return true
	}
	if w.CurrentProject == name {
		next := idx
		if next >= len(w.OpenProjectTabs) {
			next = len(w.OpenProjectTabs) - 1
		}
		return w.SetProjectByName(w.OpenProjectTabs[next])
	}
	w.syncProjectPicker()
	return true
}
