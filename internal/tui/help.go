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
		{"T", "Targets (health status)"},
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
		{":targets", "Targets health screen"},
		{":settings", "Theme settings"},
		{":q / :quit", "Quit"},
		{"/text", "Filter by text"},
	}

	var content string

	// Title
	content += Class("logo").Render("  c9s") +
		lipgloss.NewStyle().Foreground(Purple).Bold(true).Render(" Help") + "\n\n"

	// Navigation
	content += Class("help-section").Render("Navigation") + "\n"
	content += HLine(40, Muted) + "\n"
	for _, b := range navBindings {
		content += Class("help-key").Render(b.key) + Class("help-desc").Render(b.desc) + "\n"
	}

	// Actions
	content += "\n" + Class("help-section").Render("Actions") + "\n"
	content += HLine(40, Muted) + "\n"
	for _, b := range actionBindings {
		content += Class("help-key").Render(b.key) + Class("help-desc").Render(b.desc) + "\n"
	}

	// Commands
	content += "\n" + Class("help-section").Render("Commands") + "\n"
	content += HLine(40, Muted) + "\n"
	for _, c := range commands {
		content += Class("help-key").Render(c.cmd) + Class("help-desc").Render(c.desc) + "\n"
	}

	// Version info
	content += "\n" + Class("dim").Render("c9s claudectl  |  ? to dismiss")

	box := Class("help-overlay").Render(content)

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
