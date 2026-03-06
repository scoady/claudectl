package main

import (
	"encoding/json"
	"fmt"

	"github.com/scoady/claudectl/internal/api"
	"github.com/scoady/claudectl/internal/ui"
	"github.com/spf13/cobra"
)

func canvasCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "canvas <project>",
		Short: "List or manage canvas widgets",
		Args:  cobra.ExactArgs(1),
		ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
			if len(args) == 0 {
				return completeProjects(toComplete)
			}
			return nil, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			project := args[0]
			widgets, err := client.GetWidgets(project)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render(err.Error()))
				return nil
			}

			fmt.Println(ui.Banner())
			fmt.Println(ui.SectionHeader("Canvas Widgets — " + project))

			if len(widgets) == 0 {
				fmt.Println(ui.Dim.Render("  No widgets."))
				fmt.Println()
				return nil
			}

			var rows [][]string
			for _, w := range widgets {
				pos := "-"
				if w.GSX != nil && w.GSY != nil {
					pos = fmt.Sprintf("(%d,%d)", *w.GSX, *w.GSY)
				}
				tmpl := w.TemplateID
				if tmpl == "" {
					tmpl = "-"
				}

				rows = append(rows, []string{
					ui.Bold.Render(truncateStr(w.ID, 20)),
					w.Title,
					tmpl,
					fmt.Sprintf("%dx%d", w.GSW, w.GSH),
					pos,
					w.Tab,
				})
			}

			fmt.Println(ui.RenderTable(
				[]string{"ID", "Title", "Template", "Size", "Position", "Tab"},
				rows,
			))
			fmt.Println()
			return nil
		},
	}

	// c9s canvas put <project> --template <id> --data '{...}'
	var template string
	var data string
	putCmd := &cobra.Command{
		Use:   "put <project>",
		Short: "Create a widget on the canvas",
		Args:  cobra.ExactArgs(1),
		ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
			if len(args) == 0 {
				return completeProjects(toComplete)
			}
			return nil, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			project := args[0]

			body := map[string]interface{}{}
			if template != "" {
				body["template_id"] = template
			}
			if data != "" {
				var parsed map[string]interface{}
				if err := json.Unmarshal([]byte(data), &parsed); err != nil {
					fmt.Println(ui.ErrorBox.Render("Invalid JSON data: " + err.Error()))
					return nil
				}
				body["template_data"] = parsed
			}

			w, err := client.CreateWidget(project, body)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render(err.Error()))
				return nil
			}

			fmt.Println(ui.SuccessText.Render("Widget created: ") + ui.Bold.Render(w.ID))
			return nil
		},
	}
	putCmd.Flags().StringVar(&template, "template", "", "Widget template ID")
	putCmd.Flags().StringVar(&data, "data", "", "Widget data as JSON string")

	// c9s canvas rm <project> <widget_id>
	rmCmd := &cobra.Command{
		Use:   "rm <project> <widget_id>",
		Short: "Remove a widget from the canvas",
		Args:  cobra.ExactArgs(2),
		ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
			if len(args) == 0 {
				return completeProjects(toComplete)
			}
			if len(args) == 1 {
				return completeWidgets(args[0], toComplete)
			}
			return nil, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			project := args[0]
			widgetID := args[1]

			err := client.DeleteWidget(project, widgetID)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render(err.Error()))
				return nil
			}

			fmt.Println(ui.SuccessText.Render("Widget removed: ") + widgetID)
			return nil
		},
	}

	// c9s canvas tabs <project>
	tabsCmd := &cobra.Command{
		Use:   "tabs <project>",
		Short: "List canvas tabs",
		Args:  cobra.ExactArgs(1),
		ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
			if len(args) == 0 {
				return completeProjects(toComplete)
			}
			return nil, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			project := args[0]
			tabs, err := client.GetCanvasTabs(project)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render(err.Error()))
				return nil
			}

			fmt.Println(ui.Banner())
			fmt.Println(ui.SectionHeader("Canvas Tabs — " + project))

			if len(tabs) == 0 {
				fmt.Println(ui.Dim.Render("  No tabs."))
				fmt.Println()
				return nil
			}

			for _, tab := range tabs {
				fmt.Printf("  %s %s\n", ui.StatusIdle.Render("●"), ui.Bold.Render(tab))
			}
			fmt.Println()
			return nil
		},
	}

	// c9s canvas clear <project>
	clearCmd := &cobra.Command{
		Use:   "clear <project>",
		Short: "Remove all widgets from the canvas",
		Args:  cobra.ExactArgs(1),
		ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
			if len(args) == 0 {
				return completeProjects(toComplete)
			}
			return nil, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			project := args[0]
			err := client.ClearCanvas(project)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render(err.Error()))
				return nil
			}
			fmt.Println(ui.SuccessText.Render("Canvas cleared for: ") + ui.Bold.Render(project))
			return nil
		},
	}

	// c9s canvas layout <project> --data '{...}'
	var layoutData string
	layoutCmd := &cobra.Command{
		Use:   "layout <project>",
		Short: "Save canvas layout",
		Args:  cobra.ExactArgs(1),
		ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
			if len(args) == 0 {
				return completeProjects(toComplete)
			}
			return nil, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			project := args[0]
			if layoutData == "" {
				fmt.Println(ui.ErrorBox.Render("--data is required (JSON layout)"))
				return nil
			}
			var items []api.LayoutItem
			if err := json.Unmarshal([]byte(layoutData), &items); err != nil {
				fmt.Println(ui.ErrorBox.Render("Invalid JSON (expected array of {id,x,y,w,h}): " + err.Error()))
				return nil
			}
			err := client.SaveLayout(project, items)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render(err.Error()))
				return nil
			}
			fmt.Println(ui.SuccessText.Render("Layout saved for: ") + ui.Bold.Render(project))
			return nil
		},
	}
	layoutCmd.Flags().StringVar(&layoutData, "data", "", "Layout data as JSON string")

	cmd.AddCommand(putCmd, rmCmd, tabsCmd, clearCmd, layoutCmd)
	return cmd
}
