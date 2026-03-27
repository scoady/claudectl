package tui

import (
	"testing"
	"time"

	"github.com/scoady/codexctl/internal/api"
)

func TestWorkspaceTranscriptRowsFromMessagesGroupsConsecutiveTools(t *testing.T) {
	rows := workspaceTranscriptRowsFromMessages([]api.Message{
		{Role: "system", Type: "tool_use", ToolName: "ls", Timestamp: "2026-03-27T12:00:00Z"},
		{Role: "system", Type: "tool_use", ToolName: "pwd", Timestamp: "2026-03-27T12:00:01Z"},
		{Role: "assistant", Content: "done", Timestamp: "2026-03-27T12:00:02Z"},
	})

	if len(rows) != 2 {
		t.Fatalf("expected 2 transcript rows, got %d", len(rows))
	}
	if rows[0].Kind != "tool" {
		t.Fatalf("expected first row kind tool, got %q", rows[0].Kind)
	}
	if len(rows[0].Labels) != 2 {
		t.Fatalf("expected grouped tool labels, got %v", rows[0].Labels)
	}
	if rows[1].Role != "assistant" || rows[1].Content != "done" {
		t.Fatalf("expected assistant row after tool group, got %+v", rows[1])
	}
}

func TestWorkspaceShellSortedMessagesOrdersUserBeforeAssistantAtSameTimestamp(t *testing.T) {
	ts := "2026-03-27T12:34:56Z"
	sorted := workspaceShellSortedMessages([]api.Message{
		{Role: "assistant", Content: "reply", Timestamp: ts},
		{Role: "user", Content: "question", Timestamp: ts},
		{Role: "system", Type: "tool_use", ToolName: "pwd", Timestamp: ts},
	})

	if len(sorted) != 3 {
		t.Fatalf("expected 3 messages, got %d", len(sorted))
	}
	if sorted[0].Role != "user" {
		t.Fatalf("expected user first, got %+v", sorted[0])
	}
	if sorted[1].Type != "tool_use" {
		t.Fatalf("expected tool event second, got %+v", sorted[1])
	}
	if sorted[2].Role != "assistant" {
		t.Fatalf("expected assistant last, got %+v", sorted[2])
	}
}

func TestWorkspaceShellReconcilePendingUserLinesDropsDeliveredMessage(t *testing.T) {
	model := NewWorkspaceShellModel()
	model.PendingUserMessages = []workspaceShellPendingUserMessage{
		{Content: "is this working", Timestamp: time.Now().UTC().Format(time.RFC3339)},
	}

	model.reconcilePendingUserLines([]api.Message{
		{Role: "user", Content: "is this working?", Timestamp: "2026-03-27T12:34:56Z"},
	})

	if len(model.PendingUserMessages) != 0 {
		t.Fatalf("expected delivered pending user line to be cleared, got %+v", model.PendingUserMessages)
	}
}
