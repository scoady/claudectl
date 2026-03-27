package tui

import (
	"fmt"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/list"
	"github.com/charmbracelet/lipgloss"
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
	if status == nil {
		status = map[string]string{}
	}
	w.GitStatus = status
	w.GitReady = true
	w.rebuildSidebarList()
}

func (w *WorkspaceShellModel) SetGitBranch(project, branch, remote, provider string) {
	if project != w.CurrentProject {
		return
	}
	w.GitBranch = branch
	w.GitRemote = remote
	w.GitProvider = provider
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

func (w *WorkspaceShellModel) explorerItems() []workspaceShellExplorerItem {
	items := make([]workspaceShellExplorerItem, 0, len(w.Entries)+1)
	if w.CurrentDir != "" {
		parent := filepath.Dir(w.CurrentDir)
		if parent == "." {
			parent = ""
		}
		items = append(items, workspaceShellExplorerItem{
			Label:    "..",
			Path:     parent,
			Icon:     "↰",
			IsDir:    true,
			IsParent: true,
		})
	}
	for _, entry := range w.Entries {
		items = append(items, workspaceShellExplorerItem{
			Label: entry.Name,
			Path:  coalesce(entry.Path, entry.Name),
			Entry: entry,
			Icon:  workspaceShellFileIcon(entry),
			IsDir: entry.Type == "directory",
		})
	}
	return items
}

func (w *WorkspaceShellModel) ExplorerItems() []workspaceExplorerItem {
	items := w.explorerItems()
	out := make([]workspaceExplorerItem, 0, len(items))
	for _, item := range items {
		label := item.Label
		if item.IsDir && !item.IsParent {
			label += "/"
		}
		out = append(out, workspaceExplorerItem{
			Label:    label,
			Path:     item.Path,
			IsDir:    item.IsDir,
			IsParent: item.IsParent,
		})
	}
	return out
}

func (w *WorkspaceShellModel) SelectedExplorerItem() (workspaceShellExplorerItem, bool) {
	items := w.explorerItems()
	if len(items) == 0 || w.SelectedEntry < 0 || w.SelectedEntry >= len(items) {
		return workspaceShellExplorerItem{}, false
	}
	return items[w.SelectedEntry], true
}

func (w *WorkspaceShellModel) explorerAccentAndBadge(item workspaceShellExplorerItem) (lipgloss.Color, string) {
	if item.IsParent {
		return Dim, ""
	}
	status := strings.TrimSpace(w.gitStatusForPath(item.Path, item.IsDir))
	switch {
	case strings.Contains(status, "??"):
		return Green, "??"
	case strings.Contains(status, "M"):
		return Amber, "M"
	case strings.Contains(status, "D"):
		return Rose, "D"
	case strings.Contains(status, "R"):
		return Purple, "R"
	}
	if item.IsDir {
		return Blue, ""
	}
	if item.Entry.Type == "symlink" {
		return Purple, "ln"
	}
	return workspaceShellFileColor(item.Entry), ""
}

func (w *WorkspaceShellModel) gitStatusForPath(path string, isDir bool) string {
	if path == "" || len(w.GitStatus) == 0 {
		return ""
	}
	if status, ok := w.GitStatus[path]; ok {
		return status
	}
	if !isDir {
		return ""
	}
	best := ""
	for candidate, status := range w.GitStatus {
		if strings.HasPrefix(candidate, path+"/") && workspaceShellStatusPriority(status) > workspaceShellStatusPriority(best) {
			best = status
		}
	}
	return best
}

func workspaceShellConversationLines(messages []api.Message, width, limit int) []string {
	lines := make([]string, 0, min(limit, len(messages)*2))
	for i := 0; i < len(messages); i++ {
		msg := messages[i]
		if msg.Type == "tool_use" {
			labels := []string{workspaceShellToolLabel(msg)}
			stamp := msg.Timestamp
			for i+1 < len(messages) && messages[i+1].Type == "tool_use" {
				i++
				labels = append(labels, workspaceShellToolLabel(messages[i]))
			}
			lines = append(lines, workspaceShellToolLines(labels, stamp, width)...)
		} else {
			text := strings.TrimSpace(msg.Content)
			if text == "" {
				continue
			}
			lines = append(lines, workspaceShellMessageLines(msg.Role, text, msg.Timestamp, width)...)
		}
		if len(lines) >= limit {
			break
		}
	}
	if len(lines) > limit {
		return lines[len(lines)-limit:]
	}
	return lines
}

func workspaceShellMessageLine(role, content, ts string) string {
	return strings.Join(workspaceShellMessageLines(role, content, ts, 120), "\n")
}

func workspaceShellMessageLines(role, content, ts string, width int) []string {
	label := "codex"
	color := Blue
	if role == "user" {
		label = "you"
		color = Purple
	} else if role == "system" {
		label = "sys"
		color = Amber
	} else if role == "assistant" {
		label = "codex"
		color = Cyan
	}
	stamp := "--:--"
	if t, err := time.Parse(time.RFC3339, ts); err == nil {
		stamp = t.Local().Format("15:04")
	}
	return workspaceShellWrappedLines(stamp, label, color, content, width, White)
}

func workspaceShellToolLabel(msg api.Message) string {
	label := strings.TrimSpace(msg.ToolName)
	if label == "" {
		label = "tool"
	}
	if cmd, ok := msg.ToolInput["command"].(string); ok && strings.TrimSpace(cmd) != "" {
		label += "  " + strings.TrimSpace(cmd)
	}
	return label
}

func workspaceShellPlainMessage(role, content, ts string) []string {
	label := "codex"
	if role == "user" {
		label = "you"
	} else if role == "system" {
		label = "sys"
	}
	content = strings.TrimSpace(strings.ReplaceAll(content, "\r\n", "\n"))
	if content == "" {
		return nil
	}
	body := strings.Split(content, "\n")
	lines := make([]string, 0, len(body))
	for i, line := range body {
		line = strings.TrimSpace(line)
		if i == 0 {
			lines = append(lines, fmt.Sprintf("%s %s: %s", tsToStamp(ts), label, line))
			continue
		}
		lines = append(lines, "      "+line)
	}
	return lines
}

func workspaceShellToolLines(labels []string, ts string, width int) []string {
	return workspaceShellWrappedLines(tsToStamp(ts), "tool", Amber, strings.Join(labels, "  •  "), width, SubText)
}

func workspaceShellStreamLines(stream, ts string, width int) []string {
	out := make([]string, 0, 8)
	for _, raw := range strings.Split(strings.TrimSuffix(stream, "\n"), "\n") {
		line := strings.TrimSpace(raw)
		if line == "" {
			continue
		}
		if strings.HasPrefix(line, "[tool] ") {
			out = append(out, workspaceShellToolLines([]string{strings.TrimPrefix(line, "[tool] ")}, ts, width)...)
			continue
		}
		out = append(out, workspaceShellMessageLines("assistant", line, ts, width)...)
	}
	return out
}

func workspaceShellWrappedLines(stamp, label string, labelColor lipgloss.Color, content string, width int, bodyColor lipgloss.Color) []string {
	const stampW = 6
	const labelW = 7
	bodyW := max(16, width-stampW-labelW)
	parts := workspaceShellStructuredContentLines(content, bodyW)
	out := make([]string, 0, len(parts))
	first := true
	for _, part := range parts {
		curStamp := ""
		curLabel := ""
		if first {
			curStamp = stamp
			curLabel = label
			first = false
		}
		out = append(out, lipgloss.JoinHorizontal(
			lipgloss.Top,
			lipgloss.NewStyle().Foreground(Dim).Width(stampW).Render(curStamp),
			lipgloss.NewStyle().Foreground(labelColor).Bold(true).Width(labelW).Render(curLabel),
			lipgloss.NewStyle().Foreground(bodyColor).Render(part),
		))
	}
	return out
}

func tsToStamp(ts string) string {
	stamp := "--:--"
	if t, err := time.Parse(time.RFC3339, ts); err == nil {
		stamp = t.Local().Format("15:04")
	}
	return stamp
}

func workspaceShellThinkingLabel() string {
	labels := []string{
		"Thinking...",
		"Combobulating...",
		"Tracing...",
		"Inspecting...",
		"Cross-checking...",
		"Plotting...",
	}
	idx := int(time.Now().Unix()) % len(labels)
	return labels[idx]
}

func workspaceShellStructuredContentLines(content string, width int) []string {
	rawLines := strings.Split(strings.ReplaceAll(content, "\r\n", "\n"), "\n")
	lines := make([]string, 0, len(rawLines))
	for _, raw := range rawLines {
		line := strings.TrimRight(raw, " \t")
		trimmed := strings.TrimSpace(line)
		switch {
		case trimmed == "":
			lines = append(lines, "")
		case strings.HasPrefix(trimmed, "#"):
			title := strings.TrimSpace(strings.TrimLeft(trimmed, "#"))
			if title == "" {
				continue
			}
			lines = append(lines, wrapText(title, width)...)
		case strings.HasPrefix(trimmed, "- "), strings.HasPrefix(trimmed, "* "):
			lines = append(lines, workspaceShellPrefixedWrap("• ", strings.TrimSpace(trimmed[2:]), width)...)
		default:
			if prefix, rest, ok := workspaceShellNumberedPrefix(trimmed); ok {
				lines = append(lines, workspaceShellPrefixedWrap(prefix, rest, width)...)
			} else {
				wrapped := wrapText(trimmed, width)
				if len(wrapped) == 0 {
					wrapped = []string{trimmed}
				}
				lines = append(lines, wrapped...)
			}
		}
	}
	if len(lines) == 0 {
		return []string{""}
	}
	return lines
}

func workspaceShellPrefixedWrap(prefix, text string, width int) []string {
	textWidth := max(8, width-len(prefix))
	wrapped := wrapText(text, textWidth)
	if len(wrapped) == 0 {
		return []string{prefix}
	}
	lines := make([]string, 0, len(wrapped))
	indent := strings.Repeat(" ", len(prefix))
	for i, part := range wrapped {
		if i == 0 {
			lines = append(lines, prefix+part)
		} else {
			lines = append(lines, indent+part)
		}
	}
	return lines
}

func workspaceShellNumberedPrefix(line string) (string, string, bool) {
	dot := strings.Index(line, ". ")
	if dot <= 0 {
		return "", "", false
	}
	for _, ch := range line[:dot] {
		if ch < '0' || ch > '9' {
			return "", "", false
		}
	}
	return line[:dot+2], strings.TrimSpace(line[dot+2:]), true
}

func workspaceShellFileIcon(entry api.FileEntry) string {
	if entry.Type == "directory" {
		return "▣"
	}
	if entry.Type == "symlink" {
		return "↗"
	}
	base := strings.ToLower(entry.Name)
	switch {
	case base == "dockerfile" || base == "containerfile":
		return "⬢"
	case base == "makefile" || base == "justfile":
		return "▤"
	case strings.HasSuffix(base, ".go"):
		return "◉"
	case strings.HasSuffix(base, ".py"):
		return "◐"
	case strings.HasSuffix(base, ".java"):
		return "◌"
	case strings.HasSuffix(base, ".tf"), strings.HasSuffix(base, ".tfvars"), strings.HasSuffix(base, ".hcl"):
		return "⬡"
	case strings.HasSuffix(base, ".ts"), strings.HasSuffix(base, ".tsx"):
		return "◫"
	case strings.HasSuffix(base, ".js"), strings.HasSuffix(base, ".jsx"):
		return "◨"
	case strings.HasSuffix(base, ".md"), strings.HasSuffix(base, ".mdx"):
		return "≣"
	case strings.HasSuffix(base, ".json"):
		return "{}"
	case strings.HasSuffix(base, ".yaml"), strings.HasSuffix(base, ".yml"), strings.HasSuffix(base, ".toml"):
		return "⋮"
	case strings.HasSuffix(base, ".sh"), strings.HasSuffix(base, ".bash"), strings.HasSuffix(base, ".zsh"):
		return "❯"
	case strings.HasSuffix(base, ".swift"):
		return "◍"
	case strings.HasSuffix(base, ".png"), strings.HasSuffix(base, ".jpg"), strings.HasSuffix(base, ".jpeg"), strings.HasSuffix(base, ".svg"):
		return "▥"
	default:
		return "•"
	}
}

func workspaceShellFileColor(entry api.FileEntry) lipgloss.Color {
	base := strings.ToLower(entry.Name)
	switch {
	case entry.Type == "directory":
		return Cyan
	case entry.Type == "symlink":
		return Purple
	case strings.HasSuffix(base, ".go"):
		return Cyan
	case strings.HasSuffix(base, ".py"):
		return Green
	case strings.HasSuffix(base, ".java"):
		return Amber
	case strings.HasSuffix(base, ".tf"), strings.HasSuffix(base, ".tfvars"), strings.HasSuffix(base, ".hcl"):
		return Cyan
	case strings.HasSuffix(base, ".ts"), strings.HasSuffix(base, ".tsx"):
		return Blue
	case strings.HasSuffix(base, ".js"), strings.HasSuffix(base, ".jsx"):
		return Amber
	case strings.HasSuffix(base, ".md"), strings.HasSuffix(base, ".mdx"):
		return White
	case strings.HasSuffix(base, ".json"):
		return Purple
	case strings.HasSuffix(base, ".yaml"), strings.HasSuffix(base, ".yml"), strings.HasSuffix(base, ".toml"):
		return Green
	case strings.HasSuffix(base, ".sh"), strings.HasSuffix(base, ".bash"), strings.HasSuffix(base, ".zsh"):
		return Rose
	case strings.HasSuffix(base, ".swift"):
		return Amber
	case strings.HasSuffix(base, ".png"), strings.HasSuffix(base, ".jpg"), strings.HasSuffix(base, ".jpeg"), strings.HasSuffix(base, ".svg"):
		return Purple
	default:
		return SubText
	}
}

func workspaceShellEntryRank(kind string) int {
	switch kind {
	case "directory":
		return 0
	case "symlink":
		return 1
	default:
		return 2
	}
}

func workspaceShellStatusPriority(status string) int {
	switch {
	case strings.Contains(status, "??"):
		return 5
	case strings.Contains(status, "M"):
		return 4
	case strings.Contains(status, "R"):
		return 3
	case strings.Contains(status, "D"):
		return 2
	case strings.TrimSpace(status) != "":
		return 1
	default:
		return 0
	}
}

func workspaceShellAgentColor(agent api.Agent) lipgloss.Color {
	switch agent.Status {
	case "active":
		return Amber
	case "idle":
		return Cyan
	case "done":
		return Green
	case "error":
		return Rose
	default:
		return SubText
	}
}

func workspaceShellAgentIcon(agent api.Agent) string {
	if agent.IsController {
		return "ctl"
	}
	return "agt"
}

func workspaceShellCanvasIcon(widget api.Widget) string {
	switch strings.ToLower(strings.TrimSpace(widget.Kind)) {
	case "html", "hero":
		return "◫"
	case "pixel", "pixel-art":
		return "▦"
	case "chart", "spark", "sparkline":
		return "◌"
	case "markdown", "text":
		return "≣"
	default:
		if strings.TrimSpace(widget.HTML) != "" {
			return "◫"
		}
		return "◌"
	}
}

func workspaceShellCanvasColor(widget api.Widget) lipgloss.Color {
	switch strings.ToLower(strings.TrimSpace(widget.Kind)) {
	case "html", "hero":
		return Cyan
	case "pixel", "pixel-art":
		return Purple
	case "chart", "spark", "sparkline":
		return Green
	case "markdown", "text":
		return Amber
	default:
		return SubText
	}
}

func workspaceShellCanvasWidgetDesc(widget api.Widget) string {
	parts := []string{}
	if kind := strings.TrimSpace(widget.Kind); kind != "" {
		parts = append(parts, kind)
	}
	if tmpl := strings.TrimSpace(widget.TemplateID); tmpl != "" {
		parts = append(parts, tmpl)
	}
	if len(parts) == 0 {
		return "widget"
	}
	return strings.Join(parts, "  ")
}

func workspaceShellDockGlyph(mode string) string {
	switch mode {
	case workspaceDockFiles:
		return "▣"
	case workspaceDockCanvas:
		return "◫"
	case workspaceDockTasks:
		return "✦"
	case workspaceDockMetrics:
		return "◉"
	case workspaceDockTools:
		return "⬢"
	default:
		return "·"
	}
}

func workspaceShellDockTitle(mode string) string {
	switch mode {
	case workspaceDockFiles:
		return "Explorer"
	case workspaceDockCanvas:
		return "Canvas"
	case workspaceDockTasks:
		return "Sessions"
	case workspaceDockMetrics:
		return "Status"
	case workspaceDockTools:
		return "Tools"
	default:
		return "Workspace"
	}
}

func workspaceShellDockSubtitle(m *WorkspaceShellModel) string {
	switch m.DockMode {
	case workspaceDockFiles:
		parts := []string{}
		if label := workspaceShellGitBadge(m); label != "" {
			parts = append(parts, label)
		}
		if m.CurrentDir == "" {
			parts = append(parts, "Project root")
		} else {
			parts = append(parts, truncate(m.CurrentDir, 20))
		}
		return strings.Join(parts, "  ")
	case workspaceDockCanvas:
		active := coalesce(m.ActiveCanvas, "default")
		return fmt.Sprintf("%d widgets  ·  %s", len(m.CanvasWidgetsForActiveTab()), active)
	case workspaceDockTasks:
		return fmt.Sprintf("%d sessions", len(m.SubagentsForCurrent()))
	case workspaceDockMetrics:
		return "Workspace state"
	case workspaceDockTools:
		return "Utilities"
	default:
		return ""
	}
}

func containsString(values []string, needle string) bool {
	for _, value := range values {
		if value == needle {
			return true
		}
	}
	return false
}

func workspaceShellGitBadge(m *WorkspaceShellModel) string {
	branch := strings.TrimSpace(m.GitBranch)
	if branch == "" {
		return ""
	}
	provider := strings.TrimSpace(m.GitProvider)
	remote := strings.TrimSpace(m.GitRemote)
	icon := "⑂"
	label := "local"
	switch provider {
	case "gitlab":
		icon = "◆"
		label = "gitlab"
	case "github":
		icon = ""
		label = "github"
	case "bitbucket":
		icon = "◧"
		label = "bitbucket"
	case "git":
		if remote != "" {
			label = remote
		} else {
			label = "git"
		}
	default:
		if remote != "" {
			label = remote
		}
	}
	return icon + " " + label + " " + branch
}

func workspaceShellLiveLabel(m *WorkspaceShellModel, health *api.HealthResponse) string {
	parts := []string{}
	if sid := m.ActiveSessionID(); sid != "" {
		parts = append(parts, "session "+truncate(sid, 8))
	}
	if m.SessionTurnBusy {
		parts = append(parts, "streaming")
	}
	if health != nil && health.Status != "" {
		parts = append(parts, health.Status)
	}
	if len(parts) == 0 {
		return "ready"
	}
	return strings.Join(parts, " · ")
}

func focusBorder(active bool) lipgloss.Color {
	if active {
		return GlowBorder
	}
	return BorderColor
}

func coalesceColor(value, fallback lipgloss.Color) lipgloss.Color {
	if value == "" {
		return fallback
	}
	return value
}
