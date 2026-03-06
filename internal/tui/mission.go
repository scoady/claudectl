package tui

import (
	"fmt"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/scoady/claudectl/internal/api"
)

// ── Mission pane styles ─────────────────────────────────────────────────────

var (
	paneFocusBorder = lipgloss.RoundedBorder()
	paneDimBorder   = lipgloss.RoundedBorder()
)

// ── Pane model ──────────────────────────────────────────────────────────────

// MissionPane holds the state for one agent pane inside mission control.
type MissionPane struct {
	SessionID   string
	ProjectName string
	Task        string
	Status      string
	Model       string
	Phase       string
	StartTime   time.Time

	// Content buffer — ring buffer of lines
	lines    []string
	lineHead int // next write position (for ring)
	lineLen  int // number of valid lines
	rawTail  strings.Builder // partial line accumulator

	// Tool badges
	badges []string

	// Activity tracker
	spark *SparklineTracker

	// Done overlay
	done bool
}

const maxPaneLines = 500

// NewMissionPane creates a pane for the given agent.
func NewMissionPane(agent api.Agent) *MissionPane {
	started := time.Now()
	if agent.StartedAt != "" {
		for _, layout := range []string{
			time.RFC3339, time.RFC3339Nano,
			"2006-01-02T15:04:05", "2006-01-02 15:04:05",
		} {
			if t, err := time.Parse(layout, agent.StartedAt); err == nil {
				started = t
				break
			}
		}
	}
	return &MissionPane{
		SessionID:   agent.SessionID,
		ProjectName: agent.ProjectName,
		Task:        agent.Task,
		Status:      agent.Status,
		Model:       agent.Model,
		Phase:       agent.Phase,
		StartTime:   started,
		lines:       make([]string, maxPaneLines),
		spark:       NewSparklineTracker(20),
	}
}

// AppendText adds streamed text to the pane buffer.
func (p *MissionPane) AppendText(text string) {
	// Split incoming text on newlines
	p.rawTail.WriteString(text)
	raw := p.rawTail.String()
	parts := strings.Split(raw, "\n")

	if len(parts) == 1 {
		// No newline yet — keep accumulating
		return
	}

	// All but last part are complete lines
	for i := 0; i < len(parts)-1; i++ {
		p.pushLine(parts[i])
	}

	// Last part is a partial line for next time
	p.rawTail.Reset()
	p.rawTail.WriteString(parts[len(parts)-1])
}

func (p *MissionPane) pushLine(line string) {
	p.lines[p.lineHead] = line
	p.lineHead = (p.lineHead + 1) % maxPaneLines
	if p.lineLen < maxPaneLines {
		p.lineLen++
	}
}

// FlushPartial pushes any buffered partial line.
func (p *MissionPane) FlushPartial() {
	if p.rawTail.Len() > 0 {
		p.pushLine(p.rawTail.String())
		p.rawTail.Reset()
	}
}

// TailLines returns the last n lines from the buffer.
func (p *MissionPane) TailLines(n int) []string {
	if n <= 0 || p.lineLen == 0 {
		return nil
	}
	if n > p.lineLen {
		n = p.lineLen
	}

	out := make([]string, n)
	// lineHead points to the next write slot, so the most recent is lineHead-1
	start := (p.lineHead - n + maxPaneLines) % maxPaneLines
	for i := 0; i < n; i++ {
		out[i] = p.lines[(start+i)%maxPaneLines]
	}
	return out
}

// AddBadge adds a tool badge, keeping at most 6.
func (p *MissionPane) AddBadge(toolName, input string) {
	badge := RenderToolBadge(toolName, input)
	p.badges = append(p.badges, badge)
	if len(p.badges) > 6 {
		p.badges = p.badges[len(p.badges)-6:]
	}
	p.spark.Record()
}

// ── Mission control model ───────────────────────────────────────────────────

// MissionModel is the mission control multi-agent dashboard.
type MissionModel struct {
	panes     []*MissionPane
	paneIndex map[string]int // session_id → pane index
	focused   int            // which pane is focused
	width     int
	height    int
	connected bool
	wsClient  *WSClient
	apiClient *api.Client
}

