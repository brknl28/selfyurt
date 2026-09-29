package network

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"time"
)

type Checker struct {
	timeout time.Duration
}

func NewChecker(timeout time.Duration) *Checker {
	if timeout <= 0 {
		timeout = 5 * time.Second
	}
	return &Checker{timeout: timeout}
}

func (c *Checker) ResolveHostname(ctx context.Context, hostname string) ([]string, error) {
	resolver := net.DefaultResolver
	ips, err := resolver.LookupHost(ctx, hostname)
	if err != nil {
		return nil, fmt.Errorf("lookup host %s: %w", hostname, err)
	}
	return ips, nil
}

func (c *Checker) CheckPortOpen(ctx context.Context, host string, port int) bool {
	address := fmt.Sprintf("%s:%d", host, port)
	dialer := net.Dialer{Timeout: c.timeout}
	conn, err := dialer.DialContext(ctx, "tcp", address)
	if err != nil {
		return false
	}
	_ = conn.Close()
	return true
}

func (c *Checker) CheckHTTPHealth(ctx context.Context, url string) (int, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return 0, err
	}

	client := &http.Client{Timeout: c.timeout}
	resp, err := client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	return resp.StatusCode, nil
}
