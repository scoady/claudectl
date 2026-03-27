package tui

func workspaceShellFileTabActionAt(m *WorkspaceShellModel, ly workspaceShellLayout, x int) (workspaceTabAction, bool) {
	innerW := max(12, ly.Main.W-4)
	_, hits := workspaceShellRenderFileTabLine(m, innerW)
	relX := x - (ly.Main.X + 2)
	for _, hit := range hits {
		if relX < hit.StartX || relX >= hit.EndX {
			continue
		}
		if relX >= hit.CloseStart && relX < hit.CloseEnd {
			return workspaceTabAction{kind: "close", name: hit.Path}, true
		}
		return workspaceTabAction{kind: "activate", name: hit.Path}, true
	}
	return workspaceTabAction{}, false
}

func workspaceShellCanvasTabActionAt(m *WorkspaceShellModel, ly workspaceShellLayout, x int) (string, bool) {
	innerW := max(12, ly.Main.W-4)
	_, hits := workspaceShellRenderCanvasTabLine(m, innerW)
	relX := x - (ly.Main.X + 2)
	for _, hit := range hits {
		if relX >= hit.StartX && relX < hit.EndX {
			return hit.Name, true
		}
	}
	return "", false
}

func workspaceSegmentIndex(x int, rect workspaceRect, count int) int {
	if count <= 0 || rect.W <= 0 {
		return -1
	}
	cellW := rect.W / count
	if cellW <= 0 {
		cellW = 1
	}
	idx := (x - rect.X) / cellW
	if idx < 0 {
		return -1
	}
	if idx >= count {
		idx = count - 1
	}
	return idx
}

func workspaceVerticalSegmentIndex(y int, rect workspaceRect, count int) int {
	if count <= 0 || rect.H <= 0 {
		return -1
	}
	cellH := rect.H / count
	if cellH <= 0 {
		cellH = 1
	}
	idx := (y - rect.Y) / cellH
	if idx < 0 {
		return -1
	}
	if idx >= count {
		idx = count - 1
	}
	return idx
}

func workspaceShellDockIndexAt(y int, rect workspaceShellRect) int {
	contentLine := y - rect.Y - 1
	for idx, slot := range workspaceShellDockSlots(max(6, rect.H-2)) {
		if contentLine >= slot.StartLine-1 && contentLine <= slot.EndLine+1 {
			return idx
		}
	}
	return -1
}
