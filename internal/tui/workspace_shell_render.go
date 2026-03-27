package tui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
	zone "github.com/lrstanley/bubblezone"
	"github.com/scoady/codexctl/internal/api"
	editorcomponent "github.com/scoady/codexctl/internal/tui/components/editor"
	tuistyle "github.com/scoady/codexctl/internal/tui/style"
)

var (
	workspaceShellChromeBg = tuistyle.WorkspaceChromeBG
	workspaceShellPanelBg  = tuistyle.WorkspacePanelBG
	workspaceShellDockBg   = tuistyle.WorkspaceDockBG
	workspaceShellLine     = tuistyle.WorkspaceLine
)

func RenderWorkspaceShell(m *WorkspaceShellModel, stats *api.StatsResponse, health *api.HealthResponse, store *MetricsStore, host workspaceHostMetrics, mouse MousePoint, width, height int) string {
	if height <= 3 {
		return ""
	}
	bodyHeight := max(6, height-4)
	if workspaceDockShowsSidebar(m.DockMode) {
		bodyHeight = max(6, height-5)
	}
	layout := computeWorkspaceShellLayout(width, bodyHeight, m.SystemDrawerOpen, m.DockMode)

	sidebarBodyHeight := max(4, layout.Sidebar.H-6)
	if m.DockMode == workspaceDockFiles {
		sidebarBodyHeight = max(4, layout.Sidebar.H-8)
	}
	if layout.Sidebar.W > 0 {
		m.SidebarList.SetSize(max(12, layout.Sidebar.W-4), sidebarBodyHeight)
	}
	m.ProjectPicker.SetSize(max(18, layout.Picker.W-2), max(4, layout.Picker.H-2))
	m.Composer.Width = max(12, layout.Composer.W-6)
	if layout.SysComposer.W > 0 {
		m.SystemComposer.Width = max(12, layout.SysComposer.W-6)
	}

	activity := renderWorkspaceActivityPane(m, layout.Activity, mouse)
	main := renderWorkspaceTerminalPane(m, health, mouse, layout)

	var body string
	if layout.Sidebar.W == 0 {
		body = lipgloss.JoinHorizontal(lipgloss.Top, activity, " ", main)
	} else if layout.Stacked {
		sidebar := renderWorkspaceSidebarPane(m, stats, layout.Sidebar, mouse)
		body = lipgloss.JoinHorizontal(lipgloss.Top, activity, " ", lipgloss.JoinVertical(lipgloss.Left, sidebar, main))
	} else {
		sidebar := renderWorkspaceSidebarPane(m, stats, layout.Sidebar, mouse)
		body = lipgloss.JoinHorizontal(lipgloss.Top, activity, " ", sidebar, " ", main)
	}
	return zone.Scan(strings.Join([]string{
		renderWorkspaceTopStrip(m, stats, health, store, host, width),
		body,
		renderWorkspaceBottomStrip(m, width),
	}, "\n"))
}

func renderWorkspaceSidebarPane(m *WorkspaceShellModel, stats *api.StatsResponse, rect workspaceShellRect, mouse MousePoint) string {
	var body string
	footer := ""
	switch m.DockMode {
	case workspaceDockChat:
		body = m.SidebarList.View()
	case workspaceDockFiles:
		body = renderWorkspaceExplorerList(m, rect.W-4, rect.H-8, mouse)
	case workspaceDockTasks, workspaceDockCanvas:
		body = m.SidebarList.View()
	case workspaceDockMetrics:
		body = renderWorkspaceStatusBody(m, stats, rect.W-4, rect.H-6)
	case workspaceDockTools:
		body = renderWorkspaceToolsBody(rect.W-4, rect.H-6)
	}
	if m.DockMode == workspaceDockFiles {
		footer = renderWorkspaceExplorerFooter(m, rect.W-4)
	}

	lines := []string{
		lipgloss.NewStyle().Foreground(White).Bold(true).Render(workspaceShellDockTitle(m.DockMode)),
		lipgloss.NewStyle().Foreground(Dim).Render(workspaceShellDockSubtitle(m)),
		"",
		body,
	}
	if footer != "" {
		lines = append(lines, "", footer)
	}
	content := strings.Join(lines, "\n")

	return lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(focusBorder(m.FocusPane == 1)).
		Padding(0, 1).
		Width(rect.W).
		Height(rect.H).
		Background(workspaceShellPanelBg).
		Render(content)
}