// NewMissionModel creates a new mission control model.
func NewMissionModel(agents []api.Agent, wsClient *WSClient, apiClient *api.Client) MissionModel {
	m := MissionModel{
		paneIndex: make(map[string]int),
		wsClient:  wsClient,
		apiClient: apiClient,
	}

	// Create panes for active agents
	for _, ag := range agents {
		if ag.Status == "done" || ag.Status == "complete" || ag.Status == "error" || ag.Status == "cancelled" {
			continue
		}
		m.addPane(ag)
	}

	return m
}

func (m *MissionModel) addPane(agent api.Agent) {
	if _, exists := m.paneIndex[agent.SessionID]; exists {
		return
	}
	idx := len(m.panes)
	m.panes = append(m.panes, NewMissionPane(agent))
	m.paneIndex[agent.SessionID] = idx
}

// PaneCount returns the number of active panes.
func (m *MissionModel) PaneCount() int {
	return len(m.panes)
}

// FocusedPane returns the currently focused pane, or nil.
func (m *MissionModel) FocusedPane() *MissionPane {
	if m.focused >= 0 && m.focused < len(m.panes) {
		return m.panes[m.focused]
	}
	return nil
}

// Init implements tea.Model (no-op; WS connect is triggered by app).
func (m MissionModel) Init() tea.Cmd {
	return nil
}

// Update handles messages for mission control.
func (m MissionModel) Update(msg tea.Msg) (MissionModel, tea.Cmd) {
	switch msg := msg.(type) {

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height

	case tea.KeyMsg:
		return m.handleKey(msg)

	case WSConnectedMsg:
		m.connected = true

	case WSDisconnectedMsg:
		m.connected = false

	case WSTextChunkMsg:
		if idx, ok := m.paneIndex[msg.SessionID]; ok {
			m.panes[idx].AppendText(msg.Text)
			if m.panes[idx].Status != "working" && m.panes[idx].Status != "active" {
				m.panes[idx].Status = "working"
			}
		}

	case WSMilestoneMsg:
		if idx, ok := m.paneIndex[msg.SessionID]; ok {
			m.panes[idx].AddBadge(msg.ToolName, msg.Input)
		}

	case WSPhaseChangeMsg:
		if idx, ok := m.paneIndex[msg.SessionID]; ok {
			m.panes[idx].Phase = msg.Phase
		}

	case WSAgentDoneMsg:
		if idx, ok := m.paneIndex[msg.SessionID]; ok {
			m.panes[idx].done = true
			m.panes[idx].Status = "done"
			m.panes[idx].FlushPartial()
		}

	case WSAgentSpawnedMsg:
		if _, exists := m.paneIndex[msg.SessionID]; !exists {
			ag := api.Agent{
				SessionID:   msg.SessionID,
				ProjectName: msg.Project,
				Task:        msg.Task,
				Status:      "working",
			}
			m.addPane(ag)
		}
	}

	return m, nil
}

func (m MissionModel) handleKey(msg tea.KeyMsg) (MissionModel, tea.Cmd) {
	key := msg.String()

	switch key {
	case "esc":
		return m, func() tea.Msg { return NavigateMsg{Screen: ScreenDashboard} }

	case "tab":
		// Cycle focus forward
		if len(m.panes) > 0 {
			m.focused = (m.focused + 1) % len(m.panes)
		}

	case "shift+tab":
		// Cycle focus backward
		if len(m.panes) > 0 {
			m.focused = (m.focused - 1 + len(m.panes)) % len(m.panes)
		}

	case "enter":
		// Expand focused pane to full watch view
		pane := m.FocusedPane()
		if pane != nil {
			ag := api.Agent{
				SessionID:   pane.SessionID,
				ProjectName: pane.ProjectName,
				Task:        pane.Task,
				Status:      pane.Status,
				Model:       pane.Model,
				Phase:       pane.Phase,
			}
			return m, func() tea.Msg {
				return NavigateMsg{Screen: ScreenWatch, Agent: &ag}
			}
		}

	case "i":
		// Inject into focused pane
		pane := m.FocusedPane()
		if pane != nil && !pane.done {
			sid := pane.SessionID
			return m, func() tea.Msg {
				return ShowInjectMsg{SessionID: sid}
			}
		}

	case "K":
		// Kill focused pane agent
		pane := m.FocusedPane()
		if pane != nil && !pane.done {
			sid := pane.SessionID
			return m, func() tea.Msg {
				return ShowConfirmMsg{
					Title:       "Kill Agent",
					Description: "Kill agent " + truncate(sid, 20) + "?",
					Destructive: true,
					OnConfirm: func() tea.Msg {
						if m.apiClient != nil {
							err := m.apiClient.KillAgent(sid)
							return KillResultMsg{SessionID: sid, Err: err}
						}
						return KillResultMsg{SessionID: sid}
					},
				}
			}
		}

	case "1", "2", "3", "4", "5", "6", "7", "8", "9":
		idx := int(key[0]-'0') - 1
		if idx < len(m.panes) {
			m.focused = idx
		}
	}

	return m, nil
}

