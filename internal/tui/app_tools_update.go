package tui

import (
	"fmt"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/scoady/codexctl/internal/tools"
)

func (a *App) handleToolsUpdateMessage(msg tea.Msg) (tea.Model, tea.Cmd, bool) {
	switch msg := msg.(type) {
	case ToolsDataMsg:
		a.tools.ApplyData(msg)
		if msg.Err != nil {
			a.statusMsg = "Tools refresh failed: " + msg.Err.Error()
			a.statusTime = time.Now()
		} else {
			a.statusMsg = fmt.Sprintf("Loaded %d tool(s)", len(msg.Entries))
			a.tools.Message = a.statusMsg
			a.tools.Error = ""
			a.statusTime = time.Now()
		}
		return a, nil, true

	case ToolCatalogRefreshMsg:
		a.tools.ApplyCatalog(msg)
		if a.screen == ScreenTools {
			if msg.Err != nil {
				a.statusMsg = "Tool catalog refresh failed: " + msg.Err.Error()
			} else {
				a.statusMsg = fmt.Sprintf("Loaded %d catalog tool(s)", len(msg.Entries))
				a.tools.Message = a.statusMsg
			}
			a.statusTime = time.Now()
		}
		return a, nil, true

	case ToolInstallCompleteMsg:
		if a.toolInstall.Active() {
			var cmd tea.Cmd
			a.toolInstall, cmd = a.toolInstall.Update(msg)
			if msg.Err != nil {
				a.statusMsg = "Tool install failed: " + msg.Err.Error()
				a.tools.Error = msg.Err.Error()
			} else if msg.Record != nil {
				a.statusMsg = "Installed " + msg.Record.Name
				a.tools.Message = "Installed " + msg.Record.Name
				a.tools.Error = ""
			}
			a.statusTime = time.Now()
			return a, tea.Batch(cmd, RefreshToolsCmd(), RefreshToolCatalogCmd()), true
		}
		if msg.Err != nil {
			a.statusMsg = "Tool install failed: " + msg.Err.Error()
			a.tools.Error = msg.Err.Error()
		} else if msg.Record != nil {
			a.statusMsg = "Installed " + msg.Record.Name
			a.tools.Message = "Installed " + msg.Record.Name
			a.tools.Error = ""
		}
		a.statusTime = time.Now()
		return a, tea.Batch(RefreshToolsCmd(), RefreshToolCatalogCmd()), true

	case ToolSyncCompleteMsg:
		if msg.Err != nil {
			a.statusMsg = "Tool sync failed: " + msg.Err.Error()
			a.tools.Error = msg.Err.Error()
		} else if msg.Record != nil {
			a.statusMsg = "Synced " + msg.Record.Name
			a.tools.Message = "Synced " + msg.Record.Name
			a.tools.Error = ""
		}
		a.statusTime = time.Now()
		return a, tea.Batch(RefreshToolsCmd(), RefreshToolCatalogCmd()), true

	case ToolDoctorCompleteMsg:
		if msg.Err != nil {
			a.statusMsg = "Tool doctor failed: " + msg.Err.Error()
			a.tools.Error = msg.Err.Error()
		} else if msg.Result != nil {
			if msg.Result.Healthy {
				a.statusMsg = msg.ToolName + " is healthy"
				a.tools.Message = msg.ToolName + " is healthy"
			} else {
				a.statusMsg = msg.ToolName + " needs attention"
				a.tools.Message = msg.ToolName + " needs attention"
			}
			a.tools.Error = ""
		}
		a.statusTime = time.Now()
		return a, tea.Batch(RefreshToolsCmd(), RefreshToolCatalogCmd()), true

	case ToolConfigureCompleteMsg:
		if a.toolConfigure.Active() {
			var cmd tea.Cmd
			a.toolConfigure, cmd = a.toolConfigure.Update(msg)
			if msg.Err != nil {
				a.statusMsg = "Tool configure failed: " + msg.Err.Error()
				a.tools.Error = msg.Err.Error()
			} else {
				a.statusMsg = "Configured " + msg.ToolName
				a.tools.Message = "Configured " + msg.ToolName
				a.tools.Error = ""
			}
			a.statusTime = time.Now()
			return a, tea.Batch(cmd, RefreshToolsCmd(), RefreshToolCatalogCmd()), true
		}
		if msg.Err != nil {
			a.statusMsg = "Tool configure failed: " + msg.Err.Error()
			a.tools.Error = msg.Err.Error()
		} else {
			a.statusMsg = "Configured " + msg.ToolName
			a.tools.Message = "Configured " + msg.ToolName
			a.tools.Error = ""
		}
		a.statusTime = time.Now()
		return a, tea.Batch(RefreshToolsCmd(), RefreshToolCatalogCmd()), true

	case CanvasDataMsg:
		if msg.Err == nil {
			a.canvas.Widgets = msg.Widgets
			a.canvas.Templates = msg.Templates
			a.canvas.Catalog = msg.Catalog
			a.canvas.Contract = msg.Contract
			a.canvas.ClampSelection()
		}
		return a, nil, true

	case ShowToolInstallMsg:
		a.toolInstall = NewToolInstallModel(msg.Source)
		return a, a.toolInstall.Init(), true

	case ShowToolConfigureMsg:
		if inspection, err := tools.InspectInstalledTool(msg.ToolName); err == nil {
			a.toolConfigure = NewToolConfigureModel(msg.ToolName, inspection.Manifest, inspection.ConfigValues)
			return a, a.toolConfigure.Init(), true
		}
		a.statusMsg = "Tool configure failed: unable to load manifest for " + msg.ToolName
		a.statusTime = time.Now()
		return a, nil, true
	}
	return a, nil, false
}
