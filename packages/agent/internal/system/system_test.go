package system

import (
	"context"
	"testing"
	"time"
)

func TestSystemInspector(t *testing.T) {
	inspector := NewInspector("selfyurt_net")
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	info, err := inspector.GetSystemInfo(ctx)
	if err != nil {
		t.Fatalf("GetSystemInfo failed: %v", err)
	}

	if info.OS == "" {
		t.Errorf("expected OS to be non-empty")
	}
	if info.NumCPU <= 0 {
		t.Errorf("expected NumCPU > 0, got %d", info.NumCPU)
	}
	if info.GoVersion == "" {
		t.Errorf("expected GoVersion to be non-empty")
	}
}
