package main

import (
	"fmt"

	"github.com/scoady/claudectl/internal/tui"
	"github.com/scoady/claudectl/internal/ui"
	"github.com/spf13/cobra"
)

func metricsCmd() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "metrics",
		Short: "View system metrics and time-series data",
		Long:  "Query agent activity, costs, task throughput, model usage, and system health metrics.",
	}

	cmd.AddCommand(
		metricsAgentsCmd(),
		metricsCostsCmd(),
		metricsModelsCmd(),
		metricsHealthCmd(),
		metricsSummaryCmd(),
		metricsTasksCmd(),
		metricsProjectsCmd(),
	)

	return cmd
}

func metricsAgentsCmd() *cobra.Command {
	var since, resolution string

	cmd := &cobra.Command{
		Use:   "agents",
		Short: "Time-series agent activity",
		RunE: func(cmd *cobra.Command, args []string) error {
			data, err := client.GetAgentMetrics(since, resolution)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render("Failed to fetch agent metrics: " + err.Error()))
				return nil
			}

			fmt.Println(ui.SectionHeader("Agent Activity"))

			if len(data) == 0 {
				fmt.Println(ui.Dim.Render("  No data points yet. Snapshots are recorded every 30 seconds."))
				return nil
			}

			var rows [][]string
			for _, d := range data {
				rows = append(rows, []string{
					d.Time,
					ui.StatusWorking.Render(fmt.Sprintf("%d", d.Active)),
					ui.StatusIdle.Render(fmt.Sprintf("%d", d.Idle)),
					ui.Dim.Render(fmt.Sprintf("%d", d.Done)),
					ui.StatusError.Render(fmt.Sprintf("%d", d.Error)),
				})
			}

			fmt.Println(ui.RenderTable(
				[]string{"Time", "Active", "Idle", "Done", "Error"},
				rows,
			))
			return nil
		},
	}

	cmd.Flags().StringVar(&since, "since", "1h", "Time range (e.g. 15m, 1h, 6h, 24h, 7d)")
	cmd.Flags().StringVar(&resolution, "resolution", "1m", "Bucket resolution (e.g. 1m, 5m, 1h)")
	return cmd
}

func metricsCostsCmd() *cobra.Command {
	var since, resolution string

	cmd := &cobra.Command{
		Use:   "costs",
		Short: "Time-series cost accumulation",
		RunE: func(cmd *cobra.Command, args []string) error {
			data, err := client.GetCostMetrics(since, resolution)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render("Failed to fetch cost metrics: " + err.Error()))
				return nil
			}

			fmt.Println(ui.SectionHeader("Cost Metrics"))

			if len(data) == 0 {
				fmt.Println(ui.Dim.Render("  No data points yet."))
				return nil
			}

			var rows [][]string
			for _, d := range data {
				rows = append(rows, []string{
					d.Time,
					tui.FormatCost(d.Cumulative),
					tui.FormatCost(d.Incremental),
				})
			}

			fmt.Println(ui.RenderTable(
				[]string{"Time", "Cumulative", "Incremental"},
				rows,
			))
			return nil
		},
	}

	cmd.Flags().StringVar(&since, "since", "1h", "Time range (e.g. 15m, 1h, 6h, 24h, 7d)")
	cmd.Flags().StringVar(&resolution, "resolution", "5m", "Bucket resolution (e.g. 1m, 5m, 1h)")
	return cmd
}

func metricsTasksCmd() *cobra.Command {
	var since, resolution string

	cmd := &cobra.Command{
		Use:   "tasks",
		Short: "Time-series task throughput",
		RunE: func(cmd *cobra.Command, args []string) error {
			data, err := client.GetTaskMetrics(since, resolution)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render("Failed to fetch task metrics: " + err.Error()))
				return nil
			}

			fmt.Println(ui.SectionHeader("Task Throughput"))

			if len(data) == 0 {
				fmt.Println(ui.Dim.Render("  No data points yet."))
				return nil
			}

			var rows [][]string
			for _, d := range data {
				rows = append(rows, []string{
					d.Time,
					fmt.Sprintf("%d", d.Started),
					ui.SuccessText.Render(fmt.Sprintf("%d", d.Completed)),
					ui.StatusError.Render(fmt.Sprintf("%d", d.Failed)),
				})
			}

			fmt.Println(ui.RenderTable(
				[]string{"Time", "Started", "Completed", "Failed"},
				rows,
			))
			return nil
		},
	}

	cmd.Flags().StringVar(&since, "since", "1h", "Time range (e.g. 15m, 1h, 6h, 24h, 7d)")
	cmd.Flags().StringVar(&resolution, "resolution", "5m", "Bucket resolution (e.g. 1m, 5m, 1h)")
	return cmd
}

func metricsModelsCmd() *cobra.Command {
	var since string

	cmd := &cobra.Command{
		Use:   "models",
		Short: "Model usage breakdown",
		RunE: func(cmd *cobra.Command, args []string) error {
			data, err := client.GetModelUsage(since)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render("Failed to fetch model usage: " + err.Error()))
				return nil
			}

			fmt.Println(ui.SectionHeader("Model Usage"))

			if len(data) == 0 {
				fmt.Println(ui.Dim.Render("  No model usage data yet."))
				return nil
			}

			var rows [][]string
			for _, d := range data {
				rows = append(rows, []string{
					ui.Bold.Render(d.Model),
					fmt.Sprintf("%d", d.Count),
					fmt.Sprintf("%d", d.TotalTurns),
					tui.FormatCost(d.EstimatedCost),
				})
			}

			fmt.Println(ui.RenderTable(
				[]string{"Model", "Agents", "Turns", "Est. Cost"},
				rows,
			))
			return nil
		},
	}

	cmd.Flags().StringVar(&since, "since", "24h", "Time range (e.g. 1h, 6h, 24h, 7d)")
	return cmd
}

