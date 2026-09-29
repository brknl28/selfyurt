package backup

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

type Metadata struct {
	InstanceID string    `json:"instanceId"`
	CreatedAt  time.Time `json:"createdAt"`
	FilePath   string    `json:"filePath"`
	SizeBytes  int64     `json:"sizeBytes"`
}

type Manager struct {
	backupDir string
}

func NewManager(backupDir string) *Manager {
	return &Manager{backupDir: backupDir}
}

func (m *Manager) CreateInstanceBackup(ctx context.Context, instanceID, runtimeDir string) (*Metadata, error) {
	if err := os.MkdirAll(m.backupDir, 0o755); err != nil {
		return nil, fmt.Errorf("create backup dir: %w", err)
	}

	instanceDir := filepath.Join(runtimeDir, "instances", instanceID)
	if _, err := os.Stat(instanceDir); err != nil {
		return nil, fmt.Errorf("instance runtime directory not found: %w", err)
	}

	filename := fmt.Sprintf("%s_%s.tar.gz", instanceID, time.Now().Format("20060102_150405"))
	destPath := filepath.Join(m.backupDir, filename)

	outFile, err := os.Create(destPath)
	if err != nil {
		return nil, fmt.Errorf("create destination archive: %w", err)
	}
	defer outFile.Close()

	gw := gzip.NewWriter(outFile)
	defer gw.Close()

	tw := tar.NewWriter(gw)
	defer tw.Close()

	err = filepath.Walk(instanceDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		relPath, err := filepath.Rel(instanceDir, path)
		if err != nil {
			return err
		}

		header, err := tar.FileInfoHeader(info, info.Name())
		if err != nil {
			return err
		}
		header.Name = filepath.ToSlash(relPath)

		if err := tw.WriteHeader(header); err != nil {
			return err
		}

		if info.IsDir() {
			return nil
		}

		file, err := os.Open(path)
		if err != nil {
			return err
		}
		defer file.Close()

		_, err = io.Copy(tw, file)
		return err
	})

	if err != nil {
		_ = os.Remove(destPath)
		return nil, fmt.Errorf("archive creation failed: %w", err)
	}

	fi, err := os.Stat(destPath)
	if err != nil {
		return nil, err
	}

	return &Metadata{
		InstanceID: instanceID,
		CreatedAt:  time.Now(),
		FilePath:   destPath,
		SizeBytes:  fi.Size(),
	}, nil
}

func (m *Manager) ListBackups(instanceID string) ([]Metadata, error) {
	if _, err := os.Stat(m.backupDir); os.IsNotExist(err) {
		return []Metadata{}, nil
	}

	entries, err := os.ReadDir(m.backupDir)
	if err != nil {
		return nil, err
	}

	var results []Metadata
	prefix := instanceID + "_"
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".tar.gz") {
			continue
		}
		if instanceID != "" && !strings.HasPrefix(entry.Name(), prefix) {
			continue
		}

		info, err := entry.Info()
		if err != nil {
			continue
		}

		results = append(results, Metadata{
			InstanceID: instanceID,
			CreatedAt:  info.ModTime(),
			FilePath:   filepath.Join(m.backupDir, entry.Name()),
			SizeBytes:  info.Size(),
		})
	}

	return results, nil
}

func (m *Manager) ExportDockerVolume(ctx context.Context, volumeName, destTarPath string) error {
	cmd := exec.CommandContext(ctx, "docker", "run", "--rm",
		"-v", volumeName+":/volume:ro",
		"-v", filepath.Dir(destTarPath)+":/backup",
		"alpine",
		"tar", "-czf", "/backup/"+filepath.Base(destTarPath), "-C", "/volume", ".",
	)
	return cmd.Run()
}
