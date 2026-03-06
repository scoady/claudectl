# c9s Architecture v2 -- Single Binary Vision

> Date: 2026-03-06
> Status: ARCHITECTURE -- the north star for c9s development

---

## 1. Executive Summary

c9s is a single Go binary that replaces the Python FastAPI backend, Docker Compose stack, MCP sidecar containers, and shell startup scripts with one unified process. It manages Claude agent subprocesses, serves the web dashboard as embedded static files, hosts MCP servers in-process, persists all state to SQLite, reads OAuth credentials natively from the macOS Keychain, and provides both an interactive k9s-style TUI and a scriptable CLI. One binary. One process. One container. Everything else stays the same -- the frontend SPA, the WebSocket event protocol, the canvas widget system, the constellation theme, and all the visual magic are unchanged.

---

## 2. The Vision

```
TODAY (Python backend, 3 containers, startup scripts):

  macOS Host
  +-----------------------------------------------------------+
  |  scripts/start.sh                                          |
  |    -> extracts OAuth token from macOS Keychain             |
  |    -> writes .claude-snapshot/oauth-token                  |
  |    -> docker compose up                                    |
  |                                                            |
  |  docker-compose.yml                                        |
  |  +-------------------------------------------------------+ |
  |  | backend         (python:3.11-slim, ~800MB image)      | |
  |  |   FastAPI + uvicorn (79 HTTP endpoints + 1 WS)        | |
  |  |   AgentBroker (subprocess management, in-memory)      | |
  |  |   13 storage backends (dicts, JSON files, Postgres)   | |
  |  +-------------------------------------------------------+ |
  |  | mcp-canvas      (same image, port 4041)               | |
  |  |   FastMCP SSE server, 7 canvas tools                  | |
  |  +-------------------------------------------------------+ |
  |  | mcp-orchestrator (same image, port 4042)              | |
  |  |   FastMCP SSE server, task/workflow tools             | |
  |  +-------------------------------------------------------+ |
  +-----------------------------------------------------------+
          ^
          | proxy /api/ + /ws -> host.docker.internal:4040
  +-------------------+
  | kind k8s cluster  |
  | frontend (nginx)  |
  | claude-manager.   |
  |   localhost        |
  +-------------------+


TOMORROW (single Go binary, ~50MB):

  c9s serve
  +-----------------------------------------------------------+
  |  One process, one binary                                   |
  |                                                            |
  |  +-- HTTP API server (chi router) -----------------------+ |
  |  |   79 endpoints, 1:1 parity with FastAPI               | |
  |  +-------------------------------------------------------+ |
  |  +-- WebSocket server -----------------------------------+ |
  |  |   Fan-out hub, goroutine per client, parallel sends   | |
  |  +-------------------------------------------------------+ |
  |  +-- Static file server ---------------------------------+ |
  |  |   Embedded frontend SPA via go:embed                  | |
  |  +-------------------------------------------------------+ |
  |  +-- Agent broker ---------------------------------------+ |
  |  |   Goroutine per session, bufio.Scanner stream parse   | |
  |  |   context.Context cancellation, sync.RWMutex state    | |
  |  +-------------------------------------------------------+ |
  |  +-- MCP servers (embedded) -----------------------------+ |
  |  |   Canvas: 7 tools, in-process HTTP handlers           | |
  |  |   Orchestrator: task/workflow tools                    | |
  |  +-------------------------------------------------------+ |
  |  +-- SQLite (modernc.org/sqlite, pure Go) ---------------+ |
  |  |   Replaces 13 storage backends with one database      | |
  |  |   Events, sessions, tasks, widgets, workflows, cron   | |
  |  +-------------------------------------------------------+ |
  |  +-- Credential manager ---------------------------------+ |
  |  |   Native macOS Keychain via go-keyring                | |
  |  |   Auto-refresh on 401, no start.sh scripts            | |
  |  +-------------------------------------------------------+ |
  +-----------------------------------------------------------+
```

---

## 3. Binary Modes

```
c9s                            -> Interactive TUI (k9s-style dashboard)
c9s serve                      -> Start server (API + WS + frontend + MCP + broker)
c9s serve --headless           -> Server only, no TUI attached
c9s serve --port 4040          -> Custom port (default: 4040)
c9s serve --frontend ./dist    -> Serve frontend from directory instead of embedded

c9s status                     -> Rich status dashboard (projects, agents, stats)
c9s projects [name]            -> List projects or show detail
c9s agents [--active]          -> List agents
c9s agents stop <session_id>   -> Stop an agent
c9s dispatch <project> <task>  -> Dispatch a task (--follow for live stream)
c9s watch <target>             -> Stream live agent output via WebSocket
c9s tasks <project>            -> List tasks
c9s canvas <project>           -> List/manage canvas widgets

c9s health                     -> Check server health
c9s version                    -> Version info and build metadata
```

When `c9s` launches the TUI with no subcommand, it auto-starts the server if one is not already running on the configured port. This mirrors how Docker Desktop auto-starts the Docker daemon -- the user just runs `c9s` and everything works.

The CLI commands (`status`, `dispatch`, `watch`, etc.) talk to a running server over HTTP/WebSocket. If no server is running, they print a helpful error: `c9s server not running. Start it with: c9s serve`.

---

## 4. Package Architecture

