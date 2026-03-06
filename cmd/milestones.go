package main

import (
	"fmt"

	"github.com/scoady/claudectl/internal/ui"
	"github.com/spf13/cobra"
)

func milestonesCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "milestones <project>",
		Short: "List milestones for a project",
		Args:  cobra.ExactArgs(1),
		ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
			if len(args) == 0 {
				return completeProjects(toComplete)
			}
			return nil, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			project := args[0]
			milestones, err := client.GetMilestones(project)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render(err.Error()))
				return nil
			}

			fmt.Println(ui.Banner())
			fmt.Println(ui.SectionHeader("Milestones — " + project))

			if len(milestones) == 0 {
				fmt.Println(ui.Dim.Render("  No milestones."))
				fmt.Println()
				return nil
			}

			for _, m := range milestones {
				sid := m.SessionID
				if len(sid) > 12 {
					sid = sid[:12] + "..."
				}
				fmt.Printf("  %s %s  %s\n",
					ui.Dim.Render(sid),
					ui.StatusIdle.Render("●"),
					ui.Bold.Render(m.Label),
				)
			}
			fmt.Println()
			return nil
		},
	}

	// c9s milestones clear <project>
	clearCmd := &cobra.Command{
		Use:   "clear <project>",
		Short: "Clear all milestones for a project",
		Args:  cobra.ExactArgs(1),
		ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
			if len(args) == 0 {
				return completeProjects(toComplete)
			}
			return nil, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			project := args[0]
			err := client.ClearMilestones(project)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render(err.Error()))
				return nil
			}
			fmt.Println(ui.SuccessText.Render("Milestones cleared for: ") + ui.Bold.Render(project))
			return nil
		},
	}

	cmd.AddCommand(clearCmd)
	return cmd
}
