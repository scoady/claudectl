package tui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/scoady/codexctl/internal/api"
)

var (
	workspaceShellChromeBg = lipgloss.Color("#080b10")
	workspaceShellPanelBg  = lipgloss.Color("#0b0f15")
	workspaceShellDockBg   = lipgloss.Color("#0b0f15")
	workspaceShellLine     = lipgloss.Color("#16202c")
)

type workspaceShellRect struct {
	X int
	Y int
	W int
	H int
}

func (r workspaceShellRect) contains(x, y int) bool {
	return x >= r.X && x < r.X+r.W && y >= r.Y && y < r.Y+r.H
}

type workspaceShellLayout struct {
	Activity   workspaceShellRect
	Sidebar    workspaceShellRect
	Main       workspaceShellRect
	Transcript workspaceShellRect
	Preview    workspaceShellRect
	Composer   workspaceShellRect
	Picker     workspaceShellRect
	Stacked    bool
}

type workspaceShellTabHit struct {
	Name       string
	StartX     int
	EndX       int
	CloseStart int
	CloseEnd   int
	Add        bool
}

type workspaceShellFileTabHit struct {
	Path       string
	StartX     int
	EndX       int
	CloseStart int
	CloseEnd   int
}

type workspaceShellCanvasTabHit struct {
	Name   string
	StartX int
	EndX   int
}

type workspaceShellDockSlot struct {
	Mode      string
	IconLine  int
	LabelLine int
	StartLine int
	EndLine   int
}

func computeWorkspaceShellLayout(width, height int, _ bool) workspaceShellLayout {
	activityW := Clamp(10, Pct(width, 11), 12)
	sidebarW := Clamp(28, Pct(width, 30), 40)
	stacked := width < 100 || height < 22

	layout := workspaceShellLayout{
		Activity: workspaceShellRect{X: 0, Y: 0, W: activityW, H: height},
		Stacked:  stacked,
	}

	if stacked {
		bodyW := max(24, width-activityW-1)
		sidebarH := Clamp(9, Pct(height, 35), 14)
		layout.Sidebar = workspaceShellRect{X: activityW + 1, Y: 0, W: bodyW, H: sidebarH}
		layout.Main = workspaceShellRect{X: activityW + 1, Y: sidebarH + 1, W: bodyW, H: max(10, height-sidebarH-1)}
	} else {
		mainW := max(40, width-activityW-sidebarW-2)
		layout.Sidebar = workspaceShellRect{X: activityW + 1, Y: 0, W: sidebarW, H: height}
		layout.Main = workspaceShellRect{X: activityW + sidebarW + 2, Y: 0, W: mainW, H: height}
	}

	layout.Transcript = workspaceShellRect{
		X: layout.Main.X + 1,
		Y: layout.Main.Y + 3,
		W: max(12, layout.Main.W-2),
		H: max(4, layout.Main.H-8),
	}
	layout.Composer = workspaceShellRect{
		X: layout.Main.X + 1,
		Y: layout.Main.Y + layout.Main.H - 3,
		W: max(12, layout.Main.W-2),
		H: 2,
	}
	layout.Picker = workspaceShellRect{
		X: layout.Main.X + 2,
		Y: layout.Main.Y + 6,
		W: max(18, min(layout.Main.W-4, 44)),
		H: max(5, min(layout.Main.H-10, 10)),
	}
	return layout
}

func computeWorkspaceShellAppLayout(width, height int, previewReady bool) workspaceShellLayout {
	bodyHeight := max(6, height-3)
	layout := computeWorkspaceShellLayout(width, bodyHeight, previewReady)
	layout.Activity.Y++
	layout.Sidebar.Y++
	layout.Main.Y++
	layout.Transcript.Y++
	layout.Composer.Y++
	layout.Picker.Y++
	return layout
}

