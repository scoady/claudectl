package tui

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
