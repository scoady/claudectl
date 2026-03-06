// Package tui provides the interactive terminal UI for c9s.
package tui

import (
	"strings"
	"time"

	"github.com/NimbleMarkets/ntcharts/barchart"
	"github.com/NimbleMarkets/ntcharts/canvas/runes"
	"github.com/NimbleMarkets/ntcharts/heatmap"
	"github.com/NimbleMarkets/ntcharts/linechart/streamlinechart"
	"github.com/NimbleMarkets/ntcharts/linechart/timeserieslinechart"
	ntsparkline "github.com/NimbleMarkets/ntcharts/sparkline"

	"github.com/charmbracelet/lipgloss"
)

// ChartType identifies the underlying ntcharts chart kind.
type ChartType int

const (
	ChartSparkline ChartType = iota
	ChartBar
	ChartStream
	ChartTimeSeries
	ChartHeatMap
)

// ChartPanel wraps an ntcharts chart with a titled border and theme-aware colors.
// Any screen can embed a ChartPanel for composable, resize-aware chart rendering.
type ChartPanel struct {
	Title     string
	Width     int
	Height    int
	chartType ChartType

	// Underlying chart models (only one is active per panel)
	sparkline  *ntsparkline.Model
	bar        *barchart.Model
	stream     *streamlinechart.Model
	timeSeries *timeserieslinechart.Model
	heatMap    *heatmap.Model

	// Track series index for multi-series color assignment
	seriesIdx map[string]int
}

// ── Constructors ─────────────────────────────────────────────────────────────

// NewSparklineChart creates a sparkline panel using braille rendering for smooth curves.
func NewSparklineChart(title string, w, h int) *ChartPanel {
	innerW, innerH := chartInnerSize(w, h)
	sl := ntsparkline.New(innerW, innerH,
		ntsparkline.WithStyle(lipgloss.NewStyle().Foreground(Cyan)),
	)
	return &ChartPanel{
		Title:     title,
		Width:     w,
		Height:    h,
		chartType: ChartSparkline,
		sparkline: &sl,
		seriesIdx: make(map[string]int),
	}
}

// NewBarChart creates a bar chart panel with auto-scaling bars.
func NewBarChart(title string, w, h int) *ChartPanel {
	innerW, innerH := chartInnerSize(w, h)
	bc := barchart.New(innerW, innerH,
		barchart.WithStyles(
			lipgloss.NewStyle().Foreground(Dim),
			lipgloss.NewStyle().Foreground(SubText),
		),
	)
	return &ChartPanel{
		Title:     title,
		Width:     w,
		Height:    h,
		chartType: ChartBar,
		bar:       &bc,
		seriesIdx: make(map[string]int),
	}
}

// NewStreamChart creates a streaming line chart (data flows right to left).
// Good for real-time metrics like agent count, CPU, etc.
func NewStreamChart(title string, w, h int) *ChartPanel {
	innerW, innerH := chartInnerSize(w, h)
	sc := streamlinechart.New(innerW, innerH,
		streamlinechart.WithAxesStyles(
			lipgloss.NewStyle().Foreground(Dim),
			lipgloss.NewStyle().Foreground(SubText),
		),
	)
	sc.SetStyles(runes.ArcLineStyle, lipgloss.NewStyle().Foreground(Cyan))
	return &ChartPanel{
		Title:     title,
		Width:     w,
		Height:    h,
		chartType: ChartStream,
		stream:    &sc,
		seriesIdx: make(map[string]int),
	}
}

// NewTimeSeriesChart creates a time-series chart with time X axis.
// Supports braille rendering for smooth curves.
func NewTimeSeriesChart(title string, w, h int) *ChartPanel {
	innerW, innerH := chartInnerSize(w, h)
	tsc := timeserieslinechart.New(innerW, innerH,
		timeserieslinechart.WithXLabelFormatter(timeserieslinechart.HourTimeLabelFormatter()),
	)
	tsc.SetStyle(lipgloss.NewStyle().Foreground(Cyan))
	return &ChartPanel{
		Title:      title,
		Width:      w,
		Height:     h,
		chartType:  ChartTimeSeries,
		timeSeries: &tsc,
		seriesIdx:  make(map[string]int),
	}
}

