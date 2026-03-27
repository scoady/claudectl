package tui

import (
	"fmt"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/scoady/codexctl/internal/api"
)

func (a *App) showAppMenu(title string, primary []MenuItem) (tea.Model, tea.Cmd) {
	return a, a.showAppMenuCmd(title, primary)
}

func (a *App) showAppMenuCmd(title string, primary []MenuItem) tea.Cmd {
	items := a.mergeMenuItems(primary, a.navigationMenuItems())
	items = append(items, a.quitMenuItem())
	return func() tea.Msg {
		return ShowContextMenuMsg{
			Title: title,
			Items: items,
		}
	}
}

func (a *App) mergeMenuItems(sections ...[]MenuItem) []MenuItem {
	var items []MenuItem
	seen := map[string]bool{}
	for _, section := range sections {
		for _, item := range section {
			key := strings.ToLower(strings.TrimSpace(item.Label))
			if key != "" && seen[key] {
				continue
			}
			if key != "" {
				seen[key] = true
			}
			items = append(items, item)
		}
	}
	return items
}

func (a *App) menuProjectName() string {
	switch a.screen {
	case ScreenWorkspace:
		if cur := a.workspace.Current(); cur != nil {
			return cur.Name
		}
	case ScreenProject, ScreenCanvas, ScreenWidgetDetail, ScreenTemplateBrowse:
		if strings.TrimSpace(a.projectName) != "" {
			return a.projectName
		}
		if strings.TrimSpace(a.canvas.ProjectName) != "" {
			return a.canvas.ProjectName
		}
	}
	if p := a.dashboard.SelectedProject(); p != nil {
		return p.Name
	}
	return ""
}

func (a *App) navigationMenuItems() []MenuItem {
	projectName := a.menuProjectName()
	return []MenuItem{
		{
			Label:    "Home",
			Key:      "h",
			Icon:     "⌂",
			Disabled: a.screen == ScreenDashboard,
			Action: func() tea.Msg {
				return NavigateMsg{Screen: ScreenDashboard}
			},
		},
		{
			Label:    "Workspace Shell",
			Key:      "W",
			Icon:     "▣",
			Disabled: a.screen == ScreenWorkspace,
			Action: func() tea.Msg {
				if projectName != "" {
					return NavigateMsg{Screen: ScreenWorkspace, Project: &api.Project{Name: projectName}}
				}
				return NavigateMsg{Screen: ScreenWorkspace}
			},
		},
		{
			Label:    "Metrics",
			Key:      "g",
			Icon:     "◈",
			Disabled: a.screen == ScreenMetrics,
			Action: func() tea.Msg {
				return NavigateMsg{Screen: ScreenMetrics}
			},
		},
		{
			Label:    "Tools & Plugins",
			Key:      "u",
			Icon:     "⬢",
			Disabled: a.screen == ScreenTools,
			Action: func() tea.Msg {
				return NavigateMsg{Screen: ScreenTools}
			},
		},
		{
			Label:    "Settings",
			Key:      "s",
			Icon:     "⚙",
			Disabled: a.screen == ScreenSettings,
			Action: func() tea.Msg {
				return NavigateMsg{Screen: ScreenSettings}
			},
		},
	}
}

func (a *App) quitMenuItem() MenuItem {
	return MenuItem{
		Label: "Quit",
		Key:   "q",
		Icon:  "⏻",
		Style: lipgloss.NewStyle().Foreground(Rose),
		Action: func() tea.Msg {
			return tea.Quit()
		},
	}
}

func (a *App) showEscapeMenu() (tea.Model, tea.Cmd) {
	switch a.screen {
	case ScreenDashboard:
		return a.showDashboardMenu()
	case ScreenWorkspace:
		return a, a.workspaceOpenDockCmd()
	case ScreenTools:
		return a.showToolsMenu()
	default:
		return a.showAppMenu(a.escapeMenuTitle(), nil)
	}
}

func (a *App) escapeMenuTitle() string {
	switch a.screen {
	case ScreenDashboard:
		return "Home"
	case ScreenProject:
		if a.projectName != "" {
			return a.projectName
		}
		return "Project"
	case ScreenAgents:
		return "Agents"
	case ScreenMetrics:
		return "Metrics"
	case ScreenWorkspace:
		return "Workspace"
	case ScreenTools:
		return "Tools"
	case ScreenTargets:
		return "Targets"
	case ScreenSettings:
		return "Settings"
	case ScreenTimeline:
		return "Timeline"
	case ScreenCanvas:
		if a.canvas.ProjectName != "" {
			return fmt.Sprintf("Canvas • %s", a.canvas.ProjectName)
		}
		return "Canvas"
	default:
		return "Menu"
	}
}