func renderWorkspaceTerminalPane(m *WorkspaceShellModel, health *api.HealthResponse, mouse MousePoint, layout workspaceShellLayout) string {
	innerW := max(12, layout.Main.W-4)
	innerH := max(8, layout.Main.H-2)

	projectName := "No project"
	projectPath := "Press p to choose a project"
	if cur := m.Current(); cur != nil {
		projectName = cur.Name
		projectPath = truncate(cur.Path, max(18, innerW-24))
	}
	header1, header2 := renderWorkspaceMainHeaders(m, mouse, innerW, projectName, projectPath)

	if m.ProjectPickerOpen {
		pickerLines := padOrTrimLines(strings.Split(renderWorkspaceProjectPicker(m, layout.Picker, mouse), "\n"), max(4, innerH-3))
		lines := []string{
			header1,
			header2,
			HLine(innerW, workspaceShellLine),
		}
		lines = append(lines, pickerLines...)
		lines = padOrTrimLines(lines, innerH)
		return lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(focusBorder(m.FocusPane == 2)).
			Padding(0, 1).
			Width(layout.Main.W).
			Height(layout.Main.H).
			Background(workspaceShellPanelBg).
			Render(strings.Join(lines, "\n"))
	}

	if m.DockMode == workspaceDockCanvas && !m.EditorActive {
		return renderWorkspaceCanvasPane(m, mouse, layout, innerW, innerH, header1, header2)
	}

	if m.DockMode == workspaceDockFiles {
		fileStatus := "saved"
		if m.EditorDirty {
			fileStatus = "modified"
		}
		infoRow := workspaceShellAlignedRow(
			coalesce(m.PreviewTitle, "No file selected"),
			fileStatus,
			innerW,
			lipgloss.NewStyle().Foreground(SubText),
			lipgloss.NewStyle().Foreground(Cyan),
		)
		bodyH := max(4, innerH-5)
		bodyLines := renderWorkspaceFileBody(m, innerW, bodyH)
		lines := []string{
			header1,
			header2,
			HLine(innerW, workspaceShellLine),
			infoRow,
			HLine(innerW, workspaceShellLine),
		}
		lines = append(lines, bodyLines...)
		lines = padOrTrimLines(lines, innerH)
		return lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(focusBorder(m.FocusPane == 2 || m.DockMode == workspaceDockFiles)).
			Padding(0, 1).
			Width(layout.Main.W).
			Height(layout.Main.H).
			Background(workspaceShellChromeBg).
			Render(strings.Join(lines, "\n"))
	}

	if m.DockMode == workspaceDockChat {
		return renderWorkspaceChatPane(m, layout, mouse, header1, header2)
	}

	lines := padOrTrimLines([]string{
		header1,
		header2,
		HLine(innerW, workspaceShellLine),
	}, innerH)

	return lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(focusBorder(m.FocusPane == 2)).
		Padding(0, 1).
		Width(layout.Main.W).
		Height(layout.Main.H).
		Background(workspaceShellPanelBg).
		Render(strings.Join(lines, "\n"))
}

