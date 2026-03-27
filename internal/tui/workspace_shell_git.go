package tui

import "strings"

type workspaceGitContext struct {
	Status   map[string]string
	Branch   string
	Remote   string
	Provider string
	Ready    bool
}

func newWorkspaceGitContext() workspaceGitContext {
	return workspaceGitContext{Status: map[string]string{}}
}

func (g *workspaceGitContext) Reset() {
	g.Status = map[string]string{}
	g.Branch = ""
	g.Remote = ""
	g.Provider = ""
	g.Ready = false
}

func (g *workspaceGitContext) SetStatus(status map[string]string) {
	if status == nil {
		status = map[string]string{}
	}
	g.Status = status
	g.Ready = true
}

func (g *workspaceGitContext) SetBranch(branch, remote, provider string) {
	g.Branch = strings.TrimSpace(branch)
	g.Remote = strings.TrimSpace(remote)
	g.Provider = strings.TrimSpace(provider)
}
