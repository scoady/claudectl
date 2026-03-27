package main

import (
	"fmt"

	"github.com/scoady/codexctl/internal/auth"
	"github.com/spf13/cobra"
)

func authCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "auth",
		Short: "Inspect auth providers and capabilities used by tool plugins",
	}
	cmd.AddCommand(authStatusCmd())
	return cmd
}

func authStatusCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "status",
		Short: "Show currently available provider capabilities",
		RunE: func(cmd *cobra.Command, args []string) error {
			statuses := auth.ProviderStatuses()
			for _, status := range statuses {
				fmt.Printf("%s\n", status.Capability)
				fmt.Printf("  provider:  %s\n", status.Provider)
				if status.Source != "" {
					fmt.Printf("  source:    %s\n", status.Source)
				}
				if status.Available {
					fmt.Printf("  available: yes\n")
				} else {
					fmt.Printf("  available: no\n")
				}
				if status.Detail != "" {
					fmt.Printf("  detail:    %s\n", status.Detail)
				}
			}
			return nil
		},
	}
}
