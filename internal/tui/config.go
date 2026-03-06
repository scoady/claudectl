package tui

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// Config holds persisted user preferences.
type Config struct {
	Theme string `json:"theme"`
}

// configDir returns the c9s config directory path.
func configDir() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		dir = os.Getenv("HOME")
		if dir == "" {
			dir = "/tmp"
		}
		dir = filepath.Join(dir, ".config")
	}
	return filepath.Join(dir, "c9s")
}

// configPath returns the full path to the config file.
func configPath() string {
	return filepath.Join(configDir(), "config.json")
}

// LoadConfig reads the config from disk. Returns defaults if file doesn't exist.
func LoadConfig() Config {
	cfg := Config{Theme: "constellation"}

	data, err := os.ReadFile(configPath())
	if err != nil {
		return cfg
	}

	_ = json.Unmarshal(data, &cfg)
	if cfg.Theme == "" {
		cfg.Theme = "constellation"
	}
	return cfg
}

// SaveConfig writes the config to disk, creating the directory if needed.
func SaveConfig(cfg Config) error {
	dir := configDir()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}

	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(configPath(), data, 0o644)
}