func renderWorkspaceChatPane(m *WorkspaceShellModel, layout workspaceShellLayout, mouse MousePoint, header1, header2 string) string {
	innerW := max(12, layout.Main.W-4)
	innerH := max(8, layout.Main.H-2)
	bodyH := max(6, innerH-3)
	chatBlockH := bodyH
	drawerBlockH := 0
	if m.SystemDrawerOpen {
		chatBlockH = max(8, (bodyH-1)/2)
		drawerBlockH = max(7, bodyH-chatBlockH-1)
	}

	chatInnerW := innerW
	chatBodyBudget := max(3, chatBlockH-3)
	transcriptH := max(4, chatBodyBudget-2)
	m.SessionViewport.Width = chatInnerW
	m.SessionViewport.Height = transcriptH
	m.refreshSessionViewport()
	chatBody := padOrTrimLines(strings.Split(m.SessionViewport.View(), "\n"), transcriptH)
	chatBody = append(chatBody, "", renderWorkspaceInlineInput(m.Composer, chatInnerW, ">", m.ComposerFocused, m.BlinkVisible, m.SessionTurnBusy))
	chatTitleView, chatTitleW := workspaceShellChatBlockTitle(m)
	chatBlock := renderWorkspaceTerminalBlock(workspaceTerminalBlockSpec{
		TitleView: chatTitleView,
		TitleW:    chatTitleW,
		Status:    workspaceShellChatMetaStatus(m),
		Width:     innerW,
		Height:    chatBlockH,
		Focused:   m.FocusPane == 2,
		BodyLines: chatBody,
	})
	lines := []string{header1, header2, HLine(innerW, workspaceShellLine)}
	lines = append(lines, strings.Split(chatBlock, "\n")...)

	if m.SystemDrawerOpen {
		drawerInnerW := innerW
		systemBodyBudget := max(3, drawerBlockH-3)
		systemBodyH := max(4, systemBodyBudget-2)
		m.SystemViewport.Width = drawerInnerW
		m.SystemViewport.Height = systemBodyH
		m.refreshSystemViewport()
		systemBody := padOrTrimLines(strings.Split(m.SystemViewport.View(), "\n"), systemBodyH)
		systemBody = append(systemBody, "", renderWorkspaceInlineInput(m.SystemComposer, drawerInnerW, "$", m.SystemComposerFocused, m.BlinkVisible, false))
		drawer := renderWorkspaceTerminalBlock(workspaceTerminalBlockSpec{
			Title:     "OS Terminal",
			Status:    "local shell",
			Width:     innerW,
			Height:    drawerBlockH,
			Focused:   m.FocusPane == 3,
			BodyLines: systemBody,
		})
		lines = append(lines, HLine(innerW, workspaceShellLine))
		lines = append(lines, strings.Split(drawer, "\n")...)
	}

	lines = padOrTrimLines(lines, innerH)
	return lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(focusBorder(m.FocusPane == 2 || m.FocusPane == 3)).
		Padding(0, 1).
		Width(layout.Main.W).
		Height(layout.Main.H).
		Background(workspaceShellChromeBg).
		Render(strings.Join(lines, "\n"))
}

func renderWorkspaceMainHeaders(m *WorkspaceShellModel, mouse MousePoint, innerW int, projectName, projectPath string) (string, string) {
	if m.DockMode == workspaceDockChat {
		tabW := max(12, innerW-14)
		tabLine := workspaceShellRenderTabLine(m, tabW, mouse)
		header1 := lipgloss.NewStyle().Width(innerW).Render(tabLine)
		accessory := renderWorkspaceDrawerToggleButton(m.SystemDrawerOpen, mouse)
		header2 := workspaceShellAlignedRow(
			projectName+"  "+projectPath,
			accessory,
			innerW,
			lipgloss.NewStyle().Foreground(Dim),
			lipgloss.NewStyle(),
		)
		return header1, header2
	}
	title := workspaceShellDockTitle(m.DockMode)
	if m.DockMode == workspaceDockFiles && strings.TrimSpace(m.PreviewTitle) != "" {
		title = m.PreviewTitle
	}
	header1 := workspaceShellAlignedRow(
		title,
		"",
		innerW,
		lipgloss.NewStyle().Foreground(White).Bold(true),
		lipgloss.NewStyle().Foreground(Cyan),
	)
	header2 := workspaceShellAlignedRow(
		projectName+"  "+projectPath,
		"",
		innerW,
		lipgloss.NewStyle().Foreground(Dim),
		lipgloss.NewStyle().Foreground(Cyan),
	)
	return header1, header2
}