```
claudectl/
  cmd/
    main.go                      -- entry point, cobra root command, mode detection

  internal/
    server/
      server.go                  -- HTTP + WS server lifecycle (start, shutdown, health)
      routes.go                  -- all /api/* handlers (1:1 port from FastAPI's 79 endpoints)
      routes_projects.go         -- project CRUD, dispatch, config
      routes_agents.go           -- agent list, messages, inject, cancel
      routes_tasks.go            -- task CRUD, plan, start/complete
      routes_canvas.go           -- widget CRUD, layout, scene, design, catalog
      routes_workflows.go        -- workflow CRUD, start/pause/resume/advance
      routes_settings.go         -- global settings, plugins, skills, roles
      routes_cron.go             -- cron job CRUD, trigger
      routes_artifacts.go        -- file browser, content, git status
      websocket.go               -- WS upgrade, hub, fan-out, event broadcasting
      static.go                  -- embedded frontend SPA serving (go:embed)
      middleware.go              -- CORS, logging, recovery

    broker/
      broker.go                  -- agent lifecycle: create, cancel, inject, registry
      session.go                 -- subprocess spawn, stdout stream parse, event emit
      events.go                  -- typed event definitions (all WS event types)
      hooks.go                   -- capability-driven lifecycle hooks (replaces is_controller branching)

    mcp/
      canvas.go                  -- canvas MCP server (7 tools, embedded HTTP handler)
      orchestrator.go            -- orchestrator MCP server (task/workflow tools)
      transport.go               -- SSE transport implementation for MCP protocol
      capabilities.go            -- capability catalog (design tokens, CDN libs, schemas)

    store/
      sqlite.go                  -- SQLite connection, WAL mode, busy timeout
      migrations.go              -- schema versioning and migration runner
      sessions.go                -- session CRUD + event append
      projects.go                -- project metadata (supplements filesystem scan)
      tasks.go                   -- task CRUD (replaces TASKS.md regex parsing)
      widgets.go                 -- widget CRUD + layout persistence
      workflows.go               -- workflow state machine persistence
      cron.go                    -- cron job persistence
      milestones.go              -- milestone append + query

    tui/
      app.go                     -- bubbletea main model, screen router
      dashboard.go               -- dashboard: project list, agent summary, stats
      project.go                 -- project detail: agents, tasks, config
      watch.go                   -- live agent stream viewer (text + milestones)
      dispatch.go                -- dispatch prompt with project picker
      keymap.go                  -- global key bindings (vim-style navigation)
      styles.go                  -- lipgloss theme (constellation-inspired)
      components/
        table.go                 -- reusable table component
        statusbar.go             -- bottom status bar with key hints
        spinner.go               -- agent activity spinner

    api/
      client.go                  -- HTTP client (CLI mode talks to running server)
      models.go                  -- shared data types (used by both server and client)

    config/
      config.go                  -- configuration: port, data dirs, frontend path
      credentials.go             -- OAuth token from macOS Keychain (go-keyring)
      paths.go                   -- standard paths (~/.claude, managed-projects, etc.)

  c9s                            -- compiled binary (gitignored)
  go.mod
  go.sum
  ARCHITECTURE.md                -- this document
```

---

## 5. API Compatibility

The HTTP API is backwards-compatible with the current Python backend. The existing frontend SPA works unchanged -- it does not know or care whether the backend is Python or Go.

### Full Endpoint Map (79 endpoints + 1 WebSocket)

