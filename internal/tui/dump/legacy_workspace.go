//go:build ignore

package tui

import (
	"fmt"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/help"
	"github.com/charmbracelet/bubbles/key"
	"github.com/charmbracelet/bubbles/list"
	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/textarea"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/scoady/codexctl/internal/api"
)

const (
	workspacePreviewTerminal = "terminal"
	workspacePreviewFile     = "file"
	workspacePreviewAgent    = "agent"

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

type WorkspaceModel struct {
	Projects []api.Project
	Agents   []api.Agent

	SelectedProject int
	CurrentProject  string
	FocusPane       int // 0=tabs 1=dock 2=tool
	TopTab          int
	DockMode        string

	CurrentDir    string
	LoadedProject string
	LoadedDir     string
	Entries       []api.FileEntry
	SelectedEntry int

	SelectedAgent int

	PreviewMode     string
	PreviewTitle    string
	PreviewSubtitle string
	PreviewLines    []string
	PreviewPath     string
	PreviewContent  string
	PreviewEditable bool

	Editor        textarea.Model
	EditorActive  bool
	EditorDirty   bool
	EditorHistory []string

	Composer            textarea.Model
	ComposerFocused     bool
	ComposerSpinner     spinner.Model
	SessionTurnBusy     bool
	TerminalStream      string
	PendingUserMessages []workspacePendingUserMessage
	TerminalCleared     bool

	TerminalSessionID string
	TerminalTitle     string
	TerminalSubtitle  string
	TerminalLines     []string
	TerminalStatus    string

	SidebarList     list.Model
	SessionViewport viewport.Model
	Help            help.Model
}

type workspaceExplorerItem struct {
	Label    string
	Path     string
	IsDir    bool
	IsParent bool
}

type workspaceRect struct {
	X int
	Y int
	W int
	H int
}

func (r workspaceRect) contains(x, y int) bool {
	return x >= r.X && x < r.X+r.W && y >= r.Y && y < r.Y+r.H
}

type workspaceLayout struct {
	Dock    workspaceRect
	Sidebar workspaceRect
	Main    workspaceRect
}

type workspaceDockItem struct {
	Mode  string
	Icon  string
	Label string
}

type workspaceToolbarButton struct {
	Action   string
	Label    string
	Disabled bool
}

type workspaceSidebarItem struct {
	title       string
	description string
	kind        string
	path        string
	sessionID   string
	index       int
}

func (i workspaceSidebarItem) FilterValue() string { return i.title + " " + i.description }
func (i workspaceSidebarItem) Title() string       { return i.title }
func (i workspaceSidebarItem) Description() string { return i.description }

type workspacePendingUserMessage struct {
	Content   string
	Timestamp string
}

type workspaceFileVisual struct {
	Icon  string
	Color lipgloss.Color
}

type workspaceKeyMap struct {
	FocusDock    key.Binding
	FocusSidebar key.Binding
	FocusSession key.Binding
	Open         key.Binding
	Message      key.Binding
	Tools        key.Binding
	Send         key.Binding
	Nav          key.Binding
}

func newWorkspaceKeyMap() workspaceKeyMap {
	return workspaceKeyMap{
		FocusDock: key.NewBinding(key.WithKeys("tab"), key.WithHelp("tab", "focus")),
		FocusSidebar: key.NewBinding(
			key.WithKeys("j", "k"),
			key.WithHelp("j/k", "list"),
		),
		FocusSession: key.NewBinding(
			key.WithKeys("pgup", "pgdown"),
			key.WithHelp("pgup/dn", "scroll"),
		),
		Open:    key.NewBinding(key.WithKeys("enter"), key.WithHelp("enter", "open")),
		Message: key.NewBinding(key.WithKeys("type"), key.WithHelp("type", "compose")),
		Tools:   key.NewBinding(key.WithKeys("u"), key.WithHelp("u", "tools")),
		Send:    key.NewBinding(key.WithKeys("enter"), key.WithHelp("enter", "send")),
		Nav:     key.NewBinding(key.WithKeys("esc"), key.WithHelp("esc", "nav")),
	}
}

func (k workspaceKeyMap) ShortHelp() []key.Binding {
	return []key.Binding{k.Send, k.Nav, k.Tools}
}

func (k workspaceKeyMap) FullHelp() [][]key.Binding {
	return [][]key.Binding{{k.FocusDock, k.FocusSidebar, k.FocusSession, k.Open, k.Send, k.Nav, k.Tools}}
}

func workspaceFileVisualFor(name string, isDir, isParent bool) workspaceFileVisual {
	if isParent {
		return workspaceFileVisual{Icon: "↩", Color: lipgloss.Color("#7e8792")}
	}
	base := strings.ToLower(filepath.Base(name))
	ext := strings.ToLower(filepath.Ext(base))

	if isDir {
		switch base {
		case ".git":
			return workspaceFileVisual{Icon: "◆", Color: lipgloss.Color("#ff8f40")}
		case ".github":
			return workspaceFileVisual{Icon: "◎", Color: lipgloss.Color("#c7d0da")}
		case ".vscode":
			return workspaceFileVisual{Icon: "▣", Color: lipgloss.Color("#36c2ff")}
		case ".claude", ".codex":
			return workspaceFileVisual{Icon: "◉", Color: lipgloss.Color("#cb7cff")}
		case "terraform", ".terraform":
			return workspaceFileVisual{Icon: "◭", Color: lipgloss.Color("#b084ff")}
		case "docs":
			return workspaceFileVisual{Icon: "📝", Color: lipgloss.Color("#6ad7ff")}
		case "scripts", "bin":
			return workspaceFileVisual{Icon: "⚙", Color: lipgloss.Color("#7fe38b")}
		case "src", "app", "pkg", "internal", "cmd":
			return workspaceFileVisual{Icon: "◫", Color: lipgloss.Color("#78a8ff")}
		case "test", "tests", "__tests__", "spec", "specs":
			return workspaceFileVisual{Icon: "◌", Color: lipgloss.Color("#ffd454")}
		case "config", "configs":
			return workspaceFileVisual{Icon: "◬", Color: lipgloss.Color("#36f2ff")}
		}
		if strings.HasPrefix(base, ".") {
			return workspaceFileVisual{Icon: "◌", Color: lipgloss.Color("#7e8792")}
		}
		return workspaceFileVisual{Icon: "📁", Color: lipgloss.Color("#89f7ff")}
	}

	switch base {
	case "dockerfile", "containerfile":
		return workspaceFileVisual{Icon: "🐳", Color: lipgloss.Color("#6ab8ff")}
	case "makefile", "justfile", "taskfile":
		return workspaceFileVisual{Icon: "⚙", Color: lipgloss.Color("#ffb454")}
	case "readme", "readme.md", "readme.mdx":
		return workspaceFileVisual{Icon: "📝", Color: lipgloss.Color("#6ad7ff")}
	case "license", "license.md", "copying":
		return workspaceFileVisual{Icon: "§", Color: lipgloss.Color("#c9d27d")}
	case ".gitignore", ".dockerignore", ".ignore":
		return workspaceFileVisual{Icon: "◌", Color: lipgloss.Color("#7e8792")}
	case ".env", ".env.local", ".env.example", ".envrc":
		return workspaceFileVisual{Icon: "◐", Color: lipgloss.Color("#9de26a")}
	case "go.mod", "go.sum":
		return workspaceFileVisual{Icon: "🐹", Color: lipgloss.Color("#49c5ff")}
	case "package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock":
		return workspaceFileVisual{Icon: "⬢", Color: lipgloss.Color("#7fe38b")}
	case "cargo.toml", "cargo.lock":
		return workspaceFileVisual{Icon: "🦀", Color: lipgloss.Color("#ff9d5c")}
	case "pyproject.toml", "requirements.txt", "poetry.lock", "uv.lock":
		return workspaceFileVisual{Icon: "🐍", Color: lipgloss.Color("#ffd454")}
	case "terraform.tfvars", "terraform.tfvars.json":
		return workspaceFileVisual{Icon: "◭", Color: lipgloss.Color("#b084ff")}
	}

	switch ext {
	case ".go":
		return workspaceFileVisual{Icon: "🐹", Color: lipgloss.Color("#49c5ff")}
	case ".py":
		return workspaceFileVisual{Icon: "🐍", Color: lipgloss.Color("#ffd454")}
	case ".js", ".mjs", ".cjs":
		return workspaceFileVisual{Icon: "🟨", Color: lipgloss.Color("#f7df5e")}
	case ".ts", ".tsx":
		return workspaceFileVisual{Icon: "🔷", Color: lipgloss.Color("#4db7ff")}
	case ".jsx":
		return workspaceFileVisual{Icon: "⚛", Color: lipgloss.Color("#61dafb")}
	case ".rs":
		return workspaceFileVisual{Icon: "🦀", Color: lipgloss.Color("#ff9d5c")}
	case ".rb":
		return workspaceFileVisual{Icon: "♦", Color: lipgloss.Color("#ff6b81")}
	case ".java":
		return workspaceFileVisual{Icon: "☕", Color: lipgloss.Color("#ff8f40")}
	case ".kt", ".kts":
		return workspaceFileVisual{Icon: "◆", Color: lipgloss.Color("#c88cff")}
	case ".swift":
		return workspaceFileVisual{Icon: "🐦", Color: lipgloss.Color("#ff8f40")}
	case ".c", ".h", ".cpp", ".cc", ".cxx", ".hpp":
		return workspaceFileVisual{Icon: "⬡", Color: lipgloss.Color("#78a8ff")}
	case ".sh", ".bash", ".zsh", ".fish":
		return workspaceFileVisual{Icon: "⌘", Color: lipgloss.Color("#7fe38b")}
	case ".tf", ".tfvars", ".hcl":
		return workspaceFileVisual{Icon: "◭", Color: lipgloss.Color("#b084ff")}
	case ".yaml", ".yml":
		return workspaceFileVisual{Icon: "◩", Color: lipgloss.Color("#ff8fb1")}
	case ".json":
		return workspaceFileVisual{Icon: "◨", Color: lipgloss.Color("#ffb454")}
	case ".toml", ".ini", ".conf", ".cfg":
		return workspaceFileVisual{Icon: "◬", Color: lipgloss.Color("#36f2ff")}
	case ".md", ".mdx", ".txt", ".rst":
		return workspaceFileVisual{Icon: "📝", Color: lipgloss.Color("#6ad7ff")}
	case ".html":
		return workspaceFileVisual{Icon: "🌐", Color: lipgloss.Color("#ff8f40")}
	case ".css", ".scss", ".sass":
		return workspaceFileVisual{Icon: "🎨", Color: lipgloss.Color("#7fb6ff")}
	case ".sql":
		return workspaceFileVisual{Icon: "🗄", Color: lipgloss.Color("#4fd1c5")}
	case ".graphql", ".gql":
		return workspaceFileVisual{Icon: "⬣", Color: lipgloss.Color("#ff73c6")}
	case ".xml":
		return workspaceFileVisual{Icon: "◇", Color: lipgloss.Color("#ffb454")}
	case ".log":
		return workspaceFileVisual{Icon: "≣", Color: lipgloss.Color("#7e8792")}
	case ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico":
		return workspaceFileVisual{Icon: "▦", Color: lipgloss.Color("#cb7cff")}
	case ".pdf":
		return workspaceFileVisual{Icon: "▤", Color: lipgloss.Color("#ff6b81")}
	}

	if strings.HasPrefix(base, ".") {
		return workspaceFileVisual{Icon: "•", Color: lipgloss.Color("#7e8792")}
	}
	return workspaceFileVisual{Icon: "•", Color: lipgloss.Color("#c7d0da")}
}

func NewWorkspaceModel() WorkspaceModel {
	editor := textarea.New()
	editor.Prompt = ""
	editor.ShowLineNumbers = true
	editor.SetWidth(60)
	editor.SetHeight(12)
	editor.Blur()

	composer := textarea.New()
	composer.Prompt = "› "
	composer.Placeholder = "Message the project controller..."
	composer.ShowLineNumbers = false
	composer.CharLimit = 8000
	composer.SetWidth(60)
	composer.SetHeight(1)
	composer.FocusedStyle.Base = lipgloss.NewStyle().Foreground(lipgloss.Color("#f6fbff"))
	composer.FocusedStyle.CursorLine = lipgloss.NewStyle()
	composer.FocusedStyle.Placeholder = lipgloss.NewStyle().Foreground(lipgloss.Color("#67707a"))
	composer.FocusedStyle.Prompt = lipgloss.NewStyle().Foreground(lipgloss.Color("#89f7ff")).Bold(true)
	composer.FocusedStyle.Text = lipgloss.NewStyle().Foreground(lipgloss.Color("#f6fbff"))
	composer.BlurredStyle.Base = lipgloss.NewStyle().Foreground(lipgloss.Color("#b8c1cb"))
	composer.BlurredStyle.CursorLine = lipgloss.NewStyle()
	composer.BlurredStyle.Placeholder = lipgloss.NewStyle().Foreground(lipgloss.Color("#4f5760"))
	composer.BlurredStyle.Prompt = lipgloss.NewStyle().Foreground(lipgloss.Color("#4f5760"))
	composer.BlurredStyle.Text = lipgloss.NewStyle().Foreground(lipgloss.Color("#b8c1cb"))
	composer.Focus()

	turnSpinner := spinner.New(
		spinner.WithSpinner(spinner.MiniDot),
		spinner.WithStyle(lipgloss.NewStyle().Foreground(lipgloss.Color("#89f7ff")).Bold(true)),
	)

	delegate := list.NewDefaultDelegate()
	delegate.ShowDescription = false
	delegate.SetHeight(1)
	delegate.SetSpacing(0)
	delegate.Styles.NormalTitle = lipgloss.NewStyle().Foreground(White).PaddingLeft(1)
	delegate.Styles.NormalDesc = lipgloss.NewStyle().Foreground(SubText).PaddingLeft(3)
	delegate.Styles.SelectedTitle = lipgloss.NewStyle().Foreground(Cyan).Bold(true).BorderLeft(true).BorderForeground(GlowBorder).PaddingLeft(0)
	delegate.Styles.SelectedDesc = lipgloss.NewStyle().Foreground(SubText).BorderLeft(true).BorderForeground(GlowBorder).PaddingLeft(2)
	sidebar := list.New([]list.Item{}, delegate, 28, 20)
	sidebar.SetShowTitle(false)
	sidebar.SetShowFilter(false)
	sidebar.SetShowStatusBar(false)
	sidebar.SetShowPagination(false)
	sidebar.SetShowHelp(false)
	sidebar.DisableQuitKeybindings()

	session := viewport.New(60, 20)
	session.MouseWheelEnabled = true
	session.Style = lipgloss.NewStyle().Padding(0, 0)

	h := help.New()
	h.ShortSeparator = "  "
	h.Styles.ShortKey = lipgloss.NewStyle().Foreground(lipgloss.Color("#89f7ff"))
	h.Styles.ShortDesc = lipgloss.NewStyle().Foreground(lipgloss.Color("#7f8791"))

	return WorkspaceModel{
		FocusPane:       2,
		DockMode:        workspaceDockFiles,
		PreviewMode:     workspacePreviewTerminal,
		PreviewTitle:    "Workspace Terminal",
		PreviewSubtitle: "controller-first shell",
		Editor:          editor,
		EditorHistory:   []string{""},
		Composer:        composer,
		ComposerFocused: true,
		ComposerSpinner: turnSpinner,
		TerminalTitle:   "Controller Lane",
		TerminalStatus:  "Waiting for a controller session",
		SidebarList:     sidebar,
		SessionViewport: session,
		Help:            h,
	}
}

func (w *WorkspaceModel) Sync() {
	if len(w.Projects) == 0 {
		w.SelectedProject = 0
		w.CurrentProject = ""
		w.CurrentDir = ""
		w.LoadedProject = ""
		w.LoadedDir = ""
		w.Entries = nil
		w.SelectedEntry = 0
		w.SelectedAgent = 0
		w.EditorActive = false
		w.EditorDirty = false
		w.EditorHistory = []string{""}
		w.Composer.SetValue("")
		w.ComposerFocused = true
		w.Composer.Focus()
		w.SessionTurnBusy = false
		w.TerminalStream = ""
		w.PendingUserMessages = nil
		w.TerminalCleared = false
		w.TerminalSessionID = ""
		w.TerminalTitle = "Controller Lane"
		w.TerminalSubtitle = ""
		w.TerminalLines = nil
		w.TerminalStatus = "Waiting for a controller session"
		w.rebuildSidebarList()
		w.refreshSessionViewport()
		w.ensurePreviewDefaults()
		return
	}
	if w.SelectedProject < 0 {
		w.SelectedProject = 0
	}
	if w.SelectedProject >= len(w.Projects) {
		w.SelectedProject = len(w.Projects) - 1
	}

	currentChanged := false
	if w.CurrentProject == "" {
		w.CurrentProject = w.Projects[w.SelectedProject].Name
		currentChanged = true
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
			currentChanged = true
		}
	}

	if currentChanged || w.LoadedProject != w.CurrentProject {
		w.CurrentDir = ""
		w.LoadedProject = ""
		w.LoadedDir = ""
		w.Entries = nil
		w.SelectedEntry = 0
		w.SelectedAgent = 0
		w.EditorActive = false
		w.EditorDirty = false
		w.EditorHistory = []string{""}
		w.Composer.SetValue("")
		w.ComposerFocused = true
		w.Composer.Focus()
		w.SessionTurnBusy = false
		w.TerminalStream = ""
		w.PendingUserMessages = nil
		w.TerminalCleared = false
		w.TerminalSessionID = ""
		w.TerminalLines = nil
		w.TerminalStatus = "Waiting for a controller session"
		w.setTerminalPreview()
	}

	if w.SelectedEntry < 0 {
		w.SelectedEntry = 0
	}
	items := w.ExplorerItems()
	if len(items) == 0 {
		w.SelectedEntry = 0
	} else if w.SelectedEntry >= len(items) {
		w.SelectedEntry = len(items) - 1
	}

	agents := w.AgentsForCurrent()
	if w.SelectedAgent < 0 {
		w.SelectedAgent = 0
	}
	if len(agents) == 0 {
		w.SelectedAgent = 0
	} else if w.SelectedAgent >= len(agents) {
		w.SelectedAgent = len(agents) - 1
	}

	w.rebuildSidebarList()
	w.refreshSessionViewport()
	w.ensurePreviewDefaults()
}

