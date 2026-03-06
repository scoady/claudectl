package tui

import (
	"sort"
	"strings"
	"unicode"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/scoady/claudectl/internal/api"
)

// ── Fuzzy matching ──────────────────────────────────────────────────────────

// FuzzyMatch holds the result of a fuzzy match attempt.
type FuzzyMatch struct {
	Text    string
	Score   int
	Indices []int // which chars in Text matched
}

// FuzzyScore scores how well input matches candidate using fuzzy matching.
// Returns a FuzzyMatch with Score <= 0 if no match. Higher scores are better.
// Scoring: +10 consecutive match, +8 word boundary, +6 start of string, +3 regular match.
func FuzzyScore(input, candidate string) FuzzyMatch {
	if input == "" {
		return FuzzyMatch{Text: candidate, Score: 1}
	}

	lowerInput := strings.ToLower(input)
	lowerCandidate := strings.ToLower(candidate)
	rInput := []rune(lowerInput)
	rCandidate := []rune(lowerCandidate)
	origCandidate := []rune(candidate)

	if len(rInput) > len(rCandidate) {
		return FuzzyMatch{Text: candidate, Score: 0}
	}

	// Find best match greedily
	indices := make([]int, 0, len(rInput))
	score := 0
	ci := 0
	prevMatchIdx := -2

	for ii := 0; ii < len(rInput); ii++ {
		found := false
		for ci < len(rCandidate) {
			if rCandidate[ci] == rInput[ii] {
				bonus := 3 // base match score

				// Consecutive match bonus
				if ci == prevMatchIdx+1 {
					bonus = 10
				}

				// Word boundary bonus (char after separator or camelCase)
				if ci == 0 {
					bonus = max(bonus, 6)
				} else {
					prev := origCandidate[ci-1]
					curr := origCandidate[ci]
					if prev == '-' || prev == '_' || prev == ' ' || prev == '/' || prev == '.' {
						bonus = max(bonus, 8)
					} else if unicode.IsLower(prev) && unicode.IsUpper(curr) {
						bonus = max(bonus, 8)
					}
				}

				score += bonus
				indices = append(indices, ci)
				prevMatchIdx = ci
				ci++
				found = true
				break
			}
			ci++
		}
		if !found {
			return FuzzyMatch{Text: candidate, Score: 0}
		}
	}

	return FuzzyMatch{
		Text:    candidate,
		Score:   score,
		Indices: indices,
	}
}

// ── Palette action ──────────────────────────────────────────────────────────

// PaletteAction represents a single executable action in the palette.
type PaletteAction struct {
	Label    string           // Display text
	Icon     string           // Left icon
	Category string           // "project", "agent", "nav", "action", "command"
	Action   func() tea.Msg   // What happens when selected
}

// categoryOrder defines sort priority per category (lower = higher priority).
func categoryOrder(cat string) int {
	switch cat {
	case "project":
		return 0
	case "agent":
		return 1
	case "nav":
		return 2
	case "action":
		return 3
	case "command":
		return 4
	default:
		return 5
	}
}

// ── Palette model ───────────────────────────────────────────────────────────

const paletteMaxResults = 10

// PaletteModel is a command palette overlay with fuzzy search.
type PaletteModel struct {
	active   bool
	input    string
	actions  []PaletteAction
	filtered []paletteResult
	selected int
	scroll   int // top visible index
	width    int
	height   int
}

type paletteResult struct {
	action PaletteAction
	match  FuzzyMatch
}

// NewPaletteModel creates an empty palette (not active until opened).
func NewPaletteModel() PaletteModel {
	return PaletteModel{}
}

// Active returns whether the palette is visible.
func (m PaletteModel) Active() bool {
	return m.active
}

// Open activates the palette with the given actions.
func (m *PaletteModel) Open(actions []PaletteAction) {
	m.active = true
	m.input = ""
	m.actions = actions
	m.selected = 0
	m.scroll = 0
	m.refilter()
}

// Init implements tea.Model.
func (m PaletteModel) Init() tea.Cmd {
	return nil
}

