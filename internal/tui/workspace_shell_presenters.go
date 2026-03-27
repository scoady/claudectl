package tui

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/lipgloss"
	"github.com/scoady/codexctl/internal/api"
	tuistyle "github.com/scoady/codexctl/internal/tui/style"
)

func workspaceShellConversationLines(messages []api.Message, width, limit int) []string {
	lines := make([]string, 0, min(limit, len(messages)*2))
	for i := 0; i < len(messages); i++ {
		msg := messages[i]
		if msg.Type == "tool_use" {
			labels := []string{workspaceShellToolLabel(msg)}
			stamp := msg.Timestamp
			for i+1 < len(messages) && messages[i+1].Type == "tool_use" {
				i++
				labels = append(labels, workspaceShellToolLabel(messages[i]))
			}
			lines = append(lines, workspaceShellToolLines(labels, stamp, width)...)
		} else {
			text := strings.TrimSpace(msg.Content)
			if text == "" {
				continue
			}
			lines = append(lines, workspaceShellMessageLines(msg.Role, text, msg.Timestamp, width)...)
		}
		if len(lines) >= limit {
			break
		}
	}
	if len(lines) > limit {
		return lines[len(lines)-limit:]
	}
	return lines
}

func workspaceShellMessageLine(role, content, ts string) string {
	return strings.Join(workspaceShellMessageLines(role, content, ts, 120), "\n")
}

func workspaceShellTerminalRow(prefix, content string, width int, focused, busy bool) string {
	prefix = strings.TrimSpace(prefix)
	content = strings.TrimSpace(strings.ReplaceAll(content, "\n", " "))
	line := ""
	if prefix != "" {
		if prefix == ">" {
			line += tuistyle.WorkspaceTerminalPromptMarkerStyle(busy).Render(prefix)
		} else {
			line += tuistyle.WorkspaceTerminalPromptPrefixStyle().Render(prefix)
		}
		if content != "" {
			line += " "
		}
	}
	if content != "" {
		line += tuistyle.WorkspaceTerminalPromptTextStyle().Render(content)
	}
	if focused {
		cursor := tuistyle.WorkspaceTerminalPromptCursorStyle().Render(" ")
		if prefix != "" {
			cursor = tuistyle.WorkspaceTerminalCursorStyle().Render(" ")
		}
		line += cursor
	}
	if lipgloss.Width(line) > width {
		line = truncate(line, width)
	}
	return tuistyle.WorkspaceTerminalSectionStyle().
		Width(max(1, width)).
		Render(line)
}

func workspaceShellMessageLines(role, content, ts string, width int) []string {
	label := "codex"
	color := Blue
	if role == "user" {
		label = "you"
		color = Purple
	} else if role == "system" {
		label = "sys"
		color = Amber
	} else if role == "assistant" {
		label = "codex"
		color = Purple
	}
	stamp := "--:--"
	if t, err := time.Parse(time.RFC3339, ts); err == nil {
		stamp = t.Local().Format("15:04")
	}
	return workspaceShellWrappedLines(stamp, label, color, content, width, White)
}

func workspaceShellToolLabel(msg api.Message) string {
	label := strings.TrimSpace(msg.ToolName)
	if label == "" {
		label = "tool"
	}
	if cmd, ok := msg.ToolInput["command"].(string); ok && strings.TrimSpace(cmd) != "" {
		label += "  " + strings.TrimSpace(cmd)
	}
	return label
}

func workspaceShellPlainMessage(role, content, ts string) []string {
	label := "codex"
	if role == "user" {
		label = "you"
	} else if role == "system" {
		label = "sys"
	}
	content = strings.TrimSpace(strings.ReplaceAll(content, "\r\n", "\n"))
	if content == "" {
		return nil
	}
	body := strings.Split(content, "\n")
	lines := make([]string, 0, len(body))
	for i, line := range body {
		line = strings.TrimSpace(line)
		if i == 0 {
			lines = append(lines, fmt.Sprintf("%s %s: %s", tsToStamp(ts), label, line))
			continue
		}
		lines = append(lines, "      "+line)
	}
	return lines
}

func workspaceShellToolLines(labels []string, ts string, width int) []string {
	return workspaceShellWrappedLines(tsToStamp(ts), "tool", Amber, strings.Join(labels, "  •  "), width, SubText)
}