func renderWorkspaceFileBody(m *WorkspaceShellModel, innerW, bodyH int) []string {
	if m.EditorActive && m.ActiveFileTab != "" {
		m.Editor.SetWidth(innerW)
		m.Editor.SetHeight(bodyH)
		return padOrTrimLines(strings.Split(tuistyle.WorkspaceTerminalSectionStyle().Width(innerW).Render(m.Editor.View()), "\n"), bodyH)
	}
	if strings.TrimSpace(m.PreviewBody) != "" {
		lines := padOrTrimLines(strings.Split(m.PreviewBody, "\n"), bodyH)
		for i := range lines {
			lines[i] = tuistyle.WorkspaceTerminalSectionStyle().Width(innerW).Render(lines[i])
		}
		return lines
	}
	return editorcomponent.RenderEmptyState(innerW, bodyH)
}

func workspaceShellChatBlockTitle(m *WorkspaceShellModel) (string, int) {
	labelText := "Agent Chat"
	label := tuistyle.WorkspaceTerminalTitleStyle().Render(labelText)
	state := workspaceShellChatStateLabel(m)
	if state == "" {
		return label, lipgloss.Width(labelText)
	}
	view := label + "  " + tuistyle.WorkspaceTerminalStateStyle(m.SessionTurnBusy).Render(state)
	return view, lipgloss.Width(labelText) + 2 + lipgloss.Width(state)
}

func workspaceShellChatStateLabel(m *WorkspaceShellModel) string {
	if strings.TrimSpace(m.TerminalStream) != "" {
		return "generating"
	}
	if m.SessionTurnBusy || m.PendingAssistant {
		return "thinking"
	}
	return "ready"
}

func workspaceShellChatMetaStatus(m *WorkspaceShellModel) string {
	rows := m.transcriptRows()
	if len(rows) == 0 {
		return ""
	}
	return fmt.Sprintf("%d events", len(rows))
}

func renderWorkspaceCanvasPane(m *WorkspaceShellModel, mouse MousePoint, layout workspaceShellLayout, innerW, innerH int, header1, header2 string) string {
	tabLine := workspaceShellRenderCanvasTabLine(m, innerW, mouse)
	lines := []string{
		header1,
		header2,
		HLine(innerW, workspaceShellLine),
		tabLine,
		HLine(innerW, workspaceShellLine),
	}

	bodyH := max(4, innerH-len(lines))
	if widget := m.SelectedCanvasWidgetRef(); widget != nil {
		lines = append(lines, workspaceShellCanvasWidgetLines(*widget, innerW, bodyH)...)
	} else {
		empty := []string{
			lipgloss.NewStyle().Foreground(Cyan).Bold(true).Render("No widgets on this canvas yet."),
			"",
			lipgloss.NewStyle().Foreground(Dim).Render("Ask the project agent to build a scene here or use the canvas API."),
			lipgloss.NewStyle().Foreground(Dim).Render("This section is scoped to the active project only."),
		}
		lines = append(lines, padOrTrimLines(empty, bodyH)...)
	}
	lines = padOrTrimLines(lines, innerH)
	return lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(focusBorder(m.FocusPane == 2)).
		Padding(0, 1).
		Width(layout.Main.W).
		Height(layout.Main.H).
		Background(workspaceShellPanelBg).
		Render(strings.Join(lines, "\n"))
}

func dirtySuffixForPath(m *WorkspaceShellModel, path string) string {
	if path == m.ActiveFileTab && m.EditorDirty {
		return " •"
	}
	if saved, ok := m.FileSaved[path]; ok {
		if buf, ok := m.FileBuffers[path]; ok && buf != saved {
			return " •"
		}
	}
	return ""
}

func filepathBase(path string) string {
	path = strings.TrimSpace(path)
	if path == "" {
		return ""
	}
	last := strings.LastIndex(path, "/")
	if last >= 0 && last+1 < len(path) {
		return path[last+1:]
	}
	return path
}

