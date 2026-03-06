package main

import (
	"fmt"
	"os"

	"github.com/scoady/claudectl/internal/server"
	"github.com/spf13/cobra"
)

func serveCmd() *cobra.Command {
	var addr string

	cmd := &cobra.Command{
		Use:   "serve",
		Short: "Start the API server",
		Long:  "Start the c9s API server that manages projects, agents, and WebSocket connections.",
		RunE: func(cmd *cobra.Command, args []string) error {
			s := server.New(server.Config{
				ProjectsDir: os.Getenv("MANAGED_PROJECTS_DIR"),
			})
			fmt.Printf("c9s server listening on %s\n", addr)
			return s.ListenAndServeAddr(addr)
		},
	}

	cmd.Flags().StringVar(&addr, "addr", ":4040", "Listen address")

	return cmd
}
