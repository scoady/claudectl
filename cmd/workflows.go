package main

import (
	"encoding/json"
	"fmt"

	"github.com/scoady/claudectl/internal/ui"
	"github.com/spf13/cobra"
)

func workflowsCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "workflows <project>",
		Short: "Show workflow state for a project",
		Args:  cobra.ExactArgs(1),
		ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
			if len(args) == 0 {
				return completeProjects(toComplete)
			}
			return nil, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			project := args[0]
			wf, err := client.GetWorkflow(project)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render(err.Error()))
				return nil
			}

			fmt.Println(ui.Banner())
			fmt.Println(ui.SectionHeader("Workflow — " + project))

			fmt.Println(ui.KeyValue("Template", wf.TemplateID))
			fmt.Println(ui.KeyValue("Status", ui.StatusStyle(wf.Status).Render(wf.Status)))
			fmt.Println(ui.KeyValue("Current Phase", wf.CurrentPhase))
			fmt.Println(ui.KeyValue("Isolation", wf.IsolationStrategy))

			if len(wf.Phases) > 0 {
				fmt.Println(ui.SectionHeader("Phases"))
				var rows [][]string
				for _, p := range wf.Phases {
					rows = append(rows, []string{
						ui.Bold.Render(p.PhaseID),
						p.PhaseLabel,
						ui.StatusStyle(p.Status).Render(p.Status),
						fmt.Sprintf("%d", p.IterationNumber),
					})
				}
				fmt.Println(ui.RenderTable(
					[]string{"Phase ID", "Label", "Status", "Iteration"},
					rows,
				))
			}

			fmt.Println()
			return nil
		},
	}

	// c9s workflows create <project> --template <id> [--values '{"key":"val"}']
	var tmplID, valuesJSON string
	createCmd := &cobra.Command{
		Use:   "create <project>",
		Short: "Create a workflow from a template",
		Args:  cobra.ExactArgs(1),
		ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
			if len(args) == 0 {
				return completeProjects(toComplete)
			}
			return nil, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			project := args[0]
			if tmplID == "" {
				fmt.Println(ui.ErrorBox.Render("--template is required"))
				return nil
			}
			body := map[string]interface{}{
				"template_id": tmplID,
			}
			if valuesJSON != "" {
				var vals map[string]interface{}
				if err := json.Unmarshal([]byte(valuesJSON), &vals); err != nil {
					fmt.Println(ui.ErrorBox.Render("Invalid --values JSON: " + err.Error()))
					return nil
				}
				body["values"] = vals
			}
			_, err := client.CreateWorkflow(project, body)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render(err.Error()))
				return nil
			}
			fmt.Println(ui.SuccessText.Render("Workflow created for: ") + ui.Bold.Render(project))
			return nil
		},
	}
	createCmd.Flags().StringVar(&tmplID, "template", "", "Workflow template ID")
	createCmd.Flags().StringVar(&valuesJSON, "values", "", "Template values as JSON")
	createCmd.RegisterFlagCompletionFunc("template", func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
		return []string{
			"software-engineering",
			"research-analysis",
			"document-writing",
			"data-processing",
		}, cobra.ShellCompDirectiveNoFileComp
	})

	// c9s workflows start <project>
	startCmd := &cobra.Command{
		Use:   "start <project>",
		Short: "Start the workflow for a project",
		Args:  cobra.ExactArgs(1),
		ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
			if len(args) == 0 {
				return completeProjects(toComplete)
			}
			return nil, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			project := args[0]
			err := client.StartWorkflow(project)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render(err.Error()))
				return nil
			}
			fmt.Println(ui.SuccessText.Render("Workflow started for: ") + ui.Bold.Render(project))
			return nil
		},
	}

	// c9s workflows action <project> <pause|resume|skip_phase|cancel>
	actionCmd := &cobra.Command{
		Use:   "action <project> <pause|resume|skip_phase|cancel>",
		Short: "Perform a workflow action",
		Args:  cobra.ExactArgs(2),
		ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
			if len(args) == 0 {
				return completeProjects(toComplete)
			}
			if len(args) == 1 {
				return []string{"pause", "resume", "skip_phase", "cancel"}, cobra.ShellCompDirectiveNoFileComp
			}
			return nil, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			project := args[0]
			action := args[1]
			err := client.WorkflowAction(project, action)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render(err.Error()))
				return nil
			}
			fmt.Println(ui.SuccessText.Render("Workflow action '"+action+"' applied to: ") + ui.Bold.Render(project))
			return nil
		},
	}

	// c9s workflows delete <project>
	deleteCmd := &cobra.Command{
		Use:   "delete <project>",
		Short: "Delete the workflow for a project",
		Args:  cobra.ExactArgs(1),
		ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
			if len(args) == 0 {
				return completeProjects(toComplete)
			}
			return nil, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			project := args[0]
			err := client.DeleteWorkflow(project)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render(err.Error()))
				return nil
			}
			fmt.Println(ui.SuccessText.Render("Workflow deleted for: ") + ui.Bold.Render(project))
			return nil
		},
	}

	cmd.AddCommand(createCmd, startCmd, actionCmd, deleteCmd)
	return cmd
}
