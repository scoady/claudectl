package tui

import (
	"fmt"
	"path/filepath"
	"sort"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/scoady/codexctl/internal/api"
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
	found := false
	for _, tab := range w.OpenFileTabs {
		if tab == path {
			found = true
			break
		}
	}
	if !found {
		w.OpenFileTabs = append(w.OpenFileTabs, path)
	}
	w.ActiveFileTab = path
	w.PendingFileTab = path
	w.PreviewPath = path
	w.PreviewTitle = filepath.Base(path)
	w.PreviewKind = workspacePreviewFile
	w.EditorActive = true
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

func (w *WorkspaceShellModel) TogglePassThrough() {
	w.PassThrough = !w.PassThrough
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

func (w *WorkspaceShellModel) UpdateComposer(msg tea.Msg, width int) tea.Cmd {
	w.Composer.Width = max(12, width-4)
	var cmd tea.Cmd
	w.Composer, cmd = w.Composer.Update(msg)
	return cmd
}

func (w *WorkspaceShellModel) StartSessionTurn() {
	w.SessionTurnBusy = true
	w.PendingAssistant = true
	w.PendingAssistantAt = time.Now().UTC().Format(time.RFC3339)
	w.TerminalStatus = "Waiting for controller output"
	w.TerminalStream = ""
	w.refreshSessionViewport()
}

func (w *WorkspaceShellModel) FinishSessionTurn(status string) {
	w.SessionTurnBusy = false
	w.PendingAssistant = false
	w.PendingAssistantAt = ""
	if strings.TrimSpace(status) != "" {
		w.TerminalStatus = status
	}
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
	w.refreshSessionViewport()
}

func (w *WorkspaceShellModel) AppendExecResult(command string, result *api.ExecResult, err error) {
	stamp := time.Now().UTC().Format(time.RFC3339)
	if err != nil {
		w.LocalSystemMessages = append(w.LocalSystemMessages, workspaceShellPendingUserMessage{
			Content:   "command failed: " + err.Error(),
			Timestamp: stamp,
		})
		w.TerminalStatus = "Exec failed"
		w.refreshSessionViewport()
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
	w.refreshSessionViewport()
}

func (w *WorkspaceShellModel) AppendTerminalChunk(text string) {
	if strings.TrimSpace(text) == "" {
		return
	}
	w.PendingAssistant = false
	w.TerminalStream += text
	w.TerminalStatus = "Streaming"
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
	w.refreshSessionViewport()
}

func (w *WorkspaceShellModel) TranscriptPlainText() string {
	lines := make([]string, 0, len(w.TerminalMessages)+len(w.PendingUserMessages)+8)
	for _, msg := range w.TerminalMessages {
		switch msg.Type {
		case "tool_use":
			lines = append(lines, fmt.Sprintf("%s tool: %s", tsToStamp(msg.Timestamp), workspaceShellToolLabel(msg)))
		default:
			text := strings.TrimSpace(msg.Content)
			if text == "" {
				continue
			}
			lines = append(lines, workspaceShellPlainMessage(msg.Role, text, msg.Timestamp)...)
		}
	}
	for _, pending := range w.PendingUserMessages {
		lines = append(lines, workspaceShellPlainMessage("user", pending.Content, pending.Timestamp)...)
	}
	for _, msg := range w.LocalSystemMessages {
		lines = append(lines, workspaceShellPlainMessage("system", msg.Content, msg.Timestamp)...)
	}
	if w.PendingAssistant {
		lines = append(lines, fmt.Sprintf("%s %s", tsToStamp(w.PendingAssistantAt), workspaceShellThinkingLabel()))
	}
	if stream := strings.TrimSpace(w.TerminalStream); stream != "" {
		lines = append(lines, workspaceShellPlainMessage("assistant", stream, time.Now().UTC().Format(time.RFC3339))...)
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
	follow := w.SessionViewport.AtBottom()
	offset := w.SessionViewport.YOffset
	lines := make([]string, 0, len(w.TerminalLines)+len(w.PendingUserMessages)+8)
	lines = append(lines, w.TerminalLines...)
	if len(w.TerminalMessages) > 0 {
		lines = append(lines, workspaceShellConversationLines(w.TerminalMessages, width, 1200)...)
	}
	for _, pending := range w.PendingUserMessages {
		lines = append(lines, workspaceShellMessageLines("user", pending.Content, pending.Timestamp, width)...)
	}
	for _, msg := range w.LocalSystemMessages {
		lines = append(lines, workspaceShellMessageLines("system", msg.Content, msg.Timestamp, width)...)
	}
	if w.PendingAssistant {
		stamp := w.PendingAssistantAt
		if strings.TrimSpace(stamp) == "" {
			stamp = time.Now().UTC().Format(time.RFC3339)
		}
		lines = append(lines, workspaceShellMessageLines("assistant", w.ComposerSpinner.View()+" "+workspaceShellThinkingLabel(), stamp, width)...)
	}
	if stream := strings.TrimSpace(w.TerminalStream); stream != "" {
		streamStamp := w.PendingAssistantAt
		if strings.TrimSpace(streamStamp) == "" {
			streamStamp = time.Now().UTC().Format(time.RFC3339)
		}
		lines = append(lines, workspaceShellStreamLines(stream, streamStamp, width)...)
	}
	if len(lines) == 0 {
		lines = []string{lipgloss.NewStyle().Foreground(Dim).Render("No transcript yet.")}
	}
	w.SessionViewport.SetContent(strings.Join(lines, "\n"))
	if follow {
		w.SessionViewport.GotoBottom()
	} else {
		w.SessionViewport.SetYOffset(offset)
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
