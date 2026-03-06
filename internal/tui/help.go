package tui

import "github.com/charmbracelet/lipgloss"

// RenderHelp renders the help overlay modal.
func RenderHelp(width, height int) string {
	bindings := []struct {
		key  string
		desc string
	}{
		{"Enter", "Drill into selected item"},
		{"Esc / q", "Back / Quit"},
		{":", "Command mode"},
		{"/", "Filter / Search"},
		{"d", "Describe / Detail view"},
		{"l", "Logs / Stream view"},
		{"k", "Kill / Stop agent"},
		{"Ctrl+D", "Dispatch new task"},
		{"Tab", "Cycle panels"},
		{"1-9", "Quick switch to project"},
		{"j / Down", "Move selection down"},
		{"k / Up", "Move selection up (in non-agent views)"},
		{"?", "Toggle this help"},
	}

	commands := []struct {
		cmd  string
		desc string
	}{
		{":agents", "Show all agents"},
		{":projects", "Show project list (dashboard)"},
		{":q / :quit", "Quit"},
	}

	title := HelpTitleStyle.Render("c9s Key Bindings")

	content := title + "\n\n"
	for _, b := range bindings {
		content += HelpKeyStyle.Render(b.key) + HelpDescStyle.Render(b.desc) + "\n"
	}

	content += "\n" + HelpTitleStyle.Render("Commands") + "\n\n"
	for _, c := range commands {
		content += HelpKeyStyle.Render(c.cmd) + HelpDescStyle.Render(c.desc) + "\n"
	}

	box := HelpOverlayStyle.Render(content)

	// Center the overlay
	boxW := lipgloss.Width(box)
	boxH := lipgloss.Height(box)

	padLeft := (width - boxW) / 2
	padTop := (height - boxH) / 2
	if padLeft < 0 {
		padLeft = 0
	}
	if padTop < 0 {
		padTop = 0
	}

	// Build centered content
	result := ""
	for i := 0; i < padTop; i++ {
		result += "\n"
	}
	lines := splitLines(box)
	for _, line := range lines {
		result += repeatStr(" ", padLeft) + line + "\n"
	}

	return result
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
