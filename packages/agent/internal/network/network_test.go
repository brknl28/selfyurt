package network

import (
	"context"
	"net"
	"testing"
	"time"
)

func TestCheckPortOpen(t *testing.T) {
	checker := NewChecker(2 * time.Second)
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("failed to listen on local port: %v", err)
	}
	defer l.Close()

	port := l.Addr().(*net.TCPAddr).Port
	if !checker.CheckPortOpen(ctx, "127.0.0.1", port) {
		t.Errorf("expected port %d to be open", port)
	}

	if checker.CheckPortOpen(ctx, "127.0.0.1", port+9999) {
		t.Errorf("expected port %d to be closed", port+9999)
	}
}
