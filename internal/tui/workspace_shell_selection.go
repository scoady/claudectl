package tui

type workspaceShellSelection struct {
	ProjectTab   int
	ExplorerItem int
	CanvasWidget int
	Agent        int
	FileTab      string
}

func (s *workspaceShellSelection) ResetProjectContext() {
	s.ExplorerItem = 0
	s.CanvasWidget = 0
	s.Agent = 0
	s.FileTab = ""
}

func (s *workspaceShellSelection) ClampProjectTab(count int) {
	s.ProjectTab = clampSelectionIndex(s.ProjectTab, count)
}

func (s *workspaceShellSelection) ClampExplorer(count int) {
	s.ExplorerItem = clampSelectionIndex(s.ExplorerItem, count)
}

func (s *workspaceShellSelection) ClampCanvasWidget(count int) {
	s.CanvasWidget = clampSelectionIndex(s.CanvasWidget, count)
}

func (s *workspaceShellSelection) ClampAgent(count int) {
	s.Agent = clampSelectionIndex(s.Agent, count)
}

func clampSelectionIndex(current, count int) int {
	if count <= 0 {
		return 0
	}
	if current < 0 {
		return 0
	}
	if current >= count {
		return count - 1
	}
	return current
}
