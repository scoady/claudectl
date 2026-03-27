package main

import (
	"fmt"

	"github.com/scoady/codexctl/internal/ui"
	"github.com/spf13/cobra"
)

func projectsCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "projects [name]",
		Short: "List projects or show project detail",
		Args:  cobra.MaximumNArgs(1),
		ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
			if len(args) == 0 {
				return completeProjects(toComplete)
			}
			return nil, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 1 {
				return showProjectDetail(args[0])
			}
			return listProjects()
		},
	}

	// c9s projects create <name> [--description "..."] [--model "..."]
	var createDesc, createModel string
	createCmd := &cobra.Command{
		Use:   "create <name>",
		Short: "Create a new managed project",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			name := args[0]
			_, err := client.CreateProject(name, createDesc, createModel)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render(err.Error()))
				return nil
			}
			fmt.Println(ui.SuccessText.Render("Project created: ") + ui.Bold.Render(name))
			return nil
		},
	}
	createCmd.Flags().StringVar(&createDesc, "description", "", "Project description")
	createCmd.Flags().StringVar(&createModel, "model", "", "Default model for agents")
	createCmd.RegisterFlagCompletionFunc("model", func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
		return completeModels(toComplete)
	})

	// c9s projects delete <name>
	deleteCmd := &cobra.Command{
		Use:   "delete <name>",
		Short: "Delete a managed project",
		Args:  cobra.ExactArgs(1),
		ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
			if len(args) == 0 {
				return completeProjects(toComplete)
			}
			return nil, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			name := args[0]
			err := client.DeleteProject(name)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render(err.Error()))
				return nil
			}
			fmt.Println(ui.SuccessText.Render("Project deleted: ") + ui.Bold.Render(name))
			return nil
		},
	}

	// c9s projects config <name> --model "..." --parallelism N
	var cfgModel string
	var cfgParallelism int
	configCmd := &cobra.Command{
		Use:   "config <name>",
		Short: "Update project configuration",
		Args:  cobra.ExactArgs(1),
		ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
			if len(args) == 0 {
				return completeProjects(toComplete)
			}
			return nil, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			name := args[0]
			cfg := map[string]interface{}{}
			if cmd.Flags().Changed("model") {
				cfg["model"] = cfgModel
			}
			if cmd.Flags().Changed("parallelism") {
				cfg["parallelism"] = cfgParallelism
			}
			if len(cfg) == 0 {
				fmt.Println(ui.ErrorBox.Render("No config flags provided. Use --model and/or --parallelism."))
				return nil
			}
			err := client.UpdateConfig(name, cfg)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render(err.Error()))
				return nil
			}
			fmt.Println(ui.SuccessText.Render("Config updated for: ") + ui.Bold.Render(name))
			return nil
		},
	}
	configCmd.Flags().StringVar(&cfgModel, "model", "", "Default model for agents")
	configCmd.Flags().IntVar(&cfgParallelism, "parallelism", 0, "Number of parallel agents")
	configCmd.RegisterFlagCompletionFunc("model", func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
		return completeModels(toComplete)
	})

	cmd.AddCommand(createCmd, deleteCmd, configCmd)
	return cmd
}

func listProjects() error {
	projects, err := client.GetProjects()
	if err != nil {
		fmt.Println(ui.ErrorBox.Render(err.Error()))
		return nil
	}

	fmt.Println(ui.Banner())
	fmt.Println(ui.SectionHeader("Managed Projects"))

	var rows [][]string
	for _, p := range projects {
		agents := fmt.Sprintf("%d", len(p.ActiveSessionIDs))
		model := p.Config.Model
		if model == "" {
			model = ui.Dim.Render("default")
		}

		desc := p.Description
		if desc == "" {
			desc = "-"
		}

		rows = append(rows, []string{
			ui.Bold.Render(p.Name),
			agents,
			model,
			ui.Truncate(desc, 55),
		})
	}

	if len(rows) > 0 {
		fmt.Println(ui.RenderTable(
			[]string{"Project", "Agents", "Model", "Description"},
			rows,
		))
	} else {
		fmt.Println(ui.Dim.Render("  No projects."))
	}
	fmt.Println()
	return nil
}

func showProjectDetail(name string) error {
	p, err := client.GetProject(name)
	if err != nil {
		fmt.Println(ui.ErrorBox.Render(err.Error()))
		return nil
	}

	fmt.Println(ui.Banner())
	fmt.Println(ui.Title.Render("Project: " + p.Name))
	fmt.Println(ui.KeyValue("Path", p.Path))
	if p.Description != "" {
		fmt.Println(ui.KeyValue("Description", p.Description))
	}
	fmt.Println(ui.KeyValue("Parallelism", fmt.Sprintf("%d", p.Config.Parallelism)))
	model := p.Config.Model
	if model == "" {
		model = "default"
	}
	fmt.Println(ui.KeyValue("Model", model))
	fmt.Println(ui.KeyValue("Active Agents", fmt.Sprintf("%d", len(p.ActiveSessionIDs))))

	// Show agents for this project
	agents, _ := client.GetAgents()
	hasProjectAgents := false
	for _, a := range agents {
		if a.ProjectName == name {
			if !hasProjectAgents {
				fmt.Println(ui.SectionHeader("Agents"))
				hasProjectAgents = true
			}
			sid := a.SessionID
			if len(sid) > 16 {
				sid = sid[:16] + "..."
			}
			line := fmt.Sprintf("  %s %s  %s  %s",
				ui.StatusIcon(a.Status),
				ui.Bold.Render(sid),
				ui.StatusStyle(a.Phase).Render(a.Phase),
				ui.Dim.Render(a.ElapsedString()),
			)
			fmt.Println(line)
			if a.Task != "" {
				fmt.Println("    " + ui.Truncate(a.Task, 70))
			}
			if len(a.Milestones) > 0 {
				last := a.Milestones[len(a.Milestones)-1]
				fmt.Println("    " + ui.Dim.Render("last: "+last))
			}
		}
	}

	// Show tasks
	tasks, _ := client.GetTasks(name)
	if len(tasks) > 0 {
		fmt.Println(ui.SectionHeader("Tasks"))
		for _, t := range tasks {
			fmt.Printf("  %s %s\n", ui.TaskStatusIcon(t.Status), t.Text)
		}
	}

	fmt.Println()
	return nil
}
