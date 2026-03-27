package tui

func computeWorkspaceShellLayout(width, height int, drawerOpen bool, dockMode string) workspaceShellLayout {
	activityW := Clamp(6, Pct(width, 6), 8)
	sidebarW := Clamp(28, Pct(width, 30), 40)
	stacked := width < 100 || height < 22
	showSidebar := workspaceDockShowsSidebar(dockMode)

	layout := workspaceShellLayout{
		Activity: workspaceShellRect{X: 0, Y: 0, W: activityW, H: height},
		Stacked:  stacked,
	}

	if stacked {
		bodyW := max(24, width-activityW-1)
		if showSidebar {
			sidebarH := Clamp(9, Pct(height, 35), 14)
			layout.Sidebar = workspaceShellRect{X: activityW + 1, Y: 0, W: bodyW, H: sidebarH}
			layout.Main = workspaceShellRect{X: activityW + 1, Y: sidebarH + 1, W: bodyW, H: max(10, height-sidebarH-1)}
		} else {
			layout.Main = workspaceShellRect{X: activityW + 1, Y: 0, W: bodyW, H: height}
		}
	} else {
		if showSidebar {
			mainW := max(40, width-activityW-sidebarW-2)
			layout.Sidebar = workspaceShellRect{X: activityW + 1, Y: 0, W: sidebarW, H: height}
			layout.Main = workspaceShellRect{X: activityW + sidebarW + 2, Y: 0, W: mainW, H: height}
		} else {
			mainW := max(40, width-activityW-1)
			layout.Main = workspaceShellRect{X: activityW + 1, Y: 0, W: mainW, H: height}
		}
	}

	layout.Chat = layout.Main
	if drawerOpen && !stacked {
		gap := 1
		chatH := max(10, (layout.Main.H-gap)/2)
		drawerH := max(8, layout.Main.H-chatH-gap)
		layout.Chat = workspaceShellRect{X: layout.Main.X, Y: layout.Main.Y, W: layout.Main.W, H: chatH}
		layout.Drawer = workspaceShellRect{X: layout.Main.X, Y: layout.Main.Y + chatH + gap, W: layout.Main.W, H: drawerH}
	}

	base := layout.Main
	if drawerOpen && layout.Drawer.W > 0 {
		base = layout.Chat
	}
	layout.Transcript = workspaceShellRect{
		X: base.X + 1,
		Y: base.Y + 3,
		W: max(12, base.W-2),
		H: max(4, base.H-8),
	}
	layout.Composer = workspaceShellRect{
		X: base.X + 1,
		Y: base.Y + base.H - 3,
		W: max(12, base.W-2),
		H: 2,
	}
	if drawerOpen && layout.Drawer.W > 0 {
		layout.SysComposer = workspaceShellRect{
			X: layout.Drawer.X + 1,
			Y: layout.Drawer.Y + layout.Drawer.H - 3,
			W: max(12, layout.Drawer.W-2),
			H: 2,
		}
	}
	layout.Picker = workspaceShellRect{
		X: base.X + 2,
		Y: base.Y + 6,
		W: max(26, min(base.W-6, 56)),
		H: max(8, min(base.H-8, 14)),
	}
	return layout
}

func computeWorkspaceShellAppLayout(width, height int, drawerOpen bool, dockMode string) workspaceShellLayout {
	bodyHeight := max(6, height-4)
	layout := computeWorkspaceShellLayout(width, bodyHeight, drawerOpen, dockMode)
	layout.Activity.Y++
	if layout.Sidebar.W > 0 {
		layout.Sidebar.Y++
	}
	layout.Main.Y++
	layout.Chat.Y++
	if layout.Drawer.W > 0 {
		layout.Drawer.Y++
	}
	layout.Transcript.Y++
	layout.Composer.Y++
	if layout.SysComposer.W > 0 {
		layout.SysComposer.Y++
	}
	layout.Picker.Y++
	return layout
}

func workspaceDockShowsSidebar(mode string) bool {
	return mode != workspaceDockChat
}

func workspaceShellDockSlots(contentH int) []workspaceShellDockSlot {
	items := workspaceDockItems()
	if contentH <= 2 || len(items) == 0 {
		return nil
	}
	rows := contentH - 1
	tileRows := len(items)
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
		slots = append(slots, workspaceShellDockSlot{
			Mode:      item.Mode,
			IconLine:  start,
			LabelLine: -1,
			StartLine: start,
			EndLine:   start,
		})
		cur = start + 1 + nextGap()
	}
	return slots
}
