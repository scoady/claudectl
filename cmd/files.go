package main

import (
	"fmt"

	"github.com/scoady/codexctl/internal/ui"
	"github.com/spf13/cobra"
)

func filesCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "files <project> [path]",
		Short: "List files in a project directory",
		Args:  cobra.RangeArgs(1, 2),
		ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
			if len(args) == 0 {
				return completeProjects(toComplete)
			}
			return nil, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			project := args[0]
			path := ""
			if len(args) > 1 {
				path = args[1]
			}

			files, err := client.ListFiles(project, path)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render(err.Error()))
				return nil
			}

			fmt.Println(ui.Banner())
			header := "Files — " + project
			if path != "" {
				header += "/" + path
			}
			fmt.Println(ui.SectionHeader(header))

			if len(files) == 0 {
				fmt.Println(ui.Dim.Render("  Empty directory."))
				fmt.Println()
				return nil
			}

			var rows [][]string
			for _, f := range files {
				icon := ui.Dim.Render("  ")
				if f.Type == "directory" {
					icon = ui.StatusIdle.Render("D ")
				}
				size := "-"
				if f.Size > 0 {
					size = formatSize(f.Size)
				}
				rows = append(rows, []string{
					icon + ui.Bold.Render(f.Name),
					f.Type,
					size,
				})
			}

			fmt.Println(ui.RenderTable(
				[]string{"Name", "Type", "Size"},
				rows,
			))
			fmt.Println()
			return nil
		},
	}

	// c9s files cat <project> <path>
	catCmd := &cobra.Command{
		Use:   "cat <project> <path>",
		Short: "Read file content",
		Args:  cobra.ExactArgs(2),
		ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
			if len(args) == 0 {
				return completeProjects(toComplete)
			}
			return nil, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			project := args[0]
			path := args[1]
			fc, err := client.ReadFile(project, path)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render(err.Error()))
				return nil
			}
			if fc.Binary {
				fmt.Println(ui.ErrorBox.Render("Binary file — cannot display."))
				return nil
			}
			fmt.Print(fc.Content)
			if fc.Truncated {
				fmt.Println(ui.Dim.Render("\n... (truncated)"))
			}
			return nil
		},
	}

	// c9s files status <project>
	statusCmd := &cobra.Command{
		Use:   "status <project>",
		Short: "Show git status for a project",
		Args:  cobra.ExactArgs(1),
		ValidArgsFunction: func(cmd *cobra.Command, args []string, toComplete string) ([]string, cobra.ShellCompDirective) {
			if len(args) == 0 {
				return completeProjects(toComplete)
			}
			return nil, cobra.ShellCompDirectiveNoFileComp
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			project := args[0]
			status, err := client.GetGitStatus(project)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render(err.Error()))
				return nil
			}

			fmt.Println(ui.Banner())
			fmt.Println(ui.SectionHeader("Git Status — " + project))

			if len(status) == 0 {
				fmt.Println(ui.Dim.Render("  Working tree clean."))
				fmt.Println()
				return nil
			}

			var rows [][]string
			for path, code := range status {
				statusStyle := ui.Dim
				switch {
				case code == "M" || code == "MM":
					statusStyle = ui.StatusWorking
				case code == "A" || code == "AM":
					statusStyle = ui.StatusDone
				case code == "D":
					statusStyle = ui.StatusError
				case code == "??":
					statusStyle = ui.StatusIdle
				}
				rows = append(rows, []string{
					statusStyle.Render(code),
					path,
				})
			}

			fmt.Println(ui.RenderTable(
				[]string{"Status", "File"},
				rows,
			))
			fmt.Println()
			return nil
		},
	}

	cmd.AddCommand(catCmd, statusCmd)
	return cmd
}

func formatSize(bytes int64) string {
	const (
		kb = 1024
		mb = 1024 * kb
		gb = 1024 * mb
	)
	switch {
	case bytes >= gb:
		return fmt.Sprintf("%.1fG", float64(bytes)/float64(gb))
	case bytes >= mb:
		return fmt.Sprintf("%.1fM", float64(bytes)/float64(mb))
	case bytes >= kb:
		return fmt.Sprintf("%.1fK", float64(bytes)/float64(kb))
	default:
		return fmt.Sprintf("%dB", bytes)
	}
}
