package tui

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"sort"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/scoady/codexctl/internal/api"
	tuistyle "github.com/scoady/codexctl/internal/tui/style"
)

func (w *WorkspaceShellModel) SetFilePreview(path string, content *api.FileContent, err error) {
	w.PreviewPath = path
	w.PreviewTitle = filepath.Base(path)
	w.PreviewKind = workspacePreviewFile
	w.PreviewReady = false
	w.PreviewEditable = false
	w.PreviewContent = ""
	if err != nil {
		w.PreviewBody = err.Error()
		return
	}
	if content == nil {
		w.PreviewBody = ""
		return
	}
	if content.Binary {
		w.PreviewBody = "binary file preview not available"
		return
	}
	if content.Truncated {
		w.PreviewBody = "file is too large to preview"
		return
	}
	w.PreviewBody = content.Content
	w.PreviewContent = content.Content
	w.PreviewEditable = true
	if _, ok := w.FileSaved[path]; !ok || w.ActiveFileTab != path || !w.EditorDirty {
		w.FileSaved[path] = content.Content
	}
	if _, ok := w.FileBuffers[path]; !ok || w.ActiveFileTab != path || !w.EditorDirty {
		w.FileBuffers[path] = content.Content
	}
	if w.ActiveFileTab == path {
		buf := w.FileBuffers[path]
		w.Editor.SetValue(buf)
		w.resetEditorHistory(buf)
		w.EditorActive = true
		w.Editor.Focus()
		w.EditorDirty = buf != w.FileSaved[path]
	}
	w.PendingFileTab = ""
}

func (w *WorkspaceShellModel) SetAgentPreview(sessionID string, messages []api.Message, err error) {
	w.PreviewPath = sessionID
	w.PreviewTitle = "Agent Transcript"
	w.PreviewKind = workspacePreviewAgent
	w.PreviewReady = false
	w.PreviewEditable = false
	w.EditorActive = false
	w.EditorDirty = false
	if err != nil {
		w.PreviewBody = err.Error()
		return
	}
	w.PreviewBody = strings.Join(workspaceShellConversationLines(messages, 80, 80), "\n")
}

func (w *WorkspaceShellModel) SetTerminalPreview(sessionID string, messages []api.Message, err error) {
	w.TerminalSessionID = sessionID
	if ag := w.TerminalAgentRef(); ag != nil {
		w.TerminalTitle = coalesce(ag.Task, "Controller")
	} else {
		w.TerminalTitle = "Controller"
	}

	if err != nil {
		w.TerminalMessages = nil
		w.TerminalStatus = "Transcript unavailable"
		w.TerminalLines = []string{
			lipgloss.NewStyle().Foreground(Rose).Render("Failed to load transcript: " + err.Error()),
		}
		w.TerminalStream = ""
		w.refreshSessionViewport()
		return
	}

	messages = workspaceShellSortedMessages(messages)
	w.reconcilePendingUserLines(messages)
	if !w.SessionTurnBusy {
		w.PendingUserMessages = nil
	}
	w.PendingAssistant = false
	w.PendingAssistantAt = ""
	w.TerminalMessages = messages
	w.TerminalLines = nil
	if len(messages) == 0 {
		w.TerminalMessages = nil
		w.TerminalLines = []string{
			lipgloss.NewStyle().Foreground(Dim).Render("No controller transcript yet."),
			lipgloss.NewStyle().Foreground(Dim).Render("Type below and press enter to resume the session."),
		}
		w.TerminalStatus = "Ready"
	} else {
		w.TerminalStatus = fmt.Sprintf("%d events", len(messages))
	}
	w.TerminalStream = ""
	w.FollowSessionTail = true
	w.refreshSessionViewport()
}

func (w *WorkspaceShellModel) AppendLocalUserMessage(content string) {
	content = strings.TrimSpace(content)
	if content == "" {
		return
	}
	w.PendingUserMessages = append(w.PendingUserMessages, workspaceShellPendingUserMessage{
		Content:   content,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	})
	w.FollowSessionTail = true
	w.refreshSessionViewport()
}

func (w *WorkspaceShellModel) ClearComposer() {
	w.Composer.SetValue("")
}

