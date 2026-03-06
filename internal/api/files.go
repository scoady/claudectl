package api

import (
	"net/url"
)

// FileEntry represents a file or directory in a project.
type FileEntry struct {
	Name  string `json:"name"`
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

// GetGitStatus returns the git status map for a project.
func (c *Client) GetGitStatus(project string) (map[string]string, error) {
	var out map[string]string
	err := c.get("/api/projects/"+url.PathEscape(project)+"/files/status", &out)
	return out, err
}
