package server

import (
	"bufio"
	"fmt"
	"net/http"
	"os"
	"os/exec"
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

func (s *Server) handleCreateProject(w http.ResponseWriter, r *http.Request) {
	var req CreateProjectRequest
	if err := readJSON(r, &req); err != nil {
		httpError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	if req.Name == "" {
		httpError(w, http.StatusBadRequest, "name is required")
		return
	}

	projPath := filepath.Join(s.ProjectsDir, req.Name)
	if _, err := os.Stat(projPath); err == nil {
		httpError(w, http.StatusConflict, "project already exists: "+req.Name)
		return
	}

	// Create project directory structure
	if err := os.MkdirAll(filepath.Join(projPath, ".codex"), 0o755); err != nil {
		httpError(w, http.StatusInternalServerError, "failed to create project: "+err.Error())
		return
	}

	// Write PROJECT.md
	projectMD := fmt.Sprintf("# %s\n\n%s\n", req.Name, req.Description)
	if err := os.WriteFile(filepath.Join(projPath, "PROJECT.md"), []byte(projectMD), 0o644); err != nil {
		httpError(w, http.StatusInternalServerError, "failed to write PROJECT.md: "+err.Error())
		return
	}

	// Write model config if specified
	if req.Model != "" {
		cfg := fmt.Sprintf(`{"parallelism":1,"model":"%s"}`, req.Model)
		os.WriteFile(filepath.Join(projPath, ".codex", "manager.json"), []byte(cfg), 0o644)
	}

	if _, err := s.ensureCanvasProjectSpace(req.Name); err != nil {
		httpError(w, http.StatusInternalServerError, "failed to initialize canvas space: "+err.Error())
		return
	}

	gitInit := exec.Command("git", "init", "-b", "main")
	gitInit.Dir = projPath
	if err := gitInit.Run(); err != nil {
		gitInit = exec.Command("git", "init")
		gitInit.Dir = projPath
		if err := gitInit.Run(); err != nil {
			httpError(w, http.StatusInternalServerError, "failed to initialize git repo: "+err.Error())
			return
		}
	}

	writeJSON(w, http.StatusCreated, map[string]string{
		"name":   req.Name,
		"status": "created",
	})
}

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

	if s.Operator == nil {
		httpError(w, http.StatusServiceUnavailable, "operator not initialized")
		return
	}

	// Add task to TASKS.md so it appears on the kanban board
	tasksPath := filepath.Join(projPath, "TASKS.md")
	if f, err := os.OpenFile(tasksPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644); err == nil {
		fmt.Fprintf(f, "- [~] %s\n", req.Task)
		f.Close()
	}

	// Emit dispatch event — operator handles spawning
	s.Operator.Emit(Event{
		Type:        EventTaskDispatched,
		ProjectName: name,
		Task:        req.Task,
		Model:       req.Model,
	})

	writeJSON(w, http.StatusAccepted, DispatchResponse{
		Status: "accepted",
	})
}

// handleSpawnAgent lets agents request spawning other agents via the operator.
// POST /api/operator/spawn
func (s *Server) handleOperatorSpawn(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ProjectName string `json:"project_name"`
		Task        string `json:"task"`
		Model       string `json:"model,omitempty"`
		SpawnedBy   string `json:"spawned_by,omitempty"`
	}
	if err := readJSON(r, &req); err != nil {
		httpError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}
	if req.ProjectName == "" || req.Task == "" {
		httpError(w, http.StatusBadRequest, "project_name and task are required")
		return
	}

	s.Operator.Emit(Event{
		Type:        EventSpawnRequest,
		ProjectName: req.ProjectName,
		Task:        req.Task,
		Model:       req.Model,
		SessionID:   req.SpawnedBy,
	})

	writeJSON(w, http.StatusAccepted, map[string]string{"status": "accepted"})
}

// handleOperatorState returns the current operator state.
func (s *Server) handleOperatorState(w http.ResponseWriter, r *http.Request) {
	tasks := s.Operator.GetPendingTasks()
	writeJSON(w, http.StatusOK, map[string]any{
		"tasks": tasks,
		"total": len(tasks),
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