func (w *WorkspaceShellModel) StartOpenFileTab(path string) {
	path = strings.TrimSpace(path)
	if path == "" {
		return
	}
	w.OpenFileTabs = []string{path}
	w.ActiveFileTab = path
	w.PendingFileTab = path
	w.PreviewPath = path
	w.PreviewTitle = filepath.Base(path)
	w.PreviewKind = workspacePreviewFile
	w.EditorActive = true
	w.DockMode = workspaceDockFiles
	if buf, ok := w.FileBuffers[path]; ok {
		w.Editor.SetValue(buf)
		w.EditorDirty = buf != w.FileSaved[path]
		w.resetEditorHistory(buf)
	} else {
		w.Editor.SetValue("")
		w.EditorDirty = false
		w.resetEditorHistory("")
	}
	w.Editor.Focus()
}

func (w *WorkspaceShellModel) ActivateFileTab(path string) bool {
	for _, tab := range w.OpenFileTabs {
		if tab == path {
			w.ActiveFileTab = path
			w.PreviewPath = path
			w.PreviewTitle = filepath.Base(path)
			w.PreviewKind = workspacePreviewFile
			w.EditorActive = true
			buf := w.FileBuffers[path]
			w.Editor.SetValue(buf)
			w.EditorDirty = buf != w.FileSaved[path]
			w.resetEditorHistory(buf)
			w.Editor.Focus()
			return true
		}
	}
	return false
}

func (w *WorkspaceShellModel) CloseFileTab(path string) bool {
	idx := -1
	for i, tab := range w.OpenFileTabs {
		if tab == path {
			idx = i
			break
		}
	}
	if idx < 0 {
		return false
	}
	w.OpenFileTabs = append(w.OpenFileTabs[:idx], w.OpenFileTabs[idx+1:]...)
	delete(w.FileBuffers, path)
	delete(w.FileSaved, path)
	if w.ActiveFileTab == path {
		if len(w.OpenFileTabs) == 0 {
			w.ActiveFileTab = ""
			w.EditorActive = false
			w.PreviewPath = ""
			w.Editor.SetValue("")
			w.Editor.Blur()
			return true
		}
		next := idx
		if next >= len(w.OpenFileTabs) {
			next = len(w.OpenFileTabs) - 1
		}
		return w.ActivateFileTab(w.OpenFileTabs[next])
	}
	return true
}

func (w *WorkspaceShellModel) ComposerValue() string {
	return strings.TrimSpace(w.Composer.Value())
}

func (w *WorkspaceShellModel) SystemComposerValue() string {
	return strings.TrimSpace(w.SystemComposer.Value())
}

func (w *WorkspaceShellModel) ComposeControllerMessage(userMessage string) string {
	userMessage = strings.TrimSpace(userMessage)
	if userMessage == "" {
		return ""
	}
	systemContext := strings.TrimSpace(w.RecentSystemContextJSON())
	if systemContext == "" {
		return userMessage
	}
	return strings.TrimSpace(userMessage) + "\n\n" +
		"[local_os_terminal_context]\n" +
		systemContext + "\n" +
		"[/local_os_terminal_context]"
}

func (w *WorkspaceShellModel) ToggleSystemDrawer() {
	if w.DockMode != workspaceDockChat {
		return
	}
	w.SystemDrawerOpen = !w.SystemDrawerOpen
	if w.SystemDrawerOpen {
		w.FocusSystemComposer()
	} else {
		w.BlurSystemComposer()
		w.FocusComposer()
	}
}

func (w *WorkspaceShellModel) FocusComposer() {
	w.FocusPane = 2
	w.ComposerFocused = true
	w.Composer.Focus()
}

func (w *WorkspaceShellModel) BlurComposer() {
	w.ComposerFocused = false
	w.Composer.Blur()
}

func (w *WorkspaceShellModel) FocusSystemComposer() {
	w.FocusPane = 3
	w.SystemComposerFocused = true
	w.SystemComposer.Focus()
}

func (w *WorkspaceShellModel) BlurSystemComposer() {
	w.SystemComposerFocused = false
	w.SystemComposer.Blur()
}

func (w *WorkspaceShellModel) UpdateComposer(msg tea.Msg, width int) tea.Cmd {
	w.Composer.Width = max(12, width-4)
	var cmd tea.Cmd
	w.Composer, cmd = w.Composer.Update(msg)
	return cmd
}

func (w *WorkspaceShellModel) UpdateSystemComposer(msg tea.Msg, width int) tea.Cmd {
	w.SystemComposer.Width = max(12, width-4)
	var cmd tea.Cmd
	w.SystemComposer, cmd = w.SystemComposer.Update(msg)
	return cmd
}

func (w *WorkspaceShellModel) ClearSystemComposer() {
	w.SystemComposer.SetValue("")
}

