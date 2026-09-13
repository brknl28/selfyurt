package compose

import (
	"context"
	"fmt"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

type Runner struct {
	RuntimeDir string
}

func NewRunner(runtimeDir string) *Runner {
	return &Runner{RuntimeDir: runtimeDir}
}

func (r *Runner) composeFile(instanceID string) string {
	return filepath.Join(r.RuntimeDir, instanceID, "docker-compose.yml")
}

func (r *Runner) projectName(instanceID string) string {
	sanitized := strings.ToLower(instanceID)
	sanitized = regexp.MustCompile(`[^a-z0-9-]`).ReplaceAllString(sanitized, "-")
	return "sy-" + sanitized
}

func (r *Runner) baseArgs(instanceID string) []string {
	return []string{"compose", "-p", r.projectName(instanceID), "-f", r.composeFile(instanceID)}
}

func (r *Runner) run(ctx context.Context, instanceID string, args ...string) (string, error) {
	timeoutCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()

	commandArgs := append(r.baseArgs(instanceID), args...)
	cmd := exec.CommandContext(timeoutCtx, "docker", commandArgs...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return string(output), fmt.Errorf("docker %v failed: %w, output: %s", commandArgs, err, string(output))
	}

	return string(output), nil
}

func (r *Runner) Up(ctx context.Context, instanceID string) error {
	_, err := r.run(ctx, instanceID, "up", "-d")
	return err
}

func (r *Runner) Start(ctx context.Context, instanceID string) error {
	_, err := r.run(ctx, instanceID, "start")
	return err
}

func (r *Runner) Stop(ctx context.Context, instanceID string) error {
	_, err := r.run(ctx, instanceID, "stop")
	return err
}

func (r *Runner) Update(ctx context.Context, instanceID string) error {
	if _, err := r.run(ctx, instanceID, "pull"); err != nil {
		return err
	}

	_, err := r.run(ctx, instanceID, "up", "-d")
	return err
}

func (r *Runner) Down(ctx context.Context, instanceID string, removeVolumes bool) error {
	args := []string{"down"}
	if removeVolumes {
		args = append(args, "--volumes")
	}

	_, err := r.run(ctx, instanceID, args...)
	return err
}

func (r *Runner) Logs(ctx context.Context, instanceID string, tail int) (string, error) {
	if tail <= 0 {
		tail = 200
	}

	return r.run(ctx, instanceID, "logs", "--tail", strconv.Itoa(tail), "--no-color")
}

func RenderTemplate(template string, vars map[string]string) string {
	rendered := template
	for key, value := range vars {
		token := "{{" + key + "}}"
		rendered = strings.ReplaceAll(rendered, token, value)
	}

	return rendered
}
