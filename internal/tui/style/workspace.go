package style

import (
	"strings"

	"github.com/charmbracelet/lipgloss"
)

var (
	WorkspaceChromeBG = lipgloss.Color("#030507")
	WorkspacePanelBG  = lipgloss.Color("#04070a")
	WorkspaceDockBG   = lipgloss.Color("#04070a")
	WorkspaceLine     = lipgloss.Color("#123247")
	WorkspaceHoverBG  = lipgloss.Color("#0a0d13")
	WorkspaceSelectBG = lipgloss.Color("#0d121a")
	WorkspaceTabBG    = lipgloss.Color("#12101a")
	WorkspaceTabHover = lipgloss.Color("#171423")
	WorkspacePickerBG = lipgloss.Color("#0a0f16")
	WorkspacePickerOn = lipgloss.Color("#0c1119")
	WorkspaceHoverLn  = lipgloss.Color("#2a3443")
	WorkspaceMutedFG  = lipgloss.Color("#6f7f94")
	WorkspacePickerLn = lipgloss.Color("#2b3b4f")
	WorkspaceTerminalBG       = lipgloss.Color("#010203")
	WorkspaceTerminalLine     = lipgloss.Color("#14384d")
	WorkspaceTerminalPromptFG = lipgloss.Color("#7aaed0")
	WorkspaceTerminalPromptReady = lipgloss.Color("#b46cff")
	WorkspaceTerminalPromptBusy  = lipgloss.Color("#3ee38a")
	WorkspaceTerminalTextFG   = lipgloss.Color("#d6dde8")
	WorkspaceTerminalMetaFG   = lipgloss.Color("#57b5de")
	WorkspaceTerminalBadgeBG  = lipgloss.Color("#312e81")
	WorkspaceTerminalBadgeFG  = lipgloss.Color("#e8e5ff")
	WorkspaceTerminalToggleBG = lipgloss.Color("#0f141b")
	WorkspaceTerminalToggleOn = lipgloss.Color("#14384d")
)

func RenderWorkspaceActivityBrand(width int, fg lipgloss.Color) string {
	return lipgloss.NewStyle().
		Foreground(fg).
		Bold(true).
		Align(lipgloss.Center).
		Width(max(1, width)).
		Render("c9")
}

func RenderWorkspaceActivityCell(icon string, width int, accent, activeBorder, hoverBorder, inactiveFG, activeFG lipgloss.Color, active, hovered bool) string {
	fg := inactiveFG
	border := WorkspaceLine
	marker := " "
	if hovered {
		fg = accent
		border = hoverBorder
		marker = "▏"
	}
	if active {
		fg = activeFG
		border = activeBorder
		marker = "▍"
	}

	markerCell := lipgloss.NewStyle().
		Width(1).
		Align(lipgloss.Center).
		Foreground(border).
		Background(WorkspaceDockBG).
		Render(marker)

	iconW := max(5, width-1)
	iconPadLeft := max(0, (iconW-2)/2)
	iconPadRight := max(0, iconW-iconPadLeft-2)
	iconCell := lipgloss.NewStyle().
		Width(iconW).
		Foreground(fg).
		Background(WorkspaceDockBG).
		Bold(true).
		Render(strings.Repeat(" ", iconPadLeft) + icon + strings.Repeat(" ", iconPadRight))

	return markerCell + iconCell
}

func WorkspaceExplorerRowColors(accent, markerIdle, markerHover, markerActive, nameIdle, nameActive, metaIdle, metaActive lipgloss.Color, selected, hovered bool) (bg, markerFG, nameFG, metaFG lipgloss.Color, marker string) {
	bg = WorkspacePanelBG
	markerFG = markerIdle
	nameFG = accent
	metaFG = metaIdle
	marker = " "

	if hovered {
		bg = WorkspaceHoverBG
		markerFG = markerHover
		nameFG = nameActive
		metaFG = metaActive
		marker = "▏"
	}
	if selected {
		bg = WorkspaceSelectBG
		markerFG = markerActive
		nameFG = nameActive
		metaFG = metaActive
		marker = "▍"
	}
	return bg, markerFG, nameFG, metaFG, marker
}

func WorkspacePickerRowColors(accent, titleIdle, titleActive, descIdle, descActive, lineIdle, lineActive lipgloss.Color, selected, hovered, create bool) (bg, border, titleFG, descFG lipgloss.Color) {
	bg = WorkspacePanelBG
	border = lineIdle
	titleFG = titleIdle
	descFG = descIdle

	if hovered {
		bg = WorkspacePickerBG
		border = WorkspacePickerLn
		titleFG = titleActive
		descFG = descActive
	}
	if selected {
		bg = WorkspacePickerOn
		border = lineActive
		titleFG = titleActive
		descFG = descActive
	}
	if create {
		titleFG = accent
		if hovered || selected {
			border = accent
		}
	}
	return bg, border, titleFG, descFG
}

