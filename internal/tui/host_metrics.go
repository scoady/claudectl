package tui

import (
	"fmt"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
)

type workspaceHostMetrics struct {
	CPUPercent    float64
	MemoryPercent float64
	DiskPercent   float64
	NetKBps       float64
	NetBytesTotal uint64
	SampledAt     time.Time
	Ready         bool
}

type HostMetricsMsg struct {
	Metrics workspaceHostMetrics
	Err     error
}

func FetchHostMetricsCmd(previous workspaceHostMetrics) tea.Cmd {
	return func() tea.Msg {
		metrics, err := sampleHostMetrics(previous)
		if err != nil {
			return HostMetricsMsg{Err: err}
		}
		return HostMetricsMsg{Metrics: metrics}
	}
}

func sampleHostMetrics(previous workspaceHostMetrics) (workspaceHostMetrics, error) {
	if runtime.GOOS != "darwin" {
		return workspaceHostMetrics{}, nil
	}

	now := time.Now()
	cpu, _ := sampleCPUPercent()
	mem, _ := sampleMemoryPercent()
	disk, _ := sampleDiskPercent()
	netTotal, _ := sampleNetworkBytes()

	netKBps := 0.0
	if previous.NetBytesTotal > 0 && !previous.SampledAt.IsZero() && netTotal >= previous.NetBytesTotal {
		seconds := now.Sub(previous.SampledAt).Seconds()
		if seconds > 0 {
			netKBps = float64(netTotal-previous.NetBytesTotal) / seconds / 1024.0
		}
	}

	return workspaceHostMetrics{
		CPUPercent:    cpu,
		MemoryPercent: mem,
		DiskPercent:   disk,
		NetKBps:       netKBps,
		NetBytesTotal: netTotal,
		SampledAt:     now,
		Ready:         cpu > 0 || mem > 0 || disk > 0 || netTotal > 0,
	}, nil
}

func sampleCPUPercent() (float64, error) {
	out, err := runHostCommand("top", "-l", "1", "-n", "0")
	if err != nil {
		return 0, err
	}
	for _, line := range strings.Split(out, "\n") {
		if !strings.Contains(line, "CPU usage:") || !strings.Contains(line, "idle") {
			continue
		}
		idleIdx := strings.Index(line, "% idle")
		if idleIdx < 0 {
			continue
		}
		prefix := line[:idleIdx]
		start := strings.LastIndex(prefix, ",")
		if start >= 0 {
			prefix = prefix[start+1:]
		}
		prefix = strings.TrimSpace(strings.TrimSuffix(prefix, "%"))
		prefix = strings.TrimSuffix(prefix, "idle")
		prefix = strings.TrimSpace(prefix)
		idle, parseErr := strconv.ParseFloat(prefix, 64)
		if parseErr == nil {
			return clampFloat(100.0-idle, 0, 100), nil
		}
	}
	return 0, fmt.Errorf("unable to parse CPU usage")
}

func sampleMemoryPercent() (float64, error) {
	out, err := runHostCommand("memory_pressure")
	if err != nil {
		return 0, err
	}
	for _, line := range strings.Split(out, "\n") {
		if !strings.Contains(line, "System-wide memory free percentage:") {
			continue
		}
		parts := strings.Split(line, ":")
		if len(parts) < 2 {
			break
		}
		value := strings.TrimSpace(strings.TrimSuffix(parts[1], "%"))
		free, parseErr := strconv.ParseFloat(value, 64)
		if parseErr == nil {
			return clampFloat(100.0-free, 0, 100), nil
		}
	}
	return 0, fmt.Errorf("unable to parse memory pressure")
}

func sampleDiskPercent() (float64, error) {
	out, err := runHostCommand("df", "-k", "/")
	if err != nil {
		return 0, err
	}
	lines := strings.Split(strings.TrimSpace(out), "\n")
	if len(lines) < 2 {
		return 0, fmt.Errorf("unexpected df output")
	}
	fields := strings.Fields(lines[len(lines)-1])
	if len(fields) < 5 {
		return 0, fmt.Errorf("unexpected df fields")
	}
	value := strings.TrimSpace(strings.TrimSuffix(fields[4], "%"))
	pct, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return 0, err
	}
	return clampFloat(pct, 0, 100), nil
}

func sampleNetworkBytes() (uint64, error) {
	out, err := runHostCommand("netstat", "-ibn")
	if err != nil {
		return 0, err
	}
	lines := strings.Split(strings.TrimSpace(out), "\n")
	if len(lines) < 2 {
		return 0, fmt.Errorf("unexpected netstat output")
	}

	header := strings.Fields(lines[0])
	iIdx := -1
	oIdx := -1
	for idx, field := range header {
		switch field {
		case "Ibytes":
			iIdx = idx
		case "Obytes":
			oIdx = idx
		}
	}
	if iIdx < 0 || oIdx < 0 {
		return 0, fmt.Errorf("unable to locate netstat byte columns")
	}

	var best uint64
	for _, line := range lines[1:] {
		fields := strings.Fields(line)
		if len(fields) <= max(iIdx, oIdx) {
			continue
		}
		iface := fields[0]
		if iface == "lo0" || strings.HasPrefix(iface, "llw") || strings.HasPrefix(iface, "awdl") {
			continue
		}
		ibytes, errI := strconv.ParseUint(fields[iIdx], 10, 64)
		obytes, errO := strconv.ParseUint(fields[oIdx], 10, 64)
		if errI != nil || errO != nil {
			continue
		}
		total := ibytes + obytes
		if total > best {
			best = total
		}
	}
	if best == 0 {
		return 0, fmt.Errorf("unable to parse network totals")
	}
	return best, nil
}

func runHostCommand(name string, args ...string) (string, error) {
	out, err := exec.Command(name, args...).CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("%s: %w", name, err)
	}
	return string(out), nil
}

func clampFloat(v, lo, hi float64) float64 {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}
