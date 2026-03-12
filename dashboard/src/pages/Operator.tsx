import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { useMetrics } from '../hooks/useMetrics';
import {
  fetchHealth, fetchStats, fetchOperatorState, fetchAgentList, fetchProjectList,
  type AgentSessionInfo, type WSEvent, type HealthResponse, type StatsResponse, type ManagedProject,
} from '../lib/operatorApi';
import HealthStrip from '../components/operator/HealthStrip';
import AgentFleetView from '../components/operator/AgentFleetView';
import EventBusFeed from '../components/operator/EventBusFeed';
import DispatchConsole from '../components/operator/DispatchConsole';
import { Wifi, WifiOff, ShieldAlert } from 'lucide-react';

export default function Operator() {
  // ── WebSocket ───────────────────────────────────────────────────────────────
  const ws = useWebSocket();
  const [events, setEvents] = useState<WSEvent[]>([]);
  const [agents, setAgents] = useState<AgentSessionInfo[]>([]);

  // Push new events to the ring buffer (max 500)
  const pushEvent = useCallback((event: WSEvent) => {
    setEvents((prev) => [event, ...prev].slice(0, 500));
  }, []);

  // Subscribe to WebSocket events
  useEffect(() => {
    return ws.subscribe((event) => {
      pushEvent(event);

      // Update agent list from real-time events
      if (event.type === 'agent_spawned' || event.type === 'agent_update') {
        const data = event.data as AgentSessionInfo;
        if (data?.session_id) {
          setAgents((prev) => {
            const idx = prev.findIndex((a) => a.session_id === data.session_id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = { ...next[idx], ...data };
              return next;
            }
            return [data, ...prev];
          });
        }
      }

      if (event.type === 'agent_done') {
        const data = event.data as { session_id?: string };
        if (data?.session_id) {
          setAgents((prev) =>
            prev.map((a) =>
              a.session_id === data.session_id ? { ...a, status: 'done' as const } : a
            )
          );
        }
      }
    });
  }, [ws, pushEvent]);

  // ── Polling ─────────────────────────────────────────────────────────────────
  const health = useMetrics<HealthResponse>(() => fetchHealth(), 5000);
  const stats = useMetrics<StatsResponse>(() => fetchStats(), 5000);
  const projectList = useMetrics<ManagedProject[]>(() => fetchProjectList(), 15000);

  // Reconcile agent list periodically
  useEffect(() => {
    const reconcile = async () => {
      try {
        const list = await fetchAgentList();
        setAgents(list);
      } catch { /* ignore */ }
    };
    reconcile();
    const id = setInterval(reconcile, 10000);
    return () => clearInterval(id);
  }, []);

  // Also fetch operator state
  const operatorState = useMetrics(() => fetchOperatorState(), 5000);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Connection status + controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert size={16} style={{ color: '#67e8f9' }} />
          <span className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.8)', letterSpacing: 1 }}>
            OPERATOR
          </span>
          {operatorState.data && (
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(103, 232, 249, 0.08)', color: '#67e8f9' }}>
              {operatorState.data.total} queued
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={ws.reconnect}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded transition-colors hover:bg-white/5"
            style={{
              color: ws.status === 'connected' ? '#34d399' : ws.status === 'connecting' ? '#fbbf24' : '#fb7185',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {ws.status === 'connected' ? <Wifi size={10} /> : <WifiOff size={10} />}
            {ws.status}
          </button>
        </div>
      </div>

      {/* Health strip */}
      <HealthStrip health={health.data} stats={stats.data} />

      {/* Main content: Fleet + Event Bus */}
      <div className="flex-1 grid grid-cols-5 gap-3 min-h-0">
        {/* Agent Fleet — 3 cols */}
        <div
          className="col-span-3 rounded-lg p-3"
          style={{
            background: 'rgba(255,255,255,0.01)',
            border: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <AgentFleetView agents={agents} />
        </div>

        {/* Event Bus — 2 cols */}
        <div
          className="col-span-2 rounded-lg p-3"
          style={{
            background: 'rgba(255,255,255,0.01)',
            border: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <EventBusFeed events={events} />
        </div>
      </div>

      {/* Dispatch console */}
      <DispatchConsole projects={projectList.data || []} />
    </div>
  );
}