```
PROJECTS (6 endpoints)
  GET    /api/projects                              -> routes_projects.go
  POST   /api/projects                              -> routes_projects.go
  GET    /api/projects/{name}                       -> routes_projects.go
  PUT    /api/projects/{name}/config                -> routes_projects.go
  DELETE /api/projects/{name}                       -> routes_projects.go
  POST   /api/projects/{name}/dispatch              -> routes_projects.go

TASKS (7 endpoints)
  GET    /api/projects/{name}/tasks                 -> routes_tasks.go
  POST   /api/projects/{name}/tasks                 -> routes_tasks.go
  PUT    /api/projects/{name}/tasks/{index}         -> routes_tasks.go
  DELETE /api/projects/{name}/tasks/{index}         -> routes_tasks.go
  POST   /api/projects/{name}/tasks/plan            -> routes_tasks.go
  POST   /api/projects/{name}/tasks/{index}/start   -> routes_tasks.go
  POST   /api/projects/{name}/tasks/{index}/complete-> routes_tasks.go

AGENTS (4 endpoints)
  GET    /api/agents                                -> routes_agents.go
  GET    /api/agents/{session_id}/messages           -> routes_agents.go
  POST   /api/agents/{session_id}/inject             -> routes_agents.go
  DELETE /api/agents/{session_id}                    -> routes_agents.go

ORCHESTRATOR (1 endpoint)
  POST   /api/projects/{name}/orchestrator          -> routes_projects.go

MILESTONES (3 endpoints)
  GET    /api/projects/{name}/milestones            -> routes_projects.go
  DELETE /api/projects/{name}/milestones/{id}       -> routes_projects.go
  DELETE /api/projects/{name}/milestones            -> routes_projects.go

TEMPLATES (3 endpoints)
  GET    /api/templates                             -> routes_workflows.go
  GET    /api/templates/{template_id}               -> routes_workflows.go
  POST   /api/templates                             -> routes_workflows.go

WORKFLOWS (4 endpoints)
  GET    /api/projects/{name}/workflow              -> routes_workflows.go
  POST   /api/projects/{name}/workflow              -> routes_workflows.go
  POST   /api/projects/{name}/workflow/start        -> routes_workflows.go
  POST   /api/projects/{name}/workflow/action       -> routes_workflows.go
  DELETE /api/projects/{name}/workflow              -> routes_workflows.go

RULES (1 endpoint)
  GET    /api/rules                                 -> routes_settings.go

SETTINGS (4 endpoints)
  GET    /api/settings/global                       -> routes_settings.go
  PUT    /api/settings/global                       -> routes_settings.go
  GET    /api/settings/plugins                      -> routes_settings.go
  POST   /api/settings/plugins/{id}/enable          -> routes_settings.go
  POST   /api/settings/plugins/{id}/disable         -> routes_settings.go

SKILLS (5 endpoints)
  GET    /api/skills                                -> routes_settings.go
  GET    /api/skills/marketplace                    -> routes_settings.go
  POST   /api/skills                                -> routes_settings.go
  GET    /api/projects/{name}/skills                -> routes_settings.go
  POST   /api/projects/{name}/skills/{skill}/enable -> routes_settings.go
  POST   /api/projects/{name}/skills/{skill}/disable-> routes_settings.go

ROLES (5 endpoints)
  GET    /api/roles                                 -> routes_settings.go
  GET    /api/roles/all                             -> routes_settings.go
  POST   /api/roles                                 -> routes_settings.go
  PUT    /api/roles/{role_id}                       -> routes_settings.go
  DELETE /api/roles/{role_id}                       -> routes_settings.go

ARTIFACTS (3 endpoints)
  GET    /api/projects/{name}/files                 -> routes_artifacts.go
  GET    /api/projects/{name}/files/content         -> routes_artifacts.go
  GET    /api/projects/{name}/files/status          -> routes_artifacts.go

CRON (5 endpoints)
  GET    /api/projects/{name}/cron                  -> routes_cron.go
  POST   /api/projects/{name}/cron                  -> routes_cron.go
  PUT    /api/projects/{name}/cron/{job_id}         -> routes_cron.go
  DELETE /api/projects/{name}/cron/{job_id}         -> routes_cron.go
  POST   /api/projects/{name}/cron/{job_id}/trigger -> routes_cron.go

CANVAS (19 endpoints)
  GET    /api/canvas/{project}                      -> routes_canvas.go
  GET    /api/canvas/{project}/tabs                 -> routes_canvas.go
  POST   /api/canvas/{project}/widgets              -> routes_canvas.go
  PUT    /api/canvas/{project}/widgets/{id}         -> routes_canvas.go
  DELETE /api/canvas/{project}/widgets/{id}         -> routes_canvas.go
  POST   /api/canvas/{project}/scene                -> routes_canvas.go
  POST   /api/canvas/{project}/seed                 -> routes_canvas.go
  POST   /api/canvas/{project}/design               -> routes_canvas.go
  DELETE /api/canvas/{project}                      -> routes_canvas.go
  PUT    /api/canvas/{project}/layout               -> routes_canvas.go
  GET    /api/canvas/templates                      -> routes_canvas.go
  POST   /api/canvas/templates                      -> routes_canvas.go
  POST   /api/canvas/{project}/widgets/{id}/paste-template -> routes_canvas.go
  GET    /api/canvas/{project}/contract             -> routes_canvas.go
  POST   /api/canvas/{project}/controller           -> routes_canvas.go
  GET    /api/widget-catalog                        -> routes_canvas.go
  GET    /api/widget-catalog/{id}/render            -> routes_canvas.go
  POST   /api/widget-catalog                        -> routes_canvas.go
  POST   /api/widget-catalog/generate               -> routes_canvas.go
  POST   /api/widget-catalog/{id}/preview           -> routes_canvas.go
  GET    /api/widget-catalog/{id}                   -> routes_canvas.go
  DELETE /api/widget-catalog/{id}                   -> routes_canvas.go

SYSTEM (2 endpoints)
  GET    /api/stats                                 -> server.go
  GET    /api/health                                -> server.go

WEBSOCKET (1 endpoint)
  WS     /ws                                        -> websocket.go
```

