package server

import (
	"bytes"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
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
	recursive := r.URL.Query().Get("recursive") == "1" || strings.EqualFold(r.URL.Query().Get("recursive"), "true")
	depth := 0
	if raw := strings.TrimSpace(r.URL.Query().Get("depth")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			depth = parsed
		}
	}

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

	ignored := getGitIgnored(projRoot, projRoot)

	var files []FileEntry
	if recursive {
		maxDepth := depth
		if maxDepth <= 0 {
			maxDepth = 4
		}
		files = listFilesRecursive(targetDir, relPath, ignored, 0, maxDepth)
	} else {
		var err error
		files, err = listFilesFlat(targetDir, relPath, ignored)
		if err != nil {
			httpError(w, http.StatusNotFound, "directory not found")
			return
		}
	}

	writeJSON(w, http.StatusOK, files)
}

func listFilesFlat(targetDir, relPath string, ignored map[string]bool) ([]FileEntry, error) {
	entries, err := os.ReadDir(targetDir)
	if err != nil {
		return nil, err
	}

	var files []FileEntry
	for _, e := range entries {
		entry, ok := buildFileEntry(e, relPath, ignored)
		if !ok {
			continue
		}
		files = append(files, entry)
	}

	sort.Slice(files, func(i, j int) bool {
		if files[i].Type != files[j].Type {
			return files[i].Type == "directory"
		}
		return files[i].Name < files[j].Name
	})
	return files, nil
}

func listFilesRecursive(targetDir, relPath string, ignored map[string]bool, depth, maxDepth int) []FileEntry {
	entries, err := os.ReadDir(targetDir)
	if err != nil {
		return nil
	}

	var dirs []os.DirEntry
	var files []os.DirEntry
	for _, e := range entries {
		if e.IsDir() {
			dirs = append(dirs, e)
		} else {
			files = append(files, e)
		}
	}
	sort.Slice(dirs, func(i, j int) bool { return strings.ToLower(dirs[i].Name()) < strings.ToLower(dirs[j].Name()) })
	sort.Slice(files, func(i, j int) bool { return strings.ToLower(files[i].Name()) < strings.ToLower(files[j].Name()) })

	out := make([]FileEntry, 0, len(entries))
	for _, group := range [][]os.DirEntry{dirs, files} {
		for _, e := range group {
			entry, ok := buildFileEntry(e, relPath, ignored)
			if !ok {
				continue
			}
			out = append(out, entry)
			if entry.Type == "directory" && depth+1 < maxDepth {
				childDir := filepath.Join(targetDir, e.Name())
				childRel := entry.Path
				out = append(out, listFilesRecursive(childDir, childRel, ignored, depth+1, maxDepth)...)
			}
		}
	}
	return out
}

func buildFileEntry(e os.DirEntry, relPath string, ignored map[string]bool) (FileEntry, bool) {
	entryName := e.Name()
	if strings.HasPrefix(entryName, ".") {
		return FileEntry{}, false
	}
	if isNoiseDir(entryName) && e.IsDir() {
		return FileEntry{}, false
	}

	entryPath := entryName
	if relPath != "" {
		entryPath = relPath + "/" + entryName
	}
	if shouldIgnorePath(entryPath, ignored) || ignored[entryName] {
		return FileEntry{}, false
	}

	info, err := e.Info()
	if err != nil {
		return FileEntry{}, false
	}

	ftype := "file"
	switch {
	case e.Type()&os.ModeSymlink != 0:
		ftype = "symlink"
	case e.IsDir():
		ftype = "directory"
	}

	return FileEntry{
		Name:  entryName,
		Path:  entryPath,
		Type:  ftype,
		Size:  info.Size(),
		Mtime: info.ModTime().UTC().Format("2006-01-02T15:04:05Z"),
	}, true
}

func shouldIgnorePath(path string, ignored map[string]bool) bool {
	if ignored[path] {
		return true
	}
	for candidate := range ignored {
		if candidate != "" && strings.HasPrefix(path, strings.TrimSuffix(candidate, "/")+"/") {
			return true
		}
	}
	return false
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
			"content":   "",
			"binary":    false,
			"truncated": true,
			"size":      info.Size(),
			"message":   "File too large to preview (> 500KB)",
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

func (s *Server) handleMakeDir(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")

	var req struct {
		Path string `json:"path"`
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

	absTarget, _ := filepath.Abs(target)
	absRoot, _ := filepath.Abs(projRoot)
	if !strings.HasPrefix(absTarget, absRoot) {
		httpError(w, http.StatusBadRequest, "path traversal not allowed")
		return
	}

	if err := os.MkdirAll(target, 0o755); err != nil {
		httpError(w, http.StatusInternalServerError, "failed to create directory")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":   true,
		"path": req.Path,
	})
}

func (s *Server) handleExecCommand(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")

	var req struct {
		Command string `json:"command"`
	}
	if err := readJSON(r, &req); err != nil {
		httpError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	if strings.TrimSpace(req.Command) == "" {
		httpError(w, http.StatusBadRequest, "command is required")
		return
	}

	projRoot := filepath.Join(s.ProjectsDir, name)
	if _, err := os.Stat(projRoot); err != nil {
		httpError(w, http.StatusNotFound, "project not found: "+name)
		return
	}

	cmd := exec.Command("/bin/zsh", "-lc", req.Command)
	cmd.Dir = projRoot
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	exitCode := 0
	err := cmd.Run()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			httpError(w, http.StatusInternalServerError, "failed to run command: "+err.Error())
			return
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"stdout":    stdout.String(),
		"stderr":    stderr.String(),
		"exit_code": exitCode,
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
		writeJSON(w, http.StatusOK, map[string]string{"branch": "", "remote": "", "provider": "local"})
		return
	}
	branch := strings.TrimSpace(string(output))
	remoteName := "local"
	remoteURL := ""

	remoteCmd := exec.Command("git", "remote")
	remoteCmd.Dir = projRoot
	if remotesOut, remoteErr := remoteCmd.Output(); remoteErr == nil {
		for _, line := range strings.Split(string(remotesOut), "\n") {
			line = strings.TrimSpace(line)
			if line == "" {
				continue
			}
			remoteName = line
			break
		}
	}
	if remoteName != "local" {
		urlCmd := exec.Command("git", "remote", "get-url", remoteName)
		urlCmd.Dir = projRoot
		if urlOut, urlErr := urlCmd.Output(); urlErr == nil {
			remoteURL = strings.TrimSpace(string(urlOut))
		}
	}

	provider := "local"
	lowerURL := strings.ToLower(remoteURL)
	switch {
	case strings.Contains(lowerURL, "gitlab"):
		provider = "gitlab"
	case strings.Contains(lowerURL, "github"):
		provider = "github"
	case strings.Contains(lowerURL, "bitbucket"):
		provider = "bitbucket"
	case remoteName != "" && remoteName != "local":
		provider = "git"
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"branch":   branch,
		"remote":   remoteName,
		"provider": provider,
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