// ── Layout calculation ──────────────────────────────────────────────────────

// gridLayout returns (cols, rows) for a given pane count.
func gridLayout(count int) (int, int) {
	switch {
	case count <= 0:
		return 1, 1
	case count == 1:
		return 1, 1
	case count == 2:
		return 2, 1
	case count <= 4:
		return 2, 2
	case count <= 6:
		return 3, 2
	case count <= 9:
		return 3, 3
	default:
		// For 10+ agents, 4-wide grid
		cols := 4
		rows := (count + cols - 1) / cols
		return cols, rows
	}
}

// ── View rendering ──────────────────────────────────────────────────────────

// View renders the full mission control screen.
func (m MissionModel) View() string {
	if m.width == 0 || m.height == 0 {
		return "Initializing Mission Control..."
	}

	if len(m.panes) == 0 {
		return m.renderEmpty()
	}

	// Reserve space for status bar (2 lines: separator + bar)
	statusBarHeight := 2
	availHeight := m.height - statusBarHeight
	if availHeight < 4 {
		availHeight = 4
	}

	cols, rows := gridLayout(len(m.panes))

	// Compute pane dimensions
	ly := NewLayout(m.width, m.height)
	paneW := m.width / cols
	paneH := availHeight / rows
	if paneW < ly.MissionPaneMinW {
		paneW = ly.MissionPaneMinW
	}
	if paneH < ly.MissionPaneMinH {
		paneH = ly.MissionPaneMinH
	}

	// Build grid rows
	var gridRows []string
	paneIdx := 0

	for r := 0; r < rows; r++ {
		var rowPanes []string
		for c := 0; c < cols; c++ {
			if paneIdx < len(m.panes) {
				isFocused := paneIdx == m.focused
				rendered := m.renderPane(m.panes[paneIdx], paneW, paneH, isFocused, paneIdx+1)
				rowPanes = append(rowPanes, rendered)
			} else {
				// Empty cell
				rowPanes = append(rowPanes, m.renderEmptyPane(paneW, paneH))
			}
			paneIdx++
		}
		gridRows = append(gridRows, lipgloss.JoinHorizontal(lipgloss.Top, rowPanes...))
	}

	grid := lipgloss.JoinVertical(lipgloss.Left, gridRows...)

	// Status bar
	statusBar := m.renderStatusBar()

	return lipgloss.JoinVertical(lipgloss.Left, grid, statusBar)
}