// NewHeatMap creates a heat map panel with theme-aware color gradients.
func NewHeatMap(title string, w, h int) *ChartPanel {
	innerW, innerH := chartInnerSize(w, h)
	hm := heatmap.New(innerW, innerH,
		heatmap.WithColorScale(HeatMapColorScale()),
	)
	return &ChartPanel{
		Title:     title,
		Width:     w,
		Height:    h,
		chartType: ChartHeatMap,
		heatMap:   &hm,
		seriesIdx: make(map[string]int),
	}
}

// ── Data Push Methods ────────────────────────────────────────────────────────

// Push adds a single float64 value to the chart.
// For sparklines: appends to the data buffer.
// For stream charts: pushes to the default data set.
func (p *ChartPanel) Push(value float64) {
	switch p.chartType {
	case ChartSparkline:
		p.sparkline.Push(value)
	case ChartStream:
		p.stream.Push(value)
	}
}

// PushSeries adds a value to a named series (for multi-series stream charts).
func (p *ChartPanel) PushSeries(name string, value float64) {
	if p.chartType != ChartStream {
		return
	}
	// Assign color to new series
	if _, ok := p.seriesIdx[name]; !ok {
		idx := len(p.seriesIdx)
		p.seriesIdx[name] = idx
		p.stream.SetDataSetStyles(name, runes.ArcLineStyle, ChartStyle(idx))
	}
	p.stream.PushDataSet(name, value)
}

// PushTimeSeries adds a time-stamped value to a named series.
func (p *ChartPanel) PushTimeSeries(name string, t time.Time, value float64) {
	if p.chartType != ChartTimeSeries {
		return
	}
	// Assign color to new series
	if _, ok := p.seriesIdx[name]; !ok {
		idx := len(p.seriesIdx)
		p.seriesIdx[name] = idx
		p.timeSeries.SetDataSetStyle(name, ChartStyle(idx))
	}
	p.timeSeries.PushDataSet(name, timeserieslinechart.TimePoint{
		Time:  t,
		Value: value,
	})
}

// PushBar adds a labeled bar with one or more segments.
func (p *ChartPanel) PushBar(label string, values []float64) {
	if p.chartType != ChartBar {
		return
	}
	barValues := make([]barchart.BarValue, len(values))
	for i, v := range values {
		barValues[i] = barchart.BarValue{
			Name:  label,
			Value: v,
			Style: ChartStyle(i),
		}
	}
	p.bar.Push(barchart.BarData{
		Label:  label,
		Values: barValues,
	})
}

// PushHeatPoint adds a heat map data point.
func (p *ChartPanel) PushHeatPoint(x, y, value float64) {
	if p.chartType != ChartHeatMap {
		return
	}
	p.heatMap.Push(heatmap.NewHeatPoint(x, y, value))
}

// SetData replaces all sparkline data with the given slice.
func (p *ChartPanel) SetData(data []float64) {
	if p.chartType != ChartSparkline {
		return
	}
	p.sparkline.Clear()
	p.sparkline.PushAll(data)
}

// ── Resize ───────────────────────────────────────────────────────────────────

// Resize updates the panel and underlying chart dimensions.
func (p *ChartPanel) Resize(w, h int) {
	p.Width = w
	p.Height = h
	innerW, innerH := chartInnerSize(w, h)
	if innerW < 2 {
		innerW = 2
	}
	if innerH < 1 {
		innerH = 1
	}
	switch p.chartType {
	case ChartSparkline:
		p.sparkline.Resize(innerW, innerH)
	case ChartBar:
		p.bar.Resize(innerW, innerH)
	case ChartStream:
		p.stream.Resize(innerW, innerH)
	case ChartTimeSeries:
		p.timeSeries.Resize(innerW, innerH)
	case ChartHeatMap:
		p.heatMap.Resize(innerW, innerH)
	}
}

// ── Clear ────────────────────────────────────────────────────────────────────

