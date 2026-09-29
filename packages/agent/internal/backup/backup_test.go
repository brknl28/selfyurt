package backup

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestCreateAndListBackups(t *testing.T) {
	tempDir := t.TempDir()
	runtimeDir := filepath.Join(tempDir, "runtime")
	backupDir := filepath.Join(tempDir, "backups")

	instanceDir := filepath.Join(runtimeDir, "instances", "test-instance")
	if err := os.MkdirAll(instanceDir, 0o755); err != nil {
		t.Fatalf("failed to create instance dir: %v", err)
	}

	testFile := filepath.Join(instanceDir, "docker-compose.yml")
	if err := os.WriteFile(testFile, []byte("version: '3'\nservices: {}\n"), 0o644); err != nil {
		t.Fatalf("failed to write test file: %v", err)
	}

	mgr := NewManager(backupDir)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	meta, err := mgr.CreateInstanceBackup(ctx, "test-instance", runtimeDir)
	if err != nil {
		t.Fatalf("CreateInstanceBackup() error = %v", err)
	}

	if meta.SizeBytes <= 0 {
		t.Errorf("expected positive archive size, got %d", meta.SizeBytes)
	}

	list, err := mgr.ListBackups("test-instance")
	if err != nil {
		t.Fatalf("ListBackups() error = %v", err)
	}

	if len(list) != 1 {
		t.Fatalf("expected 1 backup, found %d", len(list))
	}
}
