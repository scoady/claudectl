package blocks

import (
	"strings"
	"testing"

	metricscomponent "github.com/scoady/codexctl/internal/tui/components/metrics"
)

func TestRenderCanvasProducesContent(t *testing.T) {
	canvas := NewCanvas(
		12,
		2,
		TelemetryBlock{
			ID:     "stats",
			Title:  "Workspace Telemetry",
			Accent: "#6ad1ff",
			Placement: Placement{
				Col:     0,
				Row:     0,
				ColSpan: 6,
			},
			Sizing: Sizing{MinHeight: 8, PreferredHeight: 8},
			Model: metricscomponent.NewModel([]metricscomponent.Item{
				{Label: "cpu", Value: "17%", Spark: "▁▂▃▄", Color: "#6ad1ff"},
			}, "Fri 11:10"),
			Notes: []string{"workspace tail-follow enabled"},
		},
		MilestonesBlock{
			ID:     "milestones",
			Title:  "Milestones",
			Accent: "#b46cff",
			Placement: Placement{
				Col:     6,
				Row:     0,
				ColSpan: 6,
			},
			Sizing: Sizing{MinHeight: 8, PreferredHeight: 8},
			Milestones: []Milestone{
				{Tag: "v2.0.0", Title: "Workspace Shell", Summary: "Shipped the new docked workspace UI."},
			},
		},
	)

	out := RenderCanvas(canvas, 100, 8, nil)
	if !strings.Contains(out, "Workspace Telemetry") {
		t.Fatalf("expected telemetry block title, got:\n%s", out)
	}
	if !strings.Contains(out, "Milestones") {
		t.Fatalf("expected milestones block title, got:\n%s", out)
	}
}
