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

	mdHeaderAccent = lipgloss.NewStyle().
			Foreground(Amber).
			Bold(true)

	mdBold = lipgloss.NewStyle().
		Bold(true).
		Foreground(White)

	mdCode = lipgloss.NewStyle().
		Foreground(Cyan).
		Bold(true)

	mdCodeBlock = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#94a3b8"))

	mdText = lipgloss.NewStyle().
		Foreground(White)

	mdDim = lipgloss.NewStyle().
		Foreground(Dim)

	mdCodeFence = lipgloss.NewStyle().
			Foreground(Dim)

	mdBullet = lipgloss.NewStyle().
			Foreground(Purple).
			Bold(true)

	mdCheckDone = lipgloss.NewStyle().
			Foreground(Green).
			Bold(true)

	mdCheckPending = lipgloss.NewStyle().
			Foreground(Dim)

	mdHRule = lipgloss.NewStyle().
		Foreground(Muted)
)

// RenderMarkdown applies simple markdown-ish styling to a block of text.
// Handles: headers (#), bold (**), inline code (`), code fences (```),
// bullet points, task lists, horizontal rules.
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

		trimmed := strings.TrimSpace(line)

		// Horizontal rules: --- or ***  or ___
		if len(trimmed) >= 3 && (isAllChar(trimmed, '-') || isAllChar(trimmed, '*') || isAllChar(trimmed, '_')) {
			out.WriteString(mdHRule.Render(strings.Repeat("─", 40)))
			continue
		}

		// Headers: lines starting with #
		if len(trimmed) > 0 && trimmed[0] == '#' {
			content := strings.TrimLeft(trimmed, "#")
			content = strings.TrimSpace(content)
			out.WriteString(mdHeaderAccent.Render("┃ ") + mdHeader.Render(content))
			continue
		}

		// Task lists: - [x] or - [ ]
		if strings.HasPrefix(trimmed, "- [x]") || strings.HasPrefix(trimmed, "- [X]") {
			indent := leadingSpaces(line)
			content := strings.TrimSpace(trimmed[5:])
			out.WriteString(strings.Repeat(" ", indent) + mdCheckDone.Render("  ") + " " + renderInline(content))
			continue
		}
		if strings.HasPrefix(trimmed, "- [ ]") {
			indent := leadingSpaces(line)
			content := strings.TrimSpace(trimmed[5:])
			out.WriteString(strings.Repeat(" ", indent) + mdCheckPending.Render("  ") + " " + renderInline(content))
			continue
		}

		// Bullet points: - or * at start
		if (strings.HasPrefix(trimmed, "- ") || strings.HasPrefix(trimmed, "* ")) && len(trimmed) > 2 {
			indent := leadingSpaces(line)
			content := trimmed[2:]
			out.WriteString(strings.Repeat(" ", indent) + mdBullet.Render(" ") + " " + renderInline(content))
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
				out.WriteString(mdCode.Render(" " + content + " "))
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
			Foreground(Cyan).
			Bold(true)
	case "bash":
		badgeStyle = lipgloss.NewStyle().
			Foreground(Amber).
			Bold(true)
	case "edit", "write":
		badgeStyle = lipgloss.NewStyle().
			Foreground(Purple).
			Bold(true)
	case "agent", "toolsearch":
		badgeStyle = lipgloss.NewStyle().
			Foreground(Green).
			Bold(true)
	default:
		badgeStyle = lipgloss.NewStyle().
			Foreground(White).
			Bold(true)
	}

	badge := badgeStyle.Render("[" + toolName + "]")
	if input != "" {
		badge += " " + mdDim.Render(input)
	}
	return badge
}

// isAllChar returns true if s consists entirely of character c (and optional spaces).
func isAllChar(s string, c byte) bool {
	count := 0
	for i := 0; i < len(s); i++ {
		if s[i] == c {
			count++
		} else if s[i] != ' ' {
			return false
		}
	}
	return count >= 3
}

// leadingSpaces counts leading space characters.
func leadingSpaces(s string) int {
	n := 0
	for _, ch := range s {
		if ch == ' ' {
			n++
		} else if ch == '\t' {
			n += 4
		} else {
			break
		}
	}
	return n
}