func WorkspaceTabColors(activeBG, activeFG, inactiveFG, hoverFG lipgloss.Color, active, hovered bool) (bg, fg lipgloss.Color) {
	bg = WorkspaceTabBG
	fg = inactiveFG
	if hovered {
		bg = WorkspaceTabHover
		fg = hoverFG
	}
	if active {
		bg = activeBG
		fg = activeFG
	}
	return bg, fg
}

func WorkspaceTerminalTitleStyle() lipgloss.Style {
	return lipgloss.NewStyle().Foreground(WorkspaceTerminalTextFG).Bold(true)
}

func WorkspaceTerminalStatusStyle() lipgloss.Style {
	return lipgloss.NewStyle().Foreground(WorkspaceTerminalMetaFG)
}

func WorkspaceTerminalPromptPrefixStyle() lipgloss.Style {
	return lipgloss.NewStyle().
		Foreground(WorkspaceTerminalPromptFG).
		Background(WorkspaceTerminalBG)
}

func WorkspaceTerminalPromptMarkerStyle(busy bool) lipgloss.Style {
	if busy {
		return lipgloss.NewStyle().
			Foreground(WorkspaceTerminalPromptBusy).
			Background(WorkspaceTerminalBG).
			Bold(true)
	}
	return lipgloss.NewStyle().
		Foreground(WorkspaceTerminalPromptReady).
		Background(WorkspaceTerminalBG).
		Bold(true)
}

func WorkspaceTerminalStateStyle(busy bool) lipgloss.Style {
	if busy {
		return lipgloss.NewStyle().
			Foreground(WorkspaceTerminalPromptBusy).
			Bold(true)
	}
	return lipgloss.NewStyle().
		Foreground(WorkspaceTerminalPromptReady).
		Bold(true)
}

func WorkspaceTerminalPromptTextStyle() lipgloss.Style {
	return lipgloss.NewStyle().
		Foreground(WorkspaceTerminalTextFG).
		Background(WorkspaceTerminalBG)
}

func WorkspaceTerminalCursorStyle() lipgloss.Style {
	return lipgloss.NewStyle().
		Foreground(WorkspaceTerminalBG).
		Background(WorkspaceTerminalTextFG).
		Bold(true)
}

func WorkspaceTerminalPromptCursorStyle() lipgloss.Style {
	return lipgloss.NewStyle().
		Foreground(WorkspaceTerminalBG).
		Background(WorkspaceTerminalPromptFG).
		Bold(true)
}

func WorkspaceTerminalPendingCursorStyle() lipgloss.Style {
	return lipgloss.NewStyle().
		Foreground(WorkspaceTerminalBG).
		Background(WorkspaceTerminalMetaFG).
		Bold(true)
}

func WorkspaceTerminalPendingBadgeStyle() lipgloss.Style {
	return lipgloss.NewStyle().
		Foreground(WorkspaceTerminalBadgeFG).
		Background(WorkspaceTerminalBadgeBG).
		Bold(true).
		Padding(0, 1)
}

func WorkspaceTerminalRoleLabelStyle(role string, fg lipgloss.Color, width int) lipgloss.Style {
	base := WorkspaceTerminalSectionStyle().Width(max(1, width)).Bold(true)
	if role == "codex" {
		return base.
			Foreground(WorkspaceTerminalBadgeFG).
			Background(WorkspaceTerminalBadgeBG)
	}
	return base.Foreground(fg)
}

func WorkspaceTerminalSectionStyle() lipgloss.Style {
	return lipgloss.NewStyle().Background(WorkspaceTerminalBG)
}

func WorkspaceTerminalSurfaceLine(line string, width int) string {
	return WorkspaceTerminalSectionStyle().
		Width(max(1, width)).
		Render(line)
}

func WorkspaceTerminalToggleStyle(open, hovered bool) lipgloss.Style {
	bg := WorkspaceTerminalToggleBG
	fg := WorkspaceTerminalMetaFG
	if hovered {
		bg = WorkspaceTerminalLine
		fg = WorkspaceTerminalTextFG
	}
	if open {
		bg = WorkspaceTerminalToggleOn
		fg = WorkspaceTerminalTextFG
	}
	return lipgloss.NewStyle().
		Foreground(fg).
		Background(bg).
		Bold(true).
		Padding(0, 2)
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