func (w *WorkspaceShellModel) StartSessionTurn() {
	w.SessionTurnBusy = true
	w.PendingAssistant = true
	w.PendingAssistantAt = time.Now().UTC().Format(time.RFC3339)
	w.TerminalStatus = "Waiting for controller output"
	w.TerminalStream = ""
	w.FollowSessionTail = true
	w.refreshSessionViewport()
}

func (w *WorkspaceShellModel) FinishSessionTurn(status string) {
	w.SessionTurnBusy = false
	w.PendingAssistant = false
	w.PendingAssistantAt = ""
	if strings.TrimSpace(status) != "" {
		w.TerminalStatus = status
	}
	w.FollowSessionTail = true
	w.refreshSessionViewport()
}

func (w *WorkspaceShellModel) AppendExecCommand(command string) {
	command = strings.TrimSpace(command)
	if command == "" {
		return
	}
	w.LocalSystemMessages = append(w.LocalSystemMessages, workspaceShellPendingUserMessage{
		Content:   "$ " + command,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
	})
	w.FollowSessionTail = true
	w.FollowSystemTail = true
	w.refreshSessionViewport()
	w.refreshSystemViewport()
}

func (w *WorkspaceShellModel) AppendExecResult(command string, result *api.ExecResult, err error) {
	stamp := time.Now().UTC().Format(time.RFC3339)
	if err != nil {
		w.LocalSystemMessages = append(w.LocalSystemMessages, workspaceShellPendingUserMessage{
			Content:   "command failed: " + err.Error(),
			Timestamp: stamp,
		})
		w.TerminalStatus = "Exec failed"
		w.FollowSessionTail = true
		w.FollowSystemTail = true
		w.refreshSessionViewport()
		w.refreshSystemViewport()
		return
	}
	if result == nil {
		return
	}
	parts := []string{}
	if out := strings.TrimSpace(result.Stdout); out != "" {
		parts = append(parts, out)
	}
	if out := strings.TrimSpace(result.Stderr); out != "" {
		parts = append(parts, out)
	}
	if len(parts) == 0 {
		parts = append(parts, fmt.Sprintf("exit %d", result.ExitCode))
	}
	body := strings.Join(parts, "\n")
	w.LocalSystemMessages = append(w.LocalSystemMessages, workspaceShellPendingUserMessage{
		Content:   body,
		Timestamp: stamp,
	})
	if result.ExitCode == 0 {
		w.TerminalStatus = "Command complete"
	} else {
		w.TerminalStatus = fmt.Sprintf("Command exited %d", result.ExitCode)
	}
	w.FollowSessionTail = true
	w.FollowSystemTail = true
	w.refreshSessionViewport()
	w.refreshSystemViewport()
}

func (w *WorkspaceShellModel) AppendTerminalChunk(text string) {
	if strings.TrimSpace(text) == "" {
		return
	}
	w.PendingAssistant = false
	w.TerminalStream += text
	w.TerminalStatus = "Streaming"
	w.FollowSessionTail = true
	w.refreshSessionViewport()
}

func (w *WorkspaceShellModel) AppendTerminalMilestone(label string) {
	label = strings.TrimSpace(label)
	if label == "" {
		return
	}
	if w.TerminalStream != "" && !strings.HasSuffix(w.TerminalStream, "\n") {
		w.TerminalStream += "\n"
	}
	w.TerminalStream += "[tool] " + label + "\n"
	w.TerminalStatus = "Running tools"
	w.FollowSessionTail = true
	w.refreshSessionViewport()
}

func (w *WorkspaceShellModel) ClearTerminalView() {
	w.TerminalMessages = nil
	w.TerminalLines = nil
	w.TerminalStream = ""
	w.LocalSystemMessages = nil
	w.PendingUserMessages = nil
	w.PendingAssistant = false
	w.PendingAssistantAt = ""
	w.TerminalStatus = "Transcript cleared"
	w.FollowSessionTail = true
	w.FollowSystemTail = true
	w.refreshSessionViewport()
	w.refreshSystemViewport()
}

