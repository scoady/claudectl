package tui

import (
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/scoady/codexctl/internal/api"
)

func (a *App) showDashboardMenu() (tea.Model, tea.Cmd) {
	p := a.dashboard.SelectedProject()
	title := "Home"
	items := []MenuItem{
		{Label: "Create Project", Key: "c", Icon: "+", Action: func() tea.Msg {
			return ShowCreateProjectMsg{}
		}},
	}
	if p != nil {
		projectName := p.Name
		title = projectName
		items = append([]MenuItem{
			{Label: "Open", Key: "o", Icon: "▸", Action: func() tea.Msg {
				return NavigateMsg{Screen: ScreenProject, Project: &api.Project{Name: projectName}}
			}},
			{Label: "Dispatch Task", Key: "d", Icon: "⚡", Action: func() tea.Msg {
				return ShowDispatchMsg{ProjectName: projectName}
			}},
			{Label: "View Agents", Key: "a", Icon: "●", Action: func() tea.Msg {
				return NavigateMsg{Screen: ScreenAgents}
			}},
			{Label: "Delete Project", Key: "x", Icon: "✗",
				Style: lipgloss.NewStyle().Foreground(Rose),
				Action: func() tea.Msg {
					return ShowConfirmMsg{
						Title:       "Delete Project",
						Description: "Delete \"" + projectName + "\"?\nThis cannot be undone.",
						Destructive: true,
						OnConfirm: func() tea.Msg {
							err := a.client.DeleteProject(projectName)
							return DeleteProjectResultMsg{ProjectName: projectName, Err: err}
						},
					}
				}},
		}, items...)
	}
	return a.showAppMenu(title, items)
}