func (w *WorkspaceModel) ensurePreviewDefaults() {
	if w.PreviewMode == "" {
		w.setTerminalPreview()
	}
	if w.DockMode == "" {
		w.DockMode = workspaceDockFiles
	}
}

func (w *WorkspaceModel) setTerminalPreview() {
	cur := w.currentUnsafe()
	title := "Workspace Terminal"
	subtitle := "controller-first shell"
	lines := []string{
		Class("dim").Render("$ c9s dispatch " + w.CurrentProject + " \"describe next step\""),
		Class("body").Render("Keep the main orchestration conversation here while files and agents stay inspectable around it."),
	}
	if cur != nil && cur.Path != "" {
		title = "Workspace Terminal"
		subtitle = cur.Path
		lines = []string{
			Class("dim").Render("$ cd " + cur.Path),
			Class("dim").Render("$ ls -la"),
			Class("body").Render(".codex/  PROJECT.md  TASKS.md"),
			"",
			Class("dim").Render("> click a file on the left to preview it here"),
			Class("dim").Render("> click an agent on the right to inspect recent output here"),
		}
	}
	w.PreviewMode = workspacePreviewTerminal
	w.PreviewTitle = title
	w.PreviewSubtitle = subtitle
	w.PreviewLines = lines
	w.PreviewPath = ""
	w.PreviewContent = ""
	w.PreviewEditable = false
	if len(w.TerminalLines) == 0 {
		w.TerminalTitle = "Controller Lane"
		w.TerminalSubtitle = subtitle
		w.TerminalStatus = "Waiting for a controller session"
	}
	w.refreshSessionViewport()
}