func workspaceShellCanvasWidgetLines(widget api.Widget, width, height int) []string {
	metaRight := strings.TrimSpace(widget.TemplateID)
	if metaRight == "" {
		metaRight = strings.TrimSpace(widget.Kind)
	}
	rows := []string{
		workspaceShellAlignedRow(
			workspaceShellCanvasIcon(widget)+"  "+coalesce(widget.Title, widget.ID),
			metaRight,
			width,
			lipgloss.NewStyle().Foreground(Cyan).Bold(true),
			lipgloss.NewStyle().Foreground(SubText),
		),
		workspaceShellAlignedRow(
			fmt.Sprintf("grid %dx%d", widget.GSW, widget.GSH),
			coalesce(widget.UpdatedAt, widget.CreatedAt),
			width,
			lipgloss.NewStyle().Foreground(Dim),
			lipgloss.NewStyle().Foreground(Dim),
		),
		"",
	}

	rendered := workspaceShellRenderCanvasWidget(widget, width, max(0, height-len(rows)))
	if len(rendered) > 0 {
		rows = append(rows, rendered...)
		return padOrTrimLines(rows, height)
	}

	if prompt := strings.TrimSpace(widget.Prompt); prompt != "" {
		rows = append(rows,
			lipgloss.NewStyle().Foreground(SubText).Bold(true).Render("prompt"),
		)
		rows = append(rows, wrapSimple(prompt, width)...)
		rows = append(rows, "")
	}

	if html := strings.TrimSpace(widget.HTML); html != "" {
		rows = append(rows, lipgloss.NewStyle().Foreground(SubText).Bold(true).Render("html"))
		rows = append(rows, wrapSimple(truncate(strings.ReplaceAll(html, "\n", " "), 280), width)...)
		rows = append(rows, "")
	}

	if css := strings.TrimSpace(widget.CSS); css != "" {
		rows = append(rows,
			lipgloss.NewStyle().Foreground(SubText).Bold(true).Render("assets"),
			lipgloss.NewStyle().Foreground(Dim).Render("css attached"),
		)
	}
	if js := strings.TrimSpace(widget.JS); js != "" {
		rows = append(rows, lipgloss.NewStyle().Foreground(Dim).Render("js attached"))
	}
	if dataSummary := workspaceShellCanvasDataSummary(widget.Data); dataSummary != "" {
		rows = append(rows, "")
		rows = append(rows, lipgloss.NewStyle().Foreground(SubText).Bold(true).Render("data"))
		rows = append(rows, wrapSimple(dataSummary, width)...)
	}

	return padOrTrimLines(rows, height)
}

func workspaceShellRenderCanvasWidget(widget api.Widget, width, height int) []string {
	if height <= 0 {
		return nil
	}
	switch strings.ToLower(strings.TrimSpace(widget.Kind)) {
	case "pixel", "pixel-art":
		return workspaceShellRenderPixelWidget(widget, width, height)
	case "chart", "spark", "sparkline":
		return workspaceShellRenderChartWidget(widget, width, height)
	default:
		if strings.Contains(strings.ToLower(widget.TemplateID), "pixel") {
			return workspaceShellRenderPixelWidget(widget, width, height)
		}
		if strings.Contains(strings.ToLower(widget.TemplateID), "spark") {
			return workspaceShellRenderChartWidget(widget, width, height)
		}
		return workspaceShellRenderHeroWidget(widget, width, height)
	}
}

func workspaceShellRenderHeroWidget(widget api.Widget, width, height int) []string {
	title := coalesce(workspaceShellCanvasDataString(widget.Data, "title"), widget.Title)
	subtitle := workspaceShellCanvasDataString(widget.Data, "subtitle")
	lines := []string{
		lipgloss.NewStyle().Foreground(Cyan).Bold(true).Render(truncate(title, width)),
	}
	if subtitle != "" {
		lines = append(lines, wrapSimple(subtitle, width)...)
	}
	if widget.Prompt != "" {
		lines = append(lines, "")
		lines = append(lines, lipgloss.NewStyle().Foreground(SubText).Render("scene"))
		lines = append(lines, wrapSimple(widget.Prompt, width)...)
	}
	if strings.TrimSpace(widget.HTML) != "" {
		lines = append(lines, "")
		lines = append(lines, lipgloss.NewStyle().Foreground(Dim).Render("html-backed widget"))
	}
	return padOrTrimLines(lines, height)
}