// Clear resets all chart data.
func (p *ChartPanel) Clear() {
	switch p.chartType {
	case ChartSparkline:
		p.sparkline.Clear()
	case ChartBar:
		p.bar.Clear()
	case ChartStream:
		p.stream.ClearAllData()
	case ChartTimeSeries:
		p.timeSeries.ClearAllData()
	case ChartHeatMap:
		p.heatMap.ClearData()
	}
}

// ── Rendering ────────────────────────────────────────────────────────────────

// View renders the chart with a themed title border.
func (p *ChartPanel) View() string {
	// Draw the chart content
	chartContent := p.renderChart()

	// Wrap in a titled border panel
	return p.wrapWithBorder(chartContent)
}

// ViewCompact renders the chart without a border, just the title and chart.
// Useful for inline/embedded charts in dashboards.
func (p *ChartPanel) ViewCompact() string {
	chartContent := p.renderChart()
	if p.Title == "" {
		return chartContent
	}
	titleStr := lipgloss.NewStyle().
		Foreground(Purple).
		Bold(true).
		Render(p.Title)
	return titleStr + "\n" + chartContent
}

// ViewRaw renders just the chart content with no border or title.
func (p *ChartPanel) ViewRaw() string {
	return p.renderChart()
}

// renderChart draws the underlying ntcharts model and returns its string output.
func (p *ChartPanel) renderChart() string {
	switch p.chartType {
	case ChartSparkline:
		p.sparkline.DrawBraille()
		return p.sparkline.View()
	case ChartBar:
		p.bar.Draw()
		return p.bar.View()
	case ChartStream:
		p.stream.DrawAll()
		return p.stream.View()
	case ChartTimeSeries:
		p.timeSeries.DrawBrailleAll()
		return p.timeSeries.View()
	case ChartHeatMap:
		p.heatMap.Draw()
		return p.heatMap.View()
	}
	return ""
}

// wrapWithBorder renders the chart content inside a subtle rounded border
// with the title in the top-left.
func (p *ChartPanel) wrapWithBorder(content string) string {
	// Title styled in purple bold
	titleStr := ""
	if p.Title != "" {
		titleStr = lipgloss.NewStyle().
			Foreground(Purple).
			Bold(true).
			Render(" " + p.Title + " ")
	}

	// Build the border manually for maximum control over title placement.
	borderColor := lipgloss.NewStyle().Foreground(BorderColor)
	innerWidth := p.Width - 4 // account for border + padding
	if innerWidth < 1 {
		innerWidth = 1
	}

	var b strings.Builder

	// Top border with title
	topLeft := borderColor.Render("╭─")
	topRight := borderColor.Render("─╮")
	titleWidth := lipgloss.Width(titleStr)
	remainingWidth := innerWidth - titleWidth
	if remainingWidth < 0 {
		remainingWidth = 0
	}
	topFill := borderColor.Render(strings.Repeat("─", remainingWidth))
	b.WriteString(topLeft + titleStr + topFill + topRight + "\n")

	// Content lines with side borders
	lines := strings.Split(content, "\n")
	side := borderColor.Render("│")
	for _, line := range lines {
		lineWidth := lipgloss.Width(line)
		padding := innerWidth + 2 - lineWidth // +2 for single space padding on each side
		if padding < 0 {
			padding = 0
		}
		b.WriteString(side + " " + line + strings.Repeat(" ", padding) + " " + side + "\n")
	}

	// Bottom border
	bottomLeft := borderColor.Render("╰")
	bottomRight := borderColor.Render("╯")
	bottomFill := borderColor.Render(strings.Repeat("─", innerWidth+2))
	b.WriteString(bottomLeft + bottomFill + bottomRight)

	return b.String()
}

// chartInnerSize computes the drawable area inside the border.
// Border takes 2 chars width (left+right) + 2 padding, 2 chars height (top+bottom).
func chartInnerSize(w, h int) (int, int) {
	innerW := w - 4
	innerH := h - 2
	if innerW < 2 {
		innerW = 2
	}
	if innerH < 1 {
		innerH = 1
	}
	return innerW, innerH
}
