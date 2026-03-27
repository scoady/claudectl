package tui

import (
	"fmt"
	"strings"
	"time"

	"github.com/scoady/codexctl/internal/api"
)

type workspaceTranscriptRow struct {
	Timestamp string
	Role      string
	Kind      string
	Content   string
	Labels    []string
}

func (w *WorkspaceShellModel) transcriptRows() []workspaceTranscriptRow {
	rows := make([]workspaceTranscriptRow, 0, len(w.TerminalMessages)+len(w.PendingUserMessages)+4)
	rows = append(rows, workspaceTranscriptRowsFromMessages(w.TerminalMessages)...)
	for _, pending := range w.PendingUserMessages {
		rows = append(rows, workspaceTranscriptRow{
			Timestamp: pending.Timestamp,
			Role:      "user",
			Kind:      "message",
			Content:   pending.Content,
		})
	}
	stream := strings.TrimSpace(w.TerminalStream)
	if w.PendingAssistant && stream == "" {
		rows = append(rows, workspaceTranscriptRow{
			Timestamp: coalesce(strings.TrimSpace(w.PendingAssistantAt), time.Now().UTC().Format(time.RFC3339)),
			Role:      "assistant",
			Kind:      "thinking",
			Content:   workspaceShellThinkingLabel(),
		})
	}
	if stream != "" {
		rows = append(rows, workspaceTranscriptRow{
			Timestamp: coalesce(strings.TrimSpace(w.PendingAssistantAt), time.Now().UTC().Format(time.RFC3339)),
			Role:      "assistant",
			Kind:      "stream",
			Content:   stream,
		})
	}
	return rows
}

func workspaceTranscriptRowsFromMessages(messages []api.Message) []workspaceTranscriptRow {
	rows := make([]workspaceTranscriptRow, 0, len(messages))
	for i := 0; i < len(messages); i++ {
		msg := messages[i]
		if msg.Type == "tool_use" {
			labels := []string{workspaceShellToolLabel(msg)}
			stamp := msg.Timestamp
			for i+1 < len(messages) && messages[i+1].Type == "tool_use" {
				i++
				labels = append(labels, workspaceShellToolLabel(messages[i]))
			}
			rows = append(rows, workspaceTranscriptRow{
				Timestamp: stamp,
				Role:      "system",
				Kind:      "tool",
				Labels:    labels,
			})
			continue
		}
		text := strings.TrimSpace(msg.Content)
		if text == "" {
			continue
		}
		rows = append(rows, workspaceTranscriptRow{
			Timestamp: msg.Timestamp,
			Role:      msg.Role,
			Kind:      "message",
			Content:   text,
		})
	}
	return rows
}

func (r workspaceTranscriptRow) renderLines(width int) []string {
	switch r.Kind {
	case "tool":
		return workspaceShellToolLines(r.Labels, r.Timestamp, width)
	case "thinking":
		return workspaceShellMessageLines("assistant", r.Content, r.Timestamp, width)
	default:
		return workspaceShellMessageLines(r.Role, r.Content, r.Timestamp, width)
	}
}

func (r workspaceTranscriptRow) plainLines() []string {
	switch r.Kind {
	case "tool":
		return []string{fmt.Sprintf("%s tool: %s", tsToStamp(r.Timestamp), strings.Join(r.Labels, "  •  "))}
	case "thinking":
		return []string{fmt.Sprintf("%s %s", tsToStamp(r.Timestamp), r.Content)}
	case "stream":
		return workspaceShellPlainMessage("assistant", r.Content, r.Timestamp)
	default:
		return workspaceShellPlainMessage(r.Role, r.Content, r.Timestamp)
	}
}
