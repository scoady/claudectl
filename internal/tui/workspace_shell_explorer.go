package tui

import (
	"path/filepath"
	"strings"

	"github.com/charmbracelet/lipgloss"
)

func (w *WorkspaceShellModel) explorerItems() []workspaceShellExplorerItem {
	items := make([]workspaceShellExplorerItem, 0, len(w.Entries)+1)
	if w.CurrentDir != "" {
		parent := filepath.Dir(w.CurrentDir)
		if parent == "." {
			parent = ""
		}
		items = append(items, workspaceShellExplorerItem{
			Label:    "..",
			Path:     parent,
			Icon:     "↰",
			IsDir:    true,
			IsParent: true,
		})
	}
	for _, entry := range w.Entries {
		items = append(items, workspaceShellExplorerItem{
			Label: entry.Name,
			Path:  coalesce(entry.Path, entry.Name),
			Entry: entry,
			Icon:  workspaceShellFileIcon(entry),
			IsDir: entry.Type == "directory",
		})
	}
	return items
}

func (w *WorkspaceShellModel) ExplorerItems() []workspaceExplorerItem {
	items := w.explorerItems()
	out := make([]workspaceExplorerItem, 0, len(items))
	for _, item := range items {
		label := item.Label
		if item.IsDir && !item.IsParent {
			label += "/"
		}
		out = append(out, workspaceExplorerItem{
			Label:    label,
			Path:     item.Path,
			IsDir:    item.IsDir,
			IsParent: item.IsParent,
		})
	}
	return out
}

func (w *WorkspaceShellModel) SelectedExplorerItem() (workspaceShellExplorerItem, bool) {
	items := w.explorerItems()
	if len(items) == 0 || w.SelectedEntry < 0 || w.SelectedEntry >= len(items) {
		return workspaceShellExplorerItem{}, false
	}
	return items[w.SelectedEntry], true
}

func (w *WorkspaceShellModel) explorerAccentAndBadge(item workspaceShellExplorerItem) (lipgloss.Color, string) {
	if item.IsParent {
		return Dim, ""
	}
	status := strings.TrimSpace(w.gitStatusForPath(item.Path, item.IsDir))
	switch {
	case strings.Contains(status, "??"):
		return Green, "??"
	case strings.Contains(status, "M"):
		return Amber, "M"
	case strings.Contains(status, "D"):
		return Rose, "D"
	case strings.Contains(status, "R"):
		return Purple, "R"
	}
	if item.IsDir {
		return Blue, ""
	}
	if item.Entry.Type == "symlink" {
		return Purple, "ln"
	}
	return workspaceShellFileColor(item.Entry), ""
}

func (w *WorkspaceShellModel) gitStatusForPath(path string, isDir bool) string {
	if path == "" || len(w.Git.Status) == 0 {
		return ""
	}
	if status, ok := w.Git.Status[path]; ok {
		return status
	}
	if !isDir {
		return ""
	}
	best := ""
	for candidate, status := range w.Git.Status {
		if strings.HasPrefix(candidate, path+"/") && workspaceShellStatusPriority(status) > workspaceShellStatusPriority(best) {
			best = status
		}
	}
	return best
}
