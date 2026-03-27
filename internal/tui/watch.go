package tui

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/scoady/codexctl/internal/api"
)

// ── Watch model ─────────────────────────────────────────────────────────────

// WatchModel displays live-streamed agent output with auto-scroll.
type WatchModel struct {
	// Agent info
	agent     api.Agent
	sessionID string

	// Viewport for scrollable content
	viewport viewport.Model
	ready    bool

	// Content buffer
	lines    []string
	rawBuf   strings.Builder // accumulates raw text chunks
	badges   []string        // recent tool badges
	maxBadge int             // max badges to show

	// State
	follow     bool // auto-scroll to bottom
	done       bool // agent completed
	connected  bool
	startTime  time.Time
	phase      string
	width      int
	height     int
	showSearch bool
	searchTerm string

	// WS client reference (for cleanup)
	wsClient *WSClient

	// API client for inject/kill
	apiClient *api.Client
}

type WatchHistoryMsg struct {
	Messages []api.Message
	Err      error
}

// NewWatchModel creates a new watch view for the given agent.
func NewWatchModel(agent api.Agent, wsClient *WSClient, apiClient *api.Client) WatchModel {
	vp := viewport.New(80, 20)
	vp.Style = lipgloss.NewStyle()

	return WatchModel{
		agent:     agent,
		sessionID: agent.SessionID,
		viewport:  vp,
		follow:    true,
		maxBadge:  8,
		startTime: time.Now(),
		phase:     agent.Phase,
		done:      agent.Status == "idle" || agent.Status == "done",
		wsClient:  wsClient,
		apiClient: apiClient,
	}
}

// headerHeight returns the number of lines the header occupies.
func (m WatchModel) headerHeight() int {
	return 7 // header box + separator
}

// footerHeight returns the number of lines the footer occupies.
func (m WatchModel) footerHeight() int {
	return 4 // separator + badge bar + key hints
}

// Init implements tea.Model.
func (m WatchModel) Init() tea.Cmd {
	return m.loadHistoryCmd()
}

// Update implements tea.Model.
func (m WatchModel) Update(msg tea.Msg) (WatchModel, tea.Cmd) {
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height
		vpHeight := m.height - m.headerHeight() - m.footerHeight()
		if vpHeight < 3 {
			vpHeight = 3
		}
		vpWidth := m.width
		if vpWidth < 20 {
			vpWidth = 20
		}
		if !m.ready {
			m.viewport = viewport.New(vpWidth, vpHeight)
			m.viewport.Style = lipgloss.NewStyle()
			m.ready = true
		} else {
			m.viewport.Width = vpWidth
			m.viewport.Height = vpHeight
		}
		m.refreshContent()

	case tea.KeyMsg:
		switch msg.String() {
		case "esc":
			return m, func() tea.Msg { return NavigateMsg{Screen: ScreenAgents} }
		case "k":
			// Kill agent
			if m.sessionID != "" && !m.done {
				return m, m.killAgentCmd()
			}
		case "f":
			m.follow = !m.follow
			if m.follow {
				m.viewport.GotoBottom()
			}
		case "i":
			if m.sessionID != "" && !m.done {
				return m, func() tea.Msg { return ShowInjectMsg{SessionID: m.sessionID} }
			}
		case "G":
			m.viewport.GotoBottom()
			m.follow = true
		case "g":
			m.viewport.GotoTop()
			m.follow = false
		case "/":
			// TODO: search mode
		default:
			// Pass through to viewport for scrolling (up/down/pgup/pgdn)
			var cmd tea.Cmd
			m.viewport, cmd = m.viewport.Update(msg)
			if cmd != nil {
				cmds = append(cmds, cmd)
			}
			// If user scrolled manually, disable follow
			if !m.viewport.AtBottom() {
				m.follow = false
			}
		}

	case WSTextChunkMsg:
		if msg.SessionID == m.sessionID || m.sessionID == "" {
			if m.sessionID == "" {
				m.sessionID = msg.SessionID
			}
			m.rawBuf.WriteString(msg.Text)
			m.refreshContent()
			if m.follow {
				m.viewport.GotoBottom()
			}
		}

	case WSMilestoneMsg:
		if msg.SessionID == m.sessionID {
			badge := RenderToolBadge(msg.ToolName, msg.Input)
			m.badges = append(m.badges, badge)
			if len(m.badges) > m.maxBadge {
				m.badges = m.badges[len(m.badges)-m.maxBadge:]
			}
			// Also add a visual marker in the text stream
			m.rawBuf.WriteString("\n")
			m.refreshContent()
			if m.follow {
				m.viewport.GotoBottom()
			}
		}

	case WSPhaseChangeMsg:
		if msg.SessionID == m.sessionID {
			m.phase = msg.Phase
		}

	case WSAgentDoneMsg:
		if msg.SessionID == m.sessionID {
			m.done = true
			m.agent.Status = "done"
			// Styled completion message
			m.rawBuf.WriteString("\n\n")
			m.refreshContent()
			if m.follow {
				m.viewport.GotoBottom()
			}
		}

	case WSConnectedMsg:
		m.connected = true

	case WSDisconnectedMsg:
		m.connected = false

	case WSAgentSpawnedMsg:
		if msg.SessionID == m.sessionID || m.sessionID == "" {
			if m.sessionID == "" {
				m.sessionID = msg.SessionID
			}
		}

	case WatchHistoryMsg:
		if msg.Err != nil {
			m.rawBuf.WriteString("\n[history unavailable] " + msg.Err.Error() + "\n")
			m.refreshContent()
			break
		}
		m.applyHistory(msg.Messages)
		m.refreshContent()
		if m.follow {
			m.viewport.GotoBottom()
		}
	}

	return m, tea.Batch(cmds...)
}

