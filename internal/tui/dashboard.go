package tui

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/lipgloss"
	zone "github.com/lrstanley/bubblezone"
	"github.com/scoady/codexctl/internal/api"
	blocks "github.com/scoady/codexctl/internal/tui/components/blocks"
	metricscomponent "github.com/scoady/codexctl/internal/tui/components/metrics"
)

const (
	homeCardWorkspaces = "home:workspaces"
	homeCardMetrics    = "home:metrics"
	homeCardTools      = "home:tools"
	homeCardCreate     = "home:create"
	homeCardHero       = "home:hero"
)

// DashboardModel is the home screen model showing entry-point cards and project context.
type DashboardModel struct {
	Projects []api.Project
	Agents   []api.Agent
	Stats    *api.StatsResponse
	Selected int
	Filter   string

	// Agent count history for home sparkline animation.
	AgentCountHistory []int
}

// RecordAgentCount appends the current agent count to the history ring buffer.
func (d *DashboardModel) RecordAgentCount() {
	const maxHistory = 60
	d.AgentCountHistory = append(d.AgentCountHistory, len(d.Agents))
	if len(d.AgentCountHistory) > maxHistory {
		d.AgentCountHistory = d.AgentCountHistory[len(d.AgentCountHistory)-maxHistory:]
	}
}

// FilteredProjects returns projects matching the current filter.
func (d *DashboardModel) FilteredProjects() []api.Project {
	if d.Filter == "" {
		return d.Projects
	}
	f := strings.ToLower(d.Filter)
	var out []api.Project
	for _, p := range d.Projects {
		if strings.Contains(strings.ToLower(p.Name), f) || strings.Contains(strings.ToLower(p.Description), f) {
			out = append(out, p)
		}
	}
	return out
}

// SelectedProject returns the currently selected project or nil.
func (d *DashboardModel) SelectedProject() *api.Project {
	filtered := d.FilteredProjects()
	if d.Selected >= 0 && d.Selected < len(filtered) {
		p := filtered[d.Selected]
		return &p
	}
	return nil
}

// ClampSelection ensures selection is within bounds.
func (d *DashboardModel) ClampSelection() {
	filtered := d.FilteredProjects()
	if d.Selected >= len(filtered) {
		d.Selected = len(filtered) - 1
	}
	if d.Selected < 0 {
		d.Selected = 0
	}
}

func RenderDashboard(d *DashboardModel, mouse MousePoint, width, height int) string {
	if height < 12 || width < 60 {
		return zone.Scan(renderCompactHome(d, mouse, width, height))
	}

	topH := Clamp(7, height/3, 9)
	bottomH := max(10, height-topH-1)
	gap := 2
	cardW := max(22, (width-(gap*3))/4)
	heroW := width

	workspaces := renderHomeWorkspacesCard(d, mouse, cardW, topH)
	metrics := renderHomeMetricsCard(d, mouse, cardW, topH)
	tools := renderHomeToolsCard(d, mouse, cardW, topH)
	create := renderHomeCreateCard(d, mouse, max(22, width-(cardW*3)-(gap*3)), topH)
	hero := renderHomeBlockCanvas(d, mouse, heroW, bottomH)

	topRow := lipgloss.JoinHorizontal(lipgloss.Top, workspaces, "  ", metrics, "  ", tools, "  ", create)
	header := renderHomeHero(width, d)

	return zone.Scan(strings.Join([]string{header, topRow, hero}, "\n"))
}

func renderCompactHome(d *DashboardModel, mouse MousePoint, width, height int) string {
	lines := []string{
		lipgloss.NewStyle().Foreground(Cyan).Bold(true).Render("c9s home"),
		lipgloss.NewStyle().Foreground(Dim).Render("workspace shell, metrics, tools, and agents"),
		"",
	}
	projects := d.FilteredProjects()
	if len(projects) == 0 {
		lines = append(lines, lipgloss.NewStyle().Foreground(Dim).Render("No projects yet. Create one to get started."))
	} else {
		for i, p := range projects[:minInt(len(projects), 5)] {
			prefix := "  "
			if i == d.Selected {
				prefix = "▸ "
			}
			lines = append(lines, prefix+p.Name)
		}
	}
	return strings.Join(padOrTrimLines(lines, height), "\n")
}

func renderHomeHero(width int, d *DashboardModel) string {
	title := lipgloss.NewStyle().Foreground(White).Bold(true).Render("Home")
	sub := lipgloss.NewStyle().Foreground(Dim).Render("Terminal-native orchestration for projects, agents, tools, and canvases")
	right := ""
	if d.Stats != nil {
		right = strings.Join([]string{
			Pill(fmt.Sprintf(" %d projects ", d.Stats.TotalProjects), Purple, BadgePurpleBg),
			Pill(fmt.Sprintf(" %d agents ", d.Stats.TotalAgents), Cyan, BadgeCyanBg),
			Pill(fmt.Sprintf(" %d working ", d.Stats.WorkingAgents), Amber, BadgeAmberBg),
		}, " ")
	}
	top := workspaceShellAlignedRow(title, right, width, lipgloss.NewStyle(), lipgloss.NewStyle())
	return strings.Join([]string{top, sub}, "\n")
}

