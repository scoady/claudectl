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
				Border(lipgloss.NormalBorder()).
				BorderForeground(lipgloss.Color("#334155")).
				Padding(0, 1).
				MarginBottom(0)

	watchHeaderKey = lipgloss.NewStyle().
			Foreground(Dim).
			Width(10)

	watchHeaderVal = lipgloss.NewStyle().
			Foreground(White).
			Bold(true)

	watchBadgeBar = lipgloss.NewStyle().
			Foreground(Dim).
			MarginTop(0)

	watchDoneStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(Green).
			Border(lipgloss.DoubleBorder()).
			BorderForeground(Green).
			Padding(0, 2).
			Align(lipgloss.Center)

	watchScrollIndicator = lipgloss.NewStyle().
				Foreground(Dim)

	watchFollowBadge = lipgloss.NewStyle().
				Foreground(Green).
				Bold(true)

	watchPausedBadge = lipgloss.NewStyle().
				Foreground(Amber).
				Bold(true)
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
		maxBadge:  6,
		startTime: time.Now(),
		phase:     agent.Phase,
		wsClient:  wsClient,
		apiClient: apiClient,
	}
}

// headerHeight returns the number of lines the header occupies.
func (m WatchModel) headerHeight() int {
	return 6 // header box lines
}

// footerHeight returns the number of lines the footer occupies.
func (m WatchModel) footerHeight() int {
	return 3 // badge bar + key hints + padding
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
			m.rawBuf.WriteString("\n\n--- Agent completed ---\n")
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

	// ── Viewport (scrollable content) ──
	sections = append(sections, m.viewport.View())

	// ── Footer: badge bar + key hints ──
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
	statusStr := StatusIcon(status) + " " + StatusColor(status).Render(status)

	phase := m.phase
	if phase == "" {
		phase = "-"
	}
	phaseStr := lipgloss.NewStyle().Foreground(Purple).Render(phase)

	elapsed := time.Since(m.startTime).Round(time.Second).String()

	connIcon := lipgloss.NewStyle().Foreground(Green).Render("●")
	if !m.connected {
		connIcon = lipgloss.NewStyle().Foreground(Rose).Render("○")
	}

	// Follow indicator
	followStr := watchFollowBadge.Render("FOLLOW")
	if !m.follow {
		followStr = watchPausedBadge.Render("PAUSED")
	}

	w := m.width
	if w > 2 {
		w -= 2
	}

	header := lipgloss.JoinVertical(lipgloss.Left,
		fmt.Sprintf("%s %s  %s  %s %s  %s",
			watchHeaderKey.Render("Session:"),
			watchHeaderVal.Render(sid),
			statusStr,
			phaseStr,
			DimStyle.Render(elapsed),
			connIcon+" "+followStr,
		),
		fmt.Sprintf("%s %s  %s %s",
			watchHeaderKey.Render("Project:"),
			watchHeaderVal.Render(project),
			watchHeaderKey.Render("Model:"),
			watchHeaderVal.Render(coalesce(m.agent.Model, "default")),
		),
		fmt.Sprintf("%s %s",
			watchHeaderKey.Render("Task:"),
			DimStyle.Render(task),
		),
	)

	return watchHeaderStyle.Width(w).Render(header)
}

func (m WatchModel) renderFooter() string {
	// Badge bar
	badgeStr := ""
	if len(m.badges) > 0 {
		badgeStr = strings.Join(m.badges, "  ")
	}
	badgeLine := watchBadgeBar.Render(badgeStr)

	// Scroll position
	scrollPct := fmt.Sprintf("%3.0f%%", m.viewport.ScrollPercent()*100)
	scrollStr := watchScrollIndicator.Render(scrollPct)

	// Key hints
	keys := []struct{ key, desc string }{
		{"Esc", "back"},
		{"f", "follow"},
		{"G", "bottom"},
		{"g", "top"},
		{"i", "inject"},
		{"k", "kill"},
	}
	var hints []string
	for _, k := range keys {
		hints = append(hints,
			FooterKeyStyle.Render(k.key)+" "+FooterDescStyle.Render(k.desc),
		)
	}
	hintLine := strings.Join(hints, "  ") + "  " + scrollStr

	return lipgloss.JoinVertical(lipgloss.Left, badgeLine, hintLine)
}

func (m *WatchModel) refreshContent() {
	raw := m.rawBuf.String()
	rendered := RenderMarkdown(raw)

	// Wrap to viewport width
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
