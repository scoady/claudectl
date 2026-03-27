package tui

import (
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	"github.com/charmbracelet/lipgloss"
	zone "github.com/lrstanley/bubblezone"
	tuistyle "github.com/scoady/codexctl/internal/tui/style"
)

type workspaceTerminalBlockSpec struct {
	Title     string
	TitleView string
	TitleW    int
	Status    string
	Width     int
	Height    int
	Focused   bool
	BodyLines []string
	Footer    string
}

func renderWorkspaceTerminalBlock(spec workspaceTerminalBlockSpec) string {
	innerW := max(8, spec.Width)
	titleRow := workspaceShellAlignedRow(
		spec.Title,
		spec.Status,
		innerW,
		tuistyle.WorkspaceTerminalTitleStyle(),
		tuistyle.WorkspaceTerminalStatusStyle(),
	)
	if spec.TitleView != "" {
		titleRow = workspaceShellAlignedStyledRow(
			spec.TitleView,
			spec.TitleW,
			spec.Status,
			innerW,
			tuistyle.WorkspaceTerminalStatusStyle(),
		)
	}
	lines := []string{
		titleRow,
		HLine(innerW, tuistyle.WorkspaceTerminalLine),
	}

	bodyH := max(3, spec.Height-2)
	footerLines := []string(nil)
	if strings.TrimSpace(spec.Footer) != "" {
		footerLines = strings.Split(spec.Footer, "\n")
		bodyH -= 1 + len(footerLines)
	}
	lines = append(lines, padOrTrimLines(spec.BodyLines, bodyH)...)
	if len(footerLines) > 0 {
		lines = append(lines, HLine(innerW, tuistyle.WorkspaceTerminalLine))
		lines = append(lines, footerLines...)
	}
	lines = padOrTrimLines(lines, max(3, spec.Height))

	return tuistyle.WorkspaceTerminalSectionStyle().
		Width(spec.Width).
		Height(spec.Height).
		Render(strings.Join(lines, "\n"))
}

func renderWorkspaceDrawerToggleButton(open bool, mouse MousePoint) string {
	label := " OS Terminal ▸ "
	if open {
		label = " OS Terminal ▾ "
	}
	hovered := zoneInBounds(workspaceSystemDrawerToggleZoneID(), teaMouseFromPoint(mouse))
	return zone.Mark(workspaceSystemDrawerToggleZoneID(), tuistyle.WorkspaceTerminalToggleStyle(open, hovered).Render(label))
}

func workspaceSystemDrawerToggleZoneID() string {
	return "workspace:system-drawer:toggle"
}

func renderWorkspaceInlineInput(input textinput.Model, width int, prefix string, focused, blinkVisible, busy bool) string {
	value := strings.ReplaceAll(input.Value(), "\n", " ")
	return workspaceShellTerminalRow(prefix, value, width, focused && blinkVisible, busy)
}

func workspaceShellAlignedStyledRow(leftView string, leftW int, right string, width int, rightStyle lipgloss.Style) string {
	right = workspaceSingleLine(right)
	rightW := lipgloss.Width(right)
	leftW = max(0, leftW)
	if right == "" {
		if leftW < width {
			leftView += strings.Repeat(" ", width-leftW)
		}
		return leftView
	}
	gap := width - leftW - rightW
	if gap < 1 {
		gap = 1
	}
	row := leftView + strings.Repeat(" ", gap) + rightStyle.Render(right)
	if lipgloss.Width(row) < width {
		row += strings.Repeat(" ", width-lipgloss.Width(row))
	}
	return row
}
