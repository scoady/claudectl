package main

import (
	"fmt"
	"strconv"

	"github.com/scoady/claudectl/internal/ui"
	"github.com/spf13/cobra"
)

func tasksCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "tasks <project>",
		Short: "List tasks for a project",
		Args:  cobra.ExactArgs(1),
		ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
			if len(args) == 0 {
				return completeProjects(toComplete)
			}
			return nil, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			project := args[0]
			tasks, err := client.GetTasks(project)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render(err.Error()))
				return nil
			}

			fmt.Println(ui.Banner())
			fmt.Println(ui.SectionHeader("Tasks — " + project))

			if len(tasks) == 0 {
				fmt.Println(ui.Dim.Render("  No tasks."))
				fmt.Println()
				return nil
			}

			var rows [][]string
			for i, t := range tasks {
				rows = append(rows, []string{
					fmt.Sprintf("%d", i),
					ui.TaskStatusIcon(t.Status) + " " + ui.StatusStyle(t.Status).Render(t.Status),
					t.Text,
				})
			}

			fmt.Println(ui.RenderTable(
				[]string{"#", "Status", "Task"},
				rows,
			))
			fmt.Println()
			return nil
		},
	}

	// c9s tasks add <project> "task text"
	addCmd := &cobra.Command{
		Use:   "add <project> <task_text>",
		Short: "Add a new task to a project",
		Args:  cobra.ExactArgs(2),
		ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
			if len(args) == 0 {
				return completeProjects(toComplete)
			}
			return nil, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			project := args[0]
			text := args[1]
			err := client.AddTask(project, text)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render(err.Error()))
				return nil
			}
			fmt.Println(ui.SuccessText.Render("Task added to: ") + ui.Bold.Render(project))
			return nil
		},
	}

	// c9s tasks update <project> <index> --status done|pending|in_progress
	var updateStatus string
	updateCmd := &cobra.Command{
		Use:   "update <project> <index>",
		Short: "Update a task's status",
		Args:  cobra.ExactArgs(2),
		ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
			if len(args) == 0 {
				return completeProjects(toComplete)
			}
			return nil, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			project := args[0]
			index, err := strconv.Atoi(args[1])
			if err != nil {
				fmt.Println(ui.ErrorBox.Render("Invalid task index: " + args[1]))
				return nil
			}
			if updateStatus == "" {
				fmt.Println(ui.ErrorBox.Render("--status is required"))
				return nil
			}
			err = client.UpdateTask(project, index, updateStatus)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render(err.Error()))
				return nil
			}
			fmt.Println(ui.SuccessText.Render(fmt.Sprintf("Task #%d updated to: ", index)) + ui.Bold.Render(updateStatus))
			return nil
		},
	}
	updateCmd.Flags().StringVar(&updateStatus, "status", "", "New status: done, pending, in_progress")
	updateCmd.RegisterFlagCompletionFunc("status", func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
		return []string{"done", "pending", "in_progress"}, cobra.ShellCompDirectiveNoFileComp
	})

	// c9s tasks delete <project> <index>
	deleteCmd := &cobra.Command{
		Use:   "delete <project> <index>",
		Short: "Delete a task by index",
		Args:  cobra.ExactArgs(2),
		ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
			if len(args) == 0 {
				return completeProjects(toComplete)
			}
			return nil, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			project := args[0]
			index, err := strconv.Atoi(args[1])
			if err != nil {
				fmt.Println(ui.ErrorBox.Render("Invalid task index: " + args[1]))
				return nil
			}
			err = client.DeleteTask(project, index)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render(err.Error()))
				return nil
			}
			fmt.Println(ui.SuccessText.Render(fmt.Sprintf("Task #%d deleted from: ", index)) + ui.Bold.Render(project))
			return nil
		},
	}

	// c9s tasks start <project> <index>
	startCmd := &cobra.Command{
		Use:   "start <project> <index>",
		Short: "Start a task (set to in_progress and dispatch)",
		Args:  cobra.ExactArgs(2),
		ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
			if len(args) == 0 {
				return completeProjects(toComplete)
			}
			return nil, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			project := args[0]
			index, err := strconv.Atoi(args[1])
			if err != nil {
				fmt.Println(ui.ErrorBox.Render("Invalid task index: " + args[1]))
				return nil
			}
			err = client.StartTask(project, index)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render(err.Error()))
				return nil
			}
			fmt.Println(ui.SuccessText.Render(fmt.Sprintf("Task #%d started in: ", index)) + ui.Bold.Render(project))
			return nil
		},
	}

	// c9s tasks complete <project> <index> [--summary "..."]
	var completeSummary string
	completeCmd := &cobra.Command{
		Use:   "complete <project> <index>",
		Short: "Mark a task as complete",
		Args:  cobra.ExactArgs(2),
		ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
			if len(args) == 0 {
				return completeProjects(toComplete)
			}
			return nil, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			project := args[0]
			index, err := strconv.Atoi(args[1])
			if err != nil {
				fmt.Println(ui.ErrorBox.Render("Invalid task index: " + args[1]))
				return nil
			}
			err = client.CompleteTask(project, index, completeSummary)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render(err.Error()))
				return nil
			}
			fmt.Println(ui.SuccessText.Render(fmt.Sprintf("Task #%d completed in: ", index)) + ui.Bold.Render(project))
			return nil
		},
	}
	completeCmd.Flags().StringVar(&completeSummary, "summary", "", "Completion summary")

	cmd.AddCommand(addCmd, updateCmd, deleteCmd, startCmd, completeCmd)
	return cmd
}
