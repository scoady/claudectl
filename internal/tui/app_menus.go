package tui

import (
	"fmt"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/scoady/codexctl/internal/api"
)

func (a *App) showProjectMenu() (tea.Model, tea.Cmd) {
	switch a.project.Panel {
	case 0:
		if a.project.Selected >= 0 && a.project.Selected < len(a.project.Agents) {
			ag := a.project.Agents[a.project.Selected]
			sid := ag.SessionID
			return a, func() tea.Msg {
				return ShowContextMenuMsg{
					Title: "Agent " + truncate(sid, 16),
					Items: []MenuItem{
						{Label: "Watch Logs", Key: "l", Icon: "◉", Action: func() tea.Msg {
							return NavigateMsg{Screen: ScreenWatch, Agent: &ag}
						}},
						{Label: "Inject Message", Key: "i", Icon: "▹", Action: func() tea.Msg {
							return ShowInjectMsg{SessionID: sid}
						}},
						{Label: "Kill Agent", Key: "K", Icon: "✗",
							Style: lipgloss.NewStyle().Foreground(Rose),
							Action: func() tea.Msg {
								return ShowConfirmMsg{
									Title:       "Kill Agent",
									Description: "Kill agent " + truncate(sid, 20) + "?",
									Destructive: true,
									OnConfirm: func() tea.Msg {
										err := a.client.KillAgent(sid)
										return KillResultMsg{SessionID: sid, Err: err}
									},
								}
							}},
					},
				}
			}
		}
	case 1:
		if a.project.Selected >= 0 && a.project.Selected < len(a.project.Tasks) {
			task := a.project.Tasks[a.project.Selected]
			idx := a.project.Selected
			projectName := a.projectName
			isDone := strings.EqualFold(task.Status, "done") || strings.EqualFold(task.Status, "complete") || strings.EqualFold(task.Status, "completed")
			isRunning := strings.EqualFold(task.Status, "in_progress") || strings.EqualFold(task.Status, "in-progress") || strings.EqualFold(task.Status, "running")
			return a, func() tea.Msg {
				return ShowContextMenuMsg{
					Title: "Task #" + fmt.Sprintf("%d", idx),
					Items: []MenuItem{
						{Label: "Start Task", Key: "s", Icon: "▶",
							Disabled: isRunning || isDone,
							Action: func() tea.Msg {
								_ = a.client.StartTask(projectName, idx)
								return TickMsg{}
							}},
						{Label: "Complete Task", Key: "c", Icon: "✓",
							Disabled: isDone,
							Action: func() tea.Msg {
								_ = a.client.CompleteTask(projectName, idx, "")
								return TickMsg{}
							}},
						{Label: "Delete Task", Key: "x", Icon: "✗",
							Style: lipgloss.NewStyle().Foreground(Rose),
							Action: func() tea.Msg {
								_ = a.client.DeleteTask(projectName, idx)
								return TickMsg{}
							}},
					},
				}
			}
		}
	case 2:
		if a.project.Selected >= 0 && a.project.Selected < len(a.project.Widgets) {
			widget := a.project.Widgets[a.project.Selected]
			widgetID := widget.ID
			projectName := a.projectName
			return a, func() tea.Msg {
				return ShowContextMenuMsg{
					Title: widget.Title,
					Items: []MenuItem{
						{Label: "Delete Widget", Key: "x", Icon: "✗",
							Style: lipgloss.NewStyle().Foreground(Rose),
							Action: func() tea.Msg {
								_ = a.client.DeleteWidget(projectName, widgetID)
								return TickMsg{}
							}},
					},
				}
			}
		}
	}
	return a, nil
}

func (a *App) showAgentsMenu() (tea.Model, tea.Cmd) {
	ag := a.agents.SelectedAgent()
	if ag == nil {
		return a, nil
	}
	sid := ag.SessionID
	projectName := ag.ProjectName
	return a, func() tea.Msg {
		return ShowContextMenuMsg{
			Title: "Agent " + truncate(sid, 16),
			Items: []MenuItem{
				{Label: "Watch Logs", Key: "l", Icon: "◉", Action: func() tea.Msg {
					return NavigateMsg{Screen: ScreenWatch, Agent: ag}
				}},
				{Label: "Inject Message", Key: "i", Icon: "▹", Action: func() tea.Msg {
					return ShowInjectMsg{SessionID: sid}
				}},
				{Label: "Open Project", Key: "p", Icon: "▸", Action: func() tea.Msg {
					return NavigateMsg{Screen: ScreenProject, Project: &api.Project{Name: projectName}}
				}},
				{Label: "Kill Agent", Key: "K", Icon: "✗",
					Style: lipgloss.NewStyle().Foreground(Rose),
					Action: func() tea.Msg {
						return ShowConfirmMsg{
							Title:       "Kill Agent",
							Description: "Kill agent " + truncate(sid, 20) + "?",
							Destructive: true,
							OnConfirm: func() tea.Msg {
								err := a.client.KillAgent(sid)
								return KillResultMsg{SessionID: sid, Err: err}
							},
						}
					}},
			},
		}
	}
}

