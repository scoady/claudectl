package tui

func computeWorkspaceShellLayout(width, height int, _ bool) workspaceShellLayout {
	activityW := Clamp(10, Pct(width, 11), 12)
	sidebarW := Clamp(28, Pct(width, 30), 40)
	stacked := width < 100 || height < 22

	layout := workspaceShellLayout{
		Activity: workspaceShellRect{X: 0, Y: 0, W: activityW, H: height},
		Stacked:  stacked,
	}

	if stacked {
		bodyW := max(24, width-activityW-1)
		sidebarH := Clamp(9, Pct(height, 35), 14)
		layout.Sidebar = workspaceShellRect{X: activityW + 1, Y: 0, W: bodyW, H: sidebarH}
		layout.Main = workspaceShellRect{X: activityW + 1, Y: sidebarH + 1, W: bodyW, H: max(10, height-sidebarH-1)}
	} else {
		mainW := max(40, width-activityW-sidebarW-2)
		layout.Sidebar = workspaceShellRect{X: activityW + 1, Y: 0, W: sidebarW, H: height}
		layout.Main = workspaceShellRect{X: activityW + sidebarW + 2, Y: 0, W: mainW, H: height}
	}

	layout.Transcript = workspaceShellRect{
		X: layout.Main.X + 1,
		Y: layout.Main.Y + 3,
		W: max(12, layout.Main.W-2),
		H: max(4, layout.Main.H-8),
	}
	layout.Composer = workspaceShellRect{
		X: layout.Main.X + 1,
		Y: layout.Main.Y + layout.Main.H - 3,
		W: max(12, layout.Main.W-2),
		H: 2,
	}
	layout.Picker = workspaceShellRect{
		X: layout.Main.X + 2,
		Y: layout.Main.Y + 6,
		W: max(18, min(layout.Main.W-4, 44)),
		H: max(5, min(layout.Main.H-10, 10)),
	}
	return layout
}

func computeWorkspaceShellAppLayout(width, height int, previewReady bool) workspaceShellLayout {
	bodyHeight := max(6, height-3)
	layout := computeWorkspaceShellLayout(width, bodyHeight, previewReady)
	layout.Activity.Y++
	layout.Sidebar.Y++
	layout.Main.Y++
	layout.Transcript.Y++
	layout.Composer.Y++
	layout.Picker.Y++
	return layout
}

func workspaceShellDockSlots(contentH int) []workspaceShellDockSlot {
	items := workspaceDockItems()
	if contentH <= 2 || len(items) == 0 {
		return nil
	}
	rows := contentH - 1
	tileRows := len(items) * 2
	free := rows - tileRows
	if free < 0 {
		free = 0
	}
	gap := 0
	rem := 0
	if len(items)+1 > 0 {
		gap = free / (len(items) + 1)
		rem = free % (len(items) + 1)
	}
	nextGap := func() int {
		extra := gap
		if rem > 0 {
			extra++
			rem--
		}
		return extra
	}
	cur := 1 + nextGap()
	slots := make([]workspaceShellDockSlot, 0, len(items))
	for _, item := range items {
		start := min(contentH-2, cur)
		label := min(contentH-1, start+1)
		slots = append(slots, workspaceShellDockSlot{
			Mode:      item.Mode,
			IconLine:  start,
			LabelLine: label,
			StartLine: start,
			EndLine:   label,
		})
		cur = label + 1 + nextGap()
	}
	return slots
}
