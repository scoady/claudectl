package tui

import (
	"strings"
	"testing"
	"time"

	"github.com/scoady/codexctl/internal/api"
)

func TestWorkspaceTopStripRendersSingleLine(t *testing.T) {
	store := NewMetricsStore()
	out := renderWorkspaceTopStrip(&WorkspaceShellModel{}, nil, nil, store, workspaceHostMetrics{}, 120)
	if lineCount(out) != 1 {
		t.Fatalf("expected top strip to render exactly 1 line, got %d:\n%s", lineCount(out), out)
	}
}

func TestWorkspaceTopStripRendersSingleLineWithMetricsData(t *testing.T) {
	store := NewMetricsStore()
	for _, name := range []string{"host.cpu", "host.mem", "host.disk", "host.net", "agents.active"} {
		for i := 0; i < 8; i++ {
			store.Record(name, float64((i+1)*7))
		}
	}
	stats := &api.StatsResponse{WorkingAgents: 2, IdleAgents: 3}
	health := &api.HealthResponse{WSConnections: 1}
	out := renderWorkspaceTopStrip(&WorkspaceShellModel{}, stats, health, store, workspaceHostMetrics{CPUPercent: 17, MemoryPercent: 48, DiskPercent: 52, NetKBps: 128}, 120)
	if lineCount(out) != 1 {
		t.Fatalf("expected populated top strip to render exactly 1 line, got %d:\n%s", lineCount(out), out)
	}
}

func TestWorkspaceBottomStripRendersSingleLine(t *testing.T) {
	m := NewWorkspaceShellModel()
	out := renderWorkspaceBottomStrip(&m, 120)
	if lineCount(out) != 1 {
		t.Fatalf("expected bottom strip to render exactly 1 line, got %d:\n%s", lineCount(out), out)
	}
}

func TestWorkspaceProjectTabStripRendersSingleLine(t *testing.T) {
	m := NewWorkspaceShellModel()
	m.OpenProjectTabs = []string{"test", "test2"}
	m.CurrentProject = "test"
	out := workspaceShellRenderTabLine(&m, 80, MousePoint{})
	if lineCount(out) != 1 {
		t.Fatalf("expected project tabs to render exactly 1 line, got %d:\n%s", lineCount(out), out)
	}
}

func TestWorkspaceFileTabStripRendersSingleLine(t *testing.T) {
	m := NewWorkspaceShellModel()
	m.OpenFileTabs = []string{"README.md", "hello.py"}
	m.ActiveFileTab = "hello.py"
	out := workspaceShellRenderFileTabLine(&m, 80, MousePoint{})
	if lineCount(out) != 1 {
		t.Fatalf("expected file tabs to render exactly 1 line, got %d:\n%s", lineCount(out), out)
	}
}

func TestWorkspaceDrawerLayoutSplitsMainPane(t *testing.T) {
	layout := computeWorkspaceShellLayout(120, 32, true, workspaceDockChat)
	if layout.Drawer.H == 0 || layout.Chat.H == 0 {
		t.Fatalf("expected chat and drawer rects to be populated: %#v", layout)
	}
	if layout.Chat.Y+layout.Chat.H >= layout.Drawer.Y {
		t.Fatalf("expected drawer to be below chat with spacing: %#v", layout)
	}
}

func TestRenderWorkspaceShellMatchesRequestedHeight(t *testing.T) {
	m := NewWorkspaceShellModel()
	m.OpenProjectTabs = []string{"test"}
	m.CurrentProject = "test"
	m.DockMode = workspaceDockFiles
	m.rebuildSidebarList()

	const (
		width  = 120
		height = 36
	)

	out := RenderWorkspaceShell(&m, nil, nil, NewMetricsStore(), workspaceHostMetrics{}, MousePoint{}, width, height)
	if got := lineCount(out); got != height {
		t.Fatalf("expected workspace shell to render %d lines, got %d", height, got)
	}
}

func TestRenderWorkspaceShellChatDrawerMatchesRequestedHeight(t *testing.T) {
	m := NewWorkspaceShellModel()
	m.OpenProjectTabs = []string{"test"}
	m.CurrentProject = "test"
	m.DockMode = workspaceDockChat
	m.SystemDrawerOpen = true
	m.TerminalMessages = []api.Message{{Timestamp: time.Now().UTC().Format(time.RFC3339), Role: "assistant", Content: "hello"}}
	m.LocalSystemMessages = []workspaceShellPendingUserMessage{{Timestamp: time.Now().UTC().Format(time.RFC3339), Content: "$ ls\nREADME.md"}}
	m.rebuildSidebarList()

	const (
		width  = 120
		height = 36
	)

	out := RenderWorkspaceShell(&m, nil, nil, NewMetricsStore(), workspaceHostMetrics{CPUPercent: 17}, MousePoint{}, width, height)
	if got := lineCount(out); got != height {
		t.Fatalf("expected workspace shell with drawer to render %d lines, got %d", height, got)
	}
}

func TestWorkspaceChatLayoutUsesFullMainWidth(t *testing.T) {
	layout := computeWorkspaceShellLayout(120, 32, false, workspaceDockChat)
	if layout.Sidebar.W != 0 {
		t.Fatalf("expected chat mode to hide sidebar, got %#v", layout.Sidebar)
	}
	if layout.Main.X != layout.Activity.W+1 {
		t.Fatalf("expected chat main pane to begin after activity rail, got %#v", layout.Main)
	}
}

func lineCount(s string) int {
	if s == "" {
		return 0
	}
	return strings.Count(s, "\n") + 1
}
