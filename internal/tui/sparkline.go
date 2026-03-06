package tui

import (
	"sync"
	"time"

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
var sparkChars = []rune{'▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'}

// RenderSparkline renders a sparkline string from a slice of integer values.
// The width parameter limits how many data points are shown (rightmost wins).
// If width <= 0 it shows all values.
func RenderSparkline(values []int, width int) string {
	if len(values) == 0 {
		return FaintStyle.Render("▁")
	}

	// Trim to width
	if width > 0 && len(values) > width {
		values = values[len(values)-width:]
	}

	// Find max for normalization
	maxVal := 0
	for _, v := range values {
		if v > maxVal {
			maxVal = v
		}
	}
	if maxVal == 0 {
		// All zeros — render flat baseline
		s := ""
		for range values {
			s += string(sparkChars[0])
		}
		return FaintStyle.Render(s)
	}

	// Build sparkline
	out := make([]rune, len(values))
	for i, v := range values {
		// Map value to 0..7 range
		idx := v * 7 / maxVal
		if idx > 7 {
			idx = 7
		}
		out[i] = sparkChars[idx]
	}

	return SparkStyle.Render(string(out))
}

// RenderSparklineStyled renders with explicit foreground color.
func RenderSparklineStyled(values []int, width int, fg lipgloss.Color) string {
	if len(values) == 0 {
		return FaintStyle.Render("▁")
	}

	if width > 0 && len(values) > width {
		values = values[len(values)-width:]
	}

	maxVal := 0
	for _, v := range values {
		if v > maxVal {
			maxVal = v
		}
	}
	if maxVal == 0 {
		s := ""
		for range values {
			s += string(sparkChars[0])
		}
		return FaintStyle.Render(s)
	}

	out := make([]rune, len(values))
	for i, v := range values {
		idx := v * 7 / maxVal
		if idx > 7 {
			idx = 7
		}
		out[i] = sparkChars[idx]
	}

	return lipgloss.NewStyle().Foreground(fg).Render(string(out))
}
