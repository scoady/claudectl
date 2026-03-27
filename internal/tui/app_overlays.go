package tui

import tea "github.com/charmbracelet/bubbletea"

func (a *App) updateActiveOverlay(msg tea.KeyMsg) (tea.Model, tea.Cmd, bool) {
	if a.palette.Active() {
		var cmd tea.Cmd
		a.palette, cmd = a.palette.Update(msg)
		return a, cmd, true
	}
	if a.contextMenu.Active() {
		var cmd tea.Cmd
		a.contextMenu, cmd = a.contextMenu.Update(msg)
		return a, cmd, true
	}
	if a.confirm.Active() {
		var cmd tea.Cmd
		a.confirm, cmd = a.confirm.Update(msg)
		return a, cmd, true
	}
	if a.createProject.Active() {
		var cmd tea.Cmd
		a.createProject, cmd = a.createProject.Update(msg)
		return a, cmd, true
	}
	if a.workspaceEntry.Active() {
		var cmd tea.Cmd
		a.workspaceEntry, cmd = a.workspaceEntry.Update(msg)
		return a, cmd, true
	}
	if a.toolInstall.Active() {
		var cmd tea.Cmd
		a.toolInstall, cmd = a.toolInstall.Update(msg)
		return a, cmd, true
	}
	if a.toolConfigure.Active() {
		var cmd tea.Cmd
		a.toolConfigure, cmd = a.toolConfigure.Update(msg)
		return a, cmd, true
	}
	if a.dispatch.Active() {
		var cmd tea.Cmd
		a.dispatch, cmd = a.dispatch.Update(msg)
		return a, cmd, true
	}
	if a.inject.Active() {
		var cmd tea.Cmd
		a.inject, cmd = a.inject.Update(msg)
		return a, cmd, true
	}
	return a, nil, false
}

func (a *App) hasBlockingOverlay() bool {
	return a.palette.Active() ||
		a.contextMenu.Active() ||
		a.confirm.Active() ||
		a.createProject.Active() ||
		a.workspaceEntry.Active() ||
		a.toolInstall.Active() ||
		a.toolConfigure.Active() ||
		a.dispatch.Active() ||
		a.inject.Active()
}

func (a *App) updateActiveOverlayMouse(msg tea.MouseMsg) (tea.Model, tea.Cmd, bool) {
	if a.contextMenu.Active() {
		var cmd tea.Cmd
		a.contextMenu, cmd = a.contextMenu.Update(msg)
		return a, cmd, true
	}
	return a, nil, false
}
