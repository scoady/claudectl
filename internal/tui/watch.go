package tui

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/scoady/claudectl/internal/api"
)

// ── Watch view styles ───────────────────────────────────────────────────────

var (
	watchHeaderStyle = lipgloss.NewStyle().
				Border(lipgloss.RoundedBorder()).
				BorderForeground(BorderColor).
				Padding(0, 1).
				Background(Surface0)

	watchHeaderKey = lipgloss.NewStyle().
			Foreground(Dim).
			Width(10)

	watchHeaderVal = lipgloss.NewStyle().
			Foreground(White).
			Bold(true)

	watchBadgeBar = lipgloss.NewStyle().
			MarginTop(0)

	watchDoneBox = lipgloss.NewStyle().
			Bold(true).
			Foreground(Green).
			Border(lipgloss.RoundedBorder()).
			BorderForeground(Green).
			Background(BadgeGreenBg).
			Padding(0, 3).
			Align(lipgloss.Center)

	watchScrollIndicator = lipgloss.NewStyle().
				Foreground(Dim)

	watchFollowBadge = lipgloss.NewStyle().
				Foreground(Surface0).
				Background(Green).
				Bold(true).
				Padding(0, 1)

	watchPausedBadge = lipgloss.NewStyle().
				Foreground(Surface0).
				Background(Amber).
				Bold(true).
				Padding(0, 1)
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
	return nil
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
		followStr = watchFollowBadge.Render(" FOLLOW ")
	} else {
		followStr = watchPausedBadge.Render(" PAUSED ")
	}

	w := m.width
	if w > 4 {
		w -= 4
	}

	header := lipgloss.JoinVertical(lipgloss.Left,
		fmt.Sprintf("%s %s  %s  %s  %s  %s %s",
			watchHeaderKey.Render("Session:"),
			watchHeaderVal.Render(sid),
			statusStr,
			phaseStr,
			DimStyle.Render(elapsed),
			connIcon,
			followStr,
		),
		fmt.Sprintf("%s %s  %s %s",
			watchHeaderKey.Render("Project:"),
			watchHeaderVal.Render(project),
			watchHeaderKey.Render("Model:"),
			watchHeaderVal.Render(coalesce(m.agent.Model, "default")),
		),
		fmt.Sprintf("%s %s",
			watchHeaderKey.Render("Task:"),
			SubStyle.Render(task),
		),
	)

	return watchHeaderStyle.Width(w).Render(header)
}

func (m WatchModel) renderFooter() string {
	// Separator
	sep := HLine(m.width, Muted)

	// Badge bar — newest on right, scrolling horizontally
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
	badgeLine := watchBadgeBar.Render(" " + badgeStr)

	// Scroll position
	scrollPct := fmt.Sprintf("%3.0f%%", m.viewport.ScrollPercent()*100)
	scrollStr := watchScrollIndicator.Render(scrollPct)

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
		parts += FooterKeyStyle.Render(h.Key) + FooterDescStyle.Render(" "+h.Desc)
	}
	return parts
}

func (m *WatchModel) refreshContent() {
	raw := m.rawBuf.String()
	rendered := RenderMarkdown(raw)

	// Add completion card if done
	if m.done {
		doneCard := "\n" + watchDoneBox.Render("  Agent completed  ") + "\n"
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