func workspaceShellStreamLines(stream, ts string, width int) []string {
	out := make([]string, 0, 8)
	for _, raw := range strings.Split(strings.TrimSuffix(stream, "\n"), "\n") {
		line := strings.TrimSpace(raw)
		if line == "" {
			continue
		}
		if strings.HasPrefix(line, "[tool] ") {
			out = append(out, workspaceShellToolLines([]string{strings.TrimPrefix(line, "[tool] ")}, ts, width)...)
			continue
		}
		out = append(out, workspaceShellMessageLines("assistant", line, ts, width)...)
	}
	return out
}

func workspaceShellStreamingLines(stream, ts string, width int, blinkVisible bool) []string {
	rawLines := strings.Split(strings.TrimSuffix(stream, "\n"), "\n")
	if len(rawLines) == 0 {
		return workspaceShellThinkingLines(workspaceShellThinkingLabel(), ts, width, blinkVisible)
	}

	lastAssistant := -1
	for i, raw := range rawLines {
		line := strings.TrimSpace(raw)
		if line == "" || strings.HasPrefix(line, "[tool] ") {
			continue
		}
		lastAssistant = i
	}

	out := make([]string, 0, len(rawLines)*2)
	for i, raw := range rawLines {
		line := strings.TrimSpace(raw)
		if line == "" {
			continue
		}
		if strings.HasPrefix(line, "[tool] ") {
			out = append(out, workspaceShellToolLines([]string{strings.TrimPrefix(line, "[tool] ")}, ts, width)...)
			continue
		}
		if i == lastAssistant {
			out = append(out, workspaceShellLiveAssistantLines(line, ts, width, blinkVisible)...)
			continue
		}
		out = append(out, workspaceShellMessageLines("assistant", line, ts, width)...)
	}
	if len(out) == 0 {
		return workspaceShellThinkingLines(workspaceShellThinkingLabel(), ts, width, blinkVisible)
	}
	return out
}

func workspaceShellThinkingLines(spinnerView, ts string, width int, blinkVisible bool) []string {
	stamp := tsToStamp(ts)
	const stampW = 6
	bodyW := max(12, width-stampW)
	codexBadge := tuistyle.WorkspaceTerminalPendingBadgeStyle().Render("codex")
	body := lipgloss.JoinHorizontal(lipgloss.Top,
		tuistyle.WorkspaceTerminalStatusStyle().Render(spinnerView),
		" ",
		codexBadge,
	)
	if blinkVisible {
		body += " " + tuistyle.WorkspaceTerminalPendingCursorStyle().Render(" ")
	}
	return []string{
		lipgloss.JoinHorizontal(
			lipgloss.Top,
			tuistyle.WorkspaceTerminalSectionStyle().Foreground(Dim).Width(stampW).Render(stamp),
			tuistyle.WorkspaceTerminalSectionStyle().Width(max(1, bodyW)).Render(body),
		),
	}
}

func workspaceShellLiveAssistantLines(content, ts string, width int, blinkVisible bool) []string {
	stamp := tsToStamp(ts)
	const stampW = 6
	const labelW = 7
	bodyW := max(16, width-stampW-labelW)
	parts := workspaceShellStructuredContentLines(content, bodyW)
	if len(parts) == 0 {
		parts = []string{""}
	}
	out := make([]string, 0, len(parts))
	for i, part := range parts {
		curStamp := ""
		curLabel := ""
		if i == 0 {
			curStamp = stamp
			curLabel = "codex"
		}
		body := tuistyle.WorkspaceTerminalSectionStyle().Foreground(White).Render(part)
		if i == len(parts)-1 && blinkVisible {
			body += tuistyle.WorkspaceTerminalPendingCursorStyle().Render(" ")
		}
		out = append(out, lipgloss.JoinHorizontal(
			lipgloss.Top,
			tuistyle.WorkspaceTerminalSectionStyle().Foreground(Dim).Width(stampW).Render(curStamp),
			tuistyle.WorkspaceTerminalRoleLabelStyle(curLabel, Purple, labelW).Render(curLabel),
			body,
		))
	}
	return out
}