func workspaceShellRenderPixelWidget(widget api.Widget, width, height int) []string {
	art := workspaceShellCanvasDataString(widget.Data, "art")
	if art == "" {
		art = widget.Prompt
	}
	rawLines := strings.Split(strings.TrimRight(art, "\n"), "\n")
	lines := make([]string, 0, len(rawLines)+2)
	for _, line := range rawLines {
		lines = append(lines, lipgloss.NewStyle().Foreground(Cyan).Render(truncate(line, width)))
	}
	if len(lines) == 0 {
		lines = append(lines, lipgloss.NewStyle().Foreground(Dim).Render("No pixel art data yet."))
	}
	return padOrTrimLines(lines, height)
}

func workspaceShellRenderChartWidget(widget api.Widget, width, height int) []string {
	title := coalesce(workspaceShellCanvasDataString(widget.Data, "title"), widget.Title)
	values := workspaceShellCanvasIntValues(widget.Data["values"])
	if len(values) == 0 {
		values = []int{0}
	}
	spark := RenderSparklineStyled(values, max(8, min(width, 40)), Green)
	lines := []string{
		lipgloss.NewStyle().Foreground(Green).Bold(true).Render(truncate(title, width)),
		spark,
	}
	minV, maxV, lastV := values[0], values[0], values[len(values)-1]
	for _, v := range values[1:] {
		if v < minV {
			minV = v
		}
		if v > maxV {
			maxV = v
		}
	}
	lines = append(lines, lipgloss.NewStyle().Foreground(SubText).Render(
		fmt.Sprintf("last %d  ·  min %d  ·  max %d  ·  points %d", lastV, minV, maxV, len(values)),
	))
	if widget.Prompt != "" {
		lines = append(lines, "")
		lines = append(lines, wrapSimple(widget.Prompt, width)...)
	}
	return padOrTrimLines(lines, height)
}

func workspaceShellCanvasDataSummary(data map[string]interface{}) string {
	if len(data) == 0 {
		return ""
	}
	parts := make([]string, 0, len(data))
	for key, value := range data {
		parts = append(parts, fmt.Sprintf("%s=%v", key, value))
	}
	return strings.Join(parts, "  ·  ")
}

func workspaceShellCanvasDataString(data map[string]interface{}, key string) string {
	if len(data) == 0 {
		return ""
	}
	if v, ok := data[key]; ok {
		if s, ok := v.(string); ok {
			return strings.TrimSpace(s)
		}
	}
	return ""
}

func workspaceShellCanvasIntValues(v interface{}) []int {
	switch values := v.(type) {
	case []interface{}:
		out := make([]int, 0, len(values))
		for _, value := range values {
			switch n := value.(type) {
			case float64:
				out = append(out, int(n))
			case int:
				out = append(out, n)
			}
		}
		return out
	case []int:
		return append([]int(nil), values...)
	default:
		return nil
	}
}

func workspaceShellAlignedRow(left, right string, width int, leftStyle, rightStyle lipgloss.Style) string {
	left = workspaceSingleLine(left)
	right = workspaceSingleLine(right)
	rightW := lipgloss.Width(right)
	leftW := width - rightW
	if right != "" {
		leftW--
	}
	if leftW < 0 {
		leftW = 0
	}
	leftRendered := leftStyle.Render(truncate(left, leftW))
	if right == "" {
		return lipgloss.NewStyle().Width(width).Render(leftRendered)
	}
	row := leftRendered + strings.Repeat(" ", max(1, width-lipgloss.Width(leftRendered)-rightW)) + rightStyle.Render(right)
	if lipgloss.Width(row) < width {
		row += strings.Repeat(" ", width-lipgloss.Width(row))
	}
	return row
}

