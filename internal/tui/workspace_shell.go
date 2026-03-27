package tui

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/list"
	"github.com/scoady/codexctl/internal/api"
)

type workspaceShellExplorerItem struct {
	Label    string
	Path     string
	Entry    api.FileEntry
	Icon     string
	IsDir    bool
	IsParent bool
}

func (w *WorkspaceShellModel) ActiveSessionID() string {
	if strings.TrimSpace(w.TerminalSessionID) != "" {
		return w.TerminalSessionID
	}
	if ag := w.TerminalAgentRef(); ag != nil {
		return ag.SessionID
	}
	return ""
}

func (w *WorkspaceShellModel) SessionMatches(sessionID string) bool {
	return strings.TrimSpace(sessionID) != "" && sessionID == w.ActiveSessionID()
}

func (w *WorkspaceShellModel) AgentsForCurrent() []api.Agent {
	if w.CurrentProject == "" {
		return nil
	}
	out := make([]api.Agent, 0)
	for _, ag := range w.Agents {
		if ag.ProjectName == w.CurrentProject {
			out = append(out, ag)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].StartedAt > out[j].StartedAt })
	return out
}

func (w *WorkspaceShellModel) TerminalAgentRef() *api.Agent {
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

func (w *WorkspaceShellModel) SubagentsForCurrent() []api.Agent {
	out := make([]api.Agent, 0)
	for _, ag := range w.AgentsForCurrent() {
		if !ag.IsController {
			out = append(out, ag)
		}
	}
	return out
}

func (w *WorkspaceShellModel) SelectedAgentRef() *api.Agent {
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

func (w *WorkspaceShellModel) SetSelectedAgentIndex(idx int) bool {
	agents := w.SubagentsForCurrent()
	if idx < 0 || idx >= len(agents) || idx == w.SelectedAgent {
		return false
	}
	w.SelectedAgent = idx
	w.rebuildSidebarList()
	return true
}

func (w *WorkspaceShellModel) SetEntries(project, dir string, entries []api.FileEntry) {
	if project != w.CurrentProject || dir != w.CurrentDir {
		return
	}
	w.LoadedProject = project
	w.LoadedDir = dir
	w.Entries = append([]api.FileEntry(nil), entries...)
	sort.Slice(w.Entries, func(i, j int) bool {
		left := workspaceShellEntryRank(w.Entries[i].Type)
		right := workspaceShellEntryRank(w.Entries[j].Type)
		if left != right {
			return left < right
		}
		return strings.ToLower(w.Entries[i].Name) < strings.ToLower(w.Entries[j].Name)
	})
	w.SelectedEntry = 0
	w.LastSync = time.Now()
	w.rebuildSidebarList()
}

func (w *WorkspaceShellModel) SetGitStatus(project string, status map[string]string) {
	if project != w.CurrentProject {
		return
	}
	w.Git.SetStatus(status)
	w.rebuildSidebarList()
}

func (w *WorkspaceShellModel) SetGitBranch(project, branch, remote, provider string) {
	if project != w.CurrentProject {
		return
	}
	w.Git.SetBranch(branch, remote, provider)
}

func (w *WorkspaceShellModel) SetDockMode(mode string) bool {
	if mode == "" || mode == w.DockMode {
		return false
	}
	w.DockMode = mode
	if mode == workspaceDockCanvas {
		w.BlurComposer()
	} else if w.FocusPane == 2 {
		w.FocusComposer()
	}
	w.rebuildSidebarList()
	return true
}

func (w *WorkspaceShellModel) StepDockMode(delta int) bool {
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

func (w *WorkspaceShellModel) SetExplorerIndex(idx int) bool {
	items := w.explorerItems()
	if idx < 0 || idx >= len(items) || idx == w.SelectedEntry {
		return false
	}
	w.SelectedEntry = idx
	w.rebuildSidebarList()
	return true
}

func (w *WorkspaceShellModel) OpenExplorerSelection() (loadDir, previewFile string) {
	items := w.explorerItems()
	if len(items) == 0 || w.SelectedEntry < 0 || w.SelectedEntry >= len(items) {
		return "", ""
	}
	item := items[w.SelectedEntry]
	if item.IsDir {
		w.CurrentDir = item.Path
		w.LoadedProject = ""
		w.LoadedDir = ""
		w.Entries = nil
		w.SelectedEntry = 0
		w.rebuildSidebarList()
		return item.Path, ""
	}
	w.StartOpenFileTab(item.Path)
	return "", item.Path
}

func (w *WorkspaceShellModel) ensureProjectTab(name string) {
	name = strings.TrimSpace(name)
	if name == "" {
		return
	}
	for _, tab := range w.OpenProjectTabs {
		if tab == name {
			return
		}
	}
	w.OpenProjectTabs = append(w.OpenProjectTabs, name)
}

func (w *WorkspaceShellModel) pruneProjectTabs() {
	if len(w.OpenProjectTabs) == 0 {
		return
	}
	valid := map[string]struct{}{}
	for _, p := range w.Projects {
		valid[p.Name] = struct{}{}
	}
	kept := make([]string, 0, len(w.OpenProjectTabs))
	for _, tab := range w.OpenProjectTabs {
		if _, ok := valid[tab]; ok {
			kept = append(kept, tab)
		}
	}
	w.OpenProjectTabs = kept
}

func (w *WorkspaceShellModel) rebuildSidebarList() {
	var items []list.Item
	switch w.DockMode {
	case workspaceDockFiles:
		w.SidebarList.SetDelegate(workspaceShellDelegate{compact: true})
		for _, item := range w.explorerItems() {
			accent, badge := w.explorerAccentAndBadge(item)
			desc := ""
			items = append(items, workspaceShellListItem{
				title:  item.Icon + " " + item.Label,
				desc:   desc,
				badge:  badge,
				accent: accent,
			})
		}
		if w.SelectedEntry >= len(items) {
			w.SelectedEntry = max(0, len(items)-1)
		}
		w.SidebarList.SetItems(items)
		if len(items) > 0 {
			w.SidebarList.Select(w.SelectedEntry)
		}
	case workspaceDockTasks:
		w.SidebarList.SetDelegate(workspaceShellDelegate{})
		for _, agent := range w.SubagentsForCurrent() {
			items = append(items, workspaceShellListItem{
				title:     workspaceShellAgentIcon(agent) + " " + truncate(coalesce(agent.Task, "Untitled task"), 42),
				desc:      truncate(agent.Status+"  "+coalesce(agent.Phase, "idle"), 42),
				badge:     truncate(agent.ElapsedString(), 8),
				accent:    workspaceShellAgentColor(agent),
				sessionID: agent.SessionID,
			})
		}
		if w.SelectedAgent >= len(items) {
			w.SelectedAgent = max(0, len(items)-1)
		}
		w.SidebarList.SetItems(items)
		if len(items) > 0 {
			w.SidebarList.Select(w.SelectedAgent)
		}
	case workspaceDockCanvas:
		w.SidebarList.SetDelegate(workspaceShellDelegate{compact: true})
		for _, widget := range w.CanvasWidgetsForActiveTab() {
			badge := strings.TrimSpace(widget.Kind)
			if badge == "" {
				badge = strings.TrimSpace(widget.TemplateID)
			}
			items = append(items, workspaceShellListItem{
				title:  workspaceShellCanvasIcon(widget) + " " + truncate(coalesce(widget.Title, widget.ID), 40),
				desc:   truncate(workspaceShellCanvasWidgetDesc(widget), 42),
				badge:  truncate(badge, 10),
				accent: workspaceShellCanvasColor(widget),
			})
		}
		if w.SelectedCanvasWidget >= len(items) {
			w.SelectedCanvasWidget = max(0, len(items)-1)
		}
		w.SidebarList.SetItems(items)
		if len(items) > 0 {
			w.SidebarList.Select(w.SelectedCanvasWidget)
		}
	default:
		w.SidebarList.SetItems(nil)
	}
}

func (w *WorkspaceShellModel) syncProjectPicker() {
	items := make([]list.Item, 0, len(w.Projects)+1)
	items = append(items, workspaceShellListItem{
		title:  "+ Create project",
		desc:   "Open the create project dialog",
		accent: Green,
		action: "create",
	})
	selected := 1
	for i, project := range w.Projects {
		badge := ""
		if len(project.ActiveSessionIDs) > 0 {
			badge = fmt.Sprintf("%d", len(project.ActiveSessionIDs))
		}
		items = append(items, workspaceShellListItem{
			title:  project.Name,
			desc:   truncate(project.Path, 44),
			badge:  badge,
			accent: Cyan,
			action: "project",
		})
		if project.Name == w.CurrentProject {
			selected = i + 1
		}
	}
	w.ProjectPicker.SetItems(items)
	if len(items) > 0 {
		w.ProjectPicker.Select(selected)
	}
}

func (w *WorkspaceShellModel) OpenProjectPicker() {
	w.ProjectPickerOpen = true
	w.FocusPane = 2
}

func (w *WorkspaceShellModel) CloseProjectPicker() {
	w.ProjectPickerOpen = false
}

func (w *WorkspaceShellModel) MoveProjectPicker(delta int) {
	if !w.ProjectPickerOpen {
		return
	}
	if delta > 0 {
		w.ProjectPicker.CursorDown()
	}
	if delta < 0 {
		w.ProjectPicker.CursorUp()
	}
}

func (w *WorkspaceShellModel) SelectedProjectPickerName() string {
	item, ok := w.ProjectPicker.SelectedItem().(workspaceShellListItem)
	if !ok {
		return ""
	}
	if item.action != "project" {
		return ""
	}
	return item.title
}

func (w *WorkspaceShellModel) SelectedProjectPickerAction() string {
	item, ok := w.ProjectPicker.SelectedItem().(workspaceShellListItem)
	if !ok {
		return ""
	}
	return item.action
}

func (w *WorkspaceShellModel) resetPreview() {
	w.PreviewPath = ""
	w.PreviewTitle = ""
	w.PreviewKind = ""
	w.PreviewBody = ""
	w.PreviewContent = ""
	w.PreviewReady = false
	w.PreviewEditable = false
	w.OpenFileTabs = nil
	w.ActiveFileTab = ""
	w.PendingFileTab = ""
	w.FileBuffers = map[string]string{}
	w.FileSaved = map[string]string{}
	w.EditorActive = false
	w.EditorDirty = false
	w.Editor.SetValue("")
	w.Editor.Blur()
	w.EditorHistory = []string{""}
}

func (w *WorkspaceShellModel) resetTerminal() {
	w.TerminalSessionID = ""
	w.TerminalTitle = "Controller"
	w.TerminalStatus = "Ready"
	w.TerminalLines = nil
	w.TerminalStream = ""
	w.PendingUserMessages = nil
	w.PendingAssistant = false
	w.PendingAssistantAt = ""
}

func (w *WorkspaceShellModel) resetCanvas() {
	w.CanvasWidgets = nil
	w.CanvasTabs = nil
	w.ActiveCanvas = ""
	w.SelectedCanvasWidget = 0
}

func (w *WorkspaceShellModel) SetCanvasData(project string, widgets []api.Widget, tabs []string) {
	if project != w.CurrentProject {
		return
	}
	w.CanvasWidgets = append([]api.Widget(nil), widgets...)
	sort.Slice(w.CanvasWidgets, func(i, j int) bool {
		leftTab := strings.ToLower(coalesce(w.CanvasWidgets[i].Tab, "default"))
		rightTab := strings.ToLower(coalesce(w.CanvasWidgets[j].Tab, "default"))
		if leftTab != rightTab {
			return leftTab < rightTab
		}
		leftTitle := strings.ToLower(coalesce(w.CanvasWidgets[i].Title, w.CanvasWidgets[i].ID))
		rightTitle := strings.ToLower(coalesce(w.CanvasWidgets[j].Title, w.CanvasWidgets[j].ID))
		return leftTitle < rightTitle
	})

	seen := map[string]struct{}{}
	mergedTabs := make([]string, 0, len(tabs)+1)
	addTab := func(tab string) {
		tab = strings.TrimSpace(tab)
		if tab == "" {
			tab = "default"
		}
		if _, ok := seen[tab]; ok {
			return
		}
		seen[tab] = struct{}{}
		mergedTabs = append(mergedTabs, tab)
	}
	addTab("default")
	for _, tab := range tabs {
		addTab(tab)
	}
	for _, widget := range w.CanvasWidgets {
		addTab(widget.Tab)
	}
	sort.Strings(mergedTabs)
	w.CanvasTabs = mergedTabs
	if len(w.CanvasTabs) == 0 {
		w.ActiveCanvas = ""
	} else if !containsString(w.CanvasTabs, w.ActiveCanvas) {
		w.ActiveCanvas = w.CanvasTabs[0]
	}
	if w.ActiveCanvas == "" && len(w.CanvasTabs) > 0 {
		w.ActiveCanvas = w.CanvasTabs[0]
	}
	if widgets := w.CanvasWidgetsForActiveTab(); w.SelectedCanvasWidget >= len(widgets) {
		w.SelectedCanvasWidget = max(0, len(widgets)-1)
	}
	w.rebuildSidebarList()
}

func (w *WorkspaceShellModel) CanvasWidgetsForActiveTab() []api.Widget {
	tab := strings.TrimSpace(w.ActiveCanvas)
	if tab == "" {
		tab = "default"
	}
	out := make([]api.Widget, 0, len(w.CanvasWidgets))
	for _, widget := range w.CanvasWidgets {
		widgetTab := strings.TrimSpace(widget.Tab)
		if widgetTab == "" {
			widgetTab = "default"
		}
		if widgetTab == tab {
			out = append(out, widget)
		}
	}
	return out
}

func (w *WorkspaceShellModel) SelectedCanvasWidgetRef() *api.Widget {
	widgets := w.CanvasWidgetsForActiveTab()
	if len(widgets) == 0 {
		return nil
	}
	if w.SelectedCanvasWidget < 0 {
		w.SelectedCanvasWidget = 0
	}
	if w.SelectedCanvasWidget >= len(widgets) {
		w.SelectedCanvasWidget = len(widgets) - 1
	}
	widget := widgets[w.SelectedCanvasWidget]
	return &widget
}

func (w *WorkspaceShellModel) SetCanvasWidgetIndex(idx int) bool {
	widgets := w.CanvasWidgetsForActiveTab()
	if idx < 0 || idx >= len(widgets) || idx == w.SelectedCanvasWidget {
		return false
	}
	w.SelectedCanvasWidget = idx
	w.rebuildSidebarList()
	return true
}

func (w *WorkspaceShellModel) SetCanvasTab(tab string) bool {
	tab = strings.TrimSpace(tab)
	if tab == "" {
		tab = "default"
	}
	if !containsString(w.CanvasTabs, tab) || tab == w.ActiveCanvas {
		return false
	}
	w.ActiveCanvas = tab
	w.SelectedCanvasWidget = 0
	w.rebuildSidebarList()
	return true
}

func (w *WorkspaceShellModel) StepCanvasTab(delta int) bool {
	if len(w.CanvasTabs) == 0 {
		return false
	}
	idx := 0
	for i, tab := range w.CanvasTabs {
		if tab == w.ActiveCanvas {
			idx = i
			break
		}
	}
	next := (idx + delta + len(w.CanvasTabs)) % len(w.CanvasTabs)
	return w.SetCanvasTab(w.CanvasTabs[next])
}