func (w *WorkspaceModel) Current() *api.Project {
	return w.currentUnsafe()
}

func (w *WorkspaceModel) currentUnsafe() *api.Project {
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

func (w *WorkspaceModel) SelectDelta(delta int) bool {
	if len(w.Projects) == 0 {
		return false
	}
	next := w.SelectedProject + delta
	if next < 0 {
		next = 0
	}
	if next >= len(w.Projects) {
		next = len(w.Projects) - 1
	}
	if next == w.SelectedProject && w.CurrentProject == w.Projects[next].Name {
		return false
	}
	w.SelectedProject = next
	w.CurrentProject = w.Projects[next].Name
	w.Sync()
	return true
}

func (w *WorkspaceModel) SetProjectByIndex(idx int) bool {
	if idx < 0 || idx >= len(w.Projects) {
		return false
	}
	if w.CurrentProject == w.Projects[idx].Name && w.SelectedProject == idx {
		return false
	}
	w.SelectedProject = idx
	w.CurrentProject = w.Projects[idx].Name
	w.Sync()
	return true
}

func (w *WorkspaceModel) SetProjectByName(name string) bool {
	for i, project := range w.Projects {
		if project.Name == name {
			return w.SetProjectByIndex(i)
		}
	}
	return false
}

func (w *WorkspaceModel) AgentsForCurrent() []api.Agent {
	if w.CurrentProject == "" {
		return nil
	}
	var out []api.Agent
	for _, ag := range w.Agents {
		if ag.ProjectName == w.CurrentProject {
			out = append(out, ag)
		}
	}
	sort.Slice(out, func(i, j int) bool {
		return out[i].StartedAt > out[j].StartedAt
	})
	return out
}

func (w *WorkspaceModel) TerminalAgentRef() *api.Agent {
	agents := w.AgentsForCurrent()
	if len(agents) == 0 {
		return nil
	}
	for i := range agents {
		if agents[i].IsController {
			return &agents[i]
		}
	}
	return &agents[0]
}

func (w *WorkspaceModel) SubagentsForCurrent() []api.Agent {
	all := w.AgentsForCurrent()
	out := make([]api.Agent, 0, len(all))
	for _, ag := range all {
		if ag.IsController {
			continue
		}
		out = append(out, ag)
	}
	return out
}

func (w *WorkspaceModel) SelectedAgentRef() *api.Agent {
	agents := w.SubagentsForCurrent()
	if len(agents) == 0 {
		return nil
	}
	if w.SelectedAgent < 0 {
		w.SelectedAgent = 0
	}
	if w.SelectedAgent >= len(agents) {
		w.SelectedAgent = len(agents) - 1
	}
	return &agents[w.SelectedAgent]
}

func (w *WorkspaceModel) SelectAgentDelta(delta int) bool {
	agents := w.SubagentsForCurrent()
	if len(agents) == 0 {
		return false
	}
	next := w.SelectedAgent + delta
	if next < 0 {
		next = 0
	}
	if next >= len(agents) {
		next = len(agents) - 1
	}
	if next == w.SelectedAgent {
		return false
	}
	w.SelectedAgent = next
	return true
}

func (w *WorkspaceModel) SetSelectedAgentIndex(idx int) bool {
	agents := w.SubagentsForCurrent()
	if idx < 0 || idx >= len(agents) || idx == w.SelectedAgent {
		return false
	}
	w.SelectedAgent = idx
	return true
}

func (w *WorkspaceModel) SetEntries(project, dir string, entries []api.FileEntry) {
	if project != w.CurrentProject || dir != w.CurrentDir {
		return
	}
	w.LoadedProject = project
	w.LoadedDir = dir
	w.Entries = append([]api.FileEntry(nil), entries...)
	sort.Slice(w.Entries, func(i, j int) bool {
		if w.Entries[i].Type != w.Entries[j].Type {
			return w.Entries[i].Type == "directory"
		}
		return w.Entries[i].Name < w.Entries[j].Name
	})
	w.SelectedEntry = 0
	w.rebuildSidebarList()
}

func (w *WorkspaceModel) ExplorerItems() []workspaceExplorerItem {
	var items []workspaceExplorerItem
	if w.CurrentDir != "" {
		parent := filepath.Dir(w.CurrentDir)
		if parent == "." {
			parent = ""
		}
		items = append(items, workspaceExplorerItem{
			Label:    "../",
			Path:     parent,
			IsDir:    true,
			IsParent: true,
		})
	}
	for _, entry := range w.Entries {
		path := entry.Path
		if path == "" {
			path = entry.Name
			if w.CurrentDir != "" {
				path = filepath.ToSlash(filepath.Join(w.CurrentDir, entry.Name))
			}
		}
		label := entry.Name
		if entry.Type == "directory" {
			label += "/"
		}
		items = append(items, workspaceExplorerItem{
			Label: label,
			Path:  path,
			IsDir: entry.Type == "directory",
		})
	}
	return items
}

func (w *WorkspaceModel) SelectExplorerDelta(delta int) bool {
	items := w.ExplorerItems()
	if len(items) == 0 {
		return false
	}
	next := w.SelectedEntry + delta
	if next < 0 {
		next = 0
	}
	if next >= len(items) {
		next = len(items) - 1
	}
	if next == w.SelectedEntry {
		return false
	}
	w.SelectedEntry = next
	return true
}

func (w *WorkspaceModel) SetExplorerIndex(idx int) bool {
	items := w.ExplorerItems()
	if idx < 0 || idx >= len(items) || idx == w.SelectedEntry {
		return false
	}
	w.SelectedEntry = idx
	return true
}

func (w *WorkspaceModel) SelectedExplorerItem() (workspaceExplorerItem, bool) {
	items := w.ExplorerItems()
	if len(items) == 0 {
		return workspaceExplorerItem{}, false
	}
	if w.SelectedEntry < 0 {
		w.SelectedEntry = 0
	}
	if w.SelectedEntry >= len(items) {
		w.SelectedEntry = len(items) - 1
	}
	return items[w.SelectedEntry], true
}

func (w *WorkspaceModel) OpenExplorerSelection() (loadDir, previewFile string) {
	item, ok := w.SelectedExplorerItem()
	if !ok {
		return "", ""
	}
	if item.IsDir {
		w.CurrentDir = item.Path
		w.LoadedProject = ""
		w.LoadedDir = ""
		w.Entries = nil
		w.SelectedEntry = 0
		return item.Path, ""
	}
	return "", item.Path
}

func (w *WorkspaceModel) SetFilePreview(path string, content *api.FileContent, err error) {
	w.PreviewMode = workspacePreviewFile
	w.PreviewTitle = filepath.Base(path)
	w.PreviewSubtitle = path
	w.PreviewPath = path
	w.PreviewContent = ""
	w.PreviewEditable = false
	w.EditorActive = false
	w.EditorDirty = false
	w.Editor.Blur()
	if err != nil {
		w.PreviewLines = []string{Class("dim").Render("failed to read file: " + err.Error())}
		return
	}
	if content == nil {
		w.PreviewLines = []string{Class("dim").Render("no preview available")}
		return
	}
	if content.Binary {
		w.PreviewLines = []string{Class("dim").Render("binary file preview not available")}
		return
	}
	if content.Truncated {
		w.PreviewLines = []string{Class("dim").Render("file is too large to preview")}
		return
	}
	lines := strings.Split(strings.ReplaceAll(content.Content, "\t", "  "), "\n")
	if len(lines) == 0 {
		lines = []string{""}
	}
	w.PreviewLines = lines
	w.PreviewContent = content.Content
	w.PreviewEditable = true
	w.Editor.SetValue(content.Content)
	w.resetEditorHistory(content.Content)
}

func (w *WorkspaceModel) SetAgentPreview(sessionID string, messages []api.Message, err error) {
	ag := w.SelectedAgentRef()
	w.PreviewMode = workspacePreviewAgent
	w.PreviewTitle = "Agent Output"
	w.PreviewPath = ""
	w.PreviewContent = ""
	w.PreviewEditable = false
	w.EditorActive = false
	w.EditorDirty = false
	w.Editor.Blur()
	if ag != nil {
		w.PreviewTitle = truncate(ag.Task, 48)
		w.PreviewSubtitle = truncate(sessionID, 20)
	} else {
		w.PreviewSubtitle = truncate(sessionID, 20)
	}
	if err != nil {
		w.PreviewLines = []string{Class("dim").Render("failed to load agent history: " + err.Error())}
		return
	}
	if len(messages) == 0 {
		w.PreviewLines = []string{Class("dim").Render("no captured history for this agent")}
		return
	}
	lines := []string{}
	for _, msg := range messages {
		switch msg.Type {
		case "tool_use":
			label := msg.ToolName
			if cmd, ok := msg.ToolInput["command"].(string); ok && cmd != "" {
				label += " · " + cmd
			}
			lines = append(lines, Class("dim").Render("tool  "+label))
		default:
			content := strings.TrimSpace(msg.Content)
			if content == "" {
				continue
			}
			prefix := "assistant"
			if msg.Role == "user" {
				prefix = "user"
			}
			for _, line := range strings.Split(content, "\n") {
				lines = append(lines, fmt.Sprintf("%-9s %s", prefix, line))
			}
		}
		if len(lines) > 120 {
			break
		}
	}
	if len(lines) == 0 {
		lines = []string{Class("dim").Render("no previewable text in agent history")}
	}
	w.PreviewLines = lines
	w.rebuildSidebarList()
}

func (w *WorkspaceModel) SetTerminalPreview(sessionID string, messages []api.Message, err error) {
	ag := w.TerminalAgentRef()
	w.TerminalSessionID = sessionID
	w.TerminalTitle = "Controller Lane"
	w.TerminalSubtitle = truncate(sessionID, 20)
	if ag != nil {
		if ag.IsController {
			w.TerminalTitle = "Controller Lane"
		} else {
			w.TerminalTitle = "Agent Lane"
		}
		w.TerminalSubtitle = truncate(ag.Task, 42)
	}
	if err != nil {
		w.TerminalStatus = "Terminal feed unavailable"
		w.TerminalLines = []string{Class("dim").Render("failed to load terminal transcript: " + err.Error())}
		w.TerminalStream = ""
		return
	}
	w.reconcilePendingUserLines(messages)
	lines := workspaceConversationLines(messages, 140)
	if len(lines) == 0 {
		w.TerminalStatus = "No output yet"
		w.TerminalLines = []string{
			Class("dim").Render("> controller session is live, but no transcript has been captured yet"),
			Class("dim").Render("> click into the terminal and start typing to continue the turn"),
		}
		w.TerminalStream = ""
		w.refreshSessionViewport()
		return
	}
	w.TerminalStatus = fmt.Sprintf("%d events", len(messages))
	if !w.TerminalCleared {
		w.TerminalLines = lines
	}
	w.TerminalStream = ""
	w.refreshSessionViewport()
}

func (w *WorkspaceModel) reconcilePendingUserLines(messages []api.Message) {
	if len(w.PendingUserMessages) == 0 || len(messages) == 0 {
		return
	}
	userContent := make(map[string]struct{}, len(messages))
	for _, msg := range messages {
		if msg.Role != "user" {
			continue
		}
		text := strings.TrimSpace(msg.Content)
		if text != "" {
			userContent[text] = struct{}{}
		}
	}
	if len(userContent) == 0 {
		return
	}
	remaining := make([]workspacePendingUserMessage, 0, len(w.PendingUserMessages))
	for _, message := range w.PendingUserMessages {
		if _, ok := userContent[strings.TrimSpace(message.Content)]; ok {
			continue
		}
		remaining = append(remaining, message)
	}
	w.PendingUserMessages = remaining
}

func (w *WorkspaceModel) CanEditPreviewFile() bool {
	return w.PreviewMode == workspacePreviewFile && w.PreviewPath != "" && w.PreviewEditable
}

func (w *WorkspaceModel) BeginEditingPreview() bool {
	if !w.CanEditPreviewFile() {
		return false
	}
	w.EditorActive = true
	w.Editor.Focus()
	w.resetEditorHistory(w.Editor.Value())
	w.EditorDirty = w.Editor.Value() != w.PreviewContent
	return true
}

func (w *WorkspaceModel) StopEditingPreview() {
	w.EditorActive = false
	w.Editor.Blur()
	w.PreviewLines = workspaceTextLines(w.Editor.Value())
	w.EditorDirty = w.Editor.Value() != w.PreviewContent
}

func (w *WorkspaceModel) UpdateEditor(msg tea.Msg, width, height int) tea.Cmd {
	if !w.EditorActive {
		return nil
	}
	if width > 12 {
		w.Editor.SetWidth(width)
	}
	if height > 4 {
		w.Editor.SetHeight(height)
	}
	var cmd tea.Cmd
	before := w.Editor.Value()
	w.Editor, cmd = w.Editor.Update(msg)
	after := w.Editor.Value()
	if after != before {
		w.recordEditorHistory(after)
		w.PreviewLines = workspaceTextLines(after)
	}
	w.EditorDirty = after != w.PreviewContent
	return cmd
}

func (w *WorkspaceModel) SavedEditorContent(content string) {
	w.PreviewLines = workspaceTextLines(content)
	w.Editor.SetValue(content)
	w.PreviewContent = content
	w.EditorDirty = false
	w.resetEditorHistory(content)
}

func (w *WorkspaceModel) SetTopTab(idx int) bool {
	if idx < 0 || idx >= len(workspaceTopTabs()) || idx == w.TopTab {
		return false
	}
	w.TopTab = idx
	return true
}

func (w *WorkspaceModel) StepTopTab(delta int) bool {
	count := len(workspaceTopTabs())
	if count == 0 {
		return false
	}
	next := (w.TopTab + delta + count) % count
	return w.SetTopTab(next)
}

func (w *WorkspaceModel) SetDockMode(mode string) bool {
	if mode == "" || mode == w.DockMode {
		return false
	}
	w.DockMode = mode
	if mode != workspaceDockFiles {
		w.EditorActive = false
		w.Editor.Blur()
	}
	w.rebuildSidebarList()
	return true
}

func (w *WorkspaceModel) FocusComposer() {
	w.FocusPane = 2
	w.ComposerFocused = true
	w.Composer.Focus()
}

func (w *WorkspaceModel) BlurComposer() {
	w.ComposerFocused = false
	w.Composer.Blur()
}

func (w *WorkspaceModel) UpdateComposer(msg tea.Msg, width int) tea.Cmd {
	if width > 12 {
		w.Composer.SetWidth(width)
	}
	var cmd tea.Cmd
	w.Composer, cmd = w.Composer.Update(msg)
	return cmd
}

func (w *WorkspaceModel) ComposerValue() string {
	return strings.TrimSpace(w.Composer.Value())
}

func (w *WorkspaceModel) ClearComposer() {
	w.Composer.SetValue("")
}

func (w *WorkspaceModel) StartSessionTurn() {
	w.SessionTurnBusy = true
	w.TerminalStream = ""
	w.TerminalStatus = "Waiting for controller output"
	w.refreshSessionViewport()
}

func (w *WorkspaceModel) FinishSessionTurn(status string) {
	w.SessionTurnBusy = false
	if strings.TrimSpace(status) != "" {
		w.TerminalStatus = status
	}
	w.refreshSessionViewport()
}

func (w *WorkspaceModel) AppendTerminalChunk(text string) {
	if text == "" {
		return
	}
	w.TerminalStream += text
	w.TerminalStatus = "Streaming response"
	w.refreshSessionViewport()
}

func (w *WorkspaceModel) AppendTerminalMilestone(label string) {
	if strings.TrimSpace(label) == "" {
		return
	}
	if w.TerminalStream != "" && !strings.HasSuffix(w.TerminalStream, "\n") {
		w.TerminalStream += "\n"
	}
	w.TerminalStream += "[tool] " + label + "\n"
	w.TerminalStatus = "Running tools"
	w.refreshSessionViewport()
}

func (w *WorkspaceModel) ActiveSessionID() string {
	if w.TerminalSessionID != "" {
		return w.TerminalSessionID
	}
	if ag := w.TerminalAgentRef(); ag != nil {
		return ag.SessionID
	}
	return ""
}

func (w *WorkspaceModel) SessionMatches(sessionID string) bool {
	if sessionID == "" {
		return false
	}
	return sessionID == w.ActiveSessionID()
}

func (w *WorkspaceModel) StepDockMode(delta int) bool {
	items := workspaceDockItems()
	if len(items) == 0 {
		return false
	}
	idx := 0
	for i, item := range items {
		if item.Mode == w.DockMode {
			idx = i
			break
		}
	}
	next := (idx + delta + len(items)) % len(items)
	return w.SetDockMode(items[next].Mode)
}

func (w *WorkspaceModel) CanUndoEditor() bool {
	return w.EditorActive && len(w.EditorHistory) > 1
}

func (w *WorkspaceModel) UndoPreviewEdit() bool {
	if !w.CanUndoEditor() {
		return false
	}
	w.EditorHistory = w.EditorHistory[:len(w.EditorHistory)-1]
	value := w.EditorHistory[len(w.EditorHistory)-1]
	w.Editor.SetValue(value)
	w.PreviewLines = workspaceTextLines(value)
	w.EditorDirty = value != w.PreviewContent
	return true
}

func (w *WorkspaceModel) resetEditorHistory(value string) {
	w.EditorHistory = []string{value}
}

func (w *WorkspaceModel) recordEditorHistory(value string) {
	if len(w.EditorHistory) > 0 && w.EditorHistory[len(w.EditorHistory)-1] == value {
		return
	}
	w.EditorHistory = append(w.EditorHistory, value)
	if len(w.EditorHistory) > 200 {
		w.EditorHistory = append([]string(nil), w.EditorHistory[len(w.EditorHistory)-200:]...)
	}
}

func (w *WorkspaceModel) PreviewPanelTitle() string {
	switch w.PreviewMode {
	case workspacePreviewFile:
		return "› File Preview"
	case workspacePreviewAgent:
		return "› Agent Transcript"
	default:
		return "› Workspace Terminal"
	}
}

func workspaceTopTabs() []string {
	return []string{"Overview", "Project", "System"}
}

func workspaceDockItems() []workspaceDockItem {
	return []workspaceDockItem{
		{Mode: workspaceDockFiles, Icon: "🗂", Label: "Files"},
		{Mode: workspaceDockCanvas, Icon: "🎨", Label: "Canvas"},
		{Mode: workspaceDockTasks, Icon: "✨", Label: "Tasks"},
		{Mode: workspaceDockMetrics, Icon: "📊", Label: "Metrics"},
		{Mode: workspaceDockTools, Icon: "🔌", Label: "Tools"},
	}
}

func workspaceRoleBadge(role string) string {
	switch role {
	case "user":
		return lipgloss.NewStyle().Foreground(Purple).Bold(true).Render("◉ you")
	default:
		return lipgloss.NewStyle().Foreground(Blue).Bold(true).Render("✦ codex")
	}
}

func workspaceTimestampLabel(ts string) string {
	if strings.TrimSpace(ts) == "" {
		return lipgloss.NewStyle().Foreground(Dim).Render("now")
	}
	for _, layout := range []string{time.RFC3339Nano, time.RFC3339, "2006-01-02T15:04:05"} {
		if t, err := time.Parse(layout, ts); err == nil {
			return lipgloss.NewStyle().Foreground(Dim).Render(t.Local().Format("3:04 PM"))
		}
	}
	return lipgloss.NewStyle().Foreground(Dim).Render(ts)
}

func workspaceMessageLines(role, content, ts string) []string {
	content = strings.TrimSpace(content)
	if content == "" {
		return nil
	}
	lines := strings.Split(content, "\n")
	out := make([]string, 0, len(lines))
	badge := workspaceTimestampLabel(ts) + "  " + workspaceRoleBadge(role)
	bodyStyle := lipgloss.NewStyle().Foreground(White)
	for idx, line := range lines {
		rendered := bodyStyle.Render(RenderMarkdown(line))
		if idx == 0 {
			out = append(out, badge+" "+rendered)
			continue
		}
		out = append(out, lipgloss.NewStyle().Foreground(SubText).Render("        ")+rendered)
	}
	return out
}

func workspaceConversationLines(messages []api.Message, limit int) []string {
	if len(messages) == 0 {
		return nil
	}
	lines := make([]string, 0, min(limit, len(messages)*2))
	start := 0
	if len(messages) > limit/2 {
		start = len(messages) - limit/2
	}
	for _, msg := range messages[start:] {
		switch msg.Type {
		case "tool_use":
			label := msg.ToolName
			if cmd, ok := msg.ToolInput["command"].(string); ok && cmd != "" {
				label += " · " + cmd
			}
			lines = append(lines, RenderToolBadge(label, ""))
			if output, ok := msg.ToolInput["output"].(string); ok && strings.TrimSpace(output) != "" {
				for _, line := range strings.Split(strings.TrimSpace(output), "\n") {
					lines = append(lines, lipgloss.NewStyle().Foreground(lipgloss.Color("#cfd6de")).Render("  "+line))
					if len(lines) >= limit {
						return lines[len(lines)-limit:]
					}
				}
			}
		default:
			for _, line := range workspaceMessageLines(msg.Role, msg.Content, msg.Timestamp) {
				lines = append(lines, line)
				if len(lines) >= limit {
					return lines[len(lines)-limit:]
				}
			}
		}
	}
	if len(lines) > limit {
		return lines[len(lines)-limit:]
	}
	return lines
}

func (w *WorkspaceModel) AppendLocalUserMessage(content string) {
	content = strings.TrimSpace(content)
	if content == "" {
		return
	}
	w.PendingUserMessages = append(w.PendingUserMessages, workspacePendingUserMessage{
		Content:   content,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	})
	w.refreshSessionViewport()
}

func (w *WorkspaceModel) ClearTerminalView() {
	w.TerminalCleared = true
	w.TerminalLines = nil
	w.TerminalStream = ""
	w.PendingUserMessages = nil
	w.TerminalStatus = "Transcript cleared"
	w.refreshSessionViewport()
}

func (w *WorkspaceModel) rebuildSidebarList() {
	items := make([]list.Item, 0)
	switch w.DockMode {
	case workspaceDockTasks:
		for idx, ag := range w.SubagentsForCurrent() {
			items = append(items, workspaceSidebarItem{
				title:       truncate(ag.Task, 36),
				description: truncate(miniAgentStatus(ag.Status)+"  "+coalesce(ag.Phase, "-"), 36),
				kind:        "task",
				sessionID:   ag.SessionID,
				index:       idx,
			})
		}
	default:
		for idx, item := range w.ExplorerItems() {
			visual := workspaceFileVisualFor(item.Label, item.IsDir, item.IsParent)
			desc := item.Path
			if item.IsParent {
				desc = "parent directory"
			}
			items = append(items, workspaceSidebarItem{
				title:       visual.Icon + " " + item.Label,
				description: truncate(desc, 36),
				kind:        "file",
				path:        item.Path,
				index:       idx,
			})
		}
	case workspaceDockMetrics:
		for idx, line := range []string{
			fmt.Sprintf("projects %d", safeStatsProjects(nil)),
			fmt.Sprintf("sessions %d", len(w.AgentsForCurrent())),
			fmt.Sprintf("tasks %d", len(w.SubagentsForCurrent())),
		} {
			items = append(items, workspaceSidebarItem{title: line, description: "workspace metrics", kind: "metric", index: idx})
		}
	case workspaceDockTools:
		for idx, line := range []string{"Install", "Sync", "Doctor", "Inspect"} {
			items = append(items, workspaceSidebarItem{title: line, description: "tool management", kind: "tool", index: idx})
		}
	}
	cmd := w.SidebarList.SetItems(items)
	_ = cmd
	switch w.DockMode {
	case workspaceDockTasks:
		w.SidebarList.Select(w.SelectedAgent)
	default:
		w.SidebarList.Select(w.SelectedEntry)
	}
}

func (w *WorkspaceModel) refreshSessionViewport() {
	var lines []string
	lines = append(lines, w.TerminalLines...)
	if len(w.PendingUserMessages) > 0 {
		if len(lines) > 0 {
			lines = append(lines, "")
		}
		for _, message := range w.PendingUserMessages {
			lines = append(lines, workspaceMessageLines("user", message.Content, message.Timestamp)...)
		}
	}
	hasStream := strings.TrimSpace(w.TerminalStream) != ""
	if hasStream {
		if len(lines) > 0 {
			lines = append(lines, "")
		}
		streamLines := strings.Split(strings.TrimRight(w.TerminalStream, "\n"), "\n")
		firstText := true
		for _, line := range streamLines {
			if strings.HasPrefix(line, "[tool] ") {
				lines = append(lines, RenderToolBadge(strings.TrimPrefix(line, "[tool] "), ""))
				continue
			}
			prefix := "  "
			if firstText {
				if w.SessionTurnBusy {
					prefix = workspaceRoleBadge("assistant") + " " + workspaceLiveStatus(w, true) + " "
				} else {
					prefix = workspaceRoleBadge("assistant") + " "
				}
				firstText = false
			}
			lines = append(lines, lipgloss.NewStyle().Foreground(White).Render(prefix+line))
		}
	} else if w.SessionTurnBusy {
		if len(lines) > 0 {
			lines = append(lines, "")
		}
		lines = append(lines, workspaceRoleBadge("assistant")+" "+workspaceLiveStatus(w, false))
	}
	if len(lines) == 0 {
		lines = append(lines, "No session output")
	}
	w.SessionViewport.SetContent(strings.Join(lines, "\n"))
	w.SessionViewport.GotoBottom()
}

func workspaceLiveStatus(w *WorkspaceModel, hasStream bool) string {
	status := "thinking..."
	switch {
	case hasStream:
		status = "responding..."
	case strings.TrimSpace(w.TerminalStatus) != "":
		status = strings.ToLower(strings.TrimSpace(w.TerminalStatus))
	}
	return lipgloss.NewStyle().Foreground(Cyan).Bold(true).Render(w.ComposerSpinner.View() + " " + status)
}

func workspaceTextLines(content string) []string {
	lines := strings.Split(strings.ReplaceAll(content, "\t", "  "), "\n")
	if len(lines) == 0 {
		return []string{""}
	}
	return lines
}

func RenderWorkspace(m *WorkspaceModel, stats *api.StatsResponse, health *api.HealthResponse, width, height int) (out string) {
	defer func() {
		if r := recover(); r != nil {
			out = renderWorkspacePanic(width, height, r)
		}
	}()
	return renderWorkspaceSafe(m, stats, health, width, height)
}

func renderWorkspaceSafe(m *WorkspaceModel, stats *api.StatsResponse, health *api.HealthResponse, width, height int) string {
	ly := computeWorkspaceLayout(width, height)
	leftRail := renderWorkspaceDock(m, ly.Dock.W, ly.Dock.H, m.FocusPane == 1)
	sidebar := renderWorkspaceSidebarSurface(m, ly)
	main := renderWorkspaceSessionSurface(m, stats, health, ly)
	return lipgloss.NewStyle().
		Background(lipgloss.Color("#03060b")).
		Render(lipgloss.JoinHorizontal(lipgloss.Top, leftRail, sidebar, main))
}

func computeWorkspaceLayout(width, height int) workspaceLayout {
	dockW := 5
	bodyH := height
	if bodyH < 8 {
		bodyH = 8
	}

	sidebarW := Clamp(22, width/5, 28)
	mainW := width - dockW - sidebarW
	if mainW < 72 {
		mainW = 72
		sidebarW = max(20, width-dockW-mainW)
	}
	return workspaceLayout{
		Dock:    workspaceRect{X: 0, Y: 0, W: dockW, H: bodyH},
		Sidebar: workspaceRect{X: dockW, Y: 0, W: sidebarW, H: bodyH},
		Main:    workspaceRect{X: dockW + sidebarW, Y: 0, W: mainW, H: bodyH},
	}
}

func renderWorkspacePanic(width, height int, reason any) string {
	lines := []string{
		Class("badge-rose").Render(" workspace-ui error "),
		"",
		Class("body").Render("The experimental workspace screen hit a render failure and was contained."),
		Class("dim").Render(fmt.Sprintf("reason: %v", reason)),
	}
	return clampLines(lines, Clamp(6, height, 12))
}

func renderWorkspacePanelBox(title, body string, w, h int, focused bool) string {
	borderCol := BorderColor
	if focused {
		borderCol = GlowBorder
	}
	return lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(borderCol).
		Padding(0, 1).
		Width(w).
		Height(h).
		Render(lipgloss.NewStyle().Bold(true).Foreground(White).Render(title) + "\n" + body)
}

func renderWorkspaceSummary(m *WorkspaceModel, stats *api.StatsResponse, health *api.HealthResponse, w, h int) string {
	cur := m.Current()
	var lines []string
	lines = append(lines, Class("dim").Render("High-level context"), "")
	switch m.TopTab {
	case 1:
		if cur == nil {
			lines = append(lines, Class("dim").Render("Select a workspace to load project details."))
			break
		}
		lines = append(lines,
			Class("body").Render("path    "+truncate(cur.Path, w-8)),
			Class("body").Render("model   "+coalesce(cur.Config.Model, "default")),
			Class("body").Render(fmt.Sprintf("sessions %d attached", len(m.AgentsForCurrent()))),
		)
		if cur.Description != "" {
			lines = append(lines, Class("dim").Render(truncate(cur.Description, w-2)))
		}
	case 2:
		lines = append(lines,
			Class("body").Render("health  "+workspaceHealthStatus(health)),
			Class("body").Render(fmt.Sprintf("agents  %d live / %d working", safeStatsTotal(stats), safeStatsWorking(stats))),
			Class("body").Render(fmt.Sprintf("uptime  %s", workspaceUptime(stats, health))),
			Class("dim").Render("metrics dock gives the denser panel view"),
		)
	default:
		if cur == nil {
			lines = append(lines, Class("dim").Render("Select a workspace to get started."))
			break
		}
		lines = append(lines,
			Class("body").Render("workspace  "+cur.Name),
			Class("body").Render(fmt.Sprintf("parallel   %d", max(1, cur.Config.Parallelism))),
			Class("body").Render(fmt.Sprintf("tasks      %d background", len(m.SubagentsForCurrent()))),
			Class("dim").Render("One resumable project session stays primary; subagents only appear when the session needs them."),
		)
	}
	return clampLines(lines, h)
}

func renderWorkspaceDock(m *WorkspaceModel, width, height int, focused bool) string {
	items := workspaceDockItems()
	lines := []string{"", ""}
	for _, item := range items {
		color := workspaceDockColor(item.Mode)
		icon := lipgloss.NewStyle().Foreground(lipgloss.Color("#586472")).Render(item.Icon)
		if item.Mode == m.DockMode {
			icon = lipgloss.NewStyle().Foreground(color).Bold(true).Render(item.Icon)
		}
		prefix := "  "
		if item.Mode == m.DockMode {
			prefix = "▎ "
		}
		lines = append(lines, lipgloss.NewStyle().Width(width).Render(prefix+icon))
		lines = append(lines, "")
	}
	body := clampLines(lines, height)
	return lipgloss.NewStyle().
		Width(width).
		Height(height).
		Background(lipgloss.Color("#02050a")).
		Foreground(lipgloss.Color("#e8edf3")).
		BorderRight(true).
		BorderForeground(lipgloss.Color("#0e2a3b")).
		Padding(0, 0).
		Render(body)
}

func workspaceDockColor(mode string) lipgloss.Color {
	switch mode {
	case workspaceDockTasks:
		return lipgloss.Color("#cb7cff")
	case workspaceDockMetrics:
		return lipgloss.Color("#ffd454")
	case workspaceDockTools:
		return lipgloss.Color("#36f2ff")
	default:
		return lipgloss.Color("#78a8ff")
	}
}

func renderWorkspaceSidebarSurface(m *WorkspaceModel, ly workspaceLayout) string {
	title := "EXPLORER"
	switch m.DockMode {
	case workspaceDockTasks:
		title = "TASKS"
	case workspaceDockMetrics:
		title = "METRICS"
	case workspaceDockTools:
		title = "TOOLS"
	}
	return renderWorkspaceSidebarShell(title, renderWorkspaceSidebarBody(m, ly.Sidebar.W-4, ly.Sidebar.H-4), ly.Sidebar.W, ly.Sidebar.H, m.FocusPane == 1)
}

func renderWorkspaceSidebarBody(m *WorkspaceModel, w, h int) string {
	switch m.DockMode {
	case workspaceDockTasks:
		return renderWorkspaceAgents(m, w, h)
	case workspaceDockMetrics:
		return renderWorkspaceMetricSidebar(m, w, h)
	case workspaceDockTools:
		return renderWorkspaceToolsSidebar(w, h)
	default:
		return renderWorkspaceExplorer(m, w, h)
	}
}

func renderWorkspaceSessionSurface(m *WorkspaceModel, stats *api.StatsResponse, health *api.HealthResponse, ly workspaceLayout) string {
	mainInnerW := max(12, ly.Main.W-4)
	composerHeight := 4
	viewportHeight := max(10, ly.Main.H-composerHeight-4)
	m.SessionViewport.Width = mainInnerW
	m.SessionViewport.Height = viewportHeight
	m.refreshSessionViewport()
	m.Composer.SetWidth(max(12, mainInnerW-2))
	m.Composer.SetHeight(1)
	body := renderWorkspaceTranscriptMeta(m, health, mainInnerW) + "\n\n" + m.SessionViewport.View() + "\n\n" + renderWorkspaceComposer(m, mainInnerW)
	return renderWorkspaceMainShell(renderWorkspaceSessionTitle(m, stats, health, ly.Main.W-4), body, ly.Main.W, ly.Main.H, m.FocusPane == 2)
}

func renderWorkspaceSessionTitle(m *WorkspaceModel, stats *api.StatsResponse, health *api.HealthResponse, w int) string {
	cur := m.Current()
	project := "No Project"
	if cur != nil {
		project = cur.Name
	}
	stateLabel := "live"
	stateColor := Cyan
	if m.SessionTurnBusy {
		stateLabel = "thinking"
		stateColor = lipgloss.Color("#9be7ff")
	} else if m.FocusPane != 2 {
		stateLabel = "browse"
		stateColor = lipgloss.Color("#7d8b9a")
	}
	left := lipgloss.NewStyle().Foreground(White).Bold(true).Render(project + " ▾")
	status := lipgloss.NewStyle().Foreground(stateColor).Bold(true).Render("● " + stateLabel)
	right := lipgloss.NewStyle().Foreground(lipgloss.Color("#66727f")).Render(fmt.Sprintf("%d events", len(m.TerminalLines)))
	gap := max(1, w-lipgloss.Width(left)-lipgloss.Width(status)-lipgloss.Width(right)-4)
	return truncate(left+"  "+status+strings.Repeat(" ", gap)+"  "+right, w)
}

func renderWorkspaceSidebarShell(title, body string, w, h int, focused bool) string {
	borderCol := BorderColor
	if focused {
		borderCol = GlowBorder
	}
	header := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#b6f4ff")).
		Bold(true).
		Render(title)
	divider := lipgloss.NewStyle().Foreground(lipgloss.Color("#113246")).Render(strings.Repeat("─", max(6, w-4)))
	return lipgloss.NewStyle().
		Width(w).
		Height(h).
		Background(lipgloss.Color("#060a10")).
		BorderRight(true).
		BorderForeground(borderCol).
		Padding(1, 1, 0, 1).
		Render(header + "\n" + divider + "\n" + clampLines(strings.Split(body, "\n"), max(1, h-4)))
}

func renderWorkspaceMainShell(title, body string, w, h int, focused bool) string {
	headerStyle := lipgloss.NewStyle().
		Foreground(White).
		Bold(true).
		Padding(0, 0)
	if focused {
		headerStyle = headerStyle.Foreground(lipgloss.Color("#dffcff"))
	}
	header := headerStyle.Render(title)
	divider := lipgloss.NewStyle().Foreground(lipgloss.Color("#113246")).Render(strings.Repeat("─", max(8, w-4)))
	return lipgloss.NewStyle().
		Width(w).
		Height(h).
		Background(lipgloss.Color("#060a10")).
		Foreground(White).
		Padding(1, 1, 0, 2).
		Render(header + "\n" + divider + "\n" + clampLines(strings.Split(body, "\n"), max(1, h-4)))
}

func renderWorkspaceComposer(m *WorkspaceModel, w int) string {
	borderCol := lipgloss.Color("#13293a")
	if m.ComposerFocused {
		borderCol = GlowBorder
	}
	statusText := "controller ready"
	if m.SessionTurnBusy {
		statusText = "agent responding"
	}
	hint := lipgloss.NewStyle().
		Foreground(lipgloss.Color("#52606d")).
		Render("return send   tab move   " + statusText)
	input := lipgloss.NewStyle().
		BorderTop(true).
		BorderForeground(borderCol).
		Padding(0, 0, 0, 1).
		Render(m.Composer.View())
	return lipgloss.NewStyle().
		Width(w).
		Render(hint + "\n" + input)
}

func renderWorkspaceTranscriptMeta(m *WorkspaceModel, health *api.HealthResponse, w int) string {
	path := ""
	if cur := m.Current(); cur != nil {
		path = cur.Path
	}
	left := lipgloss.NewStyle().Foreground(lipgloss.Color("#7fe7ff")).Bold(true).Render("terminal")
	center := lipgloss.NewStyle().Foreground(lipgloss.Color("#5d6975")).Render(truncate(path, max(10, w/2)))
	right := lipgloss.NewStyle().Foreground(lipgloss.Color("#5d6975")).Render(workspaceHealthStatus(health))
	gap := max(1, w-lipgloss.Width(left)-lipgloss.Width(center)-lipgloss.Width(right)-4)
	return left + "  " + center + strings.Repeat(" ", gap) + right
}

func renderWorkspaceToolsDock(w, h int) string {
	lines := []string{
		Class("badge-cyan").Render(" tools "),
		"",
		Class("body").Render("Open the full tool manager to install, sync, inspect, and doctor local CLI integrations."),
		"",
		Class("body").Render("Current contract: install the tool runtime, import external skills from `external_skills/`, and expose the command on PATH for spawned Codex sessions."),
		"",
		Class("dim").Render("Press Enter to open the full manager screen."),
		Class("dim").Render("Use it for o11y-cli and future local tool integrations."),
	}
	return renderWorkspacePanelBox("⌘ Tools", clampLines(lines, max(6, h-2)), w, h, false)
}

func renderWorkspaceMetricSidebar(m *WorkspaceModel, w, h int) string {
	lines := []string{
		Class("dim").Render("metrics workbench"),
		"",
		Class("body").Render("Fleet"),
		Class("body").Render("Health"),
		Class("body").Render("Workspace"),
		Class("body").Render("Activity"),
		"",
		Class("dim").Render("Use the main pane for the denser grid."),
	}
	return clampLines(lines, h)
}

func renderWorkspaceToolsSidebar(w, h int) string {
	lines := []string{
		Class("dim").Render("tool actions"),
		"",
		Class("body").Render("Install"),
		Class("body").Render("Sync"),
		Class("body").Render("Doctor"),
		Class("body").Render("Inspect"),
		"",
		Class("dim").Render("Enter opens the full manager."),
	}
	return clampLines(lines, h)
}

func renderWorkspaceExplorer(m *WorkspaceModel, w, h int) string {
	cur := m.Current()
	if cur == nil {
		return Class("dim").Render("No files to show")
	}
	dirLabel := "/"
	if m.CurrentDir != "" {
		dirLabel = "/" + m.CurrentDir
	}
	lines := []string{
		lipgloss.NewStyle().Foreground(lipgloss.Color("#6d7b88")).Render(truncate(dirLabel, w)),
		"",
	}
	items := m.ExplorerItems()
	if len(items) == 0 {
		lines = append(lines, Class("dim").Render("loading..."))
	} else {
		for i, item := range items {
			if len(lines) >= h-2 {
				break
			}
			prefix := "  "
			style := lipgloss.NewStyle().Foreground(SubText)
			if i == m.SelectedEntry {
				prefix = "▸ "
				style = lipgloss.NewStyle().Foreground(lipgloss.Color("#e8fbff")).Bold(true)
			}
			visual := workspaceFileVisualFor(item.Label, item.IsDir, item.IsParent)
			icon := lipgloss.NewStyle().Foreground(visual.Color).Render(visual.Icon)
			lines = append(lines, style.Render(prefix)+icon+" "+style.Render(truncate(item.Label, max(8, w-5))))
		}
	}
	lines = append(lines, "", lipgloss.NewStyle().Foreground(lipgloss.Color("#5c6873")).Render("enter open"))
	return clampLines(lines, h)
}

func workspaceFileToolbarButtons(m *WorkspaceModel) []workspaceToolbarButton {
	editorLabel := "✎ Edit"
	if m.EditorActive {
		editorLabel = "✓ Done"
	}
	return []workspaceToolbarButton{
		{Action: "toggle-editor", Label: editorLabel, Disabled: !m.CanEditPreviewFile() && !m.EditorActive},
		{Action: "undo", Label: "↺ Undo", Disabled: !m.CanUndoEditor()},
		{Action: "save", Label: "⇪ Save", Disabled: !m.EditorActive || !m.EditorDirty || m.PreviewPath == ""},
	}
}

func renderWorkspaceFileToolbar(m *WorkspaceModel, w int) string {
	parts := make([]string, 0, 3)
	for _, button := range workspaceFileToolbarButtons(m) {
		style := lipgloss.NewStyle().
			Padding(0, 1).
			Border(lipgloss.RoundedBorder()).
			BorderForeground(BorderColor).
			Foreground(SubText)
		if button.Disabled {
			style = style.BorderForeground(Muted).Foreground(Dim)
		} else {
			style = style.BorderForeground(GlowBorder).Foreground(Cyan)
		}
		parts = append(parts, style.Render(button.Label))
	}
	return truncate(strings.Join(parts, " "), w)
}

func renderWorkspaceEditorMain(m *WorkspaceModel, w, h int) string {
	tabLine := renderWorkspaceEditorTabs(m, w)
	lines := []string{
		tabLine,
		"",
		renderWorkspaceFileToolbar(m, w),
		"",
	}
	bodyH := h - len(lines)
	if bodyH < 1 {
		bodyH = 1
	}
	if m.EditorActive {
		if w > 12 {
			m.Editor.SetWidth(w)
		}
		if bodyH > 4 {
			m.Editor.SetHeight(bodyH)
		}
		lines = append(lines, splitLines(m.Editor.View())...)
	} else if m.PreviewMode == workspacePreviewFile && len(m.PreviewLines) > 0 {
		lines = append(lines, m.PreviewLines...)
	} else {
		lines = append(lines,
			Class("dim").Render("Preview a text file to edit it here."),
			Class("dim").Render("The top pane is the editor surface. The bottom workbench holds terminal and panels."),
		)
	}
	return clampLines(lines, h)
}

func renderWorkspaceEditorTabs(m *WorkspaceModel, w int) string {
	left := Pill(" explorer ", Cyan, BadgeCyanBg)
	activeName := "untitled"
	if m.PreviewPath != "" {
		activeName = filepath.Base(m.PreviewPath) + dirtySuffix(m.EditorDirty)
	}
	active := lipgloss.NewStyle().
		Padding(0, 1).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(GlowBorder).
		Foreground(White).
		Bold(true).
		Render(" " + activeName + " ")
	right := Class("dim").Render(truncate(coalesce(m.PreviewSubtitle, "preview"), max(12, w-lipgloss.Width(left)-lipgloss.Width(active)-4)))
	return truncate(left+"  "+active+"  "+right, w)
}

func renderWorkspaceTerminalPanel(m *WorkspaceModel, w, h int) string {
	lines := []string{}
	if title := coalesce(m.TerminalTitle, "Controller Lane"); title != "" {
		lines = append(lines, lipgloss.NewStyle().Foreground(lipgloss.Color("#ffffff")).Bold(true).Render(title))
	}
	if subtitle := coalesce(m.TerminalSubtitle, "controller-first shell"); subtitle != "" {
		lines = append(lines, lipgloss.NewStyle().Foreground(lipgloss.Color("#8e98a3")).Render(subtitle), "")
	}
	if len(m.TerminalLines) > 0 {
		lines = append(lines, m.TerminalLines...)
	} else {
		lines = append(lines,
			Class("dim").Render("> no controller transcript loaded yet"),
			Class("dim").Render("> dispatch a task or open an active project controller"),
		)
	}
	lines = append(lines, "", lipgloss.NewStyle().Foreground(lipgloss.Color("#8e98a3")).Render(coalesce(m.TerminalStatus, "Waiting for terminal activity")))
	return clampLines(lines, h)
}

func renderWorkspaceAgents(m *WorkspaceModel, w, h int) string {
	agents := m.SubagentsForCurrent()
	var lines []string
	if len(agents) == 0 {
		lines = append(lines, Class("dim").Render("No active tasks"), "", Class("dim").Render("The main project session is running in the terminal lane. Subagents only appear here when that session launches them."))
		return clampLines(lines, h)
	}

	lines = append(lines, Class("dim").Render("click or j/k to inspect subagent output"), "")
	for i, ag := range agents {
		if len(lines) >= h-2 {
			break
		}
		prefix := "  "
		style := lipgloss.NewStyle().Foreground(SubText)
		if i == m.SelectedAgent {
			prefix = "▸ "
			style = lipgloss.NewStyle().Foreground(White).Bold(true)
		}
		status := miniAgentStatus(ag.Status)
		lines = append(lines, style.Render(prefix+status+" "+truncate(ag.Task, w-8)))
	}
	lines = append(lines, "", Class("dim").Render("Enter/click to load task transcript"))
	return clampLines(lines, h)
}

func renderWorkspaceAgentMain(m *WorkspaceModel, w, h int) string {
	lines := []string{
		Class("dim").Render("Selected task transcript"),
		"",
	}
	if ag := m.SelectedAgentRef(); ag != nil {
		lines = append(lines,
			lipgloss.NewStyle().Foreground(White).Bold(true).Render(truncate(ag.Task, w-2)),
			StatusPill(ag.Status)+"  "+Class("dim").Render(truncate(ag.SessionID, 18)),
			Class("body").Render("phase  "+coalesce(ag.Phase, "-")+"   turns  "+fmt.Sprintf("%d", ag.TurnCount)),
			"",
		)
	}
	if m.PreviewMode == workspacePreviewAgent && len(m.PreviewLines) > 0 {
		lines = append(lines, m.PreviewLines...)
	} else {
		lines = append(lines,
			Class("dim").Render("Background tasks are optional. When the main session spawns subagents, their output appears here."),
			Class("dim").Render("The bottom terminal remains the primary project conversation lane."),
		)
	}
	return clampLines(lines, h)
}

func renderWorkspaceMetricsDock(m *WorkspaceModel, stats *api.StatsResponse, health *api.HealthResponse, w, h int) string {
	lines := []string{
		Class("body").Render(fmt.Sprintf("projects   %d", safeStatsProjects(stats))),
		Class("body").Render(fmt.Sprintf("agents     %d", safeStatsTotal(stats))),
		Class("body").Render(fmt.Sprintf("working    %d", safeStatsWorking(stats))),
		Class("body").Render(fmt.Sprintf("idle       %d", safeStatsIdle(stats))),
		"",
		Class("body").Render("health     " + workspaceHealthStatus(health)),
		Class("body").Render(fmt.Sprintf("backend    %s", workspaceUptime(stats, health))),
		Class("body").Render(fmt.Sprintf("tasks      %d", len(m.SubagentsForCurrent()))),
	}
	return clampLines(lines, h)
}

func workspaceSessionState(m *WorkspaceModel) string {
	ag := m.TerminalAgentRef()
	if ag == nil {
		return "idle"
	}
	if ag.IsController {
		return "primary"
	}
	return coalesce(ag.Status, "active")
}

func renderWorkspaceMetricBody(lines []string, h int) string {
	rendered := make([]string, 0, len(lines))
	for _, line := range lines {
		rendered = append(rendered, Class("body").Render(line))
	}
	return clampLines(rendered, h)
}

func workspaceProjectActivity(m *WorkspaceModel) []string {
	lines := []string{}
	for i, p := range m.Projects {
		if i >= 4 {
			break
		}
		count := 0
		for _, ag := range m.Agents {
			if ag.ProjectName == p.Name {
				count++
			}
		}
		lines = append(lines, fmt.Sprintf("%-12s %2d agents", truncate(p.Name, 12), count))
	}
	if len(lines) == 0 {
		lines = append(lines, "No projects loaded")
	}
	return lines
}

func workspaceEditorState(m *WorkspaceModel) string {
	if m.EditorActive {
		if m.EditorDirty {
			return "editing · unsaved"
		}
		return "editing"
	}
	if m.EditorDirty {
		return "preview · unsaved"
	}
	return "preview"
}

func workspaceHealthStatus(health *api.HealthResponse) string {
	if health == nil || health.Status == "" {
		return "unknown"
	}
	return health.Status
}

func safeStatsProjects(stats *api.StatsResponse) int {
	if stats == nil {
		return 0
	}
	return stats.TotalProjects
}

func safeStatsTotal(stats *api.StatsResponse) int {
	if stats == nil {
		return 0
	}
	return stats.TotalAgents
}

func safeStatsWorking(stats *api.StatsResponse) int {
	if stats == nil {
		return 0
	}
	return stats.WorkingAgents
}

func safeStatsIdle(stats *api.StatsResponse) int {
	if stats == nil {
		return 0
	}
	return stats.IdleAgents
}

func safeHealthWS(health *api.HealthResponse) int {
	if health == nil {
		return 0
	}
	return health.WSConnections
}

func workspaceUptime(stats *api.StatsResponse, health *api.HealthResponse) string {
	switch {
	case health != nil && health.Uptime > 0:
		return fmt.Sprintf("%.1fh", health.Uptime)
	case stats != nil && stats.UptimeSeconds > 0:
		return fmt.Sprintf("%.1fh", stats.UptimeSeconds/3600)
	default:
		return "-"
	}
}

func dirtySuffix(dirty bool) string {
	if dirty {
		return " • unsaved"
	}
	return ""
}

func stripAnsi(s string) string {
	var b strings.Builder
	skip := false
	for i := 0; i < len(s); i++ {
		ch := s[i]
		if ch == 0x1b {
			skip = true
			continue
		}
		if skip {
			if (ch >= 'A' && ch <= 'Z') || (ch >= 'a' && ch <= 'z') {
				skip = false
			}
			continue
		}
		b.WriteByte(ch)
	}
	return b.String()
}

func miniAgentStatus(status string) string {
	switch status {
	case "working", "active":
		return lipgloss.NewStyle().Foreground(Amber).Bold(true).Render("active")
	case "idle":
		return lipgloss.NewStyle().Foreground(Cyan).Bold(true).Render("idle")
	case "done":
		return lipgloss.NewStyle().Foreground(Green).Bold(true).Render("done")
	default:
		return lipgloss.NewStyle().Foreground(SubText).Render(status)
	}
}

func clampLines(lines []string, h int) string {
	if h < 1 {
		h = 1
	}
	for len(lines) < h {
		lines = append(lines, "")
	}
	if len(lines) > h {
		lines = lines[:h]
	}
	return strings.Join(lines, "\n")
}