func RenderWorkspaceShell(m *WorkspaceShellModel, stats *api.StatsResponse, health *api.HealthResponse, store *MetricsStore, host workspaceHostMetrics, width, height int) string {
	if height <= 3 {
		return ""
	}
	bodyHeight := max(6, height-3)
	layout := computeWorkspaceShellLayout(width, bodyHeight, false)

	m.SidebarList.SetSize(max(12, layout.Sidebar.W-4), max(4, layout.Sidebar.H-6))
	m.ProjectPicker.SetSize(max(18, layout.Picker.W-2), max(4, layout.Picker.H-2))
	m.Composer.Width = max(12, layout.Composer.W-6)

	activity := renderWorkspaceActivityPane(m, layout.Activity)
	sidebar := renderWorkspaceSidebarPane(m, stats, layout.Sidebar)
	main := renderWorkspaceTerminalPane(m, health, layout)

	var body string
	if layout.Stacked {
		body = lipgloss.JoinHorizontal(lipgloss.Top, activity, " ", lipgloss.JoinVertical(lipgloss.Left, sidebar, main))
	} else {
		body = lipgloss.JoinHorizontal(lipgloss.Top, activity, " ", sidebar, " ", main)
	}
	return strings.Join([]string{
		renderWorkspaceTopStrip(m, stats, health, store, host, width),
		body,
		renderWorkspaceBottomStrip(m, width),
	}, "\n")
}

func renderWorkspaceActivityPane(m *WorkspaceShellModel, rect workspaceShellRect) string {
	iconColors := map[string]lipgloss.Color{
		workspaceDockFiles:   Cyan,
		workspaceDockCanvas:  Green,
		workspaceDockTasks:   Green,
		workspaceDockMetrics: Purple,
		workspaceDockTools:   Amber,
	}
	iconGlyphs := map[string]string{
		workspaceDockFiles:   "▗▆▖",
		workspaceDockCanvas:  "▚▞▟",
		workspaceDockTasks:   "◖◉◗",
		workspaceDockMetrics: "▁▅█",
		workspaceDockTools:   "┠┼┨",
	}
	labelText := map[string]string{
		workspaceDockFiles:   "files",
		workspaceDockCanvas:  "canvas",
		workspaceDockTasks:   "tasks",
		workspaceDockMetrics: "stats",
		workspaceDockTools:   "tools",
	}

	contentH := max(6, rect.H-2)
	lines := make([]string, contentH)
	lines[0] = lipgloss.NewStyle().Foreground(Cyan).Bold(true).Align(lipgloss.Center).Width(rect.W - 2).Render("c9")
	for _, slot := range workspaceShellDockSlots(contentH) {
		itemMode := slot.Mode
		var item workspaceDockItem
		for _, candidate := range workspaceDockItems() {
			if candidate.Mode == itemMode {
				item = candidate
				break
			}
		}
		color := iconColors[item.Mode]
		icon := lipgloss.NewStyle().
			Width(rect.W - 2).
			Align(lipgloss.Center).
			Foreground(color).
			Bold(true).
			Render(iconGlyphs[item.Mode])
		label := lipgloss.NewStyle().
			Width(rect.W - 2).
			Align(lipgloss.Center).
			Foreground(Dim).
			Faint(true).
			Render(labelText[item.Mode])
		if item.Mode == m.DockMode {
			icon = lipgloss.NewStyle().
				Width(rect.W - 2).
				Align(lipgloss.Center).
				Foreground(color).
				Bold(true).
				Render(iconGlyphs[item.Mode])
			label = lipgloss.NewStyle().
				Width(rect.W - 2).
				Align(lipgloss.Center).
				Foreground(White).
				Faint(true).
				Render(labelText[item.Mode])
		}
		if slot.IconLine >= 0 && slot.IconLine < len(lines) {
			lines[slot.IconLine] = icon
		}
		if slot.LabelLine >= 0 && slot.LabelLine < len(lines) {
			lines[slot.LabelLine] = label
		}
	}

	return lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(focusBorder(m.FocusPane == 0)).
		Padding(0, 1).
		Width(rect.W).
		Height(rect.H).
		Background(workspaceShellDockBg).
		Render(strings.Join(lines, "\n"))
}

