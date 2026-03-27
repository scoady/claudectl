package tui

import (
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/gorilla/websocket"
)

// WSClient manages the WebSocket connection and feeds events into bubbletea.
type WSClient struct {
	url  string
	conn *websocket.Conn
	mu   sync.Mutex
	done chan struct{}
	once sync.Once
}

// NewWSClient creates a new WebSocket client for the given API base URL.
func NewWSClient(apiBaseURL string) *WSClient {
	wsURL := strings.Replace(apiBaseURL, "http://", "ws://", 1)
	wsURL = strings.Replace(wsURL, "https://", "wss://", 1)
	wsURL += "/ws"
	return &WSClient{
		url:  wsURL,
		done: make(chan struct{}),
	}
}

// wsEvent mirrors the backend WS JSON structure.
type wsEvent struct {
	Type      string                 `json:"type"`
	Data      map[string]interface{} `json:"data"`
	Timestamp string                 `json:"timestamp,omitempty"`
}

// Connect establishes the WS connection and starts pumping events into the
// bubbletea program. It returns a tea.Cmd that resolves with the first message.
// Subsequent messages are pushed via program.Send().
func (ws *WSClient) Connect(program *tea.Program, sessionFilter string) tea.Cmd {
	return func() tea.Msg {
		conn, _, err := websocket.DefaultDialer.Dial(ws.url, nil)
		if err != nil {
			return WSDisconnectedMsg{Err: fmt.Errorf("ws connect: %w", err)}
		}

		ws.mu.Lock()
		ws.conn = conn
		ws.mu.Unlock()

		// Keepalive pinger
		go func() {
			ticker := time.NewTicker(25 * time.Second)
			defer ticker.Stop()
			for {
				select {
				case <-ws.done:
					return
				case <-ticker.C:
					ws.mu.Lock()
					if ws.conn != nil {
						_ = ws.conn.WriteJSON(map[string]string{"type": "ping"})
					}
					ws.mu.Unlock()
				}
			}
		}()

		// Reader loop — pushes messages via program.Send()
		go func() {
			defer func() {
				ws.mu.Lock()
				if ws.conn != nil {
					ws.conn.Close()
					ws.conn = nil
				}
				ws.mu.Unlock()
			}()

			for {
				select {
				case <-ws.done:
					return
				default:
				}

				_, message, err := conn.ReadMessage()
				if err != nil {
					if program != nil {
						program.Send(WSDisconnectedMsg{Err: err})
					}
					return
				}

				var evt wsEvent
				if err := json.Unmarshal(message, &evt); err != nil {
					continue
				}

				msg := ws.parseEvent(evt, sessionFilter)
				if msg != nil && program != nil {
					program.Send(msg)
				}
			}
		}()

		return WSConnectedMsg{}
	}
}

// Close shuts down the WebSocket connection.
func (ws *WSClient) Close() {
	ws.once.Do(func() {
		close(ws.done)
	})
	ws.mu.Lock()
	defer ws.mu.Unlock()
	if ws.conn != nil {
		ws.conn.Close()
		ws.conn = nil
	}
}

// parseEvent converts a raw WS event into a typed tea.Msg.
// Returns nil for events that should be ignored.
func (ws *WSClient) parseEvent(evt wsEvent, sessionFilter string) tea.Msg {
	d := evt.Data
	if d == nil {
		return nil
	}

	sid, _ := d["session_id"].(string)

	// Filter by session if specified
	if sessionFilter != "" && sid != "" && sid != sessionFilter {
		return nil
	}

	switch evt.Type {
	case "agent_stream":
		text, _ := d["text"].(string)
		if text == "" {
			return nil
		}
		return WSTextChunkMsg{SessionID: sid, Text: text}

	case "agent_milestone":
		label, _ := d["label"].(string)
		if label == "" {
			label, _ = d["milestone"].(string)
		}
		toolName := ""
		input := ""
		// Parse label like "Read · main.py" → tool="Read", input="main.py"
		if parts := strings.SplitN(label, " · ", 2); len(parts) == 2 {
			toolName = parts[0]
			input = parts[1]
		} else {
			toolName = label
		}
		return WSMilestoneMsg{
			SessionID: sid,
			Label:     label,
			ToolName:  toolName,
			Input:     input,
		}

	case "tool_start":
		name, _ := d["name"].(string)
		input := ""
		if inp, ok := d["input"].(map[string]interface{}); ok {
			if fp, ok := inp["file_path"].(string); ok {
				input = fp
			} else if cmd, ok := inp["command"].(string); ok {
				input = truncate(cmd, 60)
			} else if p, ok := inp["pattern"].(string); ok {
				input = p
			}
		}
		return WSMilestoneMsg{
			SessionID: sid,
			Label:     name + " · " + input,
			ToolName:  name,
			Input:     input,
		}

	case "session_phase":
		phase, _ := d["phase"].(string)
		return WSPhaseChangeMsg{SessionID: sid, Phase: phase}

	case "agent_done":
		return WSAgentDoneMsg{SessionID: sid}

	case "agent_spawned":
		project, _ := d["project_name"].(string)
		if project == "" {
			project, _ = d["project"].(string)
		}
		task, _ := d["task"].(string)
		return WSAgentSpawnedMsg{SessionID: sid, Project: project, Task: task}

	case "error":
		msg, _ := d["message"].(string)
		if msg == "" {
			msg, _ = d["error"].(string)
		}
		return WSErrorMsg{Message: msg}

	case "agent_state_sync":
		// Count agents in initial sync
		agents, _ := d["agents"].([]interface{})
		return WSConnectedMsg{AgentCount: len(agents)}

	case "stats_update", "project_list", "pong":
		// Silently ignore
		return nil
	}

	return nil
}

func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	if max < 4 {
		return s[:max]
	}
	return s[:max-3] + "..."
}
