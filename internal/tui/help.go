package tui

import "github.com/charmbracelet/lipgloss"

// RenderHelp renders the help overlay modal as a floating card.
func RenderHelp(width, height int) string {
	// ── Navigation section ──
	navBindings := []struct {
		key  string
		desc string
	}{
		{"Enter", "Drill into selected item"},
		{"Esc / q", "Back / Quit"},
		{"j / Down", "Move selection down"},
		{"k / Up", "Move selection up"},
		{"1-9", "Quick switch to project"},
		{"Tab", "Cycle panels"},
	}

	// ── Actions section ──
	actionBindings := []struct {
		key  string
		desc string
	}{
		{"Ctrl+P / Ctrl+K", "Command palette"},
		{"Ctrl+D", "Dispatch new task"},
		{"t", "Agent Timeline"},
		{"m", "Mission Control (multi-agent)"},
		{"d", "Detail view"},
		{"s", "Settings / Themes"},
		{"l", "Logs / Stream view"},
		{"K", "Kill / Stop agent"},
		{"i", "Inject message (in watch)"},
		{"f", "Toggle follow (in watch)"},
	}

	// ── Commands section ──
	commands := []struct {
		cmd  string
		desc string
	}{
		{":agents", "Show all agents"},
		{":projects", "Show project list"},
		{":timeline", "Agent Timeline"},
		{":mission", "Mission Control"},
		{":settings", "Theme settings"},
		{":q / :quit", "Quit"},
		{"/text", "Filter by text"},
	}

	var content string

	// Title
	content += lipgloss.NewStyle().
		Foreground(Cyan).
		Bold(true).
		Render("  c9s") +
		lipgloss.NewStyle().
			Foreground(Purple).
			Bold(true).
			Render(" Help") + "\n\n"

	// Navigation
	content += HelpSectionStyle.Render("Navigation") + "\n"
	content += HLine(40, Muted) + "\n"
	for _, b := range navBindings {
		content += HelpKeyStyle.Render(b.key) + HelpDescStyle.Render(b.desc) + "\n"
	}

	// Actions
	content += "\n" + HelpSectionStyle.Render("Actions") + "\n"
	content += HLine(40, Muted) + "\n"
	for _, b := range actionBindings {
		content += HelpKeyStyle.Render(b.key) + HelpDescStyle.Render(b.desc) + "\n"
	}

	// Commands
	content += "\n" + HelpSectionStyle.Render("Commands") + "\n"
	content += HLine(40, Muted) + "\n"
	for _, c := range commands {
		content += HelpKeyStyle.Render(c.cmd) + HelpDescStyle.Render(c.desc) + "\n"
	}

	// Version info
	content += "\n" + DimStyle.Render("c9s claudectl  |  ? to dismiss")

	box := HelpOverlayStyle.Render(content)

	// Center the overlay using lipgloss.Place
	if width > 0 && height > 0 {
		return lipgloss.Place(width, height, lipgloss.Center, lipgloss.Center, box)
	}

	return box
}

func splitLines(s string) []string {
	var lines []string
	current := ""
	for _, ch := range s {
		if ch == '\n' {
			lines = append(lines, current)
			current = ""
		} else {
			current += string(ch)
		}
	}
	if current != "" {
		lines = append(lines, current)
	}
	return lines
}
