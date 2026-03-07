package server

import (
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
)

// FileEntry represents a file or directory in the project tree.
type FileEntry struct {
	Name  string `json:"name"`
	Path  string `json:"path"`
	Type  string `json:"type"` // "file" or "directory"
	Size  int64  `json:"size,omitempty"`
	Mtime string `json:"mtime,omitempty"`
}

// ── Handlers ─────────────────────────────────────────────────────────────────

func (s *Server) handleListFiles(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	relPath := r.URL.Query().Get("path")

	projRoot := filepath.Join(s.ProjectsDir, name)
	if _, err := os.Stat(projRoot); err != nil {
		httpError(w, http.StatusNotFound, "project not found: "+name)
		return
	}

	targetDir := projRoot
	if relPath != "" {
		targetDir = filepath.Join(projRoot, relPath)
	}

	// Safety: ensure we don't escape the project directory
	absTarget, _ := filepath.Abs(targetDir)
	absRoot, _ := filepath.Abs(projRoot)
	if !strings.HasPrefix(absTarget, absRoot) {
		httpError(w, http.StatusBadRequest, "path traversal not allowed")
		return
	}

	// Get gitignored files
	ignored := getGitIgnored(projRoot, targetDir)

	entries, err := os.ReadDir(targetDir)
	if err != nil {
		httpError(w, http.StatusNotFound, "directory not found")
		return
	}

	var files []FileEntry
	for _, e := range entries {
		entryName := e.Name()

		// Skip hidden files, common noise directories
		if strings.HasPrefix(entryName, ".") {
			continue
		}
		if isNoiseDir(entryName) && e.IsDir() {
			continue
		}

		entryPath := entryName
		if relPath != "" {
			entryPath = relPath + "/" + entryName
		}

		// Skip gitignored
		if ignored[entryPath] || ignored[entryName] {
			continue
		}

		info, err := e.Info()
		if err != nil {
			continue
		}

		ftype := "file"
		if e.IsDir() {
			ftype = "directory"
		}

		files = append(files, FileEntry{
			Name:  entryName,
			Path:  entryPath,
			Type:  ftype,
			Size:  info.Size(),
			Mtime: info.ModTime().UTC().Format("2006-01-02T15:04:05Z"),
		})
	}

	// Sort: directories first, then alphabetically
	sort.Slice(files, func(i, j int) bool {
		if files[i].Type != files[j].Type {
			return files[i].Type == "directory"
		}
		return files[i].Name < files[j].Name
	})

	writeJSON(w, http.StatusOK, files)
}

func (s *Server) handleReadFile(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	relPath := r.URL.Query().Get("path")
	if relPath == "" {
		httpError(w, http.StatusBadRequest, "path query parameter is required")
		return
	}

	projRoot := filepath.Join(s.ProjectsDir, name)
	target := filepath.Join(projRoot, relPath)

	// Safety check
	absTarget, _ := filepath.Abs(target)
	absRoot, _ := filepath.Abs(projRoot)
	if !strings.HasPrefix(absTarget, absRoot) {
		httpError(w, http.StatusBadRequest, "path traversal not allowed")
		return
	}

	info, err := os.Stat(target)
	if err != nil {
		httpError(w, http.StatusNotFound, "file not found")
		return
	}

	// Size cap: 500KB
	if info.Size() > 500*1024 {
		writeJSON(w, http.StatusOK, map[string]any{
			"content": "",
			"binary":  false,
			"truncated": true,
			"size":    info.Size(),
			"message": "File too large to preview (> 500KB)",
		})
		return
	}

	data, err := os.ReadFile(target)
	if err != nil {
		httpError(w, http.StatusInternalServerError, "failed to read file")
		return
	}

	// Binary detection
	if isBinary(data) {
		writeJSON(w, http.StatusOK, map[string]any{
			"content": "",
			"binary":  true,
			"size":    info.Size(),
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"content": string(data),
		"binary":  false,
		"size":    info.Size(),
	})
}

func (s *Server) handleWriteFile(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")

	var req struct {
		Path    string `json:"path"`
		Content string `json:"content"`
	}
	if err := readJSON(r, &req); err != nil {
		httpError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	if req.Path == "" {
		httpError(w, http.StatusBadRequest, "path is required")
		return
	}

	projRoot := filepath.Join(s.ProjectsDir, name)
	target := filepath.Join(projRoot, req.Path)

	// Safety check
	absTarget, _ := filepath.Abs(target)
	absRoot, _ := filepath.Abs(projRoot)
	if !strings.HasPrefix(absTarget, absRoot) {
		httpError(w, http.StatusBadRequest, "path traversal not allowed")
		return
	}

	// Ensure parent directory exists
	if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
		httpError(w, http.StatusInternalServerError, "failed to create directory")
		return
	}

	if err := os.WriteFile(target, []byte(req.Content), 0644); err != nil {
		httpError(w, http.StatusInternalServerError, "failed to write file")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":   true,
		"path": req.Path,
		"size": len(req.Content),
	})
}

func (s *Server) handleGitStatus(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	projRoot := filepath.Join(s.ProjectsDir, name)

	if _, err := os.Stat(projRoot); err != nil {
		httpError(w, http.StatusNotFound, "project not found")
		return
	}

	cmd := exec.Command("git", "status", "--porcelain")
	cmd.Dir = projRoot
	output, err := cmd.Output()
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]string{})
		return
	}

	statusMap := make(map[string]string)
	for _, line := range strings.Split(string(output), "\n") {
		line = strings.TrimSpace(line)
		if len(line) < 4 {
			continue
		}
		status := strings.TrimSpace(line[:2])
		path := strings.TrimSpace(line[3:])
		// Handle renamed files: "R  old -> new"
		if idx := strings.Index(path, " -> "); idx >= 0 {
			path = path[idx+4:]
		}
		statusMap[path] = status
	}

	writeJSON(w, http.StatusOK, statusMap)
}

func (s *Server) handleGitBranch(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	projRoot := filepath.Join(s.ProjectsDir, name)

	cmd := exec.Command("git", "rev-parse", "--abbrev-ref", "HEAD")
	cmd.Dir = projRoot
	output, err := cmd.Output()
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]string{"branch": ""})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"branch": strings.TrimSpace(string(output)),
	})
}

// ── Helpers ──────────────────────────────────────────────────────────────────

func isNoiseDir(name string) bool {
	noise := map[string]bool{
		"node_modules": true, "__pycache__": true, ".git": true,
		"dist": true, "build": true, ".next": true, ".nuxt": true,
		"vendor": true, "target": true, ".venv": true, "venv": true,
		".tox": true, ".mypy_cache": true, ".pytest_cache": true,
		"coverage": true, ".coverage": true,
	}
	return noise[name]
}

func getGitIgnored(projRoot, dir string) map[string]bool {
	ignored := make(map[string]bool)
	cmd := exec.Command("git", "ls-files", "--others", "--ignored", "--exclude-standard", "--directory")
	cmd.Dir = dir
	output, err := cmd.Output()
	if err != nil {
		return ignored
	}
	for _, line := range strings.Split(string(output), "\n") {
		line = strings.TrimSpace(line)
		line = strings.TrimSuffix(line, "/")
		if line != "" {
			ignored[line] = true
		}
	}
	return ignored
}

func isBinary(data []byte) bool {
	// Check first 8KB for null bytes
	check := data
	if len(check) > 8192 {
		check = check[:8192]
	}
	for _, b := range check {
		if b == 0 {
			return true
		}
	}
	return false
}
