package tui

import (
	"strings"
	"testing"
	"time"
)

func TestComposeControllerMessageIncludesSystemContext(t *testing.T) {
	w := NewWorkspaceShellModel()
	w.LocalSystemMessages = []workspaceShellPendingUserMessage{
		{Timestamp: time.Now().UTC().Format(time.RFC3339), Content: "$ ls"},
		{Timestamp: time.Now().UTC().Format(time.RFC3339), Content: "README.md\nmain.go"},
	}

	msg := w.ComposeControllerMessage("what just ran?")
	if !strings.Contains(msg, "what just ran?") {
		t.Fatalf("expected original user message to remain in compose payload")
	}
	if !strings.Contains(msg, "[local_os_terminal_context]") {
		t.Fatalf("expected local os terminal context marker in compose payload: %s", msg)
	}
	if !strings.Contains(msg, "\"source\": \"user_system\"") {
		t.Fatalf("expected JSON system events in compose payload: %s", msg)
	}
}

func TestComposeControllerMessageWithoutSystemContextReturnsOriginal(t *testing.T) {
	w := NewWorkspaceShellModel()
	msg := w.ComposeControllerMessage("hello")
	if msg != "hello" {
		t.Fatalf("expected original message without context, got %q", msg)
	}
}