func (a *App) showCanvasMenu() (tea.Model, tea.Cmd) {
	projectName := a.canvas.ProjectName
	switch a.canvas.Panel {
	case 0:
		w := a.canvas.SelectedWidget()
		if w == nil {
			return a, nil
		}
		widget := *w
		widgetID := widget.ID
		return a, func() tea.Msg {
			return ShowContextMenuMsg{
				Title: widget.Title,
				Items: []MenuItem{
					{Label: "View Details", Key: "d", Icon: "◉", Action: func() tea.Msg {
						return NavigateMsg{Screen: ScreenWidgetDetail}
					}},
					{Label: "Delete Widget", Key: "x", Icon: "✗",
						Style: lipgloss.NewStyle().Foreground(Rose),
						Action: func() tea.Msg {
							return ShowConfirmMsg{
								Title:       "Delete Widget",
								Description: "Delete widget \"" + widget.Title + "\"?",
								Destructive: true,
								OnConfirm: func() tea.Msg {
									err := a.client.DeleteWidget(projectName, widgetID)
									if err != nil {
										return CanvasActionResultMsg{Err: err}
									}
									return CanvasActionResultMsg{Message: "Widget deleted: " + widgetID}
								},
							}
						}},
				},
			}
		}
	case 1:
		t := a.canvas.SelectedTemplate()
		if t == nil {
			return a, nil
		}
		tmpl := *t
		return a, func() tea.Msg {
			return ShowContextMenuMsg{
				Title: tmpl.Title,
				Items: []MenuItem{
					{Label: "Deploy to Canvas", Key: "d", Icon: "▸", Action: func() tea.Msg {
						body := map[string]interface{}{
							"template_id": tmpl.Filename,
						}
						_, err := a.client.CreateWidget(projectName, body)
						if err != nil {
							return CanvasActionResultMsg{Err: err}
						}
						return CanvasActionResultMsg{Message: "Template deployed: " + tmpl.Filename}
					}},
				},
			}
		}
	case 2:
		ct := a.canvas.SelectedCatalogItem()
		if ct == nil {
			return a, nil
		}
		catItem := *ct
		return a, func() tea.Msg {
			return ShowContextMenuMsg{
				Title: catItem.Title,
				Items: []MenuItem{
					{Label: "View Details", Key: "d", Icon: "◉", Action: func() tea.Msg {
						return NavigateMsg{Screen: ScreenTemplateBrowse}
					}},
					{Label: "Deploy to Canvas", Key: "p", Icon: "▸", Action: func() tea.Msg {
						body := map[string]interface{}{
							"template_id": catItem.TemplateID,
						}
						_, err := a.client.CreateWidget(projectName, body)
						if err != nil {
							return CanvasActionResultMsg{Err: err}
						}
						return CanvasActionResultMsg{Message: "Catalog template deployed: " + catItem.TemplateID}
					}},
					{Label: "Delete from Catalog", Key: "x", Icon: "✗",
						Style: lipgloss.NewStyle().Foreground(Rose),
						Action: func() tea.Msg {
							return ShowConfirmMsg{
								Title:       "Delete Catalog Template",
								Description: "Delete \"" + catItem.Title + "\" from catalog?",
								Destructive: true,
								OnConfirm: func() tea.Msg {
									err := a.client.DeleteCatalogTemplate(catItem.TemplateID)
									if err != nil {
										return CanvasActionResultMsg{Err: err}
									}
									return CanvasActionResultMsg{Message: "Catalog template deleted: " + catItem.TemplateID}
								},
							}
						}},
				},
			}
		}
	case 3:
		return a, nil
	}
	return a, nil
}

func (a *App) showToolsMenu() (tea.Model, tea.Cmd) {
	rec := a.tools.SelectedRecord()
	catalog := a.tools.CurrentCatalog()
	canOperate := rec != nil
	items := []MenuItem{
		{
			Label: "Import Tool From Repo",
			Key:   "i",
			Icon:  "⇪",
			Action: func() tea.Msg {
				source := defaultToolSource
				if catalog != nil {
					source = toolCatalogSource(*catalog)
				}
				return ShowToolInstallMsg{Source: source}
			},
		},
		{
			Label:    "Configure plugin",
			Key:      "c",
			Icon:     "⚙",
			Disabled: !canOperate,
			Action: func() tea.Msg {
				if rec == nil {
					return nil
				}
				return executeCommandMsg{Command: "tools.configure"}
			},
		},
		{
			Label:    "Sync exported skills",
			Key:      "s",
			Icon:     "↺",
			Disabled: !canOperate,
			Action: func() tea.Msg {
				return executeCommandMsg{Command: "tools.sync"}
			},
		},
		{
			Label: "Run tool doctor",
			Key:   "d",
			Icon:  "◈",
			Action: func() tea.Msg {
				return executeCommandMsg{Command: "tools.doctor"}
			},
		},
		{
			Label: "Refresh catalog",
			Key:   "r",
			Icon:  "↻",
			Action: func() tea.Msg {
				return TickMsg{}
			},
		},
	}
	return a.showAppMenu("Tool Dock", items)
}
