// Package main is the entry point for c9s.
package main

import (
	"fmt"
	"os"

	"github.com/scoady/codexctl/internal/api"
	"github.com/scoady/codexctl/internal/tui"
	"github.com/scoady/codexctl/internal/ui"
	"github.com/spf13/cobra"
)

var (
	apiURL string
	client *api.Client
)

func main() {
	var rootCmd *cobra.Command
	rootCmd = &cobra.Command{
		Use:   "c9s",
		Short: "c9s — interactive TUI for Codex Agent Manager",
		Long: ui.Banner() + "\n\n" +
			"A k9s-style interactive terminal interface for the Codex Agent Manager.\n" +
			"Run with no subcommands for the interactive TUI, or use subcommands for CLI mode.",
		PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
			if envURL := os.Getenv("CM_API_URL"); envURL != "" && apiURL == "http://localhost:4040" {
				apiURL = envURL
			}
			if cmd == rootCmd {
				if err := ensureLocalBackendForTUI(apiURL); err != nil {
					return err
				}
			}
			client = api.NewClient(apiURL)
			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			return tui.Run(apiURL, tui.AppOptions{})
		},
		SilenceUsage: true,
	}

	rootCmd.PersistentFlags().StringVar(&apiURL, "api", "http://localhost:4040", "Backend API URL")

	rootCmd.AddCommand(
		authCmd(),
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
		toolsCmd(),
		serveCmd(),
	)

	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
