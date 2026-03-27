package main

import (
	"fmt"
	"strings"

	"github.com/scoady/codexctl/internal/api"
	"github.com/scoady/codexctl/internal/ui"
	"github.com/spf13/cobra"
)

func healthCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "health",
		Short: "Check backend health",
		RunE: func(cmd *cobra.Command, args []string) error {
			h, err := client.Health()
			if err != nil {
				fmt.Println(ui.ErrorBox.Render("Backend unreachable: " + err.Error()))
				return nil
			}
			stats, _ := client.Stats()

			fmt.Println(ui.Banner())
			fmt.Println()

			status := ui.SuccessText.Render("● healthy")
			if h.Status != "ok" {
				status = ui.StatusError.Render("● " + h.Status)
			}

			fmt.Println(ui.KeyValue("Status", status))
			fmt.Println(ui.KeyValue("Uptime", ui.FormatUptime(h.Uptime)))
			fmt.Println(ui.KeyValue("Agents", fmt.Sprintf("%d", h.Agents)))
			fmt.Println(ui.KeyValue("WebSocket Clients", fmt.Sprintf("%d", h.WSConnections)))

			if stats != nil {
				fmt.Println()
				fmt.Println(ui.SectionHeader("Stats"))
				fmt.Println(ui.KeyValue("Projects", fmt.Sprintf("%d", stats.TotalProjects)))
				fmt.Println(ui.KeyValue("Total Agents", fmt.Sprintf("%d", stats.TotalAgents)))
				fmt.Println(ui.KeyValue("Working", ui.StatusWorking.Render(fmt.Sprintf("%d", stats.WorkingAgents))))
				fmt.Println(ui.KeyValue("Idle", ui.StatusIdle.Render(fmt.Sprintf("%d", stats.IdleAgents))))
			}
			fmt.Println()
			return nil
		},
	}
}

func statusCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "status",
		Short: "Rich status dashboard — projects, agents, and stats",
		RunE: func(cmd *cobra.Command, args []string) error {
			projects, err := client.GetProjects()
			if err != nil {
				fmt.Println(ui.ErrorBox.Render("Failed to fetch projects: " + err.Error()))
				return nil
			}
			agents, err := client.GetAgents()
			if err != nil {
				fmt.Println(ui.ErrorBox.Render("Failed to fetch agents: " + err.Error()))
				return nil
			}
			stats, _ := client.Stats()

			fmt.Println(ui.Banner())

			// ── Stats summary ──
			if stats != nil {
				statsLine := fmt.Sprintf(
					"%s projects  %s agents (%s working, %s idle)  %s uptime",
					ui.Bold.Render(fmt.Sprintf("%d", stats.TotalProjects)),
					ui.Bold.Render(fmt.Sprintf("%d", stats.TotalAgents)),
					ui.StatusWorking.Render(fmt.Sprintf("%d", stats.WorkingAgents)),
					ui.StatusIdle.Render(fmt.Sprintf("%d", stats.IdleAgents)),
					ui.Dim.Render(ui.FormatUptime(stats.UptimeSeconds)),
				)
				fmt.Println(ui.Dim.Render("  " + statsLine))
			}

			// ── Projects table ──
			fmt.Println(ui.SectionHeader("Projects"))

			// Build agent count map
			agentsByProject := make(map[string][]api.Agent)
			for _, a := range agents {
				agentsByProject[a.ProjectName] = append(agentsByProject[a.ProjectName], a)
			}

			var projRows [][]string
			for _, p := range projects {
				pa := agentsByProject[p.Name]
				agentCount := fmt.Sprintf("%d", len(pa))

				// Count working
				working := 0
				for _, a := range pa {
					if a.Status == "working" || a.Status == "active" {
						working++
					}
				}

				statusStr := ui.StatusIdle.Render("idle")
				if working > 0 {
					statusStr = ui.StatusWorking.Render(fmt.Sprintf("%d working", working))
				}
				if len(pa) == 0 {
					statusStr = ui.Dim.Render("no agents")
				}

				desc := p.Description
				if desc == "" && p.Goal != "" {
					// Use first line of goal
					lines := strings.SplitN(p.Goal, "\n", 2)
					desc = strings.TrimPrefix(strings.TrimSpace(lines[0]), "# ")
				}

				projRows = append(projRows, []string{
					ui.Bold.Render(p.Name),
					agentCount,
					statusStr,
					ui.Truncate(desc, 50),
				})
			}

			if len(projRows) > 0 {
				fmt.Println(ui.RenderTable(
					[]string{"Project", "Agents", "Status", "Description"},
					projRows,
				))
			} else {
				fmt.Println(ui.Dim.Render("  No projects found."))
			}

			// ── Active agents table ──
			fmt.Println(ui.SectionHeader("Active Agents"))

			var agentRows [][]string
			for _, a := range agents {
				milestone := "-"
				if len(a.Milestones) > 0 {
					milestone = ui.Truncate(a.Milestones[len(a.Milestones)-1], 40)
				}

				task := ui.Truncate(a.Task, 35)
				if a.IsController {
					task = ui.Dim.Render("[ctrl] ") + task
				}

				sid := a.SessionID
				if len(sid) > 12 {
					sid = sid[:12] + "..."
				}

				agentRows = append(agentRows, []string{
					ui.StatusIcon(a.Status) + " " + sid,
					a.ProjectName,
					ui.StatusStyle(a.Phase).Render(a.Phase),
					task,
					milestone,
					a.ElapsedString(),
				})
			}

			if len(agentRows) > 0 {
				fmt.Println(ui.RenderTable(
					[]string{"Session", "Project", "Phase", "Task", "Last Milestone", "Elapsed"},
					agentRows,
				))
			} else {
				fmt.Println(ui.Dim.Render("  No active agents."))
			}

			fmt.Println()
			return nil
		},
	}
}
