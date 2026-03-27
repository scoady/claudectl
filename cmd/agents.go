package main

import (
	"fmt"

	"github.com/scoady/codexctl/internal/api"
	"github.com/scoady/codexctl/internal/ui"
	"github.com/spf13/cobra"
)

func agentsCmd() *cobra.Command {
	var activeOnly bool

	cmd := &cobra.Command{
		Use:   "agents",
		Short: "List agents or manage them",
		RunE: func(cmd *cobra.Command, args []string) error {
			agents, err := client.GetAgents()
			if err != nil {
				fmt.Println(ui.ErrorBox.Render(err.Error()))
				return nil
			}

			if activeOnly {
				var filtered []api.Agent
				for _, a := range agents {
					if a.Status == "working" || a.Status == "active" {
						filtered = append(filtered, a)
					}
				}
				agents = filtered
			}

			fmt.Println(ui.Banner())
			fmt.Println(ui.SectionHeader("Agents"))

			if len(agents) == 0 {
				label := "No agents"
				if activeOnly {
					label = "No active agents"
				}
				fmt.Println(ui.Dim.Render("  " + label + "."))
				fmt.Println()
				return nil
			}

			var rows [][]string
			for _, a := range agents {
				sid := a.SessionID
				if len(sid) > 16 {
					sid = sid[:16] + "..."
				}

				task := ui.Truncate(a.Task, 40)
				model := a.Model
				if model == "" {
					model = "-"
				}

				rows = append(rows, []string{
					ui.StatusIcon(a.Status) + " " + sid,
					a.ProjectName,
					ui.StatusStyle(a.Status).Render(a.Status),
					ui.StatusStyle(a.Phase).Render(a.Phase),
					task,
					model,
					fmt.Sprintf("%d", a.TurnCount),
					a.ElapsedString(),
				})
			}

			fmt.Println(ui.RenderTable(
				[]string{"Session", "Project", "Status", "Phase", "Task", "Model", "Turns", "Elapsed"},
				rows,
			))
			fmt.Println()
			return nil
		},
	}

	cmd.Flags().BoolVar(&activeOnly, "active", false, "Show only active/working agents")

	// c9s agents stop <session_id>
	stopCmd := &cobra.Command{
		Use:   "stop <session_id>",
		Short: "Stop an agent by session ID",
		Args:  cobra.ExactArgs(1),
		ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
			if len(args) == 0 {
				return completeAgentSessions(toComplete)
			}
			return nil, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			sessionID := args[0]
			err := client.KillAgent(sessionID)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render(err.Error()))
				return nil
			}
			fmt.Println(ui.SuccessText.Render("Agent " + sessionID + " stopped."))
			return nil
		},
	}

	// c9s agents inject <session_id> "message"
	injectCmd := &cobra.Command{
		Use:   "inject <session_id> <message>",
		Short: "Send a follow-up message to a running agent",
		Args:  cobra.ExactArgs(2),
		ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
			if len(args) == 0 {
				return completeAgentSessions(toComplete)
			}
			return nil, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			sessionID := args[0]
			message := args[1]
			err := client.InjectMessage(sessionID, message)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render(err.Error()))
				return nil
			}
			fmt.Println(ui.SuccessText.Render("Message injected to: ") + ui.Bold.Render(sessionID))
			return nil
		},
	}

	// c9s agents messages <session_id>
	messagesCmd := &cobra.Command{
		Use:   "messages <session_id>",
		Short: "Show messages for an agent session",
		Args:  cobra.ExactArgs(1),
		ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
			if len(args) == 0 {
				return completeAgentSessions(toComplete)
			}
			return nil, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			sessionID := args[0]
			messages, err := client.GetAgentMessages(sessionID)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render(err.Error()))
				return nil
			}

			fmt.Println(ui.Banner())
			fmt.Println(ui.SectionHeader("Messages — " + truncateStr(sessionID, 20)))

			if len(messages) == 0 {
				fmt.Println(ui.Dim.Render("  No messages."))
				fmt.Println()
				return nil
			}

			for _, m := range messages {
				role := ui.Dim.Render(m.Role)
				if m.Role == "assistant" {
					role = ui.StatusWorking.Render("assistant")
				} else if m.Role == "user" {
					role = ui.Bold.Render("user")
				}
				content := m.Content
				if m.Type == "tool_use" {
					content = m.ToolName
					if cmd, ok := m.ToolInput["command"].(string); ok && cmd != "" {
						content += " · " + truncateStr(cmd, 80)
					}
				}
				fmt.Printf("  %s  %s\n", role, content)
			}
			fmt.Println()
			return nil
		},
	}

	cmd.AddCommand(stopCmd, injectCmd, messagesCmd)
	return cmd
}
