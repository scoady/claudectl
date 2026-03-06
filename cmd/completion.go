package main

import (
	"os"
	"strings"

	"github.com/scoady/claudectl/internal/api"
	"github.com/spf13/cobra"
)

// completionClient returns an API client for use in completion functions.
// It reads --api flag or CM_API_URL env, falling back to localhost:4040.
func completionClient() *api.Client {
	url := "http://localhost:4040"
	if envURL := os.Getenv("CM_API_URL"); envURL != "" {
		url = envURL
	}
	// If the global apiURL was already set by flag parsing, prefer it
	if apiURL != "" && apiURL != "http://localhost:4040" {
		url = apiURL
	}
	return api.NewClient(url)
}

// completeProjects returns project names matching the given prefix.
func completeProjects(toComplete string) ([]string, cobra.ShellCompDirective) {
	c := completionClient()
	projects, err := c.GetProjects()
	if err != nil {
		return nil, cobra.ShellCompDirectiveNoFileComp
	}
	var names []string
	for _, p := range projects {
		if strings.HasPrefix(p.Name, toComplete) {
			names = append(names, p.Name)
		}
	}
	return names, cobra.ShellCompDirectiveNoFileComp
}

// completeAgentSessions returns session IDs with project+task descriptions.
func completeAgentSessions(toComplete string) ([]string, cobra.ShellCompDirective) {
	c := completionClient()
	agents, err := c.GetAgents()
	if err != nil {
		return nil, cobra.ShellCompDirectiveNoFileComp
	}
	var results []string
	for _, a := range agents {
		if strings.HasPrefix(a.SessionID, toComplete) {
			desc := a.ProjectName
			if a.Task != "" {
				task := a.Task
				if len(task) > 40 {
					task = task[:37] + "..."
				}
				desc += " — " + task
			}
			results = append(results, a.SessionID+"\t"+desc)
		}
	}
	return results, cobra.ShellCompDirectiveNoFileComp
}

// completeProjectsAndSessions returns both project names and session IDs.
func completeProjectsAndSessions(toComplete string) ([]string, cobra.ShellCompDirective) {
	projects, _ := completeProjects(toComplete)
	sessions, _ := completeAgentSessions(toComplete)
	all := append(projects, sessions...)
	return all, cobra.ShellCompDirectiveNoFileComp
}

// completeWidgets returns widget IDs for a given project.
func completeWidgets(project, toComplete string) ([]string, cobra.ShellCompDirective) {
	c := completionClient()
	widgets, err := c.GetWidgets(project)
	if err != nil {
		return nil, cobra.ShellCompDirectiveNoFileComp
	}
	var results []string
	for _, w := range widgets {
		if strings.HasPrefix(w.ID, toComplete) {
			results = append(results, w.ID+"\t"+w.Title)
		}
	}
	return results, cobra.ShellCompDirectiveNoFileComp
}

// completeModels returns known Claude model names.
func completeModels(toComplete string) ([]string, cobra.ShellCompDirective) {
	models := []string{
		"claude-opus-4-6",
		"claude-sonnet-4-6",
		"claude-haiku-4-5-20251001",
	}
	var results []string
	for _, m := range models {
		if strings.HasPrefix(m, toComplete) {
			results = append(results, m)
		}
	}
	return results, cobra.ShellCompDirectiveNoFileComp
}