func (m MissionModel) renderPane(pane *MissionPane, width, height int, focused bool, num int) string {
	// Border styling
	borderColor := BorderColor
	if focused {
		borderColor = GlowBorder
	}
	if pane.done {
		borderColor = Green
	}

	paneStyle := lipgloss.NewStyle().
		Border(paneFocusBorder).
		BorderForeground(borderColor).
		Width(width - 2). // subtract border
		Height(height - 2).
		Background(Surface0)

	// Interior width/height after padding
	innerW := width - 4 // 2 border + 2 padding
	if innerW < 10 {
		innerW = 10
	}
	innerH := height - 4
	if innerH < 2 {
		innerH = 2
	}

	// ── Header (2 lines) ──
	header := m.renderPaneHeader(pane, innerW, focused, num)
	headerLines := 2

	// ── Badge bar (1 line) ──
	badgeLine := m.renderPaneBadges(pane, innerW)
	badgeLines := 1

	// ── Content area ──
	contentLines := innerH - headerLines - badgeLines
	if contentLines < 1 {
		contentLines = 1
	}

	// Get tail lines for display
	lines := pane.TailLines(contentLines)

	// Also include partial line
	partial := pane.rawTail.String()
	if partial != "" {
		lines = append(lines, partial)
		if len(lines) > contentLines {
			lines = lines[len(lines)-contentLines:]
		}
	}

	// If no streamed content, show task description as placeholder
	if len(lines) == 0 && pane.Task != "" {
		taskLabel := lipgloss.NewStyle().Foreground(Dim).Italic(true).Render("Task:")
		// Word-wrap task into multiple lines
		taskText := pane.Task
		wrappedLines := wrapText(taskText, innerW-2)
		lines = append(lines, taskLabel)
		for _, wl := range wrappedLines {
			lines = append(lines, Class("faint").Render("  "+wl))
		}
		if len(lines) > contentLines {
			lines = lines[:contentLines]
		}
	}

	// Wrap lines to fit inner width and render
	var contentBuf strings.Builder
	rendered := 0
	for _, line := range lines {
		if rendered > 0 {
			contentBuf.WriteByte('\n')
		}
		// Truncate long lines rather than wrap to keep panes clean
		display := line
		if lipgloss.Width(display) > innerW {
			display = truncate(display, innerW)
		}
		contentBuf.WriteString(Class("sub").Render(display))
		rendered++
	}

	// Pad remaining lines
	for rendered < contentLines {
		if rendered > 0 {
			contentBuf.WriteByte('\n')
		}
		contentBuf.WriteString("")
		rendered++
	}

	// Done overlay
	if pane.done {
		overlay := m.renderDoneOverlay(contentLines, innerW)
		content := header + "\n" + overlay + "\n" + badgeLine
		return paneStyle.Render(content)
	}

	content := header + "\n" + contentBuf.String() + "\n" + badgeLine
	return paneStyle.Render(content)
}

func (m MissionModel) renderPaneHeader(pane *MissionPane, width int, focused bool, num int) string {
	// Line 1: number + session ID + status + elapsed
	numStr := lipgloss.NewStyle().Foreground(Cyan).Bold(true).Render(fmt.Sprintf("[%d]", num))

	sid := pane.SessionID
	if len(sid) > 12 {
		sid = sid[:12] + ".."
	}
	sidStr := lipgloss.NewStyle().Foreground(Faint).Render(sid)

	statusStr := miniStatusPill(pane.Status)

	elapsed := time.Since(pane.StartTime).Round(time.Second)
	elapsedStr := Class("dim").Render(formatElapsed(elapsed))

	// Sparkline in header
	sparkVals := pane.spark.Values()
	sparkStr := ""
	sparkWidth := 10
	if width > 60 {
		sparkWidth = 14
	}
	if len(sparkVals) > 0 {
		sparkStr = " " + RenderSparklineStyled(sparkVals, sparkWidth, Cyan)
	}

	line1 := numStr + " " + sidStr + " " + statusStr + " " + elapsedStr + sparkStr

	// Line 2: project name + phase
	projStr := lipgloss.NewStyle().Foreground(White).Bold(true).Render(truncate(pane.ProjectName, 16))

	phaseStr := ""
	if pane.Phase != "" {
		phaseStr = lipgloss.NewStyle().Foreground(Purple).Render(truncate(pane.Phase, 12))
	}

	line2 := projStr
	if phaseStr != "" {
		line2 += " " + phaseStr
	}

	return line1 + "\n" + line2
}

func (m MissionModel) renderPaneBadges(pane *MissionPane, width int) string {
	if len(pane.badges) == 0 {
		return Class("faint").Render(strings.Repeat("─", minInt(width, 30)))
	}

	// Show badges right-to-left, fitting in available width
	available := width
	shown := []string{}
	totalW := 0
	for i := len(pane.badges) - 1; i >= 0; i-- {
		bw := lipgloss.Width(pane.badges[i])
		if totalW+bw+1 > available {
			break
		}
		shown = append([]string{pane.badges[i]}, shown...)
		totalW += bw + 1
	}

	return strings.Join(shown, " ")
}

