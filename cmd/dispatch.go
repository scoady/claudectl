package main

import (
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/lipgloss"
	"github.com/scoady/claudectl/internal/api"
	"github.com/scoady/claudectl/internal/ui"
	"github.com/spf13/cobra"
)

func dispatchCmd() *cobra.Command {
	var follow bool
	var model string

	cmd := &cobra.Command{
		Use:   "dispatch <project> <task>",
		Short: "Dispatch a task to a project",
		Args:  cobra.ExactArgs(2),
		ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
			if len(args) == 0 {
				return completeProjects(toComplete)
			}
			return nil, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			project := args[0]
			task := args[1]

			fmt.Printf("%s Dispatching to %s...\n",
				ui.StatusWorking.Render("●"),
				ui.Bold.Render(project),
			)

			resp, err := client.Dispatch(project, task, model)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render(err.Error()))
				return nil
			}

			if resp.SessionID != "" {
				fmt.Println(ui.SuccessText.Render("Agent spawned: ") + ui.Bold.Render(resp.SessionID))
			}
			if len(resp.AgentIDs) > 0 {
				for _, id := range resp.AgentIDs {
					fmt.Println(ui.SuccessText.Render("  Agent: ") + ui.Bold.Render(id))
				}
			}
			if resp.Status != "" {
				fmt.Println(ui.KeyValue("Status", resp.Status))
			}

			if follow {
				fmt.Println()
				fmt.Println(ui.Dim.Render("Connecting to live stream..."))
				return streamWatch(project, "")
			}

			return nil
		},
	}

	cmd.Flags().BoolVarP(&follow, "follow", "f", false, "Follow agent output after dispatch")
	cmd.Flags().StringVar(&model, "model", "", "Override model for this dispatch")
	cmd.RegisterFlagCompletionFunc("model", func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
		return completeModels(toComplete)
	})

	return cmd
}

func watchCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "watch <session_id or project_name>",
		Short: "Stream live agent output via WebSocket",
		Args:  cobra.ExactArgs(1),
		ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
			if len(args) == 0 {
				return completeProjectsAndSessions(toComplete)
			}
			return nil, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			target := args[0]

			// Determine if target is a project name or session ID
			// Session IDs are typically UUIDs or "pending-xxx" format
			isProject := !strings.Contains(target, "-") || len(target) < 20

			// Try to resolve as project first
			if isProject {
				_, err := client.GetProject(target)
				if err == nil {
					fmt.Printf("%s Watching project %s (Ctrl+C to stop)\n\n",
						ui.StatusIdle.Render("◉"),
						ui.Bold.Render(target),
					)
					return streamWatch(target, "")
				}
			}

			fmt.Printf("%s Watching session %s (Ctrl+C to stop)\n\n",
				ui.StatusIdle.Render("◉"),
				ui.Bold.Render(target),
			)
			return streamWatch("", target)
		},
	}
}

