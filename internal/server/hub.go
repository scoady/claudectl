package server

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// Hub manages WebSocket connections and broadcasts events to all clients.
type Hub struct {
	mu      sync.RWMutex
	clients map[*websocket.Conn]bool
}

// NewHub creates a new WebSocket hub.
func NewHub() *Hub {
	return &Hub{
		clients: make(map[*websocket.Conn]bool),
	}
}

// Register adds a connection to the hub.
func (h *Hub) Register(conn *websocket.Conn) {
	h.mu.Lock()
	h.clients[conn] = true
	h.mu.Unlock()
}

// Unregister removes a connection from the hub and closes it.
func (h *Hub) Unregister(conn *websocket.Conn) {
	h.mu.Lock()
	if _, ok := h.clients[conn]; ok {
		delete(h.clients, conn)
		conn.Close()
	}
	h.mu.Unlock()
}

// ClientCount returns the number of connected clients.
func (h *Hub) ClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

// Broadcast sends an event to all connected clients.
func (h *Hub) Broadcast(eventType string, data any) {
	event := NewWSEvent(eventType, data)
	msg, err := json.Marshal(event)
	if err != nil {
		log.Printf("[hub] marshal error: %v", err)
		return
	}

	h.mu.RLock()
	clients := make([]*websocket.Conn, 0, len(h.clients))
	for c := range h.clients {
		clients = append(clients, c)
	}
	h.mu.RUnlock()

	for _, c := range clients {
		if err := c.WriteMessage(websocket.TextMessage, msg); err != nil {
			log.Printf("[hub] write error, removing client: %v", err)
			h.Unregister(c)
		}
	}
}

// HandleWS is the HTTP handler for WebSocket upgrade requests.
func (h *Hub) HandleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[hub] upgrade error: %v", err)
		return
	}
	h.Register(conn)
	log.Printf("[hub] client connected (%d total)", h.ClientCount())

	// Start ping/pong keepalive.
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	go h.pingLoop(conn)

	// Read loop — keeps connection alive and detects disconnects.
	conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			break
		}
	}

	h.Unregister(conn)
	log.Printf("[hub] client disconnected (%d total)", h.ClientCount())
}

// pingLoop sends pings every 30 seconds to keep the connection alive.
func (h *Hub) pingLoop(conn *websocket.Conn) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	for range ticker.C {
		h.mu.RLock()
		_, ok := h.clients[conn]
		h.mu.RUnlock()
		if !ok {
			return
		}
		if err := conn.WriteControl(
			websocket.PingMessage, nil,
			time.Now().Add(10*time.Second),
		); err != nil {
			return
		}
	}
}
