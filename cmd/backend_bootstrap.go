package main

import (
	"fmt"
	"net"
	"net/url"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/scoady/codexctl/internal/api"
)

func ensureLocalBackendForTUI(apiURL string) error {
	if !shouldAutoStartLocalBackend(apiURL) {
		return nil
	}

	client := api.NewClient(apiURL)
	if _, err := client.Health(); err == nil {
		return nil
	}

	return startBackgroundBackend(apiURL, client)
}

func shouldAutoStartLocalBackend(apiURL string) bool {
	parsed, err := url.Parse(strings.TrimSpace(apiURL))
	if err != nil {
		return false
	}
	if parsed.Scheme != "http" {
		return false
	}
	switch parsed.Hostname() {
	case "", "localhost", "127.0.0.1", "::1":
		return true
	default:
		return false
	}
}

func startBackgroundBackend(apiURL string, client *api.Client) error {
	addr, err := backendListenAddr(apiURL)
	if err != nil {
		return err
	}

	exePath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("resolve current executable: %w", err)
	}

	devNull, err := os.OpenFile(os.DevNull, os.O_RDWR, 0)
	if err != nil {
		return fmt.Errorf("open %s: %w", os.DevNull, err)
	}
	defer devNull.Close()

	cmd := exec.Command(exePath, "serve", "--addr", addr)
	cmd.Stdin = devNull
	cmd.Stdout = devNull
	cmd.Stderr = devNull
	cmd.Env = os.Environ()

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("start background backend at %s: %w", addr, err)
	}
	_ = cmd.Process.Release()

	deadline := time.Now().Add(8 * time.Second)
	for time.Now().Before(deadline) {
		if _, err := client.Health(); err == nil {
			return nil
		}
		time.Sleep(250 * time.Millisecond)
	}

	return fmt.Errorf("background backend did not become healthy at %s within 8s", apiURL)
}

func backendListenAddr(apiURL string) (string, error) {
	parsed, err := url.Parse(strings.TrimSpace(apiURL))
	if err != nil {
		return "", fmt.Errorf("parse API URL %q: %w", apiURL, err)
	}

	port := parsed.Port()
	if port == "" {
		port = "80"
	}

	host := parsed.Hostname()
	switch host {
	case "", "localhost":
		return net.JoinHostPort("localhost", port), nil
	case "127.0.0.1", "::1":
		return net.JoinHostPort(host, port), nil
	default:
		return "", fmt.Errorf("API URL %q is not a local backend target", apiURL)
	}
}