The frontend SPA is served either as embedded static files (Go's `//go:embed` directive for production builds) or from a filesystem directory (for development with `--frontend ./dist`).

---

## 6. Agent Broker in Go

The Python broker's asyncio event loop becomes goroutines. Each agent session runs in its own goroutine with clean cancellation via `context.Context`.

### Core Types

```go
// Broker owns all agent sessions and fans events to WebSocket clients.
type Broker struct {
    mu       sync.RWMutex
    sessions map[string]*Session    // session_id -> Session
    events   chan Event              // all session events funnel here
    ws       *WSHub                  // fan-out to WebSocket clients
    store    *store.Store            // SQLite persistence
    hooks    map[string][]HookFunc   // capability -> lifecycle hooks
}

// Session is one continuous conversation with a claude CLI subprocess.
type Session struct {
    ID            string
    ProjectName   string
    ProjectPath   string
    Task          string
    Model         string
    Phase         Phase
    Capabilities  map[string]bool    // replaces is_controller bool
    TaskIndex     *int               // TASKS.md index if task-bound
    MCPConfigPath string
    StartedAt     time.Time
    TurnCount     int
    Milestones    []string
    CLISessionID  string             // from system.init event

    mu            sync.RWMutex       // protects Phase, Milestones, TurnCount
    cmd           *exec.Cmd
    stdout        io.ReadCloser
    stderr        io.ReadCloser
    cancel        context.CancelFunc
    events        chan Event          // per-session event stream -> broker
    pendingInject chan string         // buffered channel for injection
    pendingAgents map[string]ToolEvent // subagent tracking
}

// Phase represents the agent's current lifecycle phase.
type Phase string

const (
    PhaseStarting  Phase = "starting"
    PhaseThinking  Phase = "thinking"
    PhaseGenerating Phase = "generating"
    PhaseToolInput Phase = "tool_input"
    PhaseToolExec  Phase = "tool_exec"
    PhaseIdle      Phase = "idle"
    PhaseInjecting Phase = "injecting"
    PhaseCancelled Phase = "cancelled"
    PhaseError     Phase = "error"
)

// HookFunc is called when a session reaches a lifecycle point.
// Capabilities determine which hooks fire.
type HookFunc func(ctx context.Context, b *Broker, s *Session, reason string) error
```

### Capability-Driven Hooks (replaces is_controller branching)

```go
func init() {
    // Register hooks by capability
    RegisterHook("persistent", hookPersistOnIdle)     // stay in registry
    RegisterHook("workflow",   hookWorkflowContinue)   // auto-advance phase
    RegisterHook("task_bound", hookMarkTaskDone)        // mark TASKS.md entry done
}

func (b *Broker) onSessionDone(ctx context.Context, s *Session, reason string) {
    // Always: milestone capture + DB persist
    b.captureMilestone(s, reason)
    b.store.UpdateSession(s.ID, reason)

    // Capability-driven hooks (no if/elif chain)
    for cap := range s.Capabilities {
        for _, hook := range b.hooks[cap] {
            hook(ctx, b, s, reason)
        }
    }

    // Always: check task queue if capacity opened
    if reason == "idle" {
        b.checkTaskQueue(ctx, s.ProjectName)
    }

    // Registry cleanup
    if reason != "idle" && !s.Capabilities["persistent"] {
        b.mu.Lock()
        delete(b.sessions, s.ID)
        b.mu.Unlock()
    }
}
```

### The Hot Path: Stream Parsing

```go
func (s *Session) streamOutput(ctx context.Context) {
    scanner := bufio.NewScanner(s.stdout)
    buf := make([]byte, 0, 64*1024)
    scanner.Buffer(buf, 1<<20) // 1MB max line (matches Python's 1MB readline limit)

    for scanner.Scan() {
        select {
        case <-ctx.Done():
            return
        default:
        }

        var event StreamEvent
        if err := json.Unmarshal(scanner.Bytes(), &event); err != nil {
            continue
        }
        s.handleEvent(ctx, &event)
    }
}

func (s *Session) handleEvent(ctx context.Context, event *StreamEvent) {
    switch event.Type {
    case "system":
        if event.Subtype == "init" {
            s.CLISessionID = event.SessionID
        }

    case "content_block_start":
        block := event.ContentBlock
        switch block.Type {
        case "tool_use":
            s.setPhase(PhaseToolInput)
            s.currentToolName = block.Name
            s.currentToolID = block.ID
            s.toolInputBuf.Reset()
        case "thinking":
            s.setPhase(PhaseThinking)
        case "text":
            s.setPhase(PhaseGenerating)
        }

    case "content_block_delta":
        delta := event.Delta
        switch delta.Type {
        case "text_delta":
            s.events <- Event{Type: EventTextDelta, SessionID: s.ID,
                Data: map[string]any{"chunk": delta.Text}}
        case "input_json_delta":
            s.toolInputBuf.WriteString(delta.PartialJSON)
        }

    case "content_block_stop":
        if s.currentToolName != "" {
            s.finalizeToolUse()
        }

    case "message_start":
        if model := event.Message.Model; model != "" && model != "<synthetic>" {
            s.Model = model
        }

    case "assistant":
        s.appendOutputBuffer(event)

    case "user":
        s.handleToolResults(event)
    }
}
```

Each session runs in its own goroutine. No asyncio. No GIL. No readline buffer hacks. The `bufio.Scanner` with a 1MB buffer handles large stream-json events natively.

### Subprocess Spawn

```go
func (s *Session) spawnAndStream(ctx context.Context, message string, resume bool) error {
    ctx, s.cancel = context.WithCancel(ctx)

    args := []string{"--print", "--output-format", "stream-json",
        "--verbose", "--include-partial-messages",
        "--permission-mode", "acceptEdits"}

    if resume && s.CLISessionID != "" {
        args = append(args, "--resume", s.CLISessionID)
    } else {
        args = append(args, "--model", s.Model)
        if s.MCPConfigPath != "" {
            args = append(args, "--mcp-config", s.MCPConfigPath)
        }
    }

    if !resume {
        message = autonomyDirective + message
    }
    args = append(args, "--", message)

    s.cmd = exec.CommandContext(ctx, "claude", args...)
    s.cmd.Dir = s.ProjectPath
    s.cmd.Env = buildSpawnEnv()

    var err error
    s.stdout, err = s.cmd.StdoutPipe()
    if err != nil {
        return fmt.Errorf("stdout pipe: %w", err)
    }
    s.stderr, err = s.cmd.StderrPipe()
    if err != nil {
        return fmt.Errorf("stderr pipe: %w", err)
    }

    if err := s.cmd.Start(); err != nil {
        return fmt.Errorf("start: %w", err)
    }

    // Drain stderr in background
    go s.drainStderr(ctx)

    // Stream stdout (blocks until process exits or context cancelled)
    s.streamOutput(ctx)

    // Wait for process
    s.cmd.Wait()

    // Handle post-completion: turn count, pending injection, idle transition
    s.TurnCount++
    s.events <- Event{Type: EventTurnDone, SessionID: s.ID,
        Data: map[string]any{"turn_count": s.TurnCount}}

    select {
    case msg := <-s.pendingInject:
        return s.spawnAndStream(ctx, msg, true) // recursive resume
    default:
        s.setPhase(PhaseIdle)
        s.events <- Event{Type: EventSessionDone, SessionID: s.ID,
            Data: map[string]any{"reason": "idle"}}
    }
    return nil
}
```

---

## 7. WebSocket Hub

```go
// WSHub manages WebSocket connections and broadcasts events.
type WSHub struct {
    mu      sync.RWMutex
    clients map[*websocket.Conn]struct{}
}

// Broadcast sends a message to all connected clients in parallel.
func (h *WSHub) Broadcast(msgType string, data any) {
    msg, err := json.Marshal(map[string]any{
        "type":      msgType,
        "data":      data,
        "timestamp": time.Now().UTC().Format(time.RFC3339Nano),
    })
    if err != nil {
        return
    }

    h.mu.RLock()
    defer h.mu.RUnlock()

    var wg sync.WaitGroup
    for c := range h.clients {
        wg.Add(1)
        go func(conn *websocket.Conn) {
            defer wg.Done()
            conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
            if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
                h.removeClient(conn)
            }
        }(c)
    }
    wg.Wait()
}
```

Parallel WebSocket sends via goroutines. The Python backend sends sequentially, blocking the event loop during each `await ws.send_text()`. With goroutines, broadcast latency is O(1) regardless of client count.

---

## 8. Storage: SQLite

From the DATA-MODEL-ANALYSIS research, the current system uses **thirteen** distinct storage backends (in-memory dicts, JSON files, markdown files, optional PostgreSQL). c9s replaces all of them with one SQLite database.

### Schema

```sql
-- Agent session events (append-only log, the source of truth)
CREATE TABLE events (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT    NOT NULL,
    project    TEXT    NOT NULL,
    timestamp  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    type       TEXT    NOT NULL,   -- 'spawned', 'phase', 'text_delta', 'tool_start', 'tool_done', 'done'
    payload    TEXT,               -- JSON blob
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);
CREATE INDEX idx_events_session ON events(session_id);
CREATE INDEX idx_events_type    ON events(type);
CREATE INDEX idx_events_project ON events(project, timestamp);

-- Agent sessions (materialized from events, queryable)
CREATE TABLE sessions (
    id          TEXT PRIMARY KEY,
    project     TEXT NOT NULL,
    project_path TEXT NOT NULL,
    task        TEXT,
    status      TEXT NOT NULL DEFAULT 'starting',
    phase       TEXT NOT NULL DEFAULT 'starting',
    model       TEXT,
    capabilities TEXT,              -- JSON array: ["persistent","workflow","mcp:canvas"]
    task_index  INTEGER,
    started_at  TEXT NOT NULL,
    ended_at    TEXT,
    turn_count  INTEGER DEFAULT 0,
    milestones  TEXT,               -- JSON array of strings
    cli_session_id TEXT
);
CREATE INDEX idx_sessions_project ON sessions(project);
CREATE INDEX idx_sessions_status  ON sessions(status);

-- Projects (supplements filesystem scan with metadata)
CREATE TABLE projects (
    name        TEXT PRIMARY KEY,
    path        TEXT NOT NULL,
    description TEXT,
    config      TEXT                -- JSON: parallelism, model, mcp_config, dashboard_prompt
);

-- Tasks (replaces TASKS.md regex parsing with proper storage)
CREATE TABLE tasks (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    project TEXT NOT NULL,
    text    TEXT NOT NULL,
    status  TEXT NOT NULL DEFAULT 'pending',  -- pending, in_progress, done
    indent  INTEGER DEFAULT 0,
    sort_order INTEGER NOT NULL,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (project) REFERENCES projects(name)
);
CREATE INDEX idx_tasks_project ON tasks(project, sort_order);

-- Milestones (replaces per-project JSON files)
CREATE TABLE milestones (
    id          TEXT PRIMARY KEY,   -- UUID
    project     TEXT NOT NULL,
    session_id  TEXT,
    task        TEXT,
    summary     TEXT,
    agent_type  TEXT,               -- controller, standalone, subagent
    model       TEXT,
    duration_s  REAL,
    created_at  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (project) REFERENCES projects(name)
);
CREATE INDEX idx_milestones_project ON milestones(project, created_at DESC);

-- Canvas widgets (replaces ~/.claude/canvas/{project}.json + in-memory cache)
CREATE TABLE widgets (
    id           TEXT PRIMARY KEY,
    project      TEXT NOT NULL,
    title        TEXT,
    tab          TEXT DEFAULT 'dashboard',
    template_id  TEXT,
    template_data TEXT,             -- JSON
    html         TEXT,
    css          TEXT,
    js           TEXT,
    gs_x         INTEGER,
    gs_y         INTEGER,
    gs_w         INTEGER DEFAULT 4,
    gs_h         INTEGER DEFAULT 4,
    no_resize    INTEGER DEFAULT 0,
    no_move      INTEGER DEFAULT 0,
    created_at   TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at   TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (project) REFERENCES projects(name)
);
CREATE INDEX idx_widgets_project ON widgets(project);

-- Workflows (replaces per-project .claude/workflow.json)
CREATE TABLE workflows (
    id          TEXT PRIMARY KEY,
    project     TEXT NOT NULL UNIQUE,
    template_id TEXT,
    status      TEXT DEFAULT 'pending',
    team        TEXT,               -- JSON array of team roles
    config      TEXT,               -- JSON: values dict
    phases      TEXT,               -- JSON array of phase objects
    isolation   TEXT,               -- JSON array of isolation info
    created_at  TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at  TEXT,
    FOREIGN KEY (project) REFERENCES projects(name)
);

-- Cron jobs (replaces ~/.claude/cron/{project}/jobs.json)
CREATE TABLE cron_jobs (
    id          TEXT PRIMARY KEY,
    project     TEXT NOT NULL,
    name        TEXT,
    schedule    TEXT NOT NULL,      -- cron expression
    task        TEXT NOT NULL,
    enabled     INTEGER DEFAULT 1,
    last_run    TEXT,
    next_run    TEXT,
    FOREIGN KEY (project) REFERENCES projects(name)
);

-- Roles (replaces ~/.claude/roles.json)
CREATE TABLE roles (
    id          TEXT PRIMARY KEY,
    template_id TEXT,               -- NULL for custom, template_id for built-in
    role        TEXT NOT NULL,
    label       TEXT,
    persona     TEXT,
    expertise   TEXT,               -- JSON array
    is_worker   INTEGER DEFAULT 0,
    builtin     INTEGER DEFAULT 0
);
```

### Why SQLite

- **Pure Go**: `modernc.org/sqlite` compiles to Go without CGO. Zero external dependencies. The binary is truly standalone.
- **WAL mode**: concurrent readers do not block writers. Multiple goroutines can read while the broker writes events.
- **Single file**: the entire database is one file at `~/.claude/c9s.db`. Back it up by copying one file.
- **Replaces 13 backends**: no more JSON file writes, no more in-memory dicts lost on restart, no more TASKS.md regex parsing, no more optional-and-unused PostgreSQL.
- **Survives restarts**: session state, milestones, widget layouts -- everything persists.

### TASKS.md Compatibility

For backward compatibility with agents that read/write TASKS.md directly, c9s watches the file for changes (via `fsnotify`) and syncs bidirectionally:
- API writes to SQLite and regenerates TASKS.md
- File changes to TASKS.md are parsed and synced to SQLite
- The `sort_order` column preserves the original file ordering

This means agents keep working with `Read TASKS.md` and `Write TASKS.md` while the API uses fast SQLite queries.

---

## 9. MCP Integration

The MCP servers become Go HTTP handlers embedded in the same process. No separate containers, no inter-process communication, no Docker networking.

### Embedded Servers

```go
func SetupMCPRoutes(mux *chi.Mux, broker *Broker, store *store.Store) {
    // Canvas MCP server (replaces mcp-canvas container on port 4041)
    canvasMCP := NewCanvasMCPServer(broker, store)
    mux.HandleFunc("/mcp/canvas/sse", canvasMCP.HandleSSE)
    mux.HandleFunc("/mcp/canvas/message", canvasMCP.HandleMessage)

    // Orchestrator MCP server (replaces mcp-orchestrator container on port 4042)
    orchMCP := NewOrchestratorMCPServer(broker, store)
    mux.HandleFunc("/mcp/orchestrator/sse", orchMCP.HandleSSE)
    mux.HandleFunc("/mcp/orchestrator/message", orchMCP.HandleMessage)
}
```

### Canvas Tools (7 tools, same as current)

| Tool | Purpose |
|------|---------|
| `canvas_capabilities` | Capability manifest: design tokens, CDN libs, widget schemas |
| `canvas_put` | Create/update widget structure (HTML/CSS/JS) |
| `canvas_data` | Lightweight data push (WS broadcast, widget reacts) |
| `canvas_design` | AI-generated widget (spawns design sub-agent) |
| `canvas_list` | List current widgets |
| `canvas_templates` | Template catalog |
| `canvas_remove` | Delete widget |

### MCP Config for Agents

The `controller_mcp_config.json` that agents receive now points to the same process:

```json
{
  "mcpServers": {
    "canvas": {
      "type": "sse",
      "url": "http://localhost:4040/mcp/canvas/sse"
    },
    "orchestrator": {
      "type": "sse",
      "url": "http://localhost:4040/mcp/orchestrator/sse"
    }
  }
}
```

One process, one port, two MCP endpoints. No Docker networking. No service discovery.

---

## 10. Credential Management

Replace the bash Keychain extraction with native Go.

### Current Flow (requires start.sh)

```
start.sh
  -> security find-generic-password -s "Claude Code-credentials" -w
  -> python3 -c "import json; print(json.load(sys.stdin)['claudeAiOauth']['accessToken'])"
  -> write to .claude-snapshot/oauth-token
  -> docker compose up (mounts token file read-only)
  -> agent_session.py reads token file on each subprocess spawn
```

### c9s Flow (no scripts needed)

```go
import "github.com/zalando/go-keyring"

func getOAuthToken() (string, error) {
    raw, err := keyring.Get("Claude Code-credentials", "default")
    if err != nil {
        return "", fmt.Errorf("keychain: %w", err)
    }

    var creds struct {
        ClaudeAiOauth struct {
            AccessToken string `json:"accessToken"`
        } `json:"claudeAiOauth"`
    }
    if err := json.Unmarshal([]byte(raw), &creds); err != nil {
        return "", fmt.Errorf("parse credentials: %w", err)
    }
    return creds.ClaudeAiOauth.AccessToken, nil
}

// Called by the broker before spawning each agent subprocess
func buildSpawnEnv() []string {
    env := os.Environ()
    token, err := getOAuthToken()
    if err == nil && token != "" {
        env = append(env, "CLAUDE_CODE_OAUTH_TOKEN="+token)
    }
    return env
}
```

The token is read fresh from the macOS Keychain on every agent spawn. If the token has been refreshed by the Claude CLI's own auth flow, c9s picks it up immediately. No file-watching, no launchd plist, no stale token bugs.

On Linux (k8s deployment), the binary falls back to reading from an environment variable or file, exactly as the Python backend does today.

---

## 11. Container Image

```dockerfile
# Build stage
FROM golang:1.23-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -o /c9s ./cmd/main.go

# Runtime stage
FROM alpine:3.19
RUN apk add --no-cache \
    nodejs npm git openssh-client \
    && npm install -g @anthropic-ai/claude-code

# CLI tools for agent access
COPY --from=build-tools /kubectl /usr/local/bin/kubectl
COPY --from=build-tools /helm    /usr/local/bin/helm

# The binary
COPY --from=build /c9s /usr/local/bin/c9s

# Frontend (pre-built SPA)
COPY frontend/dist/ /app/frontend/

EXPOSE 4040
CMD ["c9s", "serve", "--headless", "--frontend", "/app/frontend"]
```

**Image size comparison:**

| Component | Current (Python) | c9s (Go) |
|-----------|-----------------|----------|
| Base image | python:3.11-slim (130MB) | alpine:3.19 (7MB) |
| Application code | FastAPI + deps (200MB) | Go binary (30MB) |
| Node.js + Claude CLI | ~400MB | ~400MB (same -- agents need it) |
| Frontend SPA | served by k8s nginx | embedded in binary or mounted |
| System deps | pip, setuptools, etc. | none |
| **Total** | **~800MB** | **~450MB** |

The Go binary itself is ~30MB vs ~200MB of Python + pip dependencies. The Node.js runtime for the Claude CLI is the same either way -- agents spawn `claude` as a subprocess and it needs Node.js. A future optimization could use the Claude CLI's planned static binary mode to eliminate Node.js entirely.

For `brew install` distribution (macOS native, no Docker), the binary is ~30MB standalone. Users who just want the TUI and CLI do not need Docker at all.

---

## 12. K8s Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: c9s
  namespace: claude-manager
spec:
  replicas: 1
  strategy:
    type: Recreate           # single replica, stateful
  selector:
    matchLabels:
      app: c9s
  template:
    metadata:
      labels:
        app: c9s
    spec:
      serviceAccountName: c9s
      nodeSelector:
        kubernetes.io/hostname: scoady-worker
      containers:
      - name: c9s
        image: registry.registry.svc.cluster.local:5000/c9s:latest
        command: ["c9s", "serve", "--headless"]
        ports:
        - containerPort: 4040
        env:
        - name: CLAUDE_DATA_DIR
          value: /root/.claude
        - name: MANAGED_PROJECTS_DIR
          value: /projects
        volumeMounts:
        - name: claude-data
          mountPath: /root/.claude
        - name: managed-projects
          mountPath: /projects
        - name: ssh-keys
          mountPath: /root/.ssh
          readOnly: true
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "4Gi"
            cpu: "4000m"
        readinessProbe:
          httpGet:
            path: /api/health
            port: 4040
          initialDelaySeconds: 2     # Go starts in <100ms
          periodSeconds: 10
        livenessProbe:
          httpGet:
            path: /api/health
            port: 4040
          initialDelaySeconds: 5
          periodSeconds: 30
      volumes:
      - name: claude-data
        hostPath:
          path: /Users/ayx106492/.claude
          type: Directory
      - name: managed-projects
        hostPath:
          path: /Users/ayx106492/git/claude-managed-projects
          type: Directory
      - name: ssh-keys
        hostPath:
          path: /Users/ayx106492/.ssh
          type: Directory
---
apiVersion: v1
kind: Service
metadata:
  name: c9s
  namespace: claude-manager
spec:
  selector:
    app: c9s
  ports:
  - port: 4040
    targetPort: 4040
```

One container. No sidecars. No init containers. No docker-compose. The MCP servers, the API, the WebSocket hub, the frontend -- all in one process, one pod.

Compare to current deployment: 3 docker-compose services + 1 k8s nginx pod + startup scripts + OAuth token file mounts.

---

## 13. Migration Path

```
Phase 1: CLI + TUI client             <- WE ARE HERE
  c9s talks to the Python backend over HTTP/WebSocket.
  The Go binary is a pure client. No server code.
  Ship: `brew install c9s`, users get TUI + CLI immediately.

Phase 2: `c9s serve` with API parity
  Implement the HTTP server in Go with all 79 endpoints.
  Run alongside the Python backend on a different port.
  Integration tests compare responses between Go and Python.
  Ship: opt-in `c9s serve` for early adopters.

Phase 3: Agent broker in Go
  Port AgentBroker + AgentSession to Go.
  This is the core: subprocess spawn, stream parse, event emit.
  The Python broker is the most complex code (~500 lines) but
  translates cleanly to goroutines + bufio.Scanner + channels.
  Ship: `c9s serve` can manage agents end-to-end.

Phase 4: MCP servers in Go
  Port the canvas and orchestrator MCP servers.
  Embed as HTTP handlers in the same process.
  Eliminate the two sidecar containers.
  Ship: `c9s serve` replaces all 3 docker-compose services.

Phase 5: SQLite storage
  Replace JSON files + in-memory dicts with SQLite.
  Migration tool reads existing JSON/TASKS.md and imports.
  Session state survives restarts for the first time.
  Ship: `c9s migrate` imports existing data.

Phase 6: Remaining services
  Port canvas service, cron scheduler, workflow engine,
  template system, skills manager, roles, artifacts.
  These are straightforward CRUD -- the broker was the hard part.
  Ship: feature-complete `c9s serve`.

Phase 7: Drop Python backend
  `c9s serve` is the only backend. Docker Compose is gone.
  The frontend SPA is served by c9s. One binary, one process.
  Ship: `docker compose down` for the last time.

Phase 8: Optimize deployment
  ~450MB container (with Node.js for Claude CLI) or
  ~30MB binary for native macOS (brew install).
  k8s deployment is one pod, one container.
  Ship: `cm deploy` builds and pushes the Go image.
```

Each phase is independently shippable. The frontend SPA never changes -- it just talks to a different backend. Users can switch between Python and Go backends by changing one URL.

---

## 14. What We Keep

Everything that works stays. The Go rewrite is a backend replacement, not a product redesign.

| Feature | Status |
|---------|--------|
| Frontend SPA (vanilla JS, all panels, all tabs) | **Unchanged** |
| All API contracts (79 endpoints, request/response shapes) | **Unchanged** |
| WebSocket event protocol (20+ event types, same JSON format) | **Unchanged** |
| Canvas widget system (GridStack, WidgetFrame, `new Function` execution) | **Unchanged** |
| Widget JS execution model (`new Function('root','host', code)`) | **Unchanged** |
| Constellation theme, particle effects, shooting stars, void aesthetic | **Unchanged** |
| MCP tool definitions (canvas_put, canvas_data, canvas_design, etc.) | **Unchanged** |
| Agent stream-json parsing (same Claude CLI output format) | **Unchanged** |
| Workflow engine (phases, templates, roles, auto-continuation) | **Unchanged** |
| Task queue auto-dispatch with parallelism limits | **Unchanged** |
| TASKS.md / PROJECT.md file format (backward compatible) | **Unchanged** |
| Widget catalog + template system | **Unchanged** |
| Skills system (global, per-project toggles) | **Unchanged** |
| Context menus on widgets (copy, paste, save as template) | **Unchanged** |
| `gpush` workflow and Jenkins CI/CD | **Unchanged** |

---

## 15. What We Gain

| Improvement | Details |
|-------------|---------|
| **Single binary** | One file to install, one process to manage. `brew install c9s` or download from GitHub releases. |
| **~30MB binary** | vs ~200MB of Python + pip dependencies (Node.js for Claude CLI is additional either way). |
| **No Docker for dev** | Run `c9s serve` directly on macOS. Docker is only needed for k8s deployment. |
| **Native Keychain** | OAuth token read directly from macOS Keychain. No `start.sh`, no token files, no stale credentials. |
| **True concurrency** | Goroutines per agent session. No GIL, no event loop contention, no `run_in_executor` hacks. |
| **Parallel WS broadcast** | Goroutine per client send vs Python's sequential `await`. O(1) broadcast latency. |
| **SQLite replaces 13 backends** | One database file replaces in-memory dicts, JSON files, TASKS.md regex, and unused PostgreSQL. |
| **State survives restarts** | Agent milestones, widget layouts, workflow progress -- all persisted. No more losing state on `docker compose down`. |
| **Interactive TUI** | k9s-style dashboard for terminal-native workflows. Monitor agents, dispatch tasks, watch streams -- without a browser. |
| **Scriptable CLI** | `c9s dispatch project "task" --follow` for automation and CI integration. |
| **Sub-second startup** | Go binary starts in <100ms vs Python's 2-5 second import + uvicorn warmup. |
| **One container** | k8s deployment is one pod, one container. No sidecars, no docker-compose, no init containers. |
| **Distributable** | Ship as a static binary. No runtime dependencies beyond the Claude CLI. |

---

## 16. Open Questions

### Architecture Decisions

1. **Should c9s embed the Claude CLI or shell out to it?**
   Currently the Python backend shells out to `claude --print`. c9s should do the same initially. Embedding would mean importing the Claude CLI's Node.js code or using a Go SDK -- neither exists yet. Shelling out is the proven pattern.

2. **MCP SSE transport in Go -- SDK maturity?**
   `github.com/mark3labs/mcp-go` exists (~1,500 stars) but is community-maintained. For the SSE transport, we may need to implement the protocol directly -- it is simple (SSE for server-to-client, HTTP POST for client-to-server). This is a weekend of work, not a blocker.

3. **Should the TUI live in the same binary?**
   Yes. The TUI is ~2MB of compiled bubbletea code. Keeping it in the same binary means `c9s` with no args launches TUI, auto-starts server if needed. A single download gives users everything.

4. **Plugin system for custom MCP tools?**
   Phase 2+ consideration. Initially, the embedded canvas + orchestrator MCP servers cover all current functionality. A plugin system could load additional MCP tool handlers from shared libraries or subprocess stdio -- but this is a post-v1 feature.

5. **How to handle TASKS.md dual-write?**
   Agents read and write TASKS.md directly via the `Write` tool. c9s must watch the file for external changes and sync to SQLite. Bidirectional sync is complex but necessary for backward compatibility. Use `fsnotify` + debounce + conflict resolution (last-write-wins with SQLite as authority on API operations).

6. **Database location?**
   `~/.claude/c9s.db` is the natural choice. It lives alongside other Claude CLI data, is covered by existing backup strategies, and is in a directory already mounted into containers.

### Process Questions

7. **When do we start Phase 2 (server implementation)?**
   After Phase 1 (CLI + TUI) is stable and daily-driven. The TUI needs to feel solid before we take on the server rewrite.

8. **Can we auto-generate Go handlers from the Python endpoints?**
   Partially. The FastAPI endpoint signatures + Pydantic models can be mechanically translated to Go structs + chi handlers. An agent could do this with high accuracy -- the patterns are repetitive.

9. **How to test API parity?**
   Run both backends simultaneously. A test harness sends identical requests to both and diffs the responses. This catches regressions before cutover.

---

## Appendix A: Technology Choices

| Component | Library | Why |
|-----------|---------|-----|
| HTTP router | `github.com/go-chi/chi/v5` | Lightweight, stdlib-compatible, middleware chain |
| WebSocket | `github.com/gorilla/websocket` | Battle-tested, already used in c9s client |
| TUI framework | `github.com/charmbracelet/bubbletea` | Already used in c9s TUI |
| CLI framework | `github.com/spf13/cobra` | Already used in c9s CLI |
| SQLite | `modernc.org/sqlite` | Pure Go, no CGO, zero dependencies |
| Keychain | `github.com/zalando/go-keyring` | Cross-platform keyring access |
| MCP protocol | Custom SSE implementation | `mcp-go` is immature; SSE protocol is simple |
| Styling (TUI) | `github.com/charmbracelet/lipgloss` | Already used in c9s |
| File watching | `github.com/fsnotify/fsnotify` | TASKS.md bidirectional sync |
| JSON | `encoding/json` (stdlib) | Fast enough at <500 events/sec |
| Logging | `log/slog` (stdlib) | Structured logging, Go 1.21+ |
| Config | `github.com/spf13/viper` | Config files + env vars + flags |

## Appendix B: Key Metrics

| Metric | Current (Python) | Target (c9s) |
|--------|-----------------|--------------|
| Binary size | N/A (interpreted) | ~30MB |
| Container image | ~800MB | ~450MB (with Node.js) |
| Startup time | 2-5 seconds | <100ms |
| Memory (idle) | ~150MB (Python + uvicorn) | ~20MB |
| Memory (10 agents) | ~300MB (+ agent processes) | ~50MB (+ agent processes) |
| WS broadcast (3 clients) | ~1ms (sequential) | ~0.1ms (parallel) |
| Stream parse throughput | ~500 events/sec | ~5,000 events/sec |
| Storage backends | 13 | 1 (SQLite) |
| Processes to manage | 4 (backend + 2 MCP + frontend nginx) | 1 |
| Files to configure | docker-compose.yml + start.sh + MCP configs | c9s.yaml (optional) |
| Lines of code (backend) | ~8,800 Python | ~12,000-15,000 Go (estimated) |

---

*This document is the north star for c9s development. Each migration phase is independently shippable. The frontend SPA never changes. The user experience only gets better.*