func workspaceShellDockSlots(contentH int) []workspaceShellDockSlot {
	items := workspaceDockItems()
	if contentH <= 2 || len(items) == 0 {
		return nil
	}
	rows := contentH - 1 // reserve top row for the c9 mark
	tileRows := len(items) * 2
	free := rows - tileRows
	if free < 0 {
		free = 0
	}
	gap := 0
	rem := 0
	if len(items)+1 > 0 {
		gap = free / (len(items) + 1)
		rem = free % (len(items) + 1)
	}
	nextGap := func() int {
		extra := gap
		if rem > 0 {
			extra++
			rem--
		}
		return extra
	}
	cur := 1 + nextGap()
	slots := make([]workspaceShellDockSlot, 0, len(items))
	for _, item := range items {
		start := min(contentH-2, cur)
		label := min(contentH-1, start+1)
		slots = append(slots, workspaceShellDockSlot{
			Mode:      item.Mode,
			IconLine:  start,
			LabelLine: label,
			StartLine: start,
			EndLine:   label,
		})
		cur = label + 1 + nextGap()
	}
	return slots
}

func renderWorkspaceSidebarPane(m *WorkspaceShellModel, stats *api.StatsResponse, rect workspaceShellRect) string {
	var body string
	switch m.DockMode {
	case workspaceDockFiles, workspaceDockTasks, workspaceDockCanvas:
		body = m.SidebarList.View()
	case workspaceDockMetrics:
		body = renderWorkspaceStatusBody(m, stats, rect.W-4, rect.H-6)
	case workspaceDockTools:
		body = renderWorkspaceToolsBody(rect.W-4, rect.H-6)
	}

	content := strings.Join([]string{
		lipgloss.NewStyle().Foreground(White).Bold(true).Render(workspaceShellDockTitle(m.DockMode)),
		lipgloss.NewStyle().Foreground(Dim).Render(workspaceShellDockSubtitle(m)),
		"",
		body,
	}, "\n")

	return lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(focusBorder(m.FocusPane == 1)).
		Padding(0, 1).
		Width(rect.W).
		Height(rect.H).
		Background(workspaceShellPanelBg).
		Render(content)
}

