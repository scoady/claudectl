// Package tui provides the interactive terminal UI for c9s.
// types.go defines shared types and interfaces used across TUI screens.
package tui

import (
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/scoady/codexctl/internal/api"
)

// ── Screen identifiers ──────────────────────────────────────────────────────

type Screen int

const (
	ScreenDashboard Screen = iota
	ScreenProjects
	ScreenAgents
	ScreenWatch
	ScreenHelp
	ScreenProject        // drill-into single project detail
	ScreenSettings       // theme settings screen
	ScreenCanvas         // canvas management screen
	ScreenWidgetDetail   // widget detail view
	ScreenTemplateBrowse // catalog template detail
	ScreenMission        // multi-agent mission control dashboard
	ScreenTimeline       // agent timeline view
	ScreenMetrics        // Prometheus-style metrics dashboard
	ScreenTargets        // Prometheus-style targets health screen
	ScreenWorkspace      // experimental workspace-centric shell
	ScreenTools          // tool / plugin management screen
)

// ── Navigation messages ─────────────────────────────────────────────────────

// NavigateMsg tells the app to switch to a different screen.
type NavigateMsg struct {
	Screen Screen
	// Optional context for the target screen
	Agent   *api.Agent
	Project *api.Project
}

type MousePoint struct {
	X int
	Y int
}

// ── WebSocket event messages (sent from WS goroutine → bubbletea) ───────────

// WSConnectedMsg indicates the WebSocket connection was established.
type WSConnectedMsg struct {
	AgentCount int
}

// WSDisconnectedMsg indicates the WebSocket was lost.
type WSDisconnectedMsg struct {
	Err error
}

// WSTextChunkMsg delivers a streamed text chunk for an agent.
type WSTextChunkMsg struct {
	SessionID string
	Text      string
}

// WSMilestoneMsg delivers a tool-call milestone badge.
type WSMilestoneMsg struct {
	SessionID string
	Label     string
	ToolName  string
	Input     string
}

// WSAgentDoneMsg signals an agent has completed.
type WSAgentDoneMsg struct {
	SessionID string
}

// WSPhaseChangeMsg signals a phase transition.
type WSPhaseChangeMsg struct {
	SessionID string
	Phase     string
}

// WSAgentSpawnedMsg signals a new agent has been created.
type WSAgentSpawnedMsg struct {
	SessionID string
	Project   string
	Task      string
}

// WSErrorMsg carries an error from the WebSocket stream.
type WSErrorMsg struct {
	Message string
}

// ── Dispatch messages ───────────────────────────────────────────────────────

// DispatchCompleteMsg signals a dispatch request completed.
type DispatchCompleteMsg struct {
	SessionID string
	AgentIDs  []string
	Err       error
}

// InjectCompleteMsg signals an inject request completed.
type InjectCompleteMsg struct {
	Err error
}

type WorkspaceComposeCompleteMsg struct {
	SessionID string
	Err       error
}

type WorkspaceExecCompleteMsg struct {
	Command string
	Result  *api.ExecResult
	Err     error
}

// ── Shared helpers ──────────────────────────────────────────────────────────

// ShowDispatchMsg triggers the dispatch dialog overlay.
type ShowDispatchMsg struct {
	ProjectName string
}

// ShowInjectMsg triggers the inject dialog overlay.
type ShowInjectMsg struct {
	SessionID string
}

type WorkspaceSelectProjectMsg struct {
	ProjectName string
}

type WorkspaceCopyTranscriptMsg struct {
	Err error
}

// ── Command helpers ─────────────────────────────────────────────────────────

// DispatchCmd dispatches a task to the API.
func DispatchCmd(client *api.Client, project, task, model string) tea.Cmd {
	return func() tea.Msg {
		resp, err := client.Dispatch(project, task, model)
		if err != nil {
			return DispatchCompleteMsg{Err: err}
		}
		return DispatchCompleteMsg{
			SessionID: resp.SessionID,
			AgentIDs:  resp.AgentIDs,
		}
	}
}

func WorkspaceComposeCmd(client *api.Client, project, sessionID, message string) tea.Cmd {
	return func() tea.Msg {
		if client == nil {
			return WorkspaceComposeCompleteMsg{Err: nil}
		}
		if sid := strings.TrimSpace(sessionID); sid != "" {
			err := client.InjectMessage(sid, message)
			return WorkspaceComposeCompleteMsg{SessionID: sid, Err: err}
		}
		resp, err := client.Dispatch(project, message, "")
		if err != nil {
			return WorkspaceComposeCompleteMsg{Err: err}
		}
		return WorkspaceComposeCompleteMsg{SessionID: resp.SessionID}
	}
}

func WorkspaceExecCmd(client *api.Client, project, command string) tea.Cmd {
	return func() tea.Msg {
		if client == nil {
			return WorkspaceExecCompleteMsg{Command: command}
		}
		resp, err := client.ExecCommand(project, command)
		return WorkspaceExecCompleteMsg{Command: command, Result: resp, Err: err}
	}
}