// Update handles key events for the palette.
func (m PaletteModel) Update(msg tea.Msg) (PaletteModel, tea.Cmd) {
	if !m.active {
		return m, nil
	}

	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height

	case tea.KeyMsg:
		switch msg.String() {
		case "esc":
			m.active = false
			return m, nil

		case "enter":
			if len(m.filtered) > 0 && m.selected >= 0 && m.selected < len(m.filtered) {
				action := m.filtered[m.selected].action
				m.active = false
				if action.Action != nil {
					return m, func() tea.Msg { return action.Action() }
				}
			}
			return m, nil

		case "up", "ctrl+k":
			if m.selected > 0 {
				m.selected--
				if m.selected < m.scroll {
					m.scroll = m.selected
				}
			}
			return m, nil

		case "down", "ctrl+j":
			if m.selected < len(m.filtered)-1 {
				m.selected++
				if m.selected >= m.scroll+paletteMaxResults {
					m.scroll = m.selected - paletteMaxResults + 1
				}
			}
			return m, nil

		case "ctrl+n":
			if m.selected < len(m.filtered)-1 {
				m.selected++
				if m.selected >= m.scroll+paletteMaxResults {
					m.scroll = m.selected - paletteMaxResults + 1
				}
			}
			return m, nil

		case "ctrl+p":
			if m.selected > 0 {
				m.selected--
				if m.selected < m.scroll {
					m.scroll = m.selected
				}
			}
			return m, nil

		case "backspace":
			if len(m.input) > 0 {
				m.input = m.input[:len(m.input)-1]
				m.selected = 0
				m.scroll = 0
				m.refilter()
			}
			return m, nil

		default:
			key := msg.String()
			if len(key) == 1 && key[0] >= 32 {
				m.input += key
				m.selected = 0
				m.scroll = 0
				m.refilter()
			}
			return m, nil
		}
	}

	return m, nil
}

// refilter scores and sorts actions against the current input.
func (m *PaletteModel) refilter() {
	m.filtered = m.filtered[:0]

	for _, action := range m.actions {
		match := FuzzyScore(m.input, action.Label)
		if match.Score > 0 {
			m.filtered = append(m.filtered, paletteResult{
				action: action,
				match:  match,
			})
		}
	}

	// Sort by: score descending, then category order, then label
	sort.SliceStable(m.filtered, func(i, j int) bool {
		si, sj := m.filtered[i], m.filtered[j]
		if si.match.Score != sj.match.Score {
			return si.match.Score > sj.match.Score
		}
		ci := categoryOrder(si.action.Category)
		cj := categoryOrder(sj.action.Category)
		if ci != cj {
			return ci < cj
		}
		return si.action.Label < sj.action.Label
	})
}