func workspaceShellWrappedLines(stamp, label string, labelColor lipgloss.Color, content string, width int, bodyColor lipgloss.Color) []string {
	const stampW = 6
	const labelW = 7
	bodyW := max(16, width-stampW-labelW)
	parts := workspaceShellStructuredContentLines(content, bodyW)
	out := make([]string, 0, len(parts))
	first := true
	for _, part := range parts {
		curStamp := ""
		curLabel := ""
		if first {
			curStamp = stamp
			curLabel = label
			first = false
		}
		out = append(out, lipgloss.JoinHorizontal(
			lipgloss.Top,
			tuistyle.WorkspaceTerminalSectionStyle().Foreground(Dim).Width(stampW).Render(curStamp),
			tuistyle.WorkspaceTerminalRoleLabelStyle(curLabel, labelColor, labelW).Render(curLabel),
			tuistyle.WorkspaceTerminalSectionStyle().Foreground(bodyColor).Render(part),
		))
	}
	return out
}

func tsToStamp(ts string) string {
	stamp := "--:--"
	if t, err := time.Parse(time.RFC3339, ts); err == nil {
		stamp = t.Local().Format("15:04")
	}
	return stamp
}

func workspaceShellThinkingLabel() string {
	labels := []string{
		"Thinking...",
		"Combobulating...",
		"Tracing...",
		"Inspecting...",
		"Cross-checking...",
		"Plotting...",
	}
	idx := int(time.Now().Unix()) % len(labels)
	return labels[idx]
}

func workspaceShellStructuredContentLines(content string, width int) []string {
	rawLines := strings.Split(strings.ReplaceAll(content, "\r\n", "\n"), "\n")
	lines := make([]string, 0, len(rawLines))
	for _, raw := range rawLines {
		line := strings.TrimRight(raw, " \t")
		trimmed := strings.TrimSpace(line)
		switch {
		case trimmed == "":
			lines = append(lines, "")
		case strings.HasPrefix(trimmed, "#"):
			title := strings.TrimSpace(strings.TrimLeft(trimmed, "#"))
			if title == "" {
				continue
			}
			lines = append(lines, wrapText(title, width)...)
		case strings.HasPrefix(trimmed, "- "), strings.HasPrefix(trimmed, "* "):
			lines = append(lines, workspaceShellPrefixedWrap("• ", strings.TrimSpace(trimmed[2:]), width)...)
		default:
			if prefix, rest, ok := workspaceShellNumberedPrefix(trimmed); ok {
				lines = append(lines, workspaceShellPrefixedWrap(prefix, rest, width)...)
			} else {
				wrapped := wrapText(trimmed, width)
				if len(wrapped) == 0 {
					wrapped = []string{trimmed}
				}
				lines = append(lines, wrapped...)
			}
		}
	}
	if len(lines) == 0 {
		return []string{""}
	}
	return lines
}

func workspaceShellPrefixedWrap(prefix, text string, width int) []string {
	textWidth := max(8, width-len(prefix))
	wrapped := wrapText(text, textWidth)
	if len(wrapped) == 0 {
		return []string{prefix}
	}
	lines := make([]string, 0, len(wrapped))
	indent := strings.Repeat(" ", len(prefix))
	for i, part := range wrapped {
		if i == 0 {
			lines = append(lines, prefix+part)
		} else {
			lines = append(lines, indent+part)
		}
	}
	return lines
}

func workspaceShellNumberedPrefix(line string) (string, string, bool) {
	dot := strings.Index(line, ". ")
	if dot <= 0 {
		return "", "", false
	}
	for _, ch := range line[:dot] {
		if ch < '0' || ch > '9' {
			return "", "", false
		}
	}
	return line[:dot+2], strings.TrimSpace(line[dot+2:]), true
}

