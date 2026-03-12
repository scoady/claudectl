package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/scoady/claudectl/internal/server"
	"github.com/scoady/claudectl/internal/telemetry"
	"github.com/spf13/cobra"
	"go.opentelemetry.io/otel"
)

func serveCmd() *cobra.Command {
	var addr string

	cmd := &cobra.Command{
		Use:   "serve",
		Short: "Start the API server",
		Long:  "Start the c9s API server that manages projects, agents, and WebSocket connections.",
		RunE: func(cmd *cobra.Command, args []string) error {
			// Initialize OpenTelemetry
			tel, err := telemetry.Init()
			if err != nil {
				log.Printf("[telemetry] init error (continuing without OTel): %v", err)
			} else {
				defer func() {
					ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
					defer cancel()
					tel.Shutdown(ctx)
				}()
			}

			s := server.New(server.Config{
				ProjectsDir: os.Getenv("MANAGED_PROJECTS_DIR"),
			})
			s.StaticFS = server.DashboardFS()

			// Wire OTel instruments if telemetry initialized
			if tel != nil {
				meter := otel.GetMeterProvider().Meter("claudectl")
				instruments, err := telemetry.NewInstruments(meter)
				if err != nil {
					log.Printf("[telemetry] instruments error: %v", err)
				} else {
					s.OTelInstruments = instruments
				}
			}

			fmt.Printf("c9s server listening on %s\n", addr)
			return s.ListenAndServeAddr(addr)
		},
	}

	cmd.Flags().StringVar(&addr, "addr", ":4040", "Listen address")

	return cmd
}