// View renders the palette overlay.
func (m PaletteModel) View() string {
	if !m.active {
		return ""
	}

	paletteWidth := 72
	if m.width > 100 {
		paletteWidth = m.width / 2
		if paletteWidth > 90 {
			paletteWidth = 90
		}
	}
	if m.width > 0 && paletteWidth > m.width-4 {
		paletteWidth = m.width - 4
	}
	innerWidth := paletteWidth - 4 // padding

	// ── Input field ──
	inputStyle := lipgloss.NewStyle().
		Foreground(Cyan).
		Bold(true)

	cursor := lipgloss.NewStyle().Foreground(Cyan).Render("\u2588")
	inputLine := inputStyle.Render("> ") +
		lipgloss.NewStyle().Foreground(White).Render(m.input) +
		cursor

	// Pad input to full width
	inputRow := lipgloss.NewStyle().
		Background(Surface0).
		Width(innerWidth).
		Render(inputLine)

	// Divider
	divider := lipgloss.NewStyle().
		Foreground(Muted).
		Background(Surface0).
		Width(innerWidth).
		Render(strings.Repeat("\u2500", innerWidth))

	// ── Results ──
	var resultRows []string

	visible := m.filtered
	if len(visible) > m.scroll+paletteMaxResults {
		visible = visible[m.scroll : m.scroll+paletteMaxResults]
	} else if m.scroll < len(visible) {
		visible = visible[m.scroll:]
	} else {
		visible = nil
	}

	// Track category headers
	lastCategory := ""

	for vi, result := range visible {
		idx := vi + m.scroll
		action := result.action

		// Category header
		if action.Category != lastCategory {
			lastCategory = action.Category
			catLabel := categoryLabel(action.Category)
			catRow := lipgloss.NewStyle().
				Foreground(Dim).
				Background(Surface0).
				Width(innerWidth).
				Italic(true).
				Render("  " + catLabel)
			resultRows = append(resultRows, catRow)
		}

		// Icon
		icon := action.Icon
		if icon == "" {
			icon = " "
		}

		// Render label with highlighted matches
		highlighted := renderHighlighted(action.Label, result.match.Indices)

		isSelected := idx == m.selected

		var row string
		if isSelected {
			// Selected row — cyan with Surface1 bg
			prefix := lipgloss.NewStyle().
				Foreground(Cyan).
				Background(Surface1).
				Bold(true).
				Render("\u25b8 " + icon + " ")
			labelPart := lipgloss.NewStyle().
				Background(Surface1).
				Render(highlighted)
			// Pad to width
			rowContent := prefix + labelPart
			padLen := innerWidth - lipgloss.Width(rowContent)
			if padLen < 0 {
				padLen = 0
			}
			pad := lipgloss.NewStyle().Background(Surface1).Render(strings.Repeat(" ", padLen))
			row = rowContent + pad
		} else {
			prefix := lipgloss.NewStyle().
				Foreground(SubText).
				Background(Surface0).
				Render("  " + icon + " ")
			labelPart := lipgloss.NewStyle().
				Background(Surface0).
				Render(highlighted)
			rowContent := prefix + labelPart
			padLen := innerWidth - lipgloss.Width(rowContent)
			if padLen < 0 {
				padLen = 0
			}
			pad := lipgloss.NewStyle().Background(Surface0).Render(strings.Repeat(" ", padLen))
			row = rowContent + pad
		}
		resultRows = append(resultRows, row)
	}

	// Scroll indicator
	if len(m.filtered) > paletteMaxResults {
		total := len(m.filtered)
		showing := m.scroll + 1
		showEnd := m.scroll + len(visible)
		if showEnd > total {
			showEnd = total
		}
		indicator := lipgloss.NewStyle().
			Foreground(Dim).
			Background(Surface0).
			Width(innerWidth).
			Align(lipgloss.Right).
			Render(strings.Repeat(" ", innerWidth-12) + scrollIndicator(showing, showEnd, total))
		resultRows = append(resultRows, indicator)
	}

	// Empty state
	if len(m.filtered) == 0 && m.input != "" {
		emptyRow := lipgloss.NewStyle().
			Foreground(Dim).
			Background(Surface0).
			Width(innerWidth).
			Render("  No matches")
		resultRows = append(resultRows, emptyRow)
	}

	// Assemble
	var b strings.Builder
	b.WriteString(inputRow)
	b.WriteString("\n")
	b.WriteString(divider)
	for _, row := range resultRows {
		b.WriteString("\n")
		b.WriteString(row)
	}

	// Box
	box := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).
		BorderForeground(GlowBorder).
		Padding(0, 1).
		Background(Surface0).
		Width(paletteWidth).
		Render(b.String())

	// Position near top-center (like VS Code)
	if m.width > 0 && m.height > 0 {
		topOffset := m.height / 6
		if topOffset < 2 {
			topOffset = 2
		}
		box = lipgloss.Place(m.width, m.height,
			lipgloss.Center, lipgloss.Top,
			box,
			lipgloss.WithWhitespaceChars(" "),
		)
		// Shift down by adding empty lines at the top
		lines := strings.Split(box, "\n")
		if topOffset < len(lines) {
			for i := 0; i < topOffset && i < len(lines); i++ {
				lines[i] = strings.Repeat(" ", m.width)
			}
			box = strings.Join(lines, "\n")
		}
	}

	return box
}

// renderHighlighted renders text with matched indices in bold cyan.
func renderHighlighted(text string, indices []int) string {
	if len(indices) == 0 {
		return lipgloss.NewStyle().Foreground(SubText).Render(text)
	}

	matchSet := make(map[int]bool, len(indices))
	for _, i := range indices {
		matchSet[i] = true
	}

	runes := []rune(text)
	var b strings.Builder
	matchStyle := lipgloss.NewStyle().Foreground(Cyan).Bold(true)
	normalStyle := lipgloss.NewStyle().Foreground(SubText)

	inMatch := false
	var run []rune

	flush := func() {
		if len(run) == 0 {
			return
		}
		s := string(run)
		if inMatch {
			b.WriteString(matchStyle.Render(s))
		} else {
			b.WriteString(normalStyle.Render(s))
		}
		run = run[:0]
	}

	for i, r := range runes {
		isMatch := matchSet[i]
		if isMatch != inMatch {
			flush()
			inMatch = isMatch
		}
		run = append(run, r)
	}
	flush()

	return b.String()
}

func scrollIndicator(from, to, total int) string {
	return lipgloss.NewStyle().Foreground(Dim).
		Render(strings.Join([]string{
			itoa(from), "-", itoa(to), "/", itoa(total),
		}, ""))
}

func itoa(n int) string {
	if n < 0 {
		return "-" + itoa(-n)
	}
	if n < 10 {
		return string(rune('0' + n))
	}
	return itoa(n/10) + string(rune('0'+n%10))
}

func categoryLabel(cat string) string {
	switch cat {
	case "project":
		return "Projects"
	case "agent":
		return "Agents"
	case "nav":
		return "Navigation"
	case "action":
		return "Actions"
	case "command":
		return "Commands"
	default:
		return cat
	}
}

// ── Action builders ─────────────────────────────────────────────────────────

