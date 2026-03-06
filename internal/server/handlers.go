package server

import (
	"bufio"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// ── Stats ───────────────────────────────────────────────────────────────────

func (s *Server) handleStats(w http.ResponseWriter, r *http.Request) {
	projects := discoverProjects(s.ProjectsDir)

	active, idle := 0, 0
	if s.Broker != nil {
		active, idle = s.Broker.CountByStatus()
	}

	writeJSON(w, http.StatusOK, GlobalStats{
		ActiveAgents:  active,
		IdleAgents:    idle,
		TotalProjects: len(projects),
		UptimeSeconds: time.Since(s.StartedAt).Seconds(),
	})
}

// ── Projects ────────────────────────────────────────────────────────────────

func (s *Server) handleListProjects(w http.ResponseWriter, r *http.Request) {
	projects := discoverProjects(s.ProjectsDir)

	// Attach active session IDs from broker
	if s.Broker != nil {
		for i := range projects {
			projects[i].ActiveSessionIDs = s.Broker.SessionIDsForProject(projects[i].Name)
		}
	}

	writeJSON(w, http.StatusOK, projects)
}

func (s *Server) handleGetProject(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	projects := discoverProjects(s.ProjectsDir)

	for _, p := range projects {
		if p.Name == name {
			if s.Broker != nil {
				p.ActiveSessionIDs = s.Broker.SessionIDsForProject(p.Name)
			}
			writeJSON(w, http.StatusOK, p)
			return
		}
	}

	httpError(w, http.StatusNotFound, "project not found: "+name)
}

// ── Agents ──────────────────────────────────────────────────────────────────

func (s *Server) handleListAgents(w http.ResponseWriter, r *http.Request) {
	if s.Broker == nil {
		writeJSON(w, http.StatusOK, []map[string]any{})
		return
	}
	writeJSON(w, http.StatusOK, s.Broker.ListSessions())
}

func (s *Server) handleGetMessages(w http.ResponseWriter, r *http.Request) {
	sid := r.PathValue("id")
	if s.Broker == nil {
		httpError(w, http.StatusNotFound, "no broker")
		return
	}
	session := s.Broker.GetSession(sid)
	if session == nil {
		httpError(w, http.StatusNotFound, "session not found: "+sid)
		return
	}

	// Return the output buffer as messages
	session.mu.RLock()
	buf := make([]map[string]any, len(session.OutputBuffer))
	copy(buf, session.OutputBuffer)
	session.mu.RUnlock()

	writeJSON(w, http.StatusOK, buf)
}

func (s *Server) handleInjectMessage(w http.ResponseWriter, r *http.Request) {
	sid := r.PathValue("id")

	var req InjectRequest
	if err := readJSON(r, &req); err != nil {
		httpError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	if req.Message == "" {
		httpError(w, http.StatusBadRequest, "message is required")
		return
	}

	if s.Broker == nil {
		httpError(w, http.StatusServiceUnavailable, "broker not initialized")
		return
	}

	if err := s.Broker.InjectMessage(sid, req.Message); err != nil {
		httpError(w, http.StatusNotFound, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "injected"})
}

func (s *Server) handleCancelAgent(w http.ResponseWriter, r *http.Request) {
	sid := r.PathValue("id")

	if s.Broker == nil {
		httpError(w, http.StatusServiceUnavailable, "broker not initialized")
		return
	}

	if err := s.Broker.CancelSession(sid); err != nil {
		httpError(w, http.StatusNotFound, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "cancelled"})
}

// ── Dispatch ────────────────────────────────────────────────────────────────

const narratePrefix = "Narrate what you're doing in plain English as you work. " +
	"The user sees your text on a live dashboard. Write short status updates " +
	"before tool calls and summarize results after. Never go silent.\n\n"

func (s *Server) handleDispatch(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")

	var req DispatchRequest
	if err := readJSON(r, &req); err != nil {
		httpError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	if req.Task == "" {
		httpError(w, http.StatusBadRequest, "task is required")
		return
	}

	// Verify project exists
	projPath := filepath.Join(s.ProjectsDir, name)
	if _, err := os.Stat(filepath.Join(projPath, "PROJECT.md")); err != nil {
		httpError(w, http.StatusNotFound, "project not found: "+name)
		return
	}

	if s.Broker == nil {
		httpError(w, http.StatusServiceUnavailable, "broker not initialized")
		return
	}

	task := narratePrefix + req.Task
	model := req.Model

	sid, err := s.Broker.CreateSession(name, projPath, task, model)
	if err != nil {
		httpError(w, http.StatusInternalServerError, "dispatch failed: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, DispatchResponse{
		SessionID: sid,
		Status:    "dispatched",
	})
}

// ── Tasks ───────────────────────────────────────────────────────────────────

// TaskItem represents a single parsed task from TASKS.md.
type TaskItem struct {
	Text   string `json:"text"`
	Status string `json:"status"`
	Index  int    `json:"index"`
}

func (s *Server) handleListTasks(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	tasksPath := filepath.Join(s.ProjectsDir, name, "TASKS.md")

	tasks, err := parseTasks(tasksPath)
	if err != nil {
		writeJSON(w, http.StatusOK, []TaskItem{})
		return
	}

	writeJSON(w, http.StatusOK, tasks)
}

func (s *Server) handleAddTask(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")

	var req AddTaskRequest
	if err := readJSON(r, &req); err != nil {
		httpError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	if req.Text == "" {
		httpError(w, http.StatusBadRequest, "text is required")
		return
	}

	// Verify project directory exists
	if _, err := os.Stat(filepath.Join(s.ProjectsDir, name)); os.IsNotExist(err) {
		httpError(w, http.StatusNotFound, "project not found: "+name)
		return
	}

	tasksPath := filepath.Join(s.ProjectsDir, name, "TASKS.md")
	f, err := os.OpenFile(tasksPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		httpError(w, http.StatusInternalServerError, "failed to open TASKS.md: "+err.Error())
		return
	}
	defer f.Close()

	line := fmt.Sprintf("- [ ] %s\n", req.Text)
	if _, err := f.WriteString(line); err != nil {
		httpError(w, http.StatusInternalServerError, "failed to write task: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "added"})
}

// parseTasks reads TASKS.md and returns task items.
// Supports markdown checkbox format: - [ ] todo, - [x] done, - [~] in-progress
func parseTasks(path string) ([]TaskItem, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var tasks []TaskItem
	idx := 0
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())

		var status, text string
		switch {
		case strings.HasPrefix(line, "- [x] ") || strings.HasPrefix(line, "- [X] "):
			status = "done"
			text = line[6:]
		case strings.HasPrefix(line, "- [~] "):
			status = "in-progress"
			text = line[6:]
		case strings.HasPrefix(line, "- [ ] "):
			status = "todo"
			text = line[6:]
		default:
			continue
		}

		tasks = append(tasks, TaskItem{
			Text:   strings.TrimSpace(text),
			Status: status,
			Index:  idx,
		})
		idx++
	}

	return tasks, scanner.Err()
}