func workspaceShellFileIcon(entry api.FileEntry) string {
	if entry.Type == "directory" {
		return "📁"
	}
	if entry.Type == "symlink" {
		return "↗"
	}
	base := strings.ToLower(entry.Name)
	switch {
	case base == "dockerfile" || base == "containerfile":
		return "⬢"
	case base == "makefile" || base == "justfile":
		return "▤"
	case strings.HasSuffix(base, ".go"):
		return "◉"
	case strings.HasSuffix(base, ".py"):
		return "◐"
	case strings.HasSuffix(base, ".java"):
		return "◌"
	case strings.HasSuffix(base, ".tf"), strings.HasSuffix(base, ".tfvars"), strings.HasSuffix(base, ".hcl"):
		return "⬡"
	case strings.HasSuffix(base, ".ts"), strings.HasSuffix(base, ".tsx"):
		return "◫"
	case strings.HasSuffix(base, ".js"), strings.HasSuffix(base, ".jsx"):
		return "◨"
	case strings.HasSuffix(base, ".md"), strings.HasSuffix(base, ".mdx"):
		return "≣"
	case strings.HasSuffix(base, ".json"):
		return "{}"
	case strings.HasSuffix(base, ".yaml"), strings.HasSuffix(base, ".yml"), strings.HasSuffix(base, ".toml"):
		return "⋮"
	case strings.HasSuffix(base, ".sh"), strings.HasSuffix(base, ".bash"), strings.HasSuffix(base, ".zsh"):
		return "❯"
	case strings.HasSuffix(base, ".swift"):
		return "◍"
	case strings.HasSuffix(base, ".png"), strings.HasSuffix(base, ".jpg"), strings.HasSuffix(base, ".jpeg"), strings.HasSuffix(base, ".svg"):
		return "▥"
	default:
		return "•"
	}
}

func workspaceShellFileColor(entry api.FileEntry) lipgloss.Color {
	base := strings.ToLower(entry.Name)
	switch {
	case entry.Type == "directory":
		return Cyan
	case entry.Type == "symlink":
		return Purple
	case strings.HasSuffix(base, ".go"):
		return Cyan
	case strings.HasSuffix(base, ".py"):
		return Green
	case strings.HasSuffix(base, ".java"):
		return Amber
	case strings.HasSuffix(base, ".tf"), strings.HasSuffix(base, ".tfvars"), strings.HasSuffix(base, ".hcl"):
		return Cyan
	case strings.HasSuffix(base, ".ts"), strings.HasSuffix(base, ".tsx"):
		return Blue
	case strings.HasSuffix(base, ".js"), strings.HasSuffix(base, ".jsx"):
		return Amber
	case strings.HasSuffix(base, ".md"), strings.HasSuffix(base, ".mdx"):
		return White
	case strings.HasSuffix(base, ".json"):
		return Purple
	case strings.HasSuffix(base, ".yaml"), strings.HasSuffix(base, ".yml"), strings.HasSuffix(base, ".toml"):
		return Green
	case strings.HasSuffix(base, ".sh"), strings.HasSuffix(base, ".bash"), strings.HasSuffix(base, ".zsh"):
		return Rose
	case strings.HasSuffix(base, ".swift"):
		return Amber
	case strings.HasSuffix(base, ".png"), strings.HasSuffix(base, ".jpg"), strings.HasSuffix(base, ".jpeg"), strings.HasSuffix(base, ".svg"):
		return Purple
	default:
		return SubText
	}
}

func workspaceShellEntryRank(kind string) int {
	switch kind {
	case "directory":
		return 0
	case "symlink":
		return 1
	default:
		return 2
	}
}

func workspaceShellStatusPriority(status string) int {
	switch {
	case strings.Contains(status, "??"):
		return 5
	case strings.Contains(status, "M"):
		return 4
	case strings.Contains(status, "R"):
		return 3
	case strings.Contains(status, "D"):
		return 2
	case strings.TrimSpace(status) != "":
		return 1
	default:
		return 0
	}
}

func workspaceShellAgentColor(agent api.Agent) lipgloss.Color {
	switch agent.Status {
	case "active":
		return Amber
	case "idle":
		return Cyan
	case "done":
		return Green
	case "error":
		return Rose
	default:
		return SubText
	}
}

func workspaceShellAgentIcon(agent api.Agent) string {
	if agent.IsController {
		return "ctl"
	}
	return "agt"
}

func workspaceShellCanvasIcon(widget api.Widget) string {
	switch strings.ToLower(strings.TrimSpace(widget.Kind)) {
	case "html", "hero":
		return "◫"
	case "pixel", "pixel-art":
		return "▦"
	case "chart", "spark", "sparkline":
		return "◌"
	case "markdown", "text":
		return "≣"
	default:
		if strings.TrimSpace(widget.HTML) != "" {
			return "◫"
		}
		return "◌"
	}
}

