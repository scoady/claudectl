package server

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/scoady/codexctl/internal/metrics"
	"github.com/scoady/codexctl/internal/telemetry"
)

// Config holds server configuration options.
type Config struct {
	Addr        string
	ProjectsDir string
}

// Server is the c9-operator HTTP server.
type Server struct {
	Hub             *Hub
	Broker          *Broker
	Operator        *Operator
	Metrics         *metrics.Store
	OTelInstruments *telemetry.Instruments
	StartedAt       time.Time
	ProjectsDir     string
	StaticFS        fs.FS // set externally for the web dashboard; nil = no static serving
	mux             *http.ServeMux
}

// New creates a new Server with all routes registered.
func New(cfg Config) *Server {
	projectsDir := cfg.ProjectsDir
	if projectsDir == "" {
		home, _ := os.UserHomeDir()
		projectsDir = filepath.Join(home, "codex-managed-git-projects")
	}
	_ = os.MkdirAll(projectsDir, 0o755)

	hub := NewHub()
	broker := NewBroker(hub, "")
	operator := NewOperator(broker, hub, projectsDir)
	ms := metrics.NewStore()

	s := &Server{
		Hub:         hub,
		Broker:      broker,
		Operator:    operator,
		Metrics:     ms,
		StartedAt:   time.Now(),
		ProjectsDir: projectsDir,
		mux:         http.NewServeMux(),
	}
	s.registerRoutes()

	// Wire broker callbacks to emit operator events
	broker.OnSessionDone = func(sessionID, reason string) {
		switch reason {
		case "idle":
			operator.Emit(Event{Type: EventAgentIdle, SessionID: sessionID})
		case "error":
			operator.Emit(Event{Type: EventAgentError, SessionID: sessionID})
		default:
			operator.Emit(Event{Type: EventAgentDone, SessionID: sessionID})
		}
	}

	// Wire metrics callbacks (wraps the OnSessionDone above)
	s.wireMetricsCallbacks()

	// Start the operator reconciliation loop
	operator.Start()

	return s
}

// Handler returns the fully-wrapped HTTP handler (CORS + OTel middleware).
func (s *Server) Handler() http.Handler {
	h := s.corsMiddleware(s.mux)
	return telemetry.HTTPMiddleware(h)
}

// ListenAndServe starts the HTTP server on the given address.
func (s *Server) ListenAndServe() error {
	addr := ":4040"
	log.Printf("[server] listening on %s", addr)
	return http.ListenAndServe(addr, s.Handler())
}

// ListenAndServeAddr starts the HTTP server on a specific address.
func (s *Server) ListenAndServeAddr(addr string) error {
	log.Printf("[server] listening on %s", addr)
	return http.ListenAndServe(addr, s.Handler())
}

// ── Route Registration ───────────────────────────────────────────────────────

