package telemetry

import (
	"context"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
)

// Instruments holds all OTel metric instruments for claudectl.
type Instruments struct {
	ActiveAgents    metric.Int64UpDownCounter
	SpawnedTotal    metric.Int64Counter
	TaskDuration    metric.Float64Histogram
	TokensTotal     metric.Int64Counter
	CostTotal       metric.Float64Counter
	TurnsTotal      metric.Int64Counter
	ToolInvocations metric.Int64Counter
}

// NewInstruments creates all OTel metric instruments from the given meter.
func NewInstruments(m metric.Meter) (*Instruments, error) {
	activeAgents, err := m.Int64UpDownCounter("claudectl.agents.active",
		metric.WithDescription("Number of currently active agents"),
	)
	if err != nil {
		return nil, err
	}

	spawnedTotal, err := m.Int64Counter("claudectl.agents.spawned_total",
		metric.WithDescription("Total agents spawned"),
	)
	if err != nil {
		return nil, err
	}

	taskDuration, err := m.Float64Histogram("claudectl.task.duration_seconds",
		metric.WithDescription("Duration of agent tasks in seconds"),
		metric.WithExplicitBucketBoundaries(1, 5, 10, 30, 60, 120, 300, 600, 1800),
	)
	if err != nil {
		return nil, err
	}

	tokensTotal, err := m.Int64Counter("claudectl.tokens.estimated_total",
		metric.WithDescription("Estimated total tokens (input or output)"),
	)
	if err != nil {
		return nil, err
	}

	costTotal, err := m.Float64Counter("claudectl.cost.estimated_total_usd",
		metric.WithDescription("Estimated cumulative cost in USD"),
	)
	if err != nil {
		return nil, err
	}

	turnsTotal, err := m.Int64Counter("claudectl.turns.total",
		metric.WithDescription("Total conversation turns"),
	)
	if err != nil {
		return nil, err
	}

	toolInvocations, err := m.Int64Counter("claudectl.tools.invocations_total",
		metric.WithDescription("Total tool invocations"),
	)
	if err != nil {
		return nil, err
	}

	return &Instruments{
		ActiveAgents:    activeAgents,
		SpawnedTotal:    spawnedTotal,
		TaskDuration:    taskDuration,
		TokensTotal:     tokensTotal,
		CostTotal:       costTotal,
		TurnsTotal:      turnsTotal,
		ToolInvocations: toolInvocations,
	}, nil
}

// RecordAgentSpawned increments active and total counters.
func (i *Instruments) RecordAgentSpawned(ctx context.Context) {
	i.ActiveAgents.Add(ctx, 1)
	i.SpawnedTotal.Add(ctx, 1)
}

// RecordAgentDone decrements the active agents counter.
func (i *Instruments) RecordAgentDone(ctx context.Context) {
	i.ActiveAgents.Add(ctx, -1)
}

// RecordTaskDuration records the duration of a completed task in seconds.
func (i *Instruments) RecordTaskDuration(ctx context.Context, seconds float64) {
	i.TaskDuration.Record(ctx, seconds)
}

// RecordTokens records estimated token counts for a direction (input or output).
func (i *Instruments) RecordTokens(ctx context.Context, count int64, direction string) {
	i.TokensTotal.Add(ctx, count, metric.WithAttributes(
		attribute.String("direction", direction),
	))
}

// RecordCost records an incremental cost amount in USD.
func (i *Instruments) RecordCost(ctx context.Context, usd float64) {
	i.CostTotal.Add(ctx, usd)
}

// RecordTurn records a single conversation turn.
func (i *Instruments) RecordTurn(ctx context.Context) {
	i.TurnsTotal.Add(ctx, 1)
}

// RecordToolInvocation records a tool call with the tool's name as an attribute.
func (i *Instruments) RecordToolInvocation(ctx context.Context, toolName string) {
	i.ToolInvocations.Add(ctx, 1, metric.WithAttributes(
		attribute.String("tool.name", toolName),
	))
}
