package tui

import (
	"strings"

	"github.com/charmbracelet/lipgloss"
)

// ── Markdown-ish rendering styles ───────────────────────────────────────────

var (
	mdHeader = lipgloss.NewStyle().
			Bold(true).
			Foreground(Amber)

	mdBold = lipgloss.NewStyle().
		Bold(true).
		Foreground(White)

	mdCode = lipgloss.NewStyle().
		Foreground(Cyan)

	mdCodeBlock = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#94a3b8")).
			Background(lipgloss.Color("#1e293b"))

	mdText = lipgloss.NewStyle().
		Foreground(White)

	mdDim = lipgloss.NewStyle().
		Foreground(Dim)

	mdCodeFence = lipgloss.NewStyle().
			Foreground(Dim).
			Background(lipgloss.Color("#1e293b"))
)

// RenderMarkdown applies simple markdown-ish styling to a block of text.
// Handles: headers (#), bold (**), inline code (`), code fences (```).
func RenderMarkdown(text string) string {
	lines := strings.Split(text, "\n")
	var out strings.Builder
	inCodeBlock := false

	for i, line := range lines {
		if i > 0 {
			out.WriteByte('\n')
		}

		// Code fence toggle
		if strings.HasPrefix(strings.TrimSpace(line), "```") {
			inCodeBlock = !inCodeBlock
			out.WriteString(mdCodeFence.Render(line))
			continue
		}

		if inCodeBlock {
			out.WriteString(mdCodeBlock.Render(line))
			continue
		}

		// Headers: lines starting with #
		trimmed := strings.TrimSpace(line)
		if len(trimmed) > 0 && trimmed[0] == '#' {
			// Strip leading #s and space
			content := strings.TrimLeft(trimmed, "#")
			content = strings.TrimSpace(content)
			out.WriteString(mdHeader.Render(content))
			continue
		}

		// Inline formatting: bold and backtick code
		out.WriteString(renderInline(line))
	}

	return out.String()
}

// renderInline handles **bold** and `code` within a single line.
func renderInline(line string) string {
	var out strings.Builder
	i := 0

	for i < len(line) {
		// Bold: **text**
		if i+1 < len(line) && line[i] == '*' && line[i+1] == '*' {
			end := strings.Index(line[i+2:], "**")
			if end >= 0 {
				content := line[i+2 : i+2+end]
				out.WriteString(mdBold.Render(content))
				i = i + 2 + end + 2
				continue
			}
		}

		// Inline code: `text`
		if line[i] == '`' {
			end := strings.Index(line[i+1:], "`")
			if end >= 0 {
				content := line[i+1 : i+1+end]
				out.WriteString(mdCode.Render(content))
				i = i + 1 + end + 1
				continue
			}
		}

		out.WriteString(mdText.Render(string(line[i])))
		i++
	}

	return out.String()
}

// RenderToolBadge creates a styled tool-call badge like [Read] main.py
func RenderToolBadge(toolName, input string) string {
	var badgeStyle lipgloss.Style

	switch strings.ToLower(toolName) {
	case "read", "glob", "grep":
		badgeStyle = lipgloss.NewStyle().
			Background(lipgloss.Color("#164e63")).
			Foreground(Cyan).
			Bold(true).
			Padding(0, 1)
	case "bash":
		badgeStyle = lipgloss.NewStyle().
			Background(lipgloss.Color("#713f12")).
			Foreground(Amber).
			Bold(true).
			Padding(0, 1)
	case "edit", "write":
		badgeStyle = lipgloss.NewStyle().
			Background(lipgloss.Color("#3b1f7e")).
			Foreground(Purple).
			Bold(true).
			Padding(0, 1)
	case "agent", "toolsearch":
		badgeStyle = lipgloss.NewStyle().
			Background(lipgloss.Color("#064e3b")).
			Foreground(Green).
			Bold(true).
			Padding(0, 1)
	default:
		badgeStyle = lipgloss.NewStyle().
			Background(lipgloss.Color("#334155")).
			Foreground(White).
			Bold(true).
			Padding(0, 1)
	}

	badge := badgeStyle.Render(toolName)
	if input != "" {
		badge += " " + mdDim.Render(input)
	}
	return badge
}