// BuildPaletteActions constructs the full action list from current app state.
func BuildPaletteActions(projects []api.Project, agents []api.Agent, client *api.Client) []PaletteAction {
	var actions []PaletteAction

	// ── Projects ──
	for _, p := range projects {
		name := p.Name
		actions = append(actions,
			PaletteAction{
				Label:    "Open " + name,
				Icon:     "\u25b8",
				Category: "project",
				Action: func() tea.Msg {
					return NavigateMsg{Screen: ScreenProject, Project: &api.Project{Name: name}}
				},
			},
			PaletteAction{
				Label:    "Dispatch task to " + name,
				Icon:     "\u26a1",
				Category: "project",
				Action: func() tea.Msg {
					return ShowDispatchMsg{ProjectName: name}
				},
			},
		)
	}

	// ── Agents ──
	for _, ag := range agents {
		agCopy := ag
		sid := ag.SessionID
		shortSID := sid
		if len(shortSID) > 12 {
			shortSID = shortSID[:12] + "..."
		}
		label := shortSID
		if ag.ProjectName != "" {
			label = ag.ProjectName + "/" + shortSID
		}

		actions = append(actions,
			PaletteAction{
				Label:    "Watch " + label,
				Icon:     "\u25c9",
				Category: "agent",
				Action: func() tea.Msg {
					return NavigateMsg{Screen: ScreenWatch, Agent: &agCopy}
				},
			},
			PaletteAction{
				Label:    "Kill " + label,
				Icon:     "\u2717",
				Category: "agent",
				Action: func() tea.Msg {
					return ShowConfirmMsg{
						Title:       "Kill Agent",
						Description: "Kill agent " + shortSID + "?",
						Destructive: true,
						OnConfirm: func() tea.Msg {
							err := client.KillAgent(sid)
							return KillResultMsg{SessionID: sid, Err: err}
						},
					}
				},
			},
			PaletteAction{
				Label:    "Inject into " + label,
				Icon:     "\u25b9",
				Category: "agent",
				Action: func() tea.Msg {
					return ShowInjectMsg{SessionID: sid}
				},
			},
		)
	}

	// ── Navigation ──
	actions = append(actions,
		PaletteAction{
			Label:    "Dashboard",
			Icon:     "\u25c9",
			Category: "nav",
			Action:   func() tea.Msg { return NavigateMsg{Screen: ScreenDashboard} },
		},
		PaletteAction{
			Label:    "Agents list",
			Icon:     "\u25cf",
			Category: "nav",
			Action:   func() tea.Msg { return NavigateMsg{Screen: ScreenAgents} },
		},
		PaletteAction{
			Label:    "Mission Control",
			Icon:     "\u25c9",
			Category: "nav",
			Action:   func() tea.Msg { return NavigateMsg{Screen: ScreenMission} },
		},
		PaletteAction{
			Label:    "Timeline",
			Icon:     "\u25cf",
			Category: "nav",
			Action:   func() tea.Msg { return NavigateMsg{Screen: ScreenTimeline} },
		},
		PaletteAction{
			Label:    "Settings",
			Icon:     "\u2699",
			Category: "nav",
			Action: func() tea.Msg {
				return NavigateMsg{Screen: ScreenSettings}
			},
		},
	)

	// ── Actions ──
	actions = append(actions,
		PaletteAction{
			Label:    "Create new project",
			Icon:     "\u2295",
			Category: "action",
			Action:   func() tea.Msg { return ShowCreateProjectMsg{} },
		},
		PaletteAction{
			Label:    "Help",
			Icon:     "?",
			Category: "action",
			Action:   func() tea.Msg { return showHelpMsg{} },
		},
		PaletteAction{
			Label:    "Quit",
			Icon:     "\u2717",
			Category: "action",
			Action:   func() tea.Msg { return tea.Quit() },
		},
	)

	// ── Commands (make :cmd shortcuts searchable) ──
	cmds := []struct {
		cmd  string
		desc string
	}{
		{"agents", "Show all agents"},
		{"projects", "Show project list"},
		{"dashboard", "Show dashboard"},
		{"mission", "Mission Control"},
		{"timeline", "Agent Timeline"},
		{"settings", "Theme settings"},
		{"create", "Create project"},
		{"quit", "Quit application"},
	}
	for _, c := range cmds {
		cmdName := c.cmd
		actions = append(actions, PaletteAction{
			Label:    ":" + cmdName + " \u2014 " + c.desc,
			Icon:     ":",
			Category: "command",
			Action: func() tea.Msg {
				return executeCommandMsg{Command: cmdName}
			},
		})
	}

	return actions
}

// ── Internal messages ───────────────────────────────────────────────────────

// showHelpMsg triggers the help overlay from the palette.
type showHelpMsg struct{}

// executeCommandMsg triggers a : command from the palette.
type executeCommandMsg struct {
	Command string
}
