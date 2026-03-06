package main

import (
	"fmt"

	"github.com/scoady/claudectl/internal/ui"
	"github.com/spf13/cobra"
)

func cronCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "cron <project>",
		Short: "List or manage cron jobs for a project",
		Args:  cobra.ExactArgs(1),
		ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
			if len(args) == 0 {
				return completeProjects(toComplete)
			}
			return nil, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			project := args[0]
			jobs, err := client.GetCronJobs(project)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render(err.Error()))
				return nil
			}

			fmt.Println(ui.Banner())
			fmt.Println(ui.SectionHeader("Cron Jobs — " + project))

			if len(jobs) == 0 {
				fmt.Println(ui.Dim.Render("  No cron jobs."))
				fmt.Println()
				return nil
			}

			var rows [][]string
			for _, j := range jobs {
				enabled := ui.StatusDone.Render("yes")
				if !j.Enabled {
					enabled = ui.Dim.Render("no")
				}
				rows = append(rows, []string{
					ui.Bold.Render(j.ID),
					j.Name,
					j.Schedule,
					ui.Truncate(j.Task, 40),
					enabled,
				})
			}

			fmt.Println(ui.RenderTable(
				[]string{"ID", "Name", "Schedule", "Task", "Enabled"},
				rows,
			))
			fmt.Println()
			return nil
		},
	}

	// c9s cron create <project> --name "name" --schedule "*/5 * * * *" --task "do something"
	var createName, createSchedule, createTask string
	createCmd := &cobra.Command{
		Use:   "create <project>",
		Short: "Create a new cron job",
		Args:  cobra.ExactArgs(1),
		ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
			if len(args) == 0 {
				return completeProjects(toComplete)
			}
			return nil, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			project := args[0]
			if createName == "" || createSchedule == "" || createTask == "" {
				fmt.Println(ui.ErrorBox.Render("--name, --schedule, and --task are all required"))
				return nil
			}
			body := map[string]interface{}{
				"name":     createName,
				"schedule": createSchedule,
				"task":     createTask,
			}
			_, err := client.CreateCronJob(project, body)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render(err.Error()))
				return nil
			}
			fmt.Println(ui.SuccessText.Render("Cron job created: ") + ui.Bold.Render(createName))
			return nil
		},
	}
	createCmd.Flags().StringVar(&createName, "name", "", "Job name")
	createCmd.Flags().StringVar(&createSchedule, "schedule", "", "Cron schedule expression")
	createCmd.Flags().StringVar(&createTask, "task", "", "Task prompt to dispatch")

	// c9s cron update <project> <job_id> [--name "..."] [--schedule "..."] [--task "..."] [--enabled]
	var updateName, updateSchedule, updateTask string
	var updateEnabled bool
	updateCmd := &cobra.Command{
		Use:   "update <project> <job_id>",
		Short: "Update an existing cron job",
		Args:  cobra.ExactArgs(2),
		ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
			if len(args) == 0 {
				return completeProjects(toComplete)
			}
			return nil, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			project := args[0]
			jobID := args[1]
			body := map[string]interface{}{}
			if cmd.Flags().Changed("name") {
				body["name"] = updateName
			}
			if cmd.Flags().Changed("schedule") {
				body["schedule"] = updateSchedule
			}
			if cmd.Flags().Changed("task") {
				body["task"] = updateTask
			}
			if cmd.Flags().Changed("enabled") {
				body["enabled"] = updateEnabled
			}
			if len(body) == 0 {
				fmt.Println(ui.ErrorBox.Render("No update flags provided."))
				return nil
			}
			_, err := client.UpdateCronJob(project, jobID, body)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render(err.Error()))
				return nil
			}
			fmt.Println(ui.SuccessText.Render("Cron job updated: ") + ui.Bold.Render(jobID))
			return nil
		},
	}
	updateCmd.Flags().StringVar(&updateName, "name", "", "Job name")
	updateCmd.Flags().StringVar(&updateSchedule, "schedule", "", "Cron schedule expression")
	updateCmd.Flags().StringVar(&updateTask, "task", "", "Task prompt to dispatch")
	updateCmd.Flags().BoolVar(&updateEnabled, "enabled", false, "Enable or disable the job")

	// c9s cron delete <project> <job_id>
	deleteCmd := &cobra.Command{
		Use:   "delete <project> <job_id>",
		Short: "Delete a cron job",
		Args:  cobra.ExactArgs(2),
		ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
			if len(args) == 0 {
				return completeProjects(toComplete)
			}
			return nil, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			project := args[0]
			jobID := args[1]
			err := client.DeleteCronJob(project, jobID)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render(err.Error()))
				return nil
			}
			fmt.Println(ui.SuccessText.Render("Cron job deleted: ") + ui.Bold.Render(jobID))
			return nil
		},
	}

	// c9s cron trigger <project> <job_id>
	triggerCmd := &cobra.Command{
		Use:   "trigger <project> <job_id>",
		Short: "Trigger a cron job immediately",
		Args:  cobra.ExactArgs(2),
		ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
			if len(args) == 0 {
				return completeProjects(toComplete)
			}
			return nil, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			project := args[0]
			jobID := args[1]
			err := client.TriggerCronJob(project, jobID)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render(err.Error()))
				return nil
			}
			fmt.Println(ui.SuccessText.Render("Cron job triggered: ") + ui.Bold.Render(jobID))
			return nil
		},
	}

	cmd.AddCommand(createCmd, updateCmd, deleteCmd, triggerCmd)
	return cmd
}
