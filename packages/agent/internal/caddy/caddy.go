package caddy

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

type Manager struct {
	SnippetsDir   string
	ContainerName string
	ReloadDisabled bool
}

func NewManager(snippetsDir, containerName string, reloadDisabled bool) *Manager {
	return &Manager{
		SnippetsDir:   snippetsDir,
		ContainerName: containerName,
		ReloadDisabled: reloadDisabled,
	}
}

func sanitizeHostFileName(hostname string) string {
	safe := strings.ToLower(hostname)
	safe = regexp.MustCompile(`[^a-z0-9.-]`).ReplaceAllString(safe, "-")
	return safe + ".caddy"
}

func (m *Manager) snippetPath(hostname string) string {
	return filepath.Join(m.SnippetsDir, sanitizeHostFileName(hostname))
}

func (m *Manager) WriteSnippet(hostname, target string) error {
	if err := os.MkdirAll(m.SnippetsDir, 0o755); err != nil {
		return fmt.Errorf("create snippets dir: %w", err)
	}

	content := fmt.Sprintf("%s {\n  reverse_proxy %s\n}\n", hostname, target)
	if err := os.WriteFile(m.snippetPath(hostname), []byte(content), 0o644); err != nil {
		return fmt.Errorf("write snippet: %w", err)
	}

	return nil
}

func (m *Manager) RemoveSnippet(hostname string) error {
	err := os.Remove(m.snippetPath(hostname))
	if err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("remove snippet: %w", err)
	}
	return nil
}

func (m *Manager) Reload(ctx context.Context) error {
	if m.ReloadDisabled {
		return nil
	}

	timeoutCtx, cancel := context.WithTimeout(ctx, 45*time.Second)
	defer cancel()

	cmd := exec.CommandContext(
		timeoutCtx,
		"docker",
		"exec",
		m.ContainerName,
		"caddy",
		"reload",
		"--config",
		"/etc/caddy/Caddyfile",
		"--adapter",
		"caddyfile",
	)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("caddy reload failed: %w, output: %s", err, string(output))
	}

	return nil
}