// View implements tea.Model.
func (m WatchModel) View() string {
	if !m.ready {
		return "Initializing..."
	}

	var sections []string

	// ── Header ──
	sections = append(sections, m.renderHeader())

	// ── Separator ──
	sections = append(sections, HLine(m.width, Muted))

	// ── Viewport (scrollable content) ──
	sections = append(sections, m.viewport.View())

	// ── Footer: separator + badge bar + key hints ──
	sections = append(sections, m.renderFooter())

	return lipgloss.JoinVertical(lipgloss.Left, sections...)
}

// ── Rendering helpers ───────────────────────────────────────────────────────

func (m WatchModel) renderHeader() string {
	sid := m.sessionID
	if len(sid) > 24 {
		sid = sid[:24] + "..."
	}
	if sid == "" {
		sid = "(waiting...)"
	}

	project := m.agent.ProjectName
	task := m.agent.Task
	if len(task) > 60 {
		task = task[:57] + "..."
	}

	status := m.agent.Status
	if m.done {
		status = "done"
	}
	statusStr := StatusPill(status)

	phase := m.phase
	if phase == "" {
		phase = "-"
	}
	phaseStr := lipgloss.NewStyle().Foreground(Purple).Bold(true).Render(phase)

	elapsed := time.Since(m.startTime).Round(time.Second).String()

	// Connection dot
	connIcon := lipgloss.NewStyle().Foreground(Green).Bold(true).Render("●")
	if !m.connected {
		connIcon = lipgloss.NewStyle().Foreground(Rose).Bold(true).Render("○")
	}

	// Follow indicator as a pill
	var followStr string
	if m.follow {
		followStr = Class("watch-follow").Render(" FOLLOW ")
	} else {
		followStr = Class("watch-paused").Render(" PAUSED ")
	}

	hk := Class("watch-header-key")
	hv := Class("watch-header-val")

	w := m.width
	if w > 4 {
		w -= 4
	}

	header := lipgloss.JoinVertical(lipgloss.Left,
		fmt.Sprintf("%s %s  %s  %s  %s  %s %s",
			hk.Render("Session:"),
			hv.Render(sid),
			statusStr,
			phaseStr,
			Class("dim").Render(elapsed),
			connIcon,
			followStr,
		),
		fmt.Sprintf("%s %s  %s %s",
			hk.Render("Project:"),
			hv.Render(project),
			hk.Render("Model:"),
			hv.Render(coalesce(m.agent.Model, "default")),
		),
		fmt.Sprintf("%s %s",
			hk.Render("Task:"),
			Class("body").Render(task),
		),
	)

	return Class("watch-header").Width(w).Render(header)
}

