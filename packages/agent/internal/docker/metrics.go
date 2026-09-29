package docker

import (
	"bufio"
	"errors"
	"os"
	"runtime"
	"strconv"
	"strings"

	"github.com/selfyurt/selfyurt/packages/agent/internal/types"
)

func CollectMetrics() (types.MetricsResponse, error) {
	cpuPercent := estimateCPUPercent()
	memoryPercent, err := memoryUsagePercent()
	if err != nil {
		return types.MetricsResponse{}, err
	}

	diskPercent, err := diskUsagePercent("/")
	if err != nil {
		return types.MetricsResponse{}, err
	}

	return types.MetricsResponse{
		CPUPercent:    cpuPercent,
		MemoryPercent: memoryPercent,
		DiskPercent:   diskPercent,
	}, nil
}

func estimateCPUPercent() float64 {
	loadAvgContent, err := os.ReadFile("/proc/loadavg")
	if err != nil {
		return 0
	}

	parts := strings.Fields(string(loadAvgContent))
	if len(parts) == 0 {
		return 0
	}

	oneMinuteLoad, err := strconv.ParseFloat(parts[0], 64)
	if err != nil {
		return 0
	}

	cores := runtime.NumCPU()
	if cores <= 0 {
		return 0
	}

	percent := (oneMinuteLoad / float64(cores)) * 100
	if percent < 0 {
		return 0
	}
	if percent > 100 {
		return 100
	}
	return percent
}

func memoryUsagePercent() (float64, error) {
	file, err := os.Open("/proc/meminfo")
	if err != nil {
		return 0, err
	}
	defer file.Close()

	var total, available float64
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "MemTotal:") {
			total = parseMeminfoLine(line)
		}
		if strings.HasPrefix(line, "MemAvailable:") {
			available = parseMeminfoLine(line)
		}
	}

	if err := scanner.Err(); err != nil {
		return 0, err
	}

	if total == 0 {
		return 0, errors.New("memtotal is zero")
	}

	used := total - available
	if used < 0 {
		used = 0
	}

	return (used / total) * 100, nil
}

func parseMeminfoLine(line string) float64 {
	fields := strings.Fields(line)
	if len(fields) < 2 {
		return 0
	}

	value, err := strconv.ParseFloat(fields[1], 64)
	if err != nil {
		return 0
	}

	return value
}
