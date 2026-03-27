package tui

import (
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/scoady/codexctl/internal/api"
)

func (a *App) handleDataUpdateMessage(msg tea.Msg) (tea.Model, tea.Cmd, bool) {
	switch msg := msg.(type) {
	case TickMsg:
		cmds := []tea.Cmd{a.fetchData(), a.tickCmd()}
		if a.screen == ScreenWorkspace {
			cmds = append(cmds, FetchHostMetricsCmd(a.hostMetrics))
		}
		return a, tea.Batch(cmds...), true

	case DataMsg:
		var cmds []tea.Cmd
		a.health = msg.Health
		if msg.Stats != nil {
			a.stats = msg.Stats
		}
		if msg.Projects != nil {
			a.dashboard.Projects = msg.Projects
			a.dashboard.Stats = a.stats
			a.dashboard.ClampSelection()
			a.workspace.Projects = msg.Projects
			a.workspace.Sync()
		}
		if msg.Agents != nil {
			a.dashboard.Agents = msg.Agents
			a.agents.Agents = msg.Agents
			a.workspace.Agents = msg.Agents
			a.workspace.Sync()

			if a.screen == ScreenProject && a.projectName != "" {
				var pa []api.Agent
				for _, ag := range msg.Agents {
					if ag.ProjectName == a.projectName {
						pa = append(pa, ag)
					}
				}
				a.project.Agents = pa
			}

			a.agents.ClampSelection()
			a.dashboard.RecordAgentCount()
			if a.history != nil {
				a.history.Update(msg.Agents)
			}
			UpdateMetricsFromAgents(a.metricsStore, msg.Agents, a.history)
			if a.screen == ScreenTargets {
				a.targets.UpdateAgents(msg.Agents)
			}
		}
		if a.screen == ScreenProject {
			if msg.Tasks != nil {
				a.project.Tasks = msg.Tasks
			}
			if msg.Widgets != nil {
				a.project.Widgets = msg.Widgets
			}
		}
		if a.screen == ScreenWorkspace {
			if a.workspace.LoadedProject == "" {
				cmds = append(cmds, a.workspaceLoadDirCmd())
			}
			if !a.workspace.SessionTurnBusy {
				cmds = append(cmds, a.workspaceLoadTerminalCmd())
			}
		}
		return a, tea.Batch(cmds...), true

	case HostMetricsMsg:
		if msg.Err == nil {
			a.hostMetrics = msg.Metrics
			if msg.Metrics.Ready && a.metricsStore != nil {
				a.metricsStore.Record("host.cpu", msg.Metrics.CPUPercent)
				a.metricsStore.Record("host.mem", msg.Metrics.MemoryPercent)
				a.metricsStore.Record("host.disk", msg.Metrics.DiskPercent)
				a.metricsStore.Record("host.net", msg.Metrics.NetKBps)
			}
		}
		return a, nil, true

	case CanvasActionResultMsg:
		if msg.Err != nil {
			a.statusMsg = "Canvas error: " + msg.Err.Error()
		} else {
			a.statusMsg = msg.Message
		}
		a.statusTime = time.Now()
		if a.screen == ScreenCanvas {
			return a, FetchCanvasDataCmd(a.client, a.canvas.ProjectName), true
		}
		return a, nil, true

	case KillResultMsg:
		if msg.Err != nil {
			a.statusMsg = "Kill failed: " + msg.Err.Error()
		} else {
			a.statusMsg = "Killed agent " + truncate(msg.SessionID, 16)
		}
		a.statusTime = time.Now()
		return a, a.fetchData(), true

	case DeleteProjectResultMsg:
		if msg.Err != nil {
			a.statusMsg = "Delete failed: " + msg.Err.Error()
		} else {
			a.statusMsg = "Deleted project " + msg.ProjectName
		}
		a.statusTime = time.Now()
		return a, a.fetchData(), true
	}
	return a, nil, false
}
