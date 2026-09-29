package system

import (
	"context"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"github.com/selfyurt/selfyurt/packages/agent/internal/docker"
	"github.com/selfyurt/selfyurt/packages/agent/internal/types"
)

var startTime = time.Now()

type Info struct {
	OS            string                 `json:"os"`
	Arch          string                 `json:"arch"`
	Hostname      string                 `json:"hostname"`
	GoVersion     string                 `json:"goVersion"`
	NumCPU        int                    `json:"numCpu"`
	NumGoroutines int                    `json:"numGoroutines"`
	UptimeSeconds int64                  `json:"uptimeSeconds"`
	DockerVersion string                 `json:"dockerVersion"`
	Metrics       types.MetricsResponse  `json:"metrics"`
}

type Inspector struct {
	dockerNetwork string
}

func NewInspector(dockerNetwork string) *Inspector {
	return &Inspector{dockerNetwork: dockerNetwork}
}

func (i *Inspector) GetSystemInfo(ctx context.Context) (Info, error) {
	hostname, _ := os.Hostname()

	metrics, _ := docker.CollectMetrics()

	dockerVer := i.getDockerVersion(ctx)

	return Info{
		OS:            runtime.GOOS,
		Arch:          runtime.GOARCH,
		Hostname:      hostname,
		GoVersion:     runtime.Version(),
		NumCPU:        runtime.NumCPU(),
		NumGoroutines: runtime.NumGoroutine(),
		UptimeSeconds: int64(time.Since(startTime).Seconds()),
		DockerVersion: dockerVer,
		Metrics:       metrics,
	}, nil
}

func (i *Inspector) getDockerVersion(ctx context.Context) string {
	cmd := exec.CommandContext(ctx, "docker", "--version")
	out, err := cmd.Output()
	if err != nil {
		return "docker unavailable"
	}
	return strings.TrimSpace(string(out))
}

func (i *Inspector) CheckDockerNetwork(ctx context.Context) bool {
	if i.dockerNetwork == "" {
		return false
	}
	cmd := exec.CommandContext(ctx, "docker", "network", "inspect", i.dockerNetwork)
	return cmd.Run() == nil
}
