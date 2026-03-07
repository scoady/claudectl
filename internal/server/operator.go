package server

import (
	"log"
	"sync"
	"time"
)

// ── Event Types ──────────────────────────────────────────────────────────────

// EventType identifies the kind of operator event.
type EventType string

const (
	EventTaskDispatched EventType = "task_dispatched"
	EventAgentSpawned  EventType = "agent_spawned"
	EventAgentDone     EventType = "agent_done"
	EventAgentIdle     EventType = "agent_idle"
	EventAgentError    EventType = "agent_error"
	EventTaskCompleted EventType = "task_completed"
	EventInjectRequest EventType = "inject_request"
	EventSpawnRequest  EventType = "spawn_request" // agent requesting to spawn another agent
)

// Event is the unit of work flowing through the operator event bus.
type Event struct {
	Type        EventType
	ProjectName string
	SessionID   string
	Task        string
	Model       string
	TaskIndex   *int
	Message     string // for inject events
	Metadata    map[string]any
	Timestamp   time.Time
}

// ── Operator ─────────────────────────────────────────────────────────────────

// Operator is the c9-operator controller. It watches an event bus and
// reconciles desired state (tasks) with actual state (running agents).
//
// Modeled after a Kubernetes operator:
//   - Events flow in via the event channel
//   - The reconcile loop processes events and takes action (spawn agents, update state)
//   - Agents can emit events back (spawn_request, agent_done) creating feedback loops
type Operator struct {
	broker     *Broker
	hub        *Hub
	projectDir string

	events chan Event
	stopCh chan struct{}
	wg     sync.WaitGroup

	// Track dispatched tasks awaiting agent completion
	mu             sync.RWMutex
	pendingTasks   map[string]*PendingTask // keyed by session_id
	tasksByProject map[string][]*PendingTask
}

// PendingTask tracks a dispatched task through its lifecycle.
type PendingTask struct {
	ProjectName string
	Task        string
	TaskIndex   *int
	SessionID   string
	Status      string // "pending", "running", "done", "error"
	DispatchedAt time.Time
	CompletedAt  *time.Time
}

// NewOperator creates a new c9-operator controller.
func NewOperator(broker *Broker, hub *Hub, projectDir string) *Operator {
	return &Operator{
		broker:         broker,
		hub:            hub,
		projectDir:     projectDir,
		events:         make(chan Event, 256),
		stopCh:         make(chan struct{}),
		pendingTasks:   make(map[string]*PendingTask),
		tasksByProject: make(map[string][]*PendingTask),
	}
}

// Start begins the operator reconciliation loop.
func (op *Operator) Start() {
	op.wg.Add(1)
	go op.reconcileLoop()
	log.Println("[operator] started — watching event bus")
}

// Stop gracefully shuts down the operator.
func (op *Operator) Stop() {
	close(op.stopCh)
	op.wg.Wait()
	log.Println("[operator] stopped")
}

// Emit sends an event to the operator's event bus.
func (op *Operator) Emit(event Event) {
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now()
	}
	select {
	case op.events <- event:
	default:
		log.Printf("[operator] event bus full, dropping event: %s", event.Type)
	}
}

// ── Reconciliation Loop ──────────────────────────────────────────────────────

func (op *Operator) reconcileLoop() {
	defer op.wg.Done()

	for {
		select {
		case <-op.stopCh:
			return
		case event := <-op.events:
			op.handleEvent(event)
		}
	}
}

func (op *Operator) handleEvent(event Event) {
	log.Printf("[operator] event: %s project=%s session=%s", event.Type, event.ProjectName, short(event.SessionID))

	switch event.Type {

	case EventTaskDispatched:
		op.onTaskDispatched(event)

	case EventAgentDone:
		op.onAgentDone(event)

	case EventAgentIdle:
		op.onAgentIdle(event)

	case EventAgentError:
		op.onAgentError(event)

	case EventSpawnRequest:
		op.onSpawnRequest(event)

	case EventInjectRequest:
		op.onInjectRequest(event)
	}

	// Broadcast operator state to UI
	op.broadcastState()
}

// ── Event Handlers ───────────────────────────────────────────────────────────

