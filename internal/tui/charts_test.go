package tui

import (
	"strings"
	"testing"
	"time"
)

func TestNewSparklineChart(t *testing.T) {
	p := NewSparklineChart("Activity", 30, 5)
	if p == nil {
		t.Fatal("NewSparklineChart returned nil")
	}
	if p.Title != "Activity" {
		t.Errorf("expected title 'Activity', got %q", p.Title)
	}
	if p.chartType != ChartSparkline {
		t.Errorf("expected ChartSparkline type")
	}

	// Push some data and render
	for i := 0; i < 20; i++ {
		p.Push(float64(i * 3))
	}
	view := p.View()
	if len(view) == 0 {
		t.Error("sparkline View() returned empty string")
	}
	// Should contain the title
	if !strings.Contains(view, "Activity") {
		t.Error("View() should contain the title")
	}
	// Should contain border characters
	if !strings.Contains(view, "\u256d") { // ╭
		t.Error("View() should contain rounded border")
	}
}

func TestNewBarChart(t *testing.T) {
	p := NewBarChart("Models", 40, 8)
	if p == nil {
		t.Fatal("NewBarChart returned nil")
	}

	p.PushBar("sonnet", []float64{42})
	p.PushBar("opus", []float64{15})
	p.PushBar("haiku", []float64{8})

	view := p.View()
	if len(view) == 0 {
		t.Error("bar chart View() returned empty string")
	}
}

func TestNewStreamChart(t *testing.T) {
	p := NewStreamChart("CPU", 40, 6)
	if p == nil {
		t.Fatal("NewStreamChart returned nil")
	}

	// Push single series
	for i := 0; i < 30; i++ {
		p.Push(float64(i%10) + 1)
	}
	view := p.View()
	if len(view) == 0 {
		t.Error("stream chart View() returned empty string")
	}

	// Push named series
	p2 := NewStreamChart("Multi", 40, 6)
	for i := 0; i < 20; i++ {
		p2.PushSeries("alpha", float64(i))
		p2.PushSeries("beta", float64(20-i))
	}
	view2 := p2.View()
	if len(view2) == 0 {
		t.Error("multi-series stream chart View() returned empty string")
	}
}

func TestNewTimeSeriesChart(t *testing.T) {
	p := NewTimeSeriesChart("Cost", 50, 8)
	if p == nil {
		t.Fatal("NewTimeSeriesChart returned nil")
	}

	now := time.Now()
	for i := 0; i < 20; i++ {
		t0 := now.Add(-time.Duration(20-i) * time.Minute)
		p.PushTimeSeries("cost", t0, float64(i)*0.5)
	}

	view := p.View()
	if len(view) == 0 {
		t.Error("time series chart View() returned empty string")
	}
}

func TestNewHeatMap(t *testing.T) {
	p := NewHeatMap("Activity Grid", 30, 8)
	if p == nil {
		t.Fatal("NewHeatMap returned nil")
	}

	for x := 0; x < 10; x++ {
		for y := 0; y < 5; y++ {
			p.PushHeatPoint(float64(x), float64(y), float64(x*y))
		}
	}

	view := p.View()
	if len(view) == 0 {
		t.Error("heat map View() returned empty string")
	}
}

func TestChartResize(t *testing.T) {
	p := NewSparklineChart("Resize Test", 20, 4)
	p.Push(1)
	p.Push(5)
	p.Push(3)

	// Render at original size
	v1 := p.View()
	if len(v1) == 0 {
		t.Error("initial View() empty")
	}

	// Resize larger
	p.Resize(40, 8)
	v2 := p.View()
	if len(v2) == 0 {
		t.Error("resized View() empty")
	}
}

func TestSetData(t *testing.T) {
	p := NewSparklineChart("Data Replace", 20, 4)
	p.SetData([]float64{1, 2, 3, 4, 5})
	view := p.View()
	if len(view) == 0 {
		t.Error("SetData View() empty")
	}

	// Replace data
	p.SetData([]float64{10, 8, 6, 4, 2})
	view2 := p.View()
	if len(view2) == 0 {
		t.Error("replaced SetData View() empty")
	}
}

func TestChartClear(t *testing.T) {
	p := NewStreamChart("Clear Test", 20, 4)
	p.Push(5)
	p.Push(10)
	p.Clear()

	// Should still render without panic
	view := p.View()
	if len(view) == 0 {
		t.Error("cleared View() empty")
	}
}

func TestViewCompact(t *testing.T) {
	p := NewSparklineChart("Compact", 20, 4)
	p.Push(3)
	p.Push(7)

	view := p.ViewCompact()
	if !strings.Contains(view, "Compact") {
		t.Error("ViewCompact should contain title")
	}
	// Compact should NOT have border chars
	if strings.Contains(view, "\u256d") { // ╭
		t.Error("ViewCompact should not have border")
	}
}

func TestViewRaw(t *testing.T) {
	p := NewSparklineChart("Raw", 20, 4)
	p.Push(3)

	view := p.ViewRaw()
	if strings.Contains(view, "Raw") {
		t.Error("ViewRaw should not contain title")
	}
}

func TestChartPalette(t *testing.T) {
	palette := ChartPalette()
	if len(palette) < 6 {
		t.Errorf("expected at least 6 palette colors, got %d", len(palette))
	}
}

func TestChartColor(t *testing.T) {
	c0 := ChartColor(0)
	c6 := ChartColor(6) // should wrap around
	if c0 != c6 {
		t.Error("ChartColor should cycle")
	}
}

func TestRenderSparklineBraille(t *testing.T) {
	values := []int{1, 3, 7, 2, 5, 8, 4, 6}
	result := RenderSparklineBraille(values, 20, 2, Cyan)
	if len(result) == 0 {
		t.Error("RenderSparklineBraille returned empty string")
	}
}

func TestRenderSparklineUpgraded(t *testing.T) {
	// Test the upgraded RenderSparkline using ntcharts
	values := []int{0, 1, 3, 7, 5, 2, 8, 4}
	result := RenderSparkline(values, 0)
	if len(result) == 0 {
		t.Error("RenderSparkline returned empty string")
	}

	// Test with zero values
	zeros := []int{0, 0, 0, 0}
	zeroResult := RenderSparkline(zeros, 0)
	if len(zeroResult) == 0 {
		t.Error("RenderSparkline with zeros returned empty string")
	}

	// Test empty
	emptyResult := RenderSparkline(nil, 0)
	if len(emptyResult) == 0 {
		t.Error("RenderSparkline with nil returned empty string")
	}

	// Test styled
	styledResult := RenderSparklineStyled(values, 4, Amber)
	if len(styledResult) == 0 {
		t.Error("RenderSparklineStyled returned empty string")
	}
}