func (w *WorkspaceShellModel) RecentSystemContextJSON() string {
	if len(w.LocalSystemMessages) == 0 {
		return ""
	}
	type event struct {
		Timestamp string `json:"timestamp"`
		Source    string `json:"source"`
		Content   string `json:"content"`
	}
	start := 0
	if len(w.LocalSystemMessages) > 6 {
		start = len(w.LocalSystemMessages) - 6
	}
	events := make([]event, 0, len(w.LocalSystemMessages)-start)
	totalChars := 0
	for _, msg := range w.LocalSystemMessages[start:] {
		content := strings.TrimSpace(msg.Content)
		if content == "" {
			continue
		}
		if len(content) > 1200 {
			content = content[:1200] + "\n...<truncated>"
		}
		events = append(events, event{
			Timestamp: msg.Timestamp,
			Source:    "user_system",
			Content:   content,
		})
		totalChars += len(content)
		if totalChars > 2400 {
			break
		}
	}
	if len(events) == 0 {
		return ""
	}
	payload, err := json.MarshalIndent(events, "", "  ")
	if err != nil {
		return ""
	}
	return string(payload)
}

func (w *WorkspaceShellModel) TranscriptPlainText() string {
	rows := w.transcriptRows()
	lines := make([]string, 0, len(rows)*2)
	for _, row := range rows {
		lines = append(lines, row.plainLines()...)
	}
	return strings.TrimSpace(strings.Join(lines, "\n"))
}

func (w *WorkspaceShellModel) CanEditPreviewFile() bool {
	return w.PreviewKind == workspacePreviewFile && w.PreviewPath != "" && w.PreviewEditable
}

func (w *WorkspaceShellModel) BeginEditingPreview() bool {
	if !w.CanEditPreviewFile() {
		return false
	}
	w.StartOpenFileTab(w.PreviewPath)
	if saved, ok := w.FileSaved[w.PreviewPath]; ok {
		w.EditorDirty = w.Editor.Value() != saved
	}
	return true
}

func (w *WorkspaceShellModel) StopEditingPreview() {
	w.EditorActive = false
	w.Editor.Blur()
}

func (w *WorkspaceShellModel) UpdateEditor(msg tea.Msg, width, height int) tea.Cmd {
	if !w.EditorActive {
		return nil
	}
	if width > 12 {
		w.Editor.SetWidth(width)
	}
	if height > 4 {
		w.Editor.SetHeight(height)
	}
	var cmd tea.Cmd
	before := w.Editor.Value()
	w.Editor, cmd = w.Editor.Update(msg)
	after := w.Editor.Value()
	if after != before && w.ActiveFileTab != "" {
		w.FileBuffers[w.ActiveFileTab] = after
		w.recordEditorHistory(after)
		w.PreviewBody = after
		w.EditorDirty = after != w.FileSaved[w.ActiveFileTab]
	}
	return cmd
}

func (w *WorkspaceShellModel) SavedEditorContent(content string) {
	w.PreviewBody = content
	w.PreviewContent = content
	if w.ActiveFileTab != "" {
		w.FileSaved[w.ActiveFileTab] = content
		w.FileBuffers[w.ActiveFileTab] = content
	}
	w.Editor.SetValue(content)
	w.EditorDirty = false
	w.resetEditorHistory(content)
}

func (w *WorkspaceShellModel) UndoPreviewEdit() bool {
	if !w.EditorActive || len(w.EditorHistory) < 2 {
		return false
	}
	w.EditorHistory = w.EditorHistory[:len(w.EditorHistory)-1]
	prev := w.EditorHistory[len(w.EditorHistory)-1]
	w.Editor.SetValue(prev)
	if w.ActiveFileTab != "" {
		w.FileBuffers[w.ActiveFileTab] = prev
		w.EditorDirty = prev != w.FileSaved[w.ActiveFileTab]
	}
	w.PreviewBody = prev
	return true
}

func (w *WorkspaceShellModel) resetEditorHistory(value string) {
	w.EditorHistory = []string{value}
}

func (w *WorkspaceShellModel) recordEditorHistory(value string) {
	if len(w.EditorHistory) > 0 && w.EditorHistory[len(w.EditorHistory)-1] == value {
		return
	}
	w.EditorHistory = append(w.EditorHistory, value)
	if len(w.EditorHistory) > 200 {
		w.EditorHistory = append([]string(nil), w.EditorHistory[len(w.EditorHistory)-200:]...)
	}
}

