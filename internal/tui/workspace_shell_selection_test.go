package tui

import "testing"

func TestWorkspaceShellSelectionClampAndReset(t *testing.T) {
	sel := workspaceShellSelection{
		ProjectTab:   9,
		ExplorerItem: 7,
		CanvasWidget: -3,
		Agent:        4,
		FileTab:      "README.md",
	}

	sel.ClampProjectTab(2)
	sel.ClampExplorer(0)
	sel.ClampCanvasWidget(3)
	sel.ClampAgent(1)

	if sel.ProjectTab != 1 {
		t.Fatalf("expected project tab clamp to 1, got %d", sel.ProjectTab)
	}
	if sel.ExplorerItem != 0 {
		t.Fatalf("expected explorer clamp to 0, got %d", sel.ExplorerItem)
	}
	if sel.CanvasWidget != 0 {
		t.Fatalf("expected canvas widget clamp to 0, got %d", sel.CanvasWidget)
	}
	if sel.Agent != 0 {
		t.Fatalf("expected agent clamp to 0, got %d", sel.Agent)
	}

	sel.ResetProjectContext()

	if sel.ExplorerItem != 0 || sel.CanvasWidget != 0 || sel.Agent != 0 || sel.FileTab != "" {
		t.Fatalf("expected project context reset to clear subordinate selections, got %+v", sel)
	}
}
