package server

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// discoverProjects scans dir for subdirectories containing a PROJECT.md file
// and returns them as ManagedProject values sorted by name.
func discoverProjects(dir string) []ManagedProject {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil
	}

	var projects []ManagedProject
	for _, e := range entries {
		if !e.IsDir() || strings.HasPrefix(e.Name(), ".") {
			continue
		}

		projPath := filepath.Join(dir, e.Name())
		projectMD := filepath.Join(projPath, "PROJECT.md")

		content, err := os.ReadFile(projectMD)
		if err != nil {
			continue // no PROJECT.md → not a managed project
		}

		goal := strings.TrimSpace(string(content))
		desc := extractDescription(goal)

		cfg := loadProjectConfig(projPath)

		projects = append(projects, ManagedProject{
			Name:             e.Name(),
			Path:             projPath,
			Description:      desc,
			Goal:             goal,
			Config:           cfg,
			ActiveSessionIDs: []string{},
		})
	}

	sort.Slice(projects, func(i, j int) bool {
		return projects[i].Name < projects[j].Name
	})

	return projects
}

// extractDescription returns the first meaningful line of PROJECT.md content,
// stripped of markdown heading prefixes, capped at 120 characters.
func extractDescription(content string) string {
	for _, line := range strings.Split(content, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		// Strip leading markdown heading markers
		line = strings.TrimLeft(line, "# ")
		if len(line) > 120 {
			return line[:120]
		}
		return line
	}
	return ""
}

// loadProjectConfig reads .codex/manager.json from the project directory.
// Returns a zero-value ProjectConfig if the file doesn't exist or is invalid.
func loadProjectConfig(projPath string) ProjectConfig {
	var cfg ProjectConfig
	data, err := os.ReadFile(filepath.Join(projPath, ".codex", "manager.json"))
	if err != nil {
		return cfg
	}
	_ = json.Unmarshal(data, &cfg)
	return cfg
}
