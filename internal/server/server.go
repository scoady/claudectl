package server

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

// Config holds server configuration options.
type Config struct {
	Addr        string
	ProjectsDir string
}

// Server is the claudectl HTTP server.
type Server struct {
	Hub        *Hub
	Broker     *Broker
	StartedAt  time.Time
	ProjectsDir string
	StaticFS   fs.FS // set externally for the web dashboard; nil = no static serving
	mux        *http.ServeMux
}

// New creates a new Server with all routes registered.
func New(cfg Config) *Server {
	projectsDir := cfg.ProjectsDir
	if projectsDir == "" {
		home, _ := os.UserHomeDir()
		projectsDir = filepath.Join(home, "git", "claude-managed-projects")
	}

	hub := NewHub()
	s := &Server{
		Hub:         hub,
		Broker:      NewBroker(hub, ""),
		StartedAt:   time.Now(),
		ProjectsDir: projectsDir,
		mux:         http.NewServeMux(),
	}
	s.registerRoutes()
	return s
}

// ListenAndServe starts the HTTP server on the given address.
func (s *Server) ListenAndServe() error {
	addr := ":4040"
	log.Printf("[server] listening on %s", addr)
	return http.ListenAndServe(addr, s.corsMiddleware(s.mux))
}

// ListenAndServeAddr starts the HTTP server on a specific address.
func (s *Server) ListenAndServeAddr(addr string) error {
	log.Printf("[server] listening on %s", addr)
	return http.ListenAndServe(addr, s.corsMiddleware(s.mux))
}

// ── Route Registration ───────────────────────────────────────────────────────

func (s *Server) registerRoutes() {
	// Health & Stats
	s.mux.HandleFunc("GET /api/health", s.handleHealth)
	s.mux.HandleFunc("GET /api/stats", s.handleStats)

	// WebSocket
	s.mux.HandleFunc("/ws", s.Hub.HandleWS)

	// Projects (implemented)
	s.mux.HandleFunc("GET /api/projects", s.handleListProjects)
	s.mux.HandleFunc("GET /api/projects/{name}", s.handleGetProject)
	s.mux.HandleFunc("POST /api/projects/{name}/dispatch", s.handleDispatch)
	s.mux.HandleFunc("GET /api/projects/{name}/tasks", s.handleListTasks)
	s.mux.HandleFunc("POST /api/projects/{name}/tasks", s.handleAddTask)

	// Projects (stubs for future implementation)
	s.mux.HandleFunc("POST /api/projects/{name}", s.stub)
	s.mux.HandleFunc("DELETE /api/projects/{name}", s.stub)
	s.mux.HandleFunc("PUT /api/projects/{name}/config", s.stub)
	s.mux.HandleFunc("PUT /api/projects/{name}/tasks/{index}", s.stub)
	s.mux.HandleFunc("DELETE /api/projects/{name}/tasks/{index}", s.stub)
	s.mux.HandleFunc("POST /api/projects/{name}/tasks/{index}/start", s.stub)
	s.mux.HandleFunc("POST /api/projects/{name}/tasks/{index}/complete", s.stub)
	s.mux.HandleFunc("GET /api/projects/{name}/files", s.stub)
	s.mux.HandleFunc("GET /api/projects/{name}/files/content", s.stub)
	s.mux.HandleFunc("GET /api/projects/{name}/files/status", s.stub)

	// Agents (implemented)
	s.mux.HandleFunc("GET /api/agents", s.handleListAgents)
	s.mux.HandleFunc("DELETE /api/agents/{id}", s.handleCancelAgent)
	s.mux.HandleFunc("POST /api/agents/{id}/inject", s.handleInjectMessage)
	s.mux.HandleFunc("GET /api/agents/{id}/messages", s.handleGetMessages)

	// Metrics (stubs)
	s.mux.HandleFunc("GET /api/metrics/agents", s.stub)
	s.mux.HandleFunc("GET /api/metrics/costs", s.stub)
	s.mux.HandleFunc("GET /api/metrics/tasks", s.stub)
	s.mux.HandleFunc("GET /api/metrics/models", s.stub)
	s.mux.HandleFunc("GET /api/metrics/projects", s.stub)
	s.mux.HandleFunc("GET /api/metrics/health", s.stub)
	s.mux.HandleFunc("GET /api/metrics/summary", s.stub)

	// Canvas (stubs)
	s.mux.HandleFunc("GET /api/canvas/{project}", s.stub)
	s.mux.HandleFunc("DELETE /api/canvas/{project}", s.stub)
	s.mux.HandleFunc("POST /api/canvas/{project}/widgets", s.stub)
	s.mux.HandleFunc("PUT /api/canvas/{project}/widgets/{id}", s.stub)
	s.mux.HandleFunc("DELETE /api/canvas/{project}/widgets/{id}", s.stub)
	s.mux.HandleFunc("GET /api/canvas/{project}/tabs", s.stub)
	s.mux.HandleFunc("PUT /api/canvas/{project}/layout", s.stub)
	s.mux.HandleFunc("GET /api/canvas/{project}/contract", s.stub)
	s.mux.HandleFunc("POST /api/canvas/{project}/seed", s.stub)
	s.mux.HandleFunc("POST /api/canvas/{project}/scene", s.stub)
	s.mux.HandleFunc("GET /api/canvas/templates", s.stub)
	s.mux.HandleFunc("POST /api/canvas/templates", s.stub)

	// Widget catalog (stubs)
	s.mux.HandleFunc("GET /api/widget-catalog", s.stub)
	s.mux.HandleFunc("GET /api/widget-catalog/{id}", s.stub)
	s.mux.HandleFunc("DELETE /api/widget-catalog/{id}", s.stub)

	// Static files — serve embedded dashboard at root (if set).
	s.mux.HandleFunc("GET /", s.handleStatic)
}

// ── Handlers ─────────────────────────────────────────────────────────────────

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	agentCount := 0
	if s.Broker != nil {
		agentCount = s.Broker.ActiveCount()
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":         "ok",
		"uptime":         time.Since(s.StartedAt).Seconds(),
		"version":        "0.1.0",
		"agents":         agentCount,
		"ws_connections": s.Hub.ClientCount(),
	})
}

func (s *Server) stub(w http.ResponseWriter, r *http.Request) {
	httpError(w, http.StatusNotImplemented, "not implemented")
}

func (s *Server) handleStatic(w http.ResponseWriter, r *http.Request) {
	if s.StaticFS == nil {
		http.NotFound(w, r)
		return
	}
	http.FileServerFS(s.StaticFS).ServeHTTP(w, r)
}

// ── Middleware ────────────────────────────────────────────────────────────────

func (s *Server) corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// ── JSON Helpers ─────────────────────────────────────────────────────────────

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("[server] json encode error: %v", err)
	}
}

func readJSON(r *http.Request, v any) error {
	if r.Body == nil {
		return fmt.Errorf("empty request body")
	}
	defer r.Body.Close()
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	return dec.Decode(v)
}

func httpError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"detail": msg})
}
