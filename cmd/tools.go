package main

import (
	"fmt"
	"strings"

	"github.com/scoady/codexctl/internal/tools"
	"github.com/spf13/cobra"
)

func toolsCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "tools",
		Short: "Manage repo-driven local tool integrations for spawned Codex sessions",
	}
	cmd.AddCommand(
		toolsInstallCmd(),
		toolsListCmd(),
		toolsInspectCmd(),
		toolsSyncCmd(),
		toolsDoctorCmd(),
	)
	return cmd
}

func toolsInstallCmd() *cobra.Command {
	var source string
	var skipSkill bool

	cmd := &cobra.Command{
		Use:   "install",
		Short: "Install a tool from a local repo path or git URL",
		RunE: func(cmd *cobra.Command, args []string) error {
			record, err := tools.InstallToolFromSource(tools.InstallOptions{
				Source:       source,
				InstallSkill: !skipSkill,
			})
			if err != nil {
				return err
			}

			fmt.Printf("Installed %s\n", record.Name)
			fmt.Printf("  kind:    %s\n", coalesceValue(record.Kind, "tool"))
			if len(record.Tags) > 0 {
				fmt.Printf("  tags:    %s\n", strings.Join(record.Tags, ", "))
			}
			if record.RepoURL != "" {
				fmt.Printf("  repo:    %s\n", record.RepoURL)
			}
			fmt.Printf("  source:  %s\n", record.SourcePath)
			fmt.Printf("  command: %s\n", record.CommandPath)
			for _, skillPath := range record.SkillPaths {
				fmt.Printf("  skill:   %s\n", skillPath)
			}
			fmt.Println("Spawned Codex sessions will pick this tool up from PATH automatically.")
			return nil
		},
	}

	cmd.Flags().StringVar(&source, "source", "", "Local repo path or git URL (append @branch or #ref for a non-default ref)")
	cmd.Flags().BoolVar(&skipSkill, "skip-skill", false, "Install the tool runtime without writing exported Codex skills")
	_ = cmd.MarkFlagRequired("source")
	return cmd
}

func toolsListCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "list",
		Short: "List installed local tool integrations",
		RunE: func(cmd *cobra.Command, args []string) error {
			records, err := tools.ListRecords()
			if err != nil {
				return err
			}
			if len(records) == 0 {
				fmt.Println("No local tools installed.")
				return nil
			}
			for _, record := range records {
				fmt.Printf("%s\n", record.Name)
				fmt.Printf("  kind:    %s\n", coalesceValue(record.Kind, "tool"))
				if len(record.Tags) > 0 {
					fmt.Printf("  tags:    %s\n", strings.Join(record.Tags, ", "))
				}
				fmt.Printf("  command: %s\n", record.CommandPath)
				fmt.Printf("  source:  %s\n", record.SourcePath)
				for _, skillPath := range record.SkillPaths {
					fmt.Printf("  skill:   %s\n", skillPath)
				}
				if record.RepoURL != "" {
					fmt.Printf("  repo:    %s\n", record.RepoURL)
				}
			}
			return nil
		},
	}
}

func toolsInspectCmd() *cobra.Command {
	var skillFilter string
	var lines int

	cmd := &cobra.Command{
		Use:   "inspect <tool>",
		Short: "Inspect an installed tool and preview exported skills",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			inspection, err := tools.InspectInstalledTool(normalizeToolName(args[0]))
			if err != nil {
				return err
			}

			record := inspection.Record
			fmt.Printf("Tool: %s\n", record.Name)
			fmt.Printf("Kind: %s\n", coalesceValue(record.Kind, "tool"))
			if len(record.Tags) > 0 {
				fmt.Printf("Tags: %s\n", strings.Join(record.Tags, ", "))
			}
			if record.RepoURL != "" {
				fmt.Printf("Repo: %s\n", record.RepoURL)
			}
			fmt.Printf("Source: %s\n", record.SourcePath)
			fmt.Printf("Command: %s\n", record.CommandPath)
			fmt.Printf("Imported skills: %d\n", len(record.SkillPaths))
			fmt.Println()

			matched := false
			for _, spec := range inspection.SkillSpecs {
				if skillFilter != "" && skillFilter != spec.Name {
					continue
				}
				matched = true
				fmt.Printf("[%s]\n", spec.Name)
				fmt.Printf("  source: %s\n", spec.SourcePath)
				fmt.Printf("  dest:   %s\n", spec.DestPath)
				fmt.Println("  preview:")
				preview := inspection.Previews[spec.Name]
				if len(preview) == 0 {
					fmt.Println("    (empty)")
					continue
				}
				limit := len(preview)
				if lines > 0 && lines < limit {
					limit = lines
				}
				for _, line := range preview[:limit] {
					fmt.Printf("    %s\n", line)
				}
				if limit < len(preview) {
					fmt.Println("    ...")
				}
				fmt.Println()
			}

			if skillFilter != "" && !matched {
				return fmt.Errorf("skill %q not found in exported skills", skillFilter)
			}
			return nil
		},
	}

	cmd.Flags().StringVar(&skillFilter, "skill", "", "Preview only one exported skill name")
	cmd.Flags().IntVar(&lines, "lines", 12, "Number of preview lines to show per skill")
	return cmd
}

func toolsDoctorCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "doctor <tool>",
		Short: "Validate an installed tool integration",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			result := tools.DoctorInstalledTool(normalizeToolName(args[0]))
			if result.Record != nil {
				fmt.Printf("Tool: %s\n", result.Record.Name)
				fmt.Printf("Kind: %s\n", coalesceValue(result.Record.Kind, "tool"))
				if len(result.Record.Tags) > 0 {
					fmt.Printf("Tags: %s\n", strings.Join(result.Record.Tags, ", "))
				}
				if result.Record.RepoURL != "" {
					fmt.Printf("Repo: %s\n", result.Record.RepoURL)
				}
				fmt.Printf("Cmd:  %s\n", result.Record.CommandPath)
			} else {
				fmt.Printf("Tool: %s\n", result.Tool)
			}
			for _, check := range result.Checks {
				fmt.Printf("OK: %s\n", check)
			}
			for _, issue := range result.Issues {
				fmt.Printf("Issue: %s\n", issue)
			}
			if !result.Healthy {
				return fmt.Errorf("%s is not healthy", result.Tool)
			}
			fmt.Println("Healthy.")
			return nil
		},
	}
}

func toolsSyncCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "sync <tool>",
		Short: "Re-import exported skills from an installed tool source",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			record, err := tools.SyncInstalledTool(normalizeToolName(args[0]))
			if err != nil {
				return err
			}
			fmt.Printf("Synced %s exported skills from %s\n", record.Name, record.SourcePath)
			for _, skillPath := range record.SkillPaths {
				fmt.Printf("  skill: %s\n", skillPath)
			}
			return nil
		},
	}
}

func normalizeToolName(name string) string {
	return strings.TrimSpace(strings.ToLower(name))
}

func coalesceValue(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}
