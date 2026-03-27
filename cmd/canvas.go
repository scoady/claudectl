package main

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/scoady/codexctl/internal/api"
	"github.com/scoady/codexctl/internal/ui"
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

	// c9s canvas templates — list saved widget templates
	templatesCmd := &cobra.Command{
		Use:   "templates",
		Short: "List saved widget templates",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			templates, err := client.GetWidgetTemplates()
			if err != nil {
				fmt.Println(ui.ErrorBox.Render(err.Error()))
				return nil
			}

			fmt.Println(ui.Banner())
			fmt.Println(ui.SectionHeader("Widget Templates"))

			if len(templates) == 0 {
				fmt.Println(ui.Dim.Render("  No saved templates."))
				fmt.Println()
				return nil
			}

			var rows [][]string
			for _, t := range templates {
				title := t.Title
				if title == "" {
					title = "-"
				}
				hasJS := "-"
				if t.JS != "" {
					hasJS = "yes"
				}
				hasCSS := "-"
				if t.CSS != "" {
					hasCSS = "yes"
				}
				hasHTML := "-"
				if t.HTML != "" {
					hasHTML = "yes"
				}
				rows = append(rows, []string{
					ui.Bold.Render(t.Filename),
					title,
					hasJS,
					hasCSS,
					hasHTML,
				})
			}

			fmt.Println(ui.RenderTable(
				[]string{"Filename", "Title", "JS", "CSS", "HTML"},
				rows,
			))
			fmt.Println()
			return nil
		},
	}

	// c9s canvas catalog — list widget catalog
	catalogCmd := &cobra.Command{
		Use:   "catalog [template_id]",
		Short: "List widget catalog or show template details",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 1 {
				// Show specific template details
				ct, err := client.GetCatalogTemplate(args[0])
				if err != nil {
					fmt.Println(ui.ErrorBox.Render(err.Error()))
					return nil
				}

				fmt.Println(ui.Banner())
				fmt.Println(ui.SectionHeader("Catalog Template — " + ct.Title))
				fmt.Printf("  %s %s\n", ui.Dim.Render("ID:"), ui.Bold.Render(ct.TemplateID))
				fmt.Printf("  %s %s\n", ui.Dim.Render("Title:"), ct.Title)
				desc := ct.Description
				if desc == "" {
					desc = "-"
				}
				fmt.Printf("  %s %s\n", ui.Dim.Render("Description:"), desc)
				fmt.Printf("  %s %d\n", ui.Dim.Render("Parameters:"), len(ct.Parameters))

				if len(ct.Parameters) > 0 {
					fmt.Println()
					fmt.Println(ui.SectionHeader("Parameters"))
					var rows [][]string
					for _, p := range ct.Parameters {
						defVal := p.Default
						if defVal == "" {
							defVal = "-"
						}
						pDesc := p.Description
						if pDesc == "" {
							pDesc = "-"
						}
						rows = append(rows, []string{
							ui.Bold.Render(p.Name),
							p.Type,
							pDesc,
							defVal,
						})
					}
					fmt.Println(ui.RenderTable(
						[]string{"Name", "Type", "Description", "Default"},
						rows,
					))
				}
				fmt.Println()
				return nil
			}

			// List all catalog templates
			catalog, err := client.GetCatalogTemplates()
			if err != nil {
				fmt.Println(ui.ErrorBox.Render(err.Error()))
				return nil
			}

			fmt.Println(ui.Banner())
			fmt.Println(ui.SectionHeader("Widget Catalog"))

			if len(catalog) == 0 {
				fmt.Println(ui.Dim.Render("  No catalog templates."))
				fmt.Println()
				return nil
			}

			var rows [][]string
			for _, ct := range catalog {
				desc := ct.Description
				if desc == "" {
					desc = "-"
				}
				rows = append(rows, []string{
					ui.Bold.Render(ct.TemplateID),
					ct.Title,
					truncateStr(desc, 40),
					fmt.Sprintf("%d", len(ct.Parameters)),
				})
			}

			fmt.Println(ui.RenderTable(
				[]string{"Template ID", "Title", "Description", "Params"},
				rows,
			))
			fmt.Println()
			return nil
		},
	}

	// c9s canvas seed <project> — seed canvas with default widgets
	seedCmd := &cobra.Command{
		Use:   "seed <project>",
		Short: "Seed canvas with default widgets",
		Args:  cobra.ExactArgs(1),
		ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
			if len(args) == 0 {
				return completeProjects(toComplete)
			}
			return nil, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			project := args[0]
			err := client.SeedCanvas(project)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render(err.Error()))
				return nil
			}
			fmt.Println(ui.SuccessText.Render("Canvas seeded for: ") + ui.Bold.Render(project))
			return nil
		},
	}

	// c9s canvas scene <project> --file layout.json — replace entire scene
	var sceneFile string
	sceneCmd := &cobra.Command{
		Use:   "scene <project>",
		Short: "Replace entire canvas from a JSON file",
		Args:  cobra.ExactArgs(1),
		ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
			if len(args) == 0 {
				return completeProjects(toComplete)
			}
			return nil, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			project := args[0]
			if sceneFile == "" {
				fmt.Println(ui.ErrorBox.Render("--file is required (path to JSON scene file)"))
				return nil
			}
			fileData, err := os.ReadFile(sceneFile)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render("Failed to read file: " + err.Error()))
				return nil
			}
			var widgets []interface{}
			if err := json.Unmarshal(fileData, &widgets); err != nil {
				fmt.Println(ui.ErrorBox.Render("Invalid JSON (expected array of widget objects): " + err.Error()))
				return nil
			}
			err = client.ReplaceScene(project, widgets)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render(err.Error()))
				return nil
			}
			fmt.Println(ui.SuccessText.Render("Scene replaced for: ") + ui.Bold.Render(project))
			return nil
		},
	}
	sceneCmd.Flags().StringVar(&sceneFile, "file", "", "Path to JSON scene file")

	// c9s canvas contract <project> — show dashboard data contract
	contractCmd := &cobra.Command{
		Use:   "contract <project>",
		Short: "Show dashboard data contract",
		Args:  cobra.ExactArgs(1),
		ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
			if len(args) == 0 {
				return completeProjects(toComplete)
			}
			return nil, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			project := args[0]
			contract, err := client.GetDashboardContract(project)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render(err.Error()))
				return nil
			}

			fmt.Println(ui.Banner())
			fmt.Println(ui.SectionHeader("Dashboard Contract — " + project))

			if len(contract.Widgets) == 0 {
				fmt.Println(ui.Dim.Render("  No contract widgets."))
				fmt.Println()
				return nil
			}

			for _, w := range contract.Widgets {
				fmt.Printf("  %s %s\n", ui.StatusIdle.Render("●"), ui.Bold.Render(w.Title))
				fmt.Printf("    %s %s\n", ui.Dim.Render("ID:"), w.ID)
				if len(w.Schema) > 0 {
					schemaJSON, _ := json.MarshalIndent(w.Schema, "    ", "  ")
					fmt.Printf("    %s\n%s\n", ui.Dim.Render("Schema:"), string(schemaJSON))
				}
				fmt.Println()
			}
			return nil
		},
	}

	cmd.AddCommand(putCmd, rmCmd, tabsCmd, clearCmd, layoutCmd,
		templatesCmd, catalogCmd, seedCmd, sceneCmd, contractCmd)
	return cmd
}
