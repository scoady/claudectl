package metrics

import (
	"sync"
	"time"
)

// MetricPoint is a single timestamped measurement with optional labels.
type MetricPoint struct {
	Time   time.Time         `json:"time"`
	Value  float64           `json:"value"`
	Labels map[string]string `json:"labels,omitempty"`
}

// metricSeries is a bounded ring of MetricPoints.
type metricSeries struct {
	points []MetricPoint
	maxLen int
}

func (s *metricSeries) push(p MetricPoint) {
	s.points = append(s.points, p)
	if s.maxLen > 0 && len(s.points) > s.maxLen {
		s.points = s.points[len(s.points)-s.maxLen:]
	}
}

// Store is a concurrency-safe collection of named time-series.
type Store struct {
	mu     sync.Mutex
	series map[string]*metricSeries
	maxLen int
}

// NewStore creates an empty metrics store with a default ring buffer size.
func NewStore() *Store {
	return &Store{
		series: make(map[string]*metricSeries),
		maxLen: 4096,
	}
}

// Record adds a value to the named series. Optional label pairs are given as
// alternating key, value strings (e.g., Record("foo", 1.0, "direction", "input")).
func (s *Store) Record(name string, value float64, labels ...string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	ser, ok := s.series[name]
	if !ok {
		ser = &metricSeries{maxLen: s.maxLen}
		s.series[name] = ser
	}

	p := MetricPoint{Time: time.Now(), Value: value}
	if len(labels) >= 2 {
		p.Labels = make(map[string]string)
		for i := 0; i+1 < len(labels); i += 2 {
			p.Labels[labels[i]] = labels[i+1]
		}
	}

	ser.push(p)
}

// Query returns all points for the named series since the given time.
func (s *Store) Query(name string, since time.Time) []MetricPoint {
	s.mu.Lock()
	defer s.mu.Unlock()

	ser, ok := s.series[name]
	if !ok {
		return nil
	}

	var out []MetricPoint
	for _, p := range ser.points {
		if !p.Time.Before(since) {
			out = append(out, p)
		}
	}
	return out
}

// Snapshot returns downsampled points for the named series, bucketed by resolution.
// Within each bucket the values are summed.
func (s *Store) Snapshot(name string, since time.Time, resolution time.Duration) []MetricPoint {
	points := s.Query(name, since)
	if len(points) == 0 {
		return nil
	}

	if resolution <= 0 {
		return points
	}

	var out []MetricPoint
	bucketStart := points[0].Time.Truncate(resolution)
	bucketSum := 0.0
	bucketCount := 0

	for _, p := range points {
		bucket := p.Time.Truncate(resolution)
		if bucket != bucketStart {
			if bucketCount > 0 {
				out = append(out, MetricPoint{
					Time:  bucketStart,
					Value: bucketSum,
				})
			}
			bucketStart = bucket
			bucketSum = 0
			bucketCount = 0
		}
		bucketSum += p.Value
		bucketCount++
	}

	if bucketCount > 0 {
		out = append(out, MetricPoint{
			Time:  bucketStart,
			Value: bucketSum,
		})
	}

	return out
}

// Sum returns the sum of all values in the named series since the given time.
func (s *Store) Sum(name string, since time.Time) float64 {
	points := s.Query(name, since)
	var total float64
	for _, p := range points {
		total += p.Value
	}
	return total
}

// Last returns the most recent value for the named series, or 0.
func (s *Store) Last(name string) float64 {
	s.mu.Lock()
	defer s.mu.Unlock()
	ser, ok := s.series[name]
	if !ok || len(ser.points) == 0 {
		return 0
	}
	return ser.points[len(ser.points)-1].Value
}

// Count returns the number of points in the named series since the given time.
func (s *Store) Count(name string, since time.Time) int {
	return len(s.Query(name, since))
}