func workspaceSingleLine(s string) string {
	s = strings.ReplaceAll(s, "\r", " ")
	s = strings.ReplaceAll(s, "\n", " ")
	s = strings.TrimSpace(s)
	for strings.Contains(s, "  ") {
		s = strings.ReplaceAll(s, "  ", " ")
	}
	return s
}

func renderWorkspaceExplorerFooter(m *WorkspaceShellModel, width int) string {
	gitLine := lipgloss.NewStyle().Foreground(SubText).Render(workspaceShellGitBadge(m))
	if strings.TrimSpace(gitLine) == "" {
		gitLine = lipgloss.NewStyle().Foreground(Dim).Render("⑂ local repo")
	}
	treeLine := lipgloss.NewStyle().Foreground(Dim).Render(coalesce(strings.TrimSpace(m.CurrentDir), "Project root"))
	meta := fmt.Sprintf("%d files", len(m.Entries))
	if len(m.Git.Status) > 0 {
		meta = fmt.Sprintf("%s  ·  %d changed", meta, len(m.Git.Status))
	}
	metaLine := lipgloss.NewStyle().Foreground(Dim).Render(meta)
	lines := []string{
		HLine(width, workspaceShellLine),
		gitLine,
		treeLine,
		metaLine,
	}
	return strings.Join(lines, "\n")
}

func renderWorkspaceStatusBody(m *WorkspaceShellModel, stats *api.StatsResponse, width, height int) string {
	lines := []string{
		lipgloss.NewStyle().Foreground(Dim).Render("project"),
		lipgloss.NewStyle().Foreground(White).Render(coalesce(m.CurrentProject, "--")),
		"",
		lipgloss.NewStyle().Foreground(Dim).Render("branch"),
		lipgloss.NewStyle().Foreground(White).Render(coalesce(m.Git.Branch, "--")),
		"",
		lipgloss.NewStyle().Foreground(Dim).Render("sessions"),
		lipgloss.NewStyle().Foreground(White).Render(fmt.Sprintf("%d total", len(m.AgentsForCurrent()))),
	}
	if stats != nil {
		lines = append(lines,
			"",
			lipgloss.NewStyle().Foreground(Dim).Render("system"),
			lipgloss.NewStyle().Foreground(White).Render(fmt.Sprintf("%d working / %d idle", stats.WorkingAgents, stats.IdleAgents)),
		)
	}
	if !m.LastSync.IsZero() {
		lines = append(lines,
			"",
			lipgloss.NewStyle().Foreground(Dim).Render("refreshed "+m.LastSync.Format("3:04:05 PM")),
		)
	}
	return strings.Join(padOrTrimLines(lines, height), "\n")
}

func renderWorkspaceToolsBody(width, height int) string {
	lines := []string{
		lipgloss.NewStyle().Foreground(White).Bold(true).Render("Tools"),
		"",
		lipgloss.NewStyle().Foreground(SubText).Render("Open the full tool manager with `u`."),
		"",
		lipgloss.NewStyle().Foreground(Dim).Render("This workspace stays focused on files and the terminal."),
	}
	return strings.Join(padOrTrimLines(lines, height), "\n")
}

func padOrTrimLines(lines []string, height int) []string {
	if height <= 0 {
		return nil
	}
	if len(lines) > height {
		return lines[:height]
	}
	for len(lines) < height {
		lines = append(lines, "")
	}
	return lines
}

func wrapSimple(text string, width int) []string {
	text = strings.TrimSpace(text)
	if text == "" || width <= 4 {
		return []string{text}
	}
	words := strings.Fields(text)
	if len(words) == 0 {
		return []string{""}
	}
	lines := []string{}
	current := words[0]
	for _, word := range words[1:] {
		candidate := current + " " + word
		if lipgloss.Width(candidate) <= width {
			current = candidate
			continue
		}
		lines = append(lines, current)
		current = word
	}
	lines = append(lines, current)
	return lines
}