func renderHomeWorkspacesCard(d *DashboardModel, mouse MousePoint, width, height int) string {
	projects := d.FilteredProjects()
	body := []string{
		lipgloss.NewStyle().Foreground(SubText).Render("Jump into the shell, edit files, inspect git, and keep project context together."),
	}
	if len(projects) == 0 {
		body = append(body,
			"",
			lipgloss.NewStyle().Foreground(Dim).Render("No projects yet"),
			lipgloss.NewStyle().Foreground(Dim).Render("Create one to start"),
		)
	} else {
		body = append(body, "", lipgloss.NewStyle().Foreground(Dim).Render("Recent"))
		for i, p := range projects[:minInt(len(projects), max(2, height-5))] {
			prefix := "• "
			color := SubText
			if i == d.Selected {
				prefix = "▸ "
				color = Cyan
			}
			body = append(body, lipgloss.NewStyle().Foreground(color).Bold(i == d.Selected).Render(prefix+p.Name))
		}
	}
	return renderZoneCard(zoneCardSpec{
		ZoneID:   homeCardWorkspaces,
		Icon:     "▣",
		Title:    "Workspaces",
		Badge:    fmt.Sprintf("%d", len(projects)),
		Accent:   Cyan,
		Width:    width,
		Height:   height,
		Hovered:  zoneInBounds(homeCardWorkspaces, teaMouseFromPoint(mouse)),
		Selected: true,
		Body:     body,
	})
}

func renderHomeMetricsCard(d *DashboardModel, mouse MousePoint, width, height int) string {
	values := d.AgentCountHistory
	if len(values) == 0 {
		values = []int{0, 1, 1, 2, 1}
	}
	body := []string{
		lipgloss.NewStyle().Foreground(SubText).Render("Observe system and agent health in one place."),
	}
	if d.Stats != nil {
		body = append(body, "",
			lipgloss.NewStyle().Foreground(Cyan).Render(RenderSparklineBraille(values, max(10, width-8), 2, Cyan)),
			lipgloss.NewStyle().Foreground(Dim).Render(fmt.Sprintf("%d total • %d working • %d idle", d.Stats.TotalAgents, d.Stats.WorkingAgents, d.Stats.IdleAgents)),
		)
	} else {
		body = append(body, "", lipgloss.NewStyle().Foreground(Cyan).Render(RenderSparklineBraille(values, max(10, width-8), 2, Cyan)))
	}
	return renderZoneCard(zoneCardSpec{
		ZoneID:   homeCardMetrics,
		Icon:     "◈",
		Title:    "Metrics",
		Accent:   Purple,
		Width:    width,
		Height:   height,
		Hovered:  zoneInBounds(homeCardMetrics, teaMouseFromPoint(mouse)),
		Selected: false,
		Body:     body,
	})
}

func renderHomeToolsCard(d *DashboardModel, mouse MousePoint, width, height int) string {
	body := []string{
		lipgloss.NewStyle().Foreground(SubText).Render("Manage MCP tools, plugins, and local runtimes."),
		"",
		lipgloss.NewStyle().Foreground(Dim).Render("• inspect tools"),
		lipgloss.NewStyle().Foreground(Dim).Render("• sync skills"),
		lipgloss.NewStyle().Foreground(Dim).Render("• configure providers"),
	}
	return renderZoneCard(zoneCardSpec{
		ZoneID:   homeCardTools,
		Icon:     "⬢",
		Title:    "Tools & Plugins",
		Accent:   Amber,
		Width:    width,
		Height:   height,
		Hovered:  zoneInBounds(homeCardTools, teaMouseFromPoint(mouse)),
		Body:     body,
	})
}

func renderHomeCreateCard(d *DashboardModel, mouse MousePoint, width, height int) string {
	body := []string{
		lipgloss.NewStyle().Foreground(SubText).Render("Bootstrap a new local repo, initialize git, and start a managed workspace."),
		"",
		lipgloss.NewStyle().Foreground(Green).Render("Create project"),
		lipgloss.NewStyle().Foreground(Dim).Render("Press c or click this card"),
	}
	return renderZoneCard(zoneCardSpec{
		ZoneID:   homeCardCreate,
		Icon:     "+",
		Title:    "New Project",
		Accent:   Green,
		Width:    width,
		Height:   height,
		Hovered:  zoneInBounds(homeCardCreate, teaMouseFromPoint(mouse)),
		Body:     body,
	})
}

