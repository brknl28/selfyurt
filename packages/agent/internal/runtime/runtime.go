package runtime

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/selfyurt/selfyurt/packages/agent/internal/types"
)

var instanceIDRegex = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$`)

func NormalizeInstanceID(instanceID string) string {
	return strings.ToLower(strings.TrimSpace(instanceID))
}

func ValidateInstanceID(instanceID string) error {
	if !instanceIDRegex.MatchString(instanceID) {
		return fmt.Errorf("invalid instanceId")
	}
	return nil
}

func EnsureInstanceDir(runtimeDir, instanceID string) (string, error) {
	instanceDir := filepath.Join(runtimeDir, instanceID)
	if err := os.MkdirAll(instanceDir, 0o755); err != nil {
		return "", fmt.Errorf("create instance dir: %w", err)
	}
	return instanceDir, nil
}

func ComposeFilePath(runtimeDir, instanceID string) string {
	return filepath.Join(runtimeDir, instanceID, "docker-compose.yml")
}

func MetadataPath(runtimeDir, instanceID string) string {
	return filepath.Join(runtimeDir, instanceID, "instance.json")
}

func WriteComposeFile(runtimeDir, instanceID, content string) error {
	if _, err := EnsureInstanceDir(runtimeDir, instanceID); err != nil {
		return err
	}

	path := ComposeFilePath(runtimeDir, instanceID)
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		return fmt.Errorf("write compose file: %w", err)
	}

	return nil
}

func WriteMetadata(runtimeDir, instanceID string, meta types.InstanceMeta) error {
	if _, err := EnsureInstanceDir(runtimeDir, instanceID); err != nil {
		return err
	}

	data, err := json.MarshalIndent(meta, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal metadata: %w", err)
	}

	if err := os.WriteFile(MetadataPath(runtimeDir, instanceID), data, 0o644); err != nil {
		return fmt.Errorf("write metadata: %w", err)
	}

	return nil
}

func ReadMetadata(runtimeDir, instanceID string) (*types.InstanceMeta, error) {
	data, err := os.ReadFile(MetadataPath(runtimeDir, instanceID))
	if err != nil {
		return nil, err
	}

	var meta types.InstanceMeta
	if err := json.Unmarshal(data, &meta); err != nil {
		return nil, fmt.Errorf("unmarshal metadata: %w", err)
	}

	return &meta, nil
}

func RemoveInstanceDir(runtimeDir, instanceID string) error {
	path := filepath.Join(runtimeDir, instanceID)
	if err := os.RemoveAll(path); err != nil {
		return fmt.Errorf("remove instance dir: %w", err)
	}

	return nil
}
