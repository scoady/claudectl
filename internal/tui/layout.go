// Package tui provides the interactive terminal UI for c9s.
package tui

// Clamp returns val clamped between lo and hi.
func Clamp(lo, val, hi int) int {
	if val < lo {
		return lo
	}
	if val > hi {
		return hi
	}
	return val
}

// Pct returns percent% of base, rounded down.
func Pct(base, percent int) int {
	return base * percent / 100
}

// Layout holds all computed responsive dimensions derived from the terminal size.
// Recompute on every WindowSizeMsg via NewLayout(width, height).
type Layout struct {
	Width  int
	Height int

	// ── Content area ──
	ContentHeight int // available rows between header and footer

	// ── Palette ──
	PaletteWidth      int
	PaletteMaxResults int

	// ── Table column widths — agents table ──
	AgentColSID        int
	AgentColProject    int
	AgentColTask       int
	AgentColStatus     int
	AgentColPhase      int
	AgentColModel      int
	AgentColTurns      int
	AgentColMilestones int
	AgentColElapsed    int
	AgentColCost       int

	// ── Table column widths — project agent panel ──
	ProjAgentColSID     int
	ProjAgentColTask    int
	ProjAgentColPhase   int
	ProjAgentColModel   int
	ProjAgentColTurns   int
	ProjAgentColElapsed int
	ProjAgentColCost    int

	// ── Dashboard table columns ──
	DashColNum      int
	DashColName     int
	DashColActivity int
	DashColAgents   int
	DashColStatus   int
	DashColDesc     int

	// ── Panels ──
	PanelWidth   int // general content width (width - padding)
	CardMaxWidth int // max width for info cards

	// ── Mission panes ──
	MissionPaneMinW int
	MissionPaneMinH int

	// ── Canvas grid ──
	CanvasColWidth int // chars per GridStack column
	CanvasMaxWidth int // content width for canvas screen

	// ── Dialog/overlay widths ──
	DialogWidth     int // standard dialog (confirm, create-project)
	DispatchWidth   int
	InjectWidth     int
	ContextMenuMaxW int

	// ── Timeline ──
	TimelineNameCol  int
	TimelineBarWidth int

	// ── Selected row background width ──
	SelectedRowWidth int

	// ── Widget detail / template browser ──
	DetailContentWidth int

	// ── Help ──
	HelpKeyWidth int

	// ── HLine max width for tables ──
	HLineMaxWidth int
}

// NewLayout computes all responsive dimensions from terminal size.
func NewLayout(width, height int) Layout {
	l := Layout{
		Width:  width,
		Height: height,
	}

	// ── Content height: header(2) + footer(2) + cmd/status(1) ──
	l.ContentHeight = Clamp(5, height-5, height)

	// ── Palette ──
	l.PaletteWidth = Clamp(40, Pct(width, 50), 90)
	if width <= 100 {
		l.PaletteWidth = Clamp(40, 72, width-4)
	}
	if l.PaletteWidth > width-4 {
		l.PaletteWidth = width - 4
	}
	l.PaletteMaxResults = Clamp(5, Pct(height, 40), 20)
	if l.PaletteMaxResults < 10 {
		l.PaletteMaxResults = 10
	}

	// ── Agent table column widths (scale with terminal width) ──
	// Base total: 3+16+16+24+10+12+12+7+4+9+10 = 123
	if width >= 160 {
		l.AgentColSID = 20
		l.AgentColProject = 20
		l.AgentColTask = Clamp(24, Pct(width, 20), 50)
		l.AgentColStatus = 12
		l.AgentColPhase = 14
		l.AgentColModel = 14
		l.AgentColTurns = 7
		l.AgentColMilestones = 4
		l.AgentColElapsed = 10
		l.AgentColCost = 10
	} else if width >= 120 {
		l.AgentColSID = 16
		l.AgentColProject = 16
		l.AgentColTask = 24
		l.AgentColStatus = 10
		l.AgentColPhase = 12
		l.AgentColModel = 12
		l.AgentColTurns = 7
		l.AgentColMilestones = 4
		l.AgentColElapsed = 9
		l.AgentColCost = 10
	} else {
		l.AgentColSID = 14
		l.AgentColProject = 14
		l.AgentColTask = Clamp(16, width/5, 24)
		l.AgentColStatus = 10
		l.AgentColPhase = 10
		l.AgentColModel = 10
		l.AgentColTurns = 6
		l.AgentColMilestones = 4
		l.AgentColElapsed = 8
		l.AgentColCost = 8
	}

	// ── Project agent panel columns ──
	l.ProjAgentColSID = 16
	l.ProjAgentColTask = Clamp(20, Pct(width, 20), 36)
	l.ProjAgentColPhase = 12
	l.ProjAgentColModel = 12
	l.ProjAgentColTurns = 8
	l.ProjAgentColElapsed = 10
	l.ProjAgentColCost = 10

	// ── Dashboard columns ──
	l.DashColNum = 4
	l.DashColName = Clamp(16, Pct(width, 15), 28)
	l.DashColActivity = 4
	l.DashColAgents = 8
	l.DashColStatus = 18
	l.DashColDesc = Clamp(20, width-3-l.DashColNum-l.DashColName-l.DashColActivity-l.DashColAgents-l.DashColStatus-12, width/2)

	// ── Panel / card widths ──
	l.PanelWidth = Clamp(40, width-4, width)
	l.CardMaxWidth = Clamp(60, width-4, 100)

	// ── Mission panes ──
	l.MissionPaneMinW = 20
	l.MissionPaneMinH = 6

	// ── Canvas grid ──
	l.CanvasMaxWidth = Clamp(60, width-4, 120)
	l.CanvasColWidth = Clamp(4, (width-6)/12, 20)

	// ── Dialogs ──
	l.DialogWidth = Clamp(40, Pct(width, 35), 56)
	l.DispatchWidth = Clamp(50, Pct(width, 45), 72)
	l.InjectWidth = Clamp(46, Pct(width, 40), 66)
	l.ContextMenuMaxW = Clamp(24, Pct(width, 30), 50)

	// ── Timeline ──
	l.TimelineNameCol = Clamp(14, Pct(width, 15), 26)
	l.TimelineBarWidth = Clamp(20, width-l.TimelineNameCol-4, width)

	// ── Selected row ──
	l.SelectedRowWidth = Clamp(80, width, 140)

	// ── Widget detail ──
	l.DetailContentWidth = Clamp(60, width-4, 100)

	// ── Help ──
	l.HelpKeyWidth = 16

	// ── HLine ──
	l.HLineMaxWidth = Clamp(40, width, 130)

	return l
}