func renderHomeHeroCanvas(d *DashboardModel, mouse MousePoint, width, height int) string {
	frame := homeRobotFrame()
	body := []string{
		lipgloss.NewStyle().Foreground(SubText).Render("Project orchestration in one place"),
		lipgloss.NewStyle().Foreground(Dim).Render("A local controller coordinating workspaces, tools, metrics, and canvases."),
		"",
	}
	body = append(body, frame...)
	body = append(body,
		"",
		lipgloss.NewStyle().Foreground(Cyan).Render("flow"),
		lipgloss.NewStyle().Foreground(Dim).Render("create → enter workspace → delegate → inspect → iterate"),
	)
	return renderZoneCard(zoneCardSpec{
		ZoneID:   homeCardHero,
		Icon:     "✦",
		Title:    "Orchestration Loop",
		Accent:   Cyan,
		Width:    width,
		Height:   height,
		Hovered:  zoneInBounds(homeCardHero, teaMouseFromPoint(mouse)),
		Body:     body,
	})
}

func renderHomeBlockCanvas(d *DashboardModel, mouse MousePoint, width, height int) string {
	hovered := map[string]bool{}
	return blocks.RenderCanvas(buildHomeCanvas(d), width, height, hovered)
}

func buildHomeCanvas(d *DashboardModel) blocks.Canvas {
	agentValues := d.AgentCountHistory
	if len(agentValues) == 0 {
		agentValues = []int{0, 1, 2, 1, 2, 3}
	}

	working := 0
	total := len(d.Agents)
	if d.Stats != nil {
		working = d.Stats.WorkingAgents
		total = d.Stats.TotalAgents
	}
	projects := len(d.FilteredProjects())
	if d.Stats != nil && d.Stats.TotalProjects > 0 {
		projects = d.Stats.TotalProjects
	}

	telemetry := blocks.TelemetryBlock{
		ID:     "home-telemetry",
		Title:  "Workspace Telemetry",
		Badge:  "live",
		Accent: string(Cyan),
		Placement: blocks.Placement{
			Col:     0,
			Row:     0,
			ColSpan: 6,
		},
		Sizing: blocks.Sizing{MinHeight: 10, PreferredHeight: 10},
		Model: metricscomponent.NewModel([]metricscomponent.Item{
			{Label: "projects", Value: fmt.Sprintf("%d", projects), Spark: RenderSparklineStyled(agentValues, 8, Cyan), Color: string(Cyan)},
			{Label: "agents", Value: fmt.Sprintf("%d", total), Spark: RenderSparklineStyled(agentValues, 8, Purple), Color: string(Purple)},
			{Label: "working", Value: fmt.Sprintf("%d", working), Spark: RenderSparklineStyled(agentValues, 8, Green), Color: string(Green)},
		}, time.Now().Format("Mon 3:04 PM")),
		Notes: []string{
			"Shared block: drop onto any canvas needing a compact telemetry strip.",
			"Backed by the same metric primitives used in the workspace shell.",
		},
	}

	milestones := blocks.MilestonesBlock{
		ID:     "home-milestones",
		Title:  "Milestones",
		Badge:  "recent",
		Accent: string(Purple),
		Placement: blocks.Placement{
			Col:     6,
			Row:     0,
			ColSpan: 6,
		},
		Sizing: blocks.Sizing{MinHeight: 10, PreferredHeight: 10},
		Milestones: []blocks.Milestone{
			{Tag: "v2.0.0", Title: "Workspace Shell", Summary: "Project dock, chat, files, git context, and canvas all landed in one shell."},
			{Tag: "v2.0.1", Title: "Home + Refactor", Summary: "Home became the default entry point and the TUI architecture started splitting into reusable modules."},
			{Tag: "next", Title: "Canvas + Blocks", Summary: "Shared canvas/grid primitives are now the intended way to stamp out new UI features."},
		},
	}

	return blocks.NewCanvas(12, 2, telemetry, milestones)
}

func homeRobotFrame() []string {
	frames := [][]string{
		{
			"      [◉_◉]        ──▶  [ task ]     [ tool ]",
			"      /|_|\\\\          └─▶ [ git ]      [ note ]",
			"     /_/ \\_\\\\",
		},
		{
			"      [◉_◉]        ──▶  [ task ]  ✦   [ tool ]",
			"      /|_|\\\\        ✦   └─▶ [ git ]      [ note ]",
			"     /_/ \\_\\\\",
		},
		{
			"      [◉_◉]   ✦    ──▶  [ task ]     [ tool ]",
			"      /|_|\\\\          └─▶ [ git ]  ✦   [ note ]",
			"     /_/ \\_\\\\",
		},
	}
	frame := frames[int(time.Now().Unix())%len(frames)]
	out := make([]string, 0, len(frame))
	for _, line := range frame {
		out = append(out, lipgloss.NewStyle().Foreground(Cyan).Render(line))
	}
	return out
}