func workspaceShellCanvasColor(widget api.Widget) lipgloss.Color {
	switch strings.ToLower(strings.TrimSpace(widget.Kind)) {
	case "html", "hero":
		return Cyan
	case "pixel", "pixel-art":
		return Purple
	case "chart", "spark", "sparkline":
		return Green
	case "markdown", "text":
		return Amber
	default:
		return SubText
	}
}

func workspaceShellCanvasWidgetDesc(widget api.Widget) string {
	parts := []string{}
	if kind := strings.TrimSpace(widget.Kind); kind != "" {
		parts = append(parts, kind)
	}
	if tmpl := strings.TrimSpace(widget.TemplateID); tmpl != "" {
		parts = append(parts, tmpl)
	}
	if len(parts) == 0 {
		return "widget"
	}
	return strings.Join(parts, "  ")
}

func workspaceShellDockGlyph(mode string) string {
	switch mode {
	case workspaceDockChat:
		return "◉"
	case workspaceDockFiles:
		return "▣"
	case workspaceDockCanvas:
		return "◫"
	case workspaceDockTasks:
		return "✦"
	case workspaceDockMetrics:
		return "◉"
	case workspaceDockTools:
		return "⬢"
	default:
		return "·"
	}
}

func workspaceShellDockTitle(mode string) string {
	switch mode {
	case workspaceDockChat:
		return "Agent Chat"
	case workspaceDockFiles:
		return "Explorer"
	case workspaceDockCanvas:
		return "Canvas"
	case workspaceDockTasks:
		return "Sessions"
	case workspaceDockMetrics:
		return "Status"
	case workspaceDockTools:
		return "Tools"
	default:
		return "Workspace"
	}
}

func workspaceShellDockSubtitle(m *WorkspaceShellModel) string {
	switch m.DockMode {
	case workspaceDockChat:
		return fmt.Sprintf("%d sessions", len(m.AgentsForCurrent()))
	case workspaceDockFiles:
		if m.CurrentDir == "" {
			return "Project tree"
		} else {
			return truncate(m.CurrentDir, 28)
		}
	case workspaceDockCanvas:
		active := coalesce(m.ActiveCanvas, "default")
		return fmt.Sprintf("%d widgets  ·  %s", len(m.CanvasWidgetsForActiveTab()), active)
	case workspaceDockTasks:
		return fmt.Sprintf("%d sessions", len(m.SubagentsForCurrent()))
	case workspaceDockMetrics:
		return "Workspace state"
	case workspaceDockTools:
		return "Utilities"
	default:
		return ""
	}
}

func containsString(values []string, needle string) bool {
	for _, value := range values {
		if value == needle {
			return true
		}
	}
	return false
}

func workspaceShellGitBadge(m *WorkspaceShellModel) string {
	branch := strings.TrimSpace(m.Git.Branch)
	if branch == "" {
		return ""
	}
	provider := strings.TrimSpace(m.Git.Provider)
	remote := strings.TrimSpace(m.Git.Remote)
	icon := "◆"
	label := "local"
	switch provider {
	case "gitlab":
		icon = "◆"
		label = "gitlab"
	case "github":
		icon = ""
		label = "github"
	case "bitbucket":
		icon = "◧"
		label = "bitbucket"
	case "git":
		if remote != "" {
			label = remote
		} else {
			label = "git"
		}
	default:
		if remote != "" {
			label = remote
		}
	}
	return icon + " " + label + " " + branch
}

func workspaceShellLiveLabel(m *WorkspaceShellModel, health *api.HealthResponse) string {
	parts := []string{}
	if m.SessionTurnBusy {
		parts = append(parts, "streaming")
	}
	if health != nil && health.Status != "" && health.Status != "ok" {
		parts = append(parts, health.Status)
	}
	if len(parts) == 0 {
		return "ready"
	}
	return strings.Join(parts, " · ")
}

func focusBorder(active bool) lipgloss.Color {
	if active {
		return GlowBorder
	}
	return BorderColor
}

func coalesceColor(value, fallback lipgloss.Color) lipgloss.Color {
	if value == "" {
		return fallback
	}
	return value
}
