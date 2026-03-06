package tui

import (
	"sync"
	"time"

	ntsparkline "github.com/NimbleMarkets/ntcharts/sparkline"

	"github.com/charmbracelet/lipgloss"
)

// SparklineTracker tracks tool-call events per minute for an agent
// and renders a sparkline chart showing activity over time.
type SparklineTracker struct {
	mu      sync.Mutex
	buckets []int // each bucket = 1 minute of tool calls
	current int   // events in the current bucket
	last    time.Time
	maxLen  int // max number of buckets to keep
}

// NewSparklineTracker creates a tracker that keeps up to maxLen minutes of history.
func NewSparklineTracker(maxLen int) *SparklineTracker {
	if maxLen < 1 {
		maxLen = 20
	}
	return &SparklineTracker{
		buckets: make([]int, 0, maxLen),
		last:    time.Now(),
		maxLen:  maxLen,
	}
}

// Record registers a tool-call event.
func (s *SparklineTracker) Record() {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	elapsed := now.Sub(s.last)

	// Roll over buckets if a minute has passed
	minutesElapsed := int(elapsed.Minutes())
	if minutesElapsed > 0 {
		// Push the current bucket
		s.buckets = append(s.buckets, s.current)
		// Fill in any empty minutes
		for i := 1; i < minutesElapsed && i < s.maxLen; i++ {
			s.buckets = append(s.buckets, 0)
		}
		s.current = 0
		s.last = now
		// Trim to maxLen
		if len(s.buckets) > s.maxLen {
			s.buckets = s.buckets[len(s.buckets)-s.maxLen:]
		}
	}

	s.current++
}

// Values returns all bucket values plus the current in-progress bucket.
func (s *SparklineTracker) Values() []int {
	s.mu.Lock()
	defer s.mu.Unlock()

	out := make([]int, len(s.buckets)+1)
	copy(out, s.buckets)
	out[len(out)-1] = s.current
	return out
}

// sparkChars are the Unicode block elements for sparkline rendering, 8 levels.
// Kept for backward compatibility with the simple Sparkline() function in styles.go.
var sparkChars = []rune{'\u2581', '\u2582', '\u2583', '\u2584', '\u2585', '\u2586', '\u2587', '\u2588'}

// RenderSparkline renders a sparkline string from a slice of integer values
// using ntcharts braille rendering for smooth curves.
// The width parameter limits how many data points are shown (rightmost wins).
// If width <= 0 it shows all values.
func RenderSparkline(values []int, width int) string {
	return RenderSparklineStyled(values, width, Green)
}

// RenderSparklineStyled renders a braille sparkline with explicit foreground color.
func RenderSparklineStyled(values []int, width int, fg lipgloss.Color) string {
	if len(values) == 0 {
		return Class("faint").Render("\u2581")
	}

	// Trim to width
	if width > 0 && len(values) > width {
		values = values[len(values)-width:]
	}

	// Check for all-zero data
	maxVal := 0
	for _, v := range values {
		if v > maxVal {
			maxVal = v
		}
	}
	if maxVal == 0 {
		// All zeros - render a flat baseline using ntcharts
		sl := ntsparkline.New(len(values), 1,
			ntsparkline.WithStyle(lipgloss.NewStyle().Foreground(Faint)),
		)
		data := make([]float64, len(values))
		sl.PushAll(data)
		sl.Draw()
		return sl.View()
	}

	// Convert int values to float64 for ntcharts
	data := make([]float64, len(values))
	for i, v := range values {
		data[i] = float64(v)
	}

	// Use braille rendering for smooth curves (height=2 gives nice resolution)
	height := 2
	if len(values) < 4 {
		height = 1
	}
	sl := ntsparkline.New(len(values), height,
		ntsparkline.WithStyle(lipgloss.NewStyle().Foreground(fg)),
	)
	sl.PushAll(data)
	sl.DrawBraille()
	return sl.View()
}

// RenderSparklineBraille renders a larger braille sparkline at a given width and height.
// Ideal for chart panels and dashboard widgets.
func RenderSparklineBraille(values []int, width, height int, fg lipgloss.Color) string {
	if len(values) == 0 {
		return Class("faint").Render("\u2581")
	}

	// Convert and trim
	if width > 0 && len(values) > width {
		values = values[len(values)-width:]
	}
	data := make([]float64, len(values))
	for i, v := range values {
		data[i] = float64(v)
	}

	sl := ntsparkline.New(width, height,
		ntsparkline.WithStyle(lipgloss.NewStyle().Foreground(fg)),
	)
	sl.PushAll(data)
	sl.DrawBraille()
	return sl.View()
}