func (s *Server) registerRoutes() {
	// Health & Stats
	s.mux.HandleFunc("GET /api/health", s.handleHealth)
	s.mux.HandleFunc("GET /api/stats", s.handleStats)

	// WebSocket (upgrades use GET)
	s.mux.HandleFunc("GET /ws", s.Hub.HandleWS)

	// Projects (implemented)
	s.mux.HandleFunc("POST /api/projects", s.handleCreateProject)
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
	s.mux.HandleFunc("GET /api/projects/{name}/files", s.handleListFiles)
	s.mux.HandleFunc("GET /api/projects/{name}/files/content", s.handleReadFile)
	s.mux.HandleFunc("PUT /api/projects/{name}/files/content", s.handleWriteFile)
	s.mux.HandleFunc("POST /api/projects/{name}/files/mkdir", s.handleMakeDir)
	s.mux.HandleFunc("POST /api/projects/{name}/exec", s.handleExecCommand)
	s.mux.HandleFunc("GET /api/projects/{name}/files/status", s.handleGitStatus)
	s.mux.HandleFunc("GET /api/projects/{name}/files/branch", s.handleGitBranch)

	// Agents (implemented)
	s.mux.HandleFunc("GET /api/agents", s.handleListAgents)
	s.mux.HandleFunc("DELETE /api/agents/{id}", s.handleCancelAgent)
	s.mux.HandleFunc("POST /api/agents/{id}/inject", s.handleInjectMessage)
	s.mux.HandleFunc("GET /api/agents/{id}/messages", s.handleGetMessages)

	// Operator (implemented)
	s.mux.HandleFunc("POST /api/operator/spawn", s.handleOperatorSpawn)
	s.mux.HandleFunc("GET /api/operator/state", s.handleOperatorState)

	// Metrics (implemented)
	s.mux.HandleFunc("GET /api/metrics/agents", s.handleMetricsAgents)
	s.mux.HandleFunc("GET /api/metrics/costs", s.handleMetricsCosts)
	s.mux.HandleFunc("GET /api/metrics/tasks", s.handleMetricsTasks)
	s.mux.HandleFunc("GET /api/metrics/models", s.handleMetricsModels)
	s.mux.HandleFunc("GET /api/metrics/projects", s.handleMetricsProjects)
	s.mux.HandleFunc("GET /api/metrics/health", s.handleMetricsHealth)
	s.mux.HandleFunc("GET /api/metrics/summary", s.handleMetricsSummary)

	// Canvas
	s.mux.HandleFunc("GET /api/canvas/{project}", s.handleGetCanvas)
	s.mux.HandleFunc("DELETE /api/canvas/{project}", s.handleClearCanvas)
	s.mux.HandleFunc("POST /api/canvas/{project}/widgets", s.handleCreateCanvasWidget)
	s.mux.HandleFunc("PUT /api/canvas/{project}/widgets/{id}", s.handleUpdateCanvasWidget)
	s.mux.HandleFunc("DELETE /api/canvas/{project}/widgets/{id}", s.handleDeleteCanvasWidget)
	s.mux.HandleFunc("GET /api/canvas/{project}/tabs", s.handleGetCanvasTabs)
	s.mux.HandleFunc("PUT /api/canvas/{project}/layout", s.handleSaveCanvasLayout)
	s.mux.HandleFunc("GET /api/canvas/{project}/contract", s.handleGetCanvasContract)
	s.mux.HandleFunc("POST /api/canvas/{project}/seed", s.handleSeedCanvas)
	s.mux.HandleFunc("POST /api/canvas/{project}/scene", s.handleReplaceCanvasScene)
	s.mux.HandleFunc("GET /api/canvas/templates", s.handleGetCanvasTemplates)
	s.mux.HandleFunc("POST /api/canvas/templates", s.handleSaveCanvasTemplate)

	// Widget catalog
	s.mux.HandleFunc("GET /api/widget-catalog", s.handleGetWidgetCatalog)
	s.mux.HandleFunc("GET /api/widget-catalog/{id}", s.handleGetWidgetCatalogItem)
	s.mux.HandleFunc("DELETE /api/widget-catalog/{id}", s.handleDeleteWidgetCatalogItem)

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
		"version":        "2.0.1",
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
	// Try serving the exact file first; fall back to index.html for SPA routing
	path := r.URL.Path
	if path == "/" {
		path = "index.html"
	} else {
		path = path[1:] // strip leading /
	}
	if _, err := fs.Stat(s.StaticFS, path); err != nil {
		// File not found — serve index.html for client-side routing
		path = "index.html"
	}
	data, err := fs.ReadFile(s.StaticFS, path)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	// Set content type
	switch {
	case strings.HasSuffix(path, ".html"):
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
	case strings.HasSuffix(path, ".js"):
		w.Header().Set("Content-Type", "application/javascript")
	case strings.HasSuffix(path, ".css"):
		w.Header().Set("Content-Type", "text/css")
	case strings.HasSuffix(path, ".svg"):
		w.Header().Set("Content-Type", "image/svg+xml")
	case strings.HasSuffix(path, ".json"):
		w.Header().Set("Content-Type", "application/json")
	}
	w.Write(data)
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
