package tui

import (
	"sync"
	"time"
)

// MetricPoint is a single timestamped measurement.
type MetricPoint struct {
	Time  time.Time
	Value float64
}

// MetricSeries is a named, bounded ring of MetricPoints.
type MetricSeries struct {
	Name   string
	Points []MetricPoint
	MaxLen int
}

// Push appends a point, evicting the oldest if over capacity.
func (s *MetricSeries) Push(p MetricPoint) {
	s.Points = append(s.Points, p)
	if s.MaxLen > 0 && len(s.Points) > s.MaxLen {
		s.Points = s.Points[len(s.Points)-s.MaxLen:]
	}
}

// MetricsStore is a concurrency-safe collection of named time-series.
type MetricsStore struct {
	mu     sync.Mutex
	series map[string]*MetricSeries
}

// NewMetricsStore creates an empty store.
func NewMetricsStore() *MetricsStore {
	return &MetricsStore{
		series: make(map[string]*MetricSeries),
	}
}

// Record adds a value to the named series (creates it if needed).
func (ms *MetricsStore) Record(name string, value float64) {
	ms.mu.Lock()
	defer ms.mu.Unlock()
	s, ok := ms.series[name]
	if !ok {
		s = &MetricSeries{Name: name, MaxLen: 1024}
		ms.series[name] = s
	}
	s.Push(MetricPoint{Time: time.Now(), Value: value})
}

// Query returns points for the named series since the given time.
func (ms *MetricsStore) Query(name string, since time.Time) []MetricPoint {
	ms.mu.Lock()
	defer ms.mu.Unlock()
	s, ok := ms.series[name]
	if !ok {
		return nil
	}
	var out []MetricPoint
	for _, p := range s.Points {
		if !p.Time.Before(since) {
			out = append(out, p)
		}
	}
	return out
}

// Rate computes the per-second rate of change over the given window.
func (ms *MetricsStore) Rate(name string, window time.Duration) float64 {
	pts := ms.Query(name, time.Now().Add(-window))
	if len(pts) < 2 {
		return 0
	}
	first := pts[0]
	last := pts[len(pts)-1]
	dt := last.Time.Sub(first.Time).Seconds()
	if dt == 0 {
		return 0
	}
	return (last.Value - first.Value) / dt
}

// Sum returns the sum of all values in the given window.
func (ms *MetricsStore) Sum(name string, window time.Duration) float64 {
	pts := ms.Query(name, time.Now().Add(-window))
	var total float64
	for _, p := range pts {
		total += p.Value
	}
	return total
}

// Last returns the most recent value for the named series, or 0.
func (ms *MetricsStore) Last(name string) float64 {
	ms.mu.Lock()
	defer ms.mu.Unlock()
	s, ok := ms.series[name]
	if !ok || len(s.Points) == 0 {
		return 0
	}
	return s.Points[len(s.Points)-1].Value
}

// SeriesNames returns all recorded series names.
func (ms *MetricsStore) SeriesNames() []string {
	ms.mu.Lock()
	defer ms.mu.Unlock()
	names := make([]string, 0, len(ms.series))
	for n := range ms.series {
		names = append(names, n)
	}
	return names
}