func (m WatchModel) renderFooter() string {
	// Separator
	sep := HLine(m.width, Muted)

	// Badge bar -- newest on right, scrolling horizontally
	badgeStr := ""
	if len(m.badges) > 0 {
		// Calculate how many badges fit
		available := m.width - 4
		shown := []string{}
		totalW := 0
		for i := len(m.badges) - 1; i >= 0; i-- {
			bw := lipgloss.Width(m.badges[i])
			if totalW+bw+2 > available {
				break
			}
			shown = append([]string{m.badges[i]}, shown...)
			totalW += bw + 2
		}
		badgeStr = strings.Join(shown, "  ")
	}
	badgeLine := lipgloss.NewStyle().MarginTop(0).Render(" " + badgeStr)

	// Scroll position
	scrollPct := fmt.Sprintf("%3.0f%%", m.viewport.ScrollPercent()*100)
	scrollStr := Class("watch-scroll").Render(scrollPct)

	// Key hints as pills
	keys := []KeyHint{
		{"Esc", "back"},
		{"f", "follow"},
		{"G", "bottom"},
		{"g", "top"},
		{"i", "inject"},
		{"k", "kill"},
	}
	hintLine := " " + renderKeyHints(keys) + "  " + scrollStr

	return lipgloss.JoinVertical(lipgloss.Left, sep, badgeLine, hintLine)
}

func renderKeyHints(hints []KeyHint) string {
	parts := ""
	for i, h := range hints {
		if i > 0 {
			parts += "  "
		}
		parts += Class("footer-key").Render(h.Key) + Class("footer-desc").Render(" "+h.Desc)
	}
	return parts
}

func (m WatchModel) loadHistoryCmd() tea.Cmd {
	if m.apiClient == nil || m.sessionID == "" {
		return nil
	}
	sessionID := m.sessionID
	return func() tea.Msg {
		messages, err := m.apiClient.GetAgentMessages(sessionID)
		return WatchHistoryMsg{Messages: messages, Err: err}
	}
}

func (m *WatchModel) applyHistory(messages []api.Message) {
	if len(messages) == 0 {
		return
	}
	var history strings.Builder
	for _, msg := range messages {
		switch msg.Type {
		case "tool_use":
			badge := RenderToolBadge(coalesce(msg.ToolName, "tool"), watchToolInputSummary(msg.ToolInput))
			m.badges = append(m.badges, badge)
		default:
			content := strings.TrimSpace(msg.Content)
			if content == "" {
				continue
			}
			if history.Len() > 0 {
				history.WriteString("\n\n")
			}
			history.WriteString(content)
		}
	}
	if len(m.badges) > m.maxBadge {
		m.badges = m.badges[len(m.badges)-m.maxBadge:]
	}
	if history.Len() == 0 {
		return
	}
	if m.rawBuf.Len() > 0 {
		m.rawBuf.WriteString("\n\n")
	}
	m.rawBuf.WriteString(history.String())
}

func watchToolInputSummary(input map[string]any) string {
	if len(input) == 0 {
		return ""
	}
	if command, ok := input["command"].(string); ok && command != "" {
		return command
	}
	if status, ok := input["status"].(string); ok && status != "" {
		return status
	}
	return ""
}

func (m *WatchModel) refreshContent() {
	raw := m.rawBuf.String()
	rendered := RenderMarkdown(raw)

	// Add completion card if done
	if m.done {
		doneCard := "\n" + Class("watch-done").Render("  Agent completed  ") + "\n"
		rendered += doneCard
	}

	m.viewport.SetContent(rendered)
}

func (m WatchModel) killAgentCmd() tea.Cmd {
	return func() tea.Msg {
		if m.apiClient != nil {
			_ = m.apiClient.KillAgent(m.sessionID)
		}
		return WSAgentDoneMsg{SessionID: m.sessionID}
	}
}

func coalesce(a, b string) string {
	if a != "" {
		return a
	}
	return b
}