func (w *WorkspaceShellModel) refreshSessionViewport() {
	width := max(36, w.SessionViewport.Width-1)
	follow := w.FollowSessionTail || w.SessionViewport.AtBottom()
	offset := w.SessionViewport.YOffset
	rows := w.transcriptRows()
	lines := make([]string, 0, len(w.TerminalLines)+len(rows)*2)
	lines = append(lines, w.TerminalLines...)
	for _, row := range rows {
		if row.Kind == "thinking" {
			lines = append(lines, workspaceShellThinkingLines(w.ComposerSpinner.View(), row.Timestamp, width, w.BlinkVisible)...)
			continue
		}
		if row.Kind == "stream" {
			lines = append(lines, workspaceShellStreamingLines(row.Content, row.Timestamp, width, w.BlinkVisible)...)
			continue
		}
		lines = append(lines, row.renderLines(width)...)
	}
	if len(lines) == 0 {
		lines = []string{lipgloss.NewStyle().Foreground(Dim).Render("No transcript yet.")}
	}
	surfaced := make([]string, 0, len(lines))
	for _, line := range lines {
		surfaced = append(surfaced, tuistyle.WorkspaceTerminalSurfaceLine(line, width))
	}
	w.SessionViewport.SetContent(strings.Join(surfaced, "\n"))
	if follow {
		w.SessionViewport.GotoBottom()
		w.FollowSessionTail = false
	} else {
		w.SessionViewport.SetYOffset(offset)
	}
}

func (w *WorkspaceShellModel) refreshSystemViewport() {
	width := max(28, w.SystemViewport.Width-1)
	follow := w.FollowSystemTail || w.SystemViewport.AtBottom()
	offset := w.SystemViewport.YOffset
	lines := make([]string, 0, len(w.LocalSystemMessages)*2+2)
	for _, msg := range w.LocalSystemMessages {
		lines = append(lines, workspaceShellMessageLines("system", msg.Content, msg.Timestamp, width)...)
	}
	if len(lines) == 0 {
		lines = []string{
			lipgloss.NewStyle().Foreground(Dim).Render("Run local OS commands here."),
			lipgloss.NewStyle().Foreground(Dim).Render("Output is mirrored into the agent transcript."),
		}
	}
	surfaced := make([]string, 0, len(lines))
	for _, line := range lines {
		surfaced = append(surfaced, tuistyle.WorkspaceTerminalSurfaceLine(line, width))
	}
	w.SystemViewport.SetContent(strings.Join(surfaced, "\n"))
	if follow {
		w.SystemViewport.GotoBottom()
		w.FollowSystemTail = false
	} else {
		w.SystemViewport.SetYOffset(offset)
	}
}

func (w *WorkspaceShellModel) reconcilePendingUserLines(messages []api.Message) {
	if len(w.PendingUserMessages) == 0 {
		return
	}
	seen := map[string]struct{}{}
	for _, msg := range messages {
		if msg.Role == "user" {
			norm := workspaceShellNormalizeMessageText(msg.Content)
			if norm != "" {
				seen[norm] = struct{}{}
			}
		}
	}
	remaining := make([]workspaceShellPendingUserMessage, 0, len(w.PendingUserMessages))
	for _, pending := range w.PendingUserMessages {
		pendingNorm := workspaceShellNormalizeMessageText(pending.Content)
		if pendingNorm == "" {
			continue
		}
		if _, ok := seen[pendingNorm]; ok {
			continue
		}
		matched := false
		for existing := range seen {
			if strings.Contains(existing, pendingNorm) || strings.Contains(pendingNorm, existing) {
				matched = true
				break
			}
		}
		if matched {
			continue
		}
		remaining = append(remaining, pending)
	}
	w.PendingUserMessages = remaining
}

func workspaceShellSortedMessages(messages []api.Message) []api.Message {
	if len(messages) < 2 {
		return messages
	}
	out := append([]api.Message(nil), messages...)
	sort.SliceStable(out, func(i, j int) bool {
		ti := workspaceShellMessageTime(out[i].Timestamp)
		tj := workspaceShellMessageTime(out[j].Timestamp)
		if !ti.Equal(tj) {
			return ti.Before(tj)
		}
		ri := workspaceShellMessageRoleRank(out[i])
		rj := workspaceShellMessageRoleRank(out[j])
		if ri != rj {
			return ri < rj
		}
		return false
	})
	return out
}

func workspaceShellMessageTime(ts string) time.Time {
	if t, err := time.Parse(time.RFC3339, ts); err == nil {
		return t
	}
	return time.Time{}
}

func workspaceShellMessageRoleRank(msg api.Message) int {
	switch msg.Role {
	case "user":
		return 0
	case "system":
		return 1
	case "assistant":
		return 3
	}
	if msg.Type == "tool_use" {
		return 2
	}
	return 4
}

func workspaceShellNormalizeMessageText(text string) string {
	fields := strings.Fields(strings.TrimSpace(strings.ToLower(text)))
	return strings.Join(fields, " ")
}