func metricsProjectsCmd() *cobra.Command {
	var since, resolution string

	cmd := &cobra.Command{
		Use:   "projects",
		Short: "Per-project activity time-series",
		RunE: func(cmd *cobra.Command, args []string) error {
			data, err := client.GetProjectMetrics(since, resolution)
			if err != nil {
				fmt.Println(ui.ErrorBox.Render("Failed to fetch project metrics: " + err.Error()))
				return nil
			}

			fmt.Println(ui.SectionHeader("Project Activity"))

			if len(data) == 0 {
				fmt.Println(ui.Dim.Render("  No project activity data yet."))
				return nil
			}

			for project, series := range data {
				fmt.Println()
				fmt.Println(ui.Bold.Render("  " + project))

				var rows [][]string
				for _, d := range series {
					rows = append(rows, []string{
						d.Time,
						fmt.Sprintf("%d", d.AgentCount),
						fmt.Sprintf("%d", d.TurnCount),
					})
				}

				fmt.Println(ui.RenderTable(
					[]string{"Time", "Agents", "Turns"},
					rows,
				))
			}
			return nil
		},
	}

	cmd.Flags().StringVar(&since, "since", "1h", "Time range (e.g. 15m, 1h, 6h, 24h, 7d)")
	cmd.Flags().StringVar(&resolution, "resolution", "5m", "Bucket resolution (e.g. 1m, 5m, 1h)")
	return cmd
}

func metricsHealthCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "health",
		Short: "Current system health stats",
		RunE: func(cmd *cobra.Command, args []string) error {
			h, err := client.GetSystemHealth()
			if err != nil {
				fmt.Println(ui.ErrorBox.Render("Failed to fetch system health: " + err.Error()))
				return nil
			}

			fmt.Println(ui.SectionHeader("System Health"))
			fmt.Println(ui.KeyValue("Uptime", h.Uptime))
			fmt.Println(ui.KeyValue("Total Spawned", fmt.Sprintf("%d", h.TotalAgentsSpawned)))
			fmt.Println(ui.KeyValue("Active Agents", ui.StatusWorking.Render(fmt.Sprintf("%d", h.ActiveAgents))))
			fmt.Println(ui.KeyValue("Idle Agents", ui.StatusIdle.Render(fmt.Sprintf("%d", h.IdleAgents))))
			fmt.Println(ui.KeyValue("Error Agents", ui.StatusError.Render(fmt.Sprintf("%d", h.ErrorAgents))))
			fmt.Println(ui.KeyValue("WebSocket Clients", fmt.Sprintf("%d", h.ActiveWS)))
			fmt.Println(ui.KeyValue("Total Turns", fmt.Sprintf("%d", h.TotalTurns)))
			fmt.Println(ui.KeyValue("Cumulative Cost", tui.FormatCost(h.CumulativeCost)))
			fmt.Println(ui.KeyValue("Snapshots", fmt.Sprintf("%d", h.SnapshotCount)))
			fmt.Println()
			return nil
		},
	}
}

func metricsSummaryCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "summary",
		Short: "Quick metrics overview",
		RunE: func(cmd *cobra.Command, args []string) error {
			s, err := client.GetMetricsSummary()
			if err != nil {
				fmt.Println(ui.ErrorBox.Render("Failed to fetch metrics summary: " + err.Error()))
				return nil
			}

			fmt.Println(ui.Banner())
			fmt.Println(ui.SectionHeader("Metrics Summary"))
			fmt.Println(ui.KeyValue("Uptime", s.Uptime))
			fmt.Println(ui.KeyValue("Active Agents", ui.StatusWorking.Render(fmt.Sprintf("%d", s.ActiveAgents))))
			fmt.Println(ui.KeyValue("Idle Agents", ui.StatusIdle.Render(fmt.Sprintf("%d", s.IdleAgents))))
			fmt.Println(ui.KeyValue("Total Spawned", fmt.Sprintf("%d", s.TotalAgentsSpawned)))
			fmt.Println(ui.KeyValue("Total Turns", fmt.Sprintf("%d", s.TotalTurns)))
			fmt.Println(ui.KeyValue("Cumulative Cost", tui.FormatCost(s.CumulativeCost)))
			fmt.Println(ui.KeyValue("WebSocket Clients", fmt.Sprintf("%d", s.ActiveWS)))

			fmt.Println()
			fmt.Println(ui.KeyValue("Tasks Started", fmt.Sprintf("%d", s.TotalTasksStarted)))
			fmt.Println(ui.KeyValue("Tasks Completed", ui.SuccessText.Render(fmt.Sprintf("%d", s.TotalTasksCompleted))))
			fmt.Println(ui.KeyValue("Tasks Failed", ui.StatusError.Render(fmt.Sprintf("%d", s.TotalTasksFailed))))

			if len(s.ModelBreakdown) > 0 {
				fmt.Println()
				fmt.Println(ui.SectionHeader("Models"))
				for model, count := range s.ModelBreakdown {
					fmt.Println(ui.KeyValue(model, fmt.Sprintf("%d agents", count)))
				}
			}

			if len(s.ProjectAgentCounts) > 0 {
				fmt.Println()
				fmt.Println(ui.SectionHeader("Projects"))
				for proj, count := range s.ProjectAgentCounts {
					fmt.Println(ui.KeyValue(proj, fmt.Sprintf("%d agents", count)))
				}
			}

			fmt.Println()
			return nil
		},
	}
}