func renderWorkspaceTerminalPane(m *WorkspaceShellModel, health *api.HealthResponse, layout workspaceShellLayout) string {
	innerW := max(12, layout.Main.W-4)
	innerH := max(8, layout.Main.H-2)
	transcriptH := max(4, innerH-6)

	projectName := "No project"
	projectPath := "Press p to choose a project"
	if cur := m.Current(); cur != nil {
		projectName = cur.Name
		projectPath = truncate(cur.Path, max(18, innerW-24))
	}
	branch := "--"
	if strings.TrimSpace(m.GitBranch) != "" {
		branch = m.GitBranch
	}

	tabW := max(12, innerW-14)
	tabLine, _ := workspaceShellRenderTabLine(m, tabW)
	branchLabel := lipgloss.NewStyle().Foreground(SubText).Render("git " + branch)
	header1 := tabLine + strings.Repeat(" ", max(1, innerW-lipgloss.Width(tabLine)-lipgloss.Width(branchLabel))) + branchLabel
	header2 := workspaceShellAlignedRow(
		projectName+"  "+projectPath,
		workspaceShellLiveLabel(m, health),
		innerW,
		lipgloss.NewStyle().Foreground(Dim),
		lipgloss.NewStyle().Foreground(Cyan),
	)

	if !m.ProjectPickerOpen && m.DockMode == workspaceDockCanvas && !m.EditorActive {
		return renderWorkspaceCanvasPane(m, layout, innerW, innerH, header1, header2)
	}

	if !m.ProjectPickerOpen && m.EditorActive && m.ActiveFileTab != "" {
		fileTabLine, _ := workspaceShellRenderFileTabLine(m, innerW)
		fileStatus := "saved"
		if m.EditorDirty {
			fileStatus = "modified"
		}
		infoRow := workspaceShellAlignedRow(
			coalesce(m.ActiveFileTab, "file"),
			fileStatus,
			innerW,
			lipgloss.NewStyle().Foreground(SubText),
			lipgloss.NewStyle().Foreground(Cyan),
		)
		editorH := max(4, innerH-6)
		m.Editor.SetWidth(innerW)
		m.Editor.SetHeight(editorH)
		editorLines := padOrTrimLines(strings.Split(m.Editor.View(), "\n"), editorH)
		lines := []string{
			header1,
			header2,
			HLine(innerW, workspaceShellLine),
			fileTabLine,
			infoRow,
			HLine(innerW, workspaceShellLine),
		}
		lines = append(lines, editorLines...)
		lines = padOrTrimLines(lines, innerH)
		return lipgloss.NewStyle().
			Border(lipgloss.RoundedBorder()).
			BorderForeground(focusBorder(m.FocusPane == 2 || m.EditorActive)).
			Padding(0, 1).
			Width(layout.Main.W).
			Height(layout.Main.H).
			Background(workspaceShellPanelBg).
			Render(strings.Join(lines, "\n"))
	}

	transcriptLines := []string{}
	if m.ProjectPickerOpen {
		pickerLines := strings.Split(m.ProjectPicker.View(), "\n")
		transcriptLines = append(transcriptLines,
			lipgloss.NewStyle().Foreground(Cyan).Bold(true).Render("Projects"),
			lipgloss.NewStyle().Foreground(Dim).Render("Switch workspace"),
			"",
		)
		transcriptLines = append(transcriptLines, pickerLines...)
	} else {
		m.SessionViewport.Width = innerW
		m.SessionViewport.Height = transcriptH
		m.refreshSessionViewport()
		transcriptLines = strings.Split(m.SessionViewport.View(), "\n")
	}
	transcriptLines = padOrTrimLines(transcriptLines, transcriptH)
	m.Composer.Prompt = workspaceShellPassThroughPrompt(m.PassThrough)
	lines := []string{
		header1,
		header2,
		HLine(innerW, workspaceShellLine),
	}
	lines = append(lines, transcriptLines...)
	lines = append(lines,
		HLine(innerW, workspaceShellLine),
		m.Composer.View(),
	)
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

func renderWorkspaceCanvasPane(m *WorkspaceShellModel, layout workspaceShellLayout, innerW, innerH int, header1, header2 string) string {
	tabLine, _ := workspaceShellRenderCanvasTabLine(m, innerW)
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

func workspaceShellRenderFileTabLine(m *WorkspaceShellModel, width int) (string, []workspaceShellFileTabHit) {
	if width <= 8 {
		return "", nil
	}
	hits := make([]workspaceShellFileTabHit, 0, len(m.OpenFileTabs))
	parts := make([]string, 0, len(m.OpenFileTabs))
	x := 0
	for _, path := range m.OpenFileTabs {
		label := "  " + truncate(filepathBase(path), 20) + dirtySuffixForPath(m, path) + "  ×  "
		style := lipgloss.NewStyle().
			Foreground(SubText)
		if path == m.ActiveFileTab {
			style = style.
				Foreground(White).
				Bold(true)
		}
		rendered := style.Render(label)
		partW := lipgloss.Width(rendered)
		if x+partW > width {
			break
		}
		hits = append(hits, workspaceShellFileTabHit{
			Path:       path,
			StartX:     x,
			EndX:       x + partW,
			CloseStart: x + max(0, partW-5),
			CloseEnd:   x + partW,
		})
		parts = append(parts, rendered)
		x += partW + 1
	}
	line := strings.Join(parts, " ")
	if lipgloss.Width(line) < width {
		line += strings.Repeat(" ", width-lipgloss.Width(line))
	}
	return line, hits
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

func workspaceShellRenderTabLine(m *WorkspaceShellModel, width int) (string, []workspaceShellTabHit) {
	if width <= 8 {
		return "", nil
	}
	hits := make([]workspaceShellTabHit, 0, len(m.OpenProjectTabs)+1)
	parts := make([]string, 0, len(m.OpenProjectTabs)+1)
	x := 0
	for _, tab := range m.OpenProjectTabs {
		label := "  " + truncate(tab, 18) + "  ×  "
		style := lipgloss.NewStyle().
			Foreground(SubText).
			Padding(0, 0)
		if tab == m.CurrentProject {
			style = style.
				Foreground(White).
				Bold(true)
		}
		rendered := style.Render(label)
		partW := lipgloss.Width(rendered)
		if x+partW > width-4 {
			break
		}
		hits = append(hits, workspaceShellTabHit{
			Name:       tab,
			StartX:     x,
			EndX:       x + partW,
			CloseStart: x + max(0, partW-5),
			CloseEnd:   x + partW,
		})
		parts = append(parts, rendered)
		x += partW + 1
	}
	addLabel := lipgloss.NewStyle().
		Foreground(Cyan).
		Bold(true).
		Render("  +  ")
	if x+lipgloss.Width(addLabel) <= width {
		hits = append(hits, workspaceShellTabHit{
			Add:    true,
			StartX: max(0, x-1),
			EndX:   x + lipgloss.Width(addLabel) + 2,
		})
		parts = append(parts, addLabel)
	}
	line := strings.Join(parts, " ")
	if lipgloss.Width(line) < width {
		line += strings.Repeat(" ", width-lipgloss.Width(line))
	}
	return line, hits
}

func workspaceShellRenderCanvasTabLine(m *WorkspaceShellModel, width int) (string, []workspaceShellCanvasTabHit) {
	if width <= 8 {
		return "", nil
	}
	hits := make([]workspaceShellCanvasTabHit, 0, len(m.CanvasTabs))
	parts := make([]string, 0, len(m.CanvasTabs))
	x := 0
	for _, tab := range m.CanvasTabs {
		label := "  " + truncate(tab, 18) + "  "
		style := lipgloss.NewStyle().Foreground(SubText)
		if tab == m.ActiveCanvas {
			style = style.Foreground(White).Bold(true)
		}
		rendered := style.Render(label)
		partW := lipgloss.Width(rendered)
		if x+partW > width {
			break
		}
		hits = append(hits, workspaceShellCanvasTabHit{Name: tab, StartX: x, EndX: x + partW})
		parts = append(parts, rendered)
		x += partW + 1
	}
	line := strings.Join(parts, " ")
	if lipgloss.Width(line) < width {
		line += strings.Repeat(" ", width-lipgloss.Width(line))
	}
	return line, hits
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
	left = strings.TrimSpace(left)
	right = strings.TrimSpace(right)
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

func workspaceShellComposerMeta(m *WorkspaceShellModel) string {
	box := "☐"
	label := "codex"
	if m.PassThrough {
		box = "☑"
		label = "direct"
	}
	return "enter send  x " + box + " " + label + "  n new  y copy  p projects  tab nav"
}

func workspaceShellPassThroughPrompt(passThrough bool) string {
	box := "□"
	if passThrough {
		box = "▣"
	}
	return box + "  pass thru to os  › "
}

func renderWorkspaceStatusBody(m *WorkspaceShellModel, stats *api.StatsResponse, width, height int) string {
	lines := []string{
		lipgloss.NewStyle().Foreground(Dim).Render("project"),
		lipgloss.NewStyle().Foreground(White).Render(coalesce(m.CurrentProject, "--")),
		"",
		lipgloss.NewStyle().Foreground(Dim).Render("branch"),
		lipgloss.NewStyle().Foreground(White).Render(coalesce(m.GitBranch, "--")),
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
