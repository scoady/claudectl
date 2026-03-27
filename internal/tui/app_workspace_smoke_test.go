package tui

import (
	"strings"
	"testing"

	"github.com/scoady/codexctl/internal/api"
	tuitest "github.com/scoady/codexctl/internal/tui/testutil"
)

func TestAppWorkspaceViewSmoke(t *testing.T) {
	app := NewApp("http://127.0.0.1:0", AppOptions{})
	app.width = 120
	app.height = 40
	app.layout = NewLayout(app.width, app.height)
	app.screen = ScreenWorkspace

	app.workspace = NewWorkspaceShellModel()
	app.workspace.OpenProjectTabs = []string{"test"}
	app.workspace.CurrentProject = "test"
	app.workspace.CurrentDir = ""
	app.workspace.Entries = []api.FileEntry{
		{Name: "hello.py", Path: "hello.py", Type: "file"},
		{Name: "PROJECT.md", Path: "PROJECT.md", Type: "file"},
	}
	app.workspace.TerminalLines = []string{"ready"}
	app.workspace.rebuildSidebarList()

	frame := tuitest.NormalizeFrame(app.View())
	for _, needle := range []string{"Agent Chat", "OS Terminal", "workspace", "test"} {
		if !strings.Contains(frame, needle) {
			t.Fatalf("expected workspace frame to contain %q\n%s", needle, frame)
		}
	}
}

func TestAppHomeViewSmoke(t *testing.T) {
	app := NewApp("http://127.0.0.1:0", AppOptions{})
	app.width = 120
	app.height = 40
	app.layout = NewLayout(app.width, app.height)
	app.screen = ScreenDashboard

	frame := tuitest.NormalizeFrame(app.View())
	for _, needle := range []string{"Workspaces", "Metrics", "Tools", "New Project"} {
		if !strings.Contains(frame, needle) {
			t.Fatalf("expected home frame to contain %q\n%s", needle, frame)
		}
	}
}
