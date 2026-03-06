// ── Singleton WebSocket Manager ──────────────────────────────────────────────
// Event-bus pattern with auto-reconnect and exponential backoff.
// Multiple components can subscribe without creating separate connections.
//
// Usage:
//   import { agentWS } from './websocket';
//   const unsub = agentWS.on('agent_milestone', (event) => { ... });
//   // later: unsub()  or  agentWS.off('agent_milestone', handler)

import type { StreamEvent, WSEventType } from '../types';

const WS_URL = 'ws://localhost:4040/ws';

type EventHandler = (event: StreamEvent) => void;

// ── Reconnect constants ──────────────────────────────────────────────────────

const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;
const BACKOFF_MULTIPLIER = 1.5;

// ── WebSocket Manager Class ──────────────────────────────────────────────────

class WebSocketManager {
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Set<EventHandler>>();
  private wildcardListeners = new Set<EventHandler>();
  private backoffMs = INITIAL_BACKOFF_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionallyClosed = false;
  private _connected = false;

  /** Whether the WebSocket is currently connected. */
  get connected(): boolean {
    return this._connected;
  }

  /** Open the connection. Safe to call multiple times. */
  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.intentionallyClosed = false;
    this.createSocket();
  }

  /** Gracefully close the connection and stop reconnecting. */
  disconnect(): void {
    this.intentionallyClosed = true;
    this.clearReconnect();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this._connected = false;
  }

  /**
   * Subscribe to a specific event type.
   * Returns an unsubscribe function for convenience.
   */
  on(event: WSEventType | string, handler: EventHandler): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    // Auto-connect on first subscription
    this.connect();

    return () => this.off(event, handler);
  }

  /** Unsubscribe from a specific event type. */
  off(event: WSEventType | string, handler: EventHandler): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(handler);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Subscribe to ALL events (wildcard).
   * Returns an unsubscribe function.
   */
  onAny(handler: EventHandler): () => void {
    this.wildcardListeners.add(handler);
    this.connect();
    return () => this.wildcardListeners.delete(handler);
  }

  /** Remove all listeners and disconnect. */
  destroy(): void {
    this.listeners.clear();
    this.wildcardListeners.clear();
    this.disconnect();
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private createSocket(): void {
    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        this._connected = true;
        this.backoffMs = INITIAL_BACKOFF_MS; // reset backoff on success
      };

      this.ws.onmessage = (ev: MessageEvent) => {
        try {
          const event: StreamEvent = JSON.parse(ev.data);
          this.dispatch(event);
        } catch {
          // Silently ignore unparseable messages
        }
      };

      this.ws.onclose = () => {
        this._connected = false;
        this.ws = null;

        if (!this.intentionallyClosed) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = () => {
        // onclose will fire after onerror — reconnect happens there
        if (this.ws) {
          this.ws.close();
        }
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private dispatch(event: StreamEvent): void {
    // Type-specific listeners
    const handlers = this.listeners.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (err) {
          console.error('[WS] Handler error:', err);
        }
      }
    }

    // Wildcard listeners
    for (const handler of this.wildcardListeners) {
      try {
        handler(event);
      } catch (err) {
        console.error('[WS] Wildcard handler error:', err);
      }
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnect();

    this.reconnectTimer = setTimeout(() => {
      this.createSocket();
    }, this.backoffMs);

    // Exponential backoff with cap
    this.backoffMs = Math.min(this.backoffMs * BACKOFF_MULTIPLIER, MAX_BACKOFF_MS);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

// ── Singleton export ─────────────────────────────────────────────────────────

export const agentWS = new WebSocketManager();
export { WS_URL };
export default agentWS;
