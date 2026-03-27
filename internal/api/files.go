package api

import (
	"net/url"
)

// FileEntry represents a file or directory in a project.
type FileEntry struct {
	Name  string `json:"name"`
	Path  string `json:"path"`
	Type  string `json:"type"`
	Size  int64  `json:"size,omitempty"`
	Mtime string `json:"mtime,omitempty"`
}

// FileContent represents the content of a file.
type FileContent struct {
	Content   string `json:"content"`
	Binary    bool   `json:"binary"`
	Truncated bool   `json:"truncated"`
}

type ExecResult struct {
	Stdout   string `json:"stdout"`
	Stderr   string `json:"stderr"`
	ExitCode int    `json:"exit_code"`
}

type GitBranchInfo struct {
	Branch   string `json:"branch"`
	Remote   string `json:"remote"`
	Provider string `json:"provider"`
}

// ListFiles lists files in a project directory.
func (c *Client) ListFiles(project, path string) ([]FileEntry, error) {
	var out []FileEntry
	q := "/api/projects/" + url.PathEscape(project) + "/files"
	if path != "" {
		q += "?path=" + url.QueryEscape(path)
	}
	err := c.get(q, &out)
	return out, err
}

// ReadFile reads a file's content from a project.
func (c *Client) ReadFile(project, path string) (*FileContent, error) {
	var out FileContent
	q := "/api/projects/" + url.PathEscape(project) + "/files/content?path=" + url.QueryEscape(path)
	err := c.get(q, &out)
	return &out, err
}

// WriteFile writes text content into a project file.
func (c *Client) WriteFile(project, path, content string) error {
	body := map[string]string{
		"path":    path,
		"content": content,
	}
	return c.put("/api/projects/"+url.PathEscape(project)+"/files/content", body, nil)
}

// CreateDir creates a directory inside a project.
func (c *Client) CreateDir(project, path string) error {
	body := map[string]string{
		"path": path,
	}
	return c.post("/api/projects/"+url.PathEscape(project)+"/files/mkdir", body, nil)
}

// ExecCommand runs a shell command inside a project directory.
func (c *Client) ExecCommand(project, command string) (*ExecResult, error) {
	var out ExecResult
	body := map[string]string{
		"command": command,
	}
	err := c.post("/api/projects/"+url.PathEscape(project)+"/exec", body, &out)
	return &out, err
}

// GetGitStatus returns the git status map for a project.
func (c *Client) GetGitStatus(project string) (map[string]string, error) {
	var out map[string]string
	err := c.get("/api/projects/"+url.PathEscape(project)+"/files/status", &out)
	return out, err
}

// GetGitBranch returns the current git branch metadata for a project.
func (c *Client) GetGitBranch(project string) (*GitBranchInfo, error) {
	var out GitBranchInfo
	err := c.get("/api/projects/"+url.PathEscape(project)+"/files/branch", &out)
	return &out, err
}