func (m MissionModel) renderDoneOverlay(height, width int) string {
	var buf strings.Builder

	// Center a "DONE" badge vertically
	padTop := height / 2
	if padTop > 0 {
		padTop--
	}

	for i := 0; i < padTop; i++ {
		buf.WriteByte('\n')
	}

	doneBadge := lipgloss.NewStyle().
		Bold(true).
		Foreground(Green).
		Background(BadgeGreenBg).
		Padding(0, 2).
		Render(" DONE ")

	// Center horizontally
	badgeW := lipgloss.Width(doneBadge)
	leftPad := (width - badgeW) / 2
	if leftPad < 0 {
		leftPad = 0
	}
	buf.WriteString(repeatStr(" ", leftPad) + doneBadge)

	// Fill remaining
	remaining := height - padTop - 1
	for i := 0; i < remaining; i++ {
		buf.WriteByte('\n')
	}

	return buf.String()
}

func (m MissionModel) renderEmptyPane(width, height int) string {
	return lipgloss.NewStyle().
		Border(paneDimBorder).
		BorderForeground(Muted).
		Width(width - 2).
		Height(height - 2).
		Foreground(Faint).
		Render("")
}

func (m MissionModel) renderEmpty() string {
	// No agents — show centered message
	msg := lipgloss.NewStyle().
		Foreground(Dim).
		Render("No active agents. Dispatch a task to get started.")

	hint := Class("faint").Render("Press Esc to go back, or Ctrl+D to dispatch.")

	content := msg + "\n\n" + hint

	return lipgloss.Place(m.width, m.height, lipgloss.Center, lipgloss.Center, content)
}

func (m MissionModel) renderStatusBar() string {
	activeCount := 0
	doneCount := 0
	for _, p := range m.panes {
		if p.done {
			doneCount++
		} else {
			activeCount++
		}
	}

	// Separator
	sep := HLine(m.width, Muted)

	// Connection indicator
	connIcon := Class("header-status-ok").Render("●")
	if !m.connected {
		connIcon = Class("header-status-err").Render("○")
	}

	// Status text
	title := Class("logo").Render(" Mission Control")
	agentInfo := Class("dim").Render(fmt.Sprintf(" %d active", activeCount))
	if doneCount > 0 {
		agentInfo += lipgloss.NewStyle().Foreground(Green).Render(fmt.Sprintf("  %d done", doneCount))
	}

	left := " " + connIcon + title + agentInfo

	// Key hints
	hints := renderKeyHints([]KeyHint{
		{"Tab", "focus"},
		{"Enter", "expand"},
		{"i", "inject"},
		{"K", "kill"},
		{"1-9", "jump"},
		{"Esc", "back"},
	})

	right := hints + " "

	// Fill gap
	leftW := lipgloss.Width(left)
	rightW := lipgloss.Width(right)
	gap := m.width - leftW - rightW
	if gap < 1 {
		gap = 1
	}

	bar := Class("footer-bar").Width(m.width).Render(left + repeatStr(" ", gap) + right)

	return sep + "\n" + bar
}

// ── Helpers ─────────────────────────────────────────────────────────────────

// miniStatusPill renders a compact status indicator.
func miniStatusPill(status string) string {
	switch status {
	case "working", "active":
		return lipgloss.NewStyle().Foreground(Amber).Bold(true).Render("●")
	case "idle":
		return lipgloss.NewStyle().Foreground(Cyan).Render("◌")
	case "done", "complete":
		return lipgloss.NewStyle().Foreground(Green).Bold(true).Render("✓")
	case "error", "disconnected", "cancelled":
		return lipgloss.NewStyle().Foreground(Rose).Bold(true).Render("✗")
	default:
		return lipgloss.NewStyle().Foreground(Dim).Render("·")
	}
}

func formatElapsed(d time.Duration) string {
	if d < time.Minute {
		return fmt.Sprintf("%ds", int(d.Seconds()))
	}
	if d < time.Hour {
		return fmt.Sprintf("%dm%ds", int(d.Minutes()), int(d.Seconds())%60)
	}
	return fmt.Sprintf("%dh%dm", int(d.Hours()), int(d.Minutes())%60)
}

// wrapText breaks text into lines of at most maxWidth characters, splitting on spaces.
func wrapText(text string, maxWidth int) []string {
	if maxWidth <= 0 {
		return []string{text}
	}
	words := strings.Fields(text)
	if len(words) == 0 {
		return nil
	}
	var lines []string
	current := words[0]
	for _, w := range words[1:] {
		if len(current)+1+len(w) > maxWidth {
			lines = append(lines, current)
			current = w
		} else {
			current += " " + w
		}
	}
	lines = append(lines, current)
	return lines
}
