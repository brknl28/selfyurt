//go:build !windows

package docker

import (
	"errors"
	"syscall"
)

func diskUsagePercent(path string) (float64, error) {
	var stat syscall.Statfs_t
	if err := syscall.Statfs(path, &stat); err != nil {
		return 0, err
	}

	total := float64(stat.Blocks) * float64(stat.Bsize)
	free := float64(stat.Bavail) * float64(stat.Bsize)
	if total == 0 {
		return 0, errors.New("disk size is zero")
	}

	used := total - free
	if used < 0 {
		used = 0
	}

	return (used / total) * 100, nil
}
