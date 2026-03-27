package blocks

import (
	metricscomponent "github.com/scoady/codexctl/internal/tui/components/metrics"
)

type TelemetryBlock struct {
	ID        string
	ZoneID    string
	Title     string
	Badge     string
	Accent    string
	Placement Placement
	Sizing    Sizing
	Model     metricscomponent.Model
	Notes     []string
}

func (b TelemetryBlock) BlockID() string           { return b.ID }
func (b TelemetryBlock) BlockPlacement() Placement { return b.Placement }
func (b TelemetryBlock) BlockSizing() Sizing       { return b.Sizing }

func (b TelemetryBlock) BlockHeader() Header {
	return Header{
		ZoneID: b.ZoneID,
		Title:  b.Title,
		Badge:  b.Badge,
		Accent: accentColor(b.Accent),
	}
}

func (b TelemetryBlock) RenderBody(width, height int) []string {
	lines := []string{metricscomponent.Render(b.Model, width)}
	lines = append(lines, "")
	for _, note := range b.Notes {
		lines = append(lines, mutedStyle().Render(note))
	}
	return padOrTrim(lines, height)
}
