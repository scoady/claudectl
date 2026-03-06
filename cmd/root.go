// Package main is the entry point for c9s.
package main

import (
	"os"

	"github.com/scoady/claudectl/internal/api"
	"github.com/scoady/claudectl/internal/tui"
	"github.com/scoady/claudectl/internal/ui"
	"github.com/spf13/cobra"
)

var (
	apiURL string
	client *api.Client
)

func main() {
	rootCmd := &cobra.Command{
		Use:   "c9s",
		Short: "c9s — interactive TUI for Claude Agent Manager",
		Long: ui.Banner() + "\n\n" +
			"A k9s-style interactive terminal interface for the Claude Agent Manager.\n" +
			"Run with no subcommands for the interactive TUI, or use subcommands for CLI mode.",
		PersistentPreRun: func(cmd *cobra.Command, args []string) {
			if envURL := os.Getenv("CM_API_URL"); envURL != "" && apiURL == "http://localhost:4040" {
				apiURL = envURL
			}
			client = api.NewClient(apiURL)
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			// No subcommand — launch interactive TUI
			return tui.Run(apiURL)
		},
		SilenceUsage: true,
	}

	rootCmd.PersistentFlags().StringVar(&apiURL, "api", "http://localhost:4040", "Backend API URL")

	rootCmd.AddCommand(
		healthCmd(),
		statusCmd(),
		projectsCmd(),
		agentsCmd(),
		dispatchCmd(),
		watchCmd(),
		tasksCmd(),
		canvasCmd(),
		workflowsCmd(),
		cronCmd(),
		filesCmd(),
		milestonesCmd(),
		metricsCmd(),
	)

	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}