func (op *Operator) onTaskDispatched(event Event) {
	projectPath := op.resolveProjectPath(event.ProjectName)
	if projectPath == "" {
		log.Printf("[operator] project not found: %s", event.ProjectName)
		op.hub.Broadcast("operator_error", map[string]any{
			"error":        "project not found",
			"project_name": event.ProjectName,
		})
		return
	}

	task := narratePrefix + event.Task
	model := event.Model

	session := op.broker.SpawnSession(
		event.ProjectName,
		projectPath,
		task,
		model,
		false,  // not a controller — it's a worker
		event.TaskIndex,
		"", // MCP config — empty for now, agents inherit from project
	)

	// Track the pending task
	pt := &PendingTask{
		ProjectName:  event.ProjectName,
		Task:         event.Task,
		TaskIndex:    event.TaskIndex,
		SessionID:    session.SessionID,
		Status:       "running",
		DispatchedAt: time.Now(),
	}

	op.mu.Lock()
	op.pendingTasks[session.SessionID] = pt
	op.tasksByProject[event.ProjectName] = append(op.tasksByProject[event.ProjectName], pt)
	op.mu.Unlock()

	log.Printf("[operator] spawned agent %s for project %s", session.SessionID[:8], event.ProjectName)
}

func (op *Operator) onAgentDone(event Event) {
	op.mu.Lock()
	if pt, ok := op.pendingTasks[event.SessionID]; ok {
		now := time.Now()
		pt.Status = "done"
		pt.CompletedAt = &now
	}
	op.mu.Unlock()

	log.Printf("[operator] agent %s done", short(event.SessionID))
}

func (op *Operator) onAgentIdle(event Event) {
	// Agent finished its turn but is still alive for follow-ups
	log.Printf("[operator] agent %s idle", short(event.SessionID))
}

func (op *Operator) onAgentError(event Event) {
	op.mu.Lock()
	if pt, ok := op.pendingTasks[event.SessionID]; ok {
		now := time.Now()
		pt.Status = "error"
		pt.CompletedAt = &now
	}
	op.mu.Unlock()

	log.Printf("[operator] agent %s errored", short(event.SessionID))
}

// onSpawnRequest handles an agent requesting to spawn another agent.
// This is the key capability: agents can create sub-agents.
func (op *Operator) onSpawnRequest(event Event) {
	log.Printf("[operator] agent %s requesting spawn in project %s: %s",
		short(event.SessionID), event.ProjectName, truncate(event.Task, 80))

	// Emit as a task dispatch — the operator treats it the same
	op.Emit(Event{
		Type:        EventTaskDispatched,
		ProjectName: event.ProjectName,
		Task:        event.Task,
		Model:       event.Model,
		TaskIndex:   event.TaskIndex,
		Metadata: map[string]any{
			"spawned_by": event.SessionID,
		},
	})
}

func (op *Operator) onInjectRequest(event Event) {
	if event.SessionID == "" || event.Message == "" {
		return
	}
	if err := op.broker.InjectMessage(event.SessionID, event.Message); err != nil {
		log.Printf("[operator] inject failed for %s: %v", short(event.SessionID), err)
	}
}

// ── Helpers ──────────────────────────────────────────────────────────────────

func (op *Operator) resolveProjectPath(name string) string {
	projects := discoverProjects(op.projectDir)
	for _, p := range projects {
		if p.Name == name {
			return p.Path
		}
	}
	return ""
}

func (op *Operator) broadcastState() {
	op.mu.RLock()
	pending := len(op.pendingTasks)
	running := 0
	done := 0
	for _, pt := range op.pendingTasks {
		switch pt.Status {
		case "running":
			running++
		case "done":
			done++
		}
	}
	op.mu.RUnlock()

	op.hub.Broadcast("operator_state", map[string]any{
		"pending_tasks": pending,
		"running":       running,
		"done":          done,
	})
}

// GetPendingTasks returns a snapshot of all tracked tasks.
func (op *Operator) GetPendingTasks() []PendingTask {
	op.mu.RLock()
	defer op.mu.RUnlock()
	result := make([]PendingTask, 0, len(op.pendingTasks))
	for _, pt := range op.pendingTasks {
		result = append(result, *pt)
	}
	return result
}

func short(s string) string {
	if len(s) > 8 {
		return s[:8]
	}
	return s
}

func truncate(s string, n int) string {
	if len(s) > n {
		return s[:n] + "..."
	}
	return s
}