func streamWatch(projectFilter, sessionFilter string) error {
	// Style helpers
	milestoneStyle := lipgloss.NewStyle().
		Foreground(ui.ColorCyan).
		Bold(true)
	phaseStyle := lipgloss.NewStyle().
		Foreground(ui.ColorPurple).
		Bold(true)
	textStyle := lipgloss.NewStyle().
		Foreground(ui.ColorWhite)
	dimStyle := lipgloss.NewStyle().
		Foreground(ui.ColorDim)
	agentLabel := lipgloss.NewStyle().
		Foreground(ui.ColorAmber).
		Bold(true)
	errorStyle := lipgloss.NewStyle().
		Foreground(ui.ColorRed).
		Bold(true)

	return client.StreamWebSocket(func(event api.WSEvent) error {
		dataMap, ok := event.Data.(map[string]interface{})
		if !ok {
			return nil
		}

		// Filter by project or session
		if projectFilter != "" {
			if pn, ok := dataMap["project_name"].(string); ok && pn != projectFilter {
				return nil
			}
			// Also check nested project field
			if pn, ok := dataMap["project"].(string); ok && pn != projectFilter {
				return nil
			}
		}
		if sessionFilter != "" {
			if sid, ok := dataMap["session_id"].(string); ok && sid != sessionFilter {
				return nil
			}
		}

		ts := time.Now().Format("15:04:05")
		prefix := dimStyle.Render(ts)

		switch event.Type {
		case "agent_spawned":
			sid, _ := dataMap["session_id"].(string)
			task, _ := dataMap["task"].(string)
			fmt.Printf("%s %s Agent spawned %s\n", prefix,
				agentLabel.Render("⚡"),
				ui.Bold.Render(truncateStr(sid, 20)),
			)
			if task != "" {
				fmt.Printf("  %s\n", dimStyle.Render(truncateStr(task, 80)))
			}

		case "agent_milestone":
			label, _ := dataMap["label"].(string)
			if label == "" {
				label, _ = dataMap["milestone"].(string)
			}
			sid, _ := dataMap["session_id"].(string)
			shortSID := truncateStr(sid, 8)
			fmt.Printf("%s %s %s\n", prefix,
				dimStyle.Render("["+shortSID+"]"),
				milestoneStyle.Render(label),
			)

		case "session_phase":
			phase, _ := dataMap["phase"].(string)
			sid, _ := dataMap["session_id"].(string)
			shortSID := truncateStr(sid, 8)
			fmt.Printf("%s %s phase → %s\n", prefix,
				dimStyle.Render("["+shortSID+"]"),
				phaseStyle.Render(phase),
			)

		case "agent_stream":
			text, _ := dataMap["text"].(string)
			if text != "" {
				// Stream text deltas
				fmt.Print(textStyle.Render(text))
			}

		case "tool_start":
			name, _ := dataMap["name"].(string)
			sid, _ := dataMap["session_id"].(string)
			shortSID := truncateStr(sid, 8)
			// Render as a badge
			badge := ui.Badge.Render(name)
			inputStr := ""
			if inp, ok := dataMap["input"].(map[string]interface{}); ok {
				// Show key input fields
				if fp, ok := inp["file_path"].(string); ok {
					inputStr = " " + dimStyle.Render(fp)
				} else if cmd, ok := inp["command"].(string); ok {
					inputStr = " " + dimStyle.Render(truncateStr(cmd, 50))
				} else if p, ok := inp["pattern"].(string); ok {
					inputStr = " " + dimStyle.Render(p)
				}
			}
			fmt.Printf("\n%s %s %s%s\n", prefix,
				dimStyle.Render("["+shortSID+"]"),
				badge, inputStr,
			)

		case "tool_done":
			// Brief acknowledgment
			name, _ := dataMap["name"].(string)
			_ = name // could show duration here

		case "agent_done":
			sid, _ := dataMap["session_id"].(string)
			fmt.Printf("\n%s %s Agent done %s\n", prefix,
				ui.SuccessText.Render("✓"),
				ui.Bold.Render(truncateStr(sid, 20)),
			)

		case "error":
			msg, _ := dataMap["message"].(string)
			if msg == "" {
				msg, _ = dataMap["error"].(string)
			}
			fmt.Printf("%s %s %s\n", prefix,
				errorStyle.Render("ERROR"),
				msg,
			)

		case "agent_state_sync":
			// Initial state dump on connect
			if agentsRaw, ok := dataMap["agents"].([]interface{}); ok {
				count := len(agentsRaw)
				if count > 0 {
					fmt.Printf("%s %s Connected — %d agent(s) active\n", prefix,
						ui.SuccessText.Render("●"),
						count,
					)
				} else {
					fmt.Printf("%s %s Connected — no active agents\n", prefix,
						dimStyle.Render("●"),
					)
				}
			}

		case "stats_update", "project_list", "pong":
			// Silently ignore these
		}

		return nil
	})
}

func truncateStr(s string, max int) string {
	if len(s) <= max {
		return s
	}
	if max < 4 {
		return s[:max]
	}
	return s[:max-3] + "..."
}
