import { motion, AnimatePresence } from 'framer-motion';
import { Radio, Filter } from 'lucide-react';
import { useState } from 'react';
import type { WSEvent } from '../../lib/operatorApi';

interface Props {
  events: WSEvent[];
}

const eventColors: Record<string, string> = {
  agent_spawned: '#fbbf24',
  agent_done: '#34d399',
  agent_update: '#67e8f9',
  agent_milestone: '#c084fc',
  agent_stream: '#94a3b8',
  agent_id_assigned: '#60a5fa',
  stats_update: '#818cf8',
  operator_state: '#67e8f9',
};

const eventIcons: Record<string, string> = {
  agent_spawned: '◆',
  agent_done: '✓',
  agent_update: '↻',
  agent_milestone: '★',
  agent_stream: '▸',
  agent_id_assigned: '⬡',
  stats_update: '◎',
  operator_state: '◈',
};

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '--:--:--';
  }
}

function eventSummary(event: WSEvent): string {
  const data = event.data as Record<string, unknown>;
  switch (event.type) {
    case 'agent_spawned':
      return `${data?.project_name || 'unknown'} → new agent`;
    case 'agent_done':
      return `${(data?.session_id as string)?.slice(0, 8) || '?'} completed`;
    case 'agent_milestone':
      return `${(data?.session_id as string)?.slice(0, 8)} · ${data?.milestone || ''}`;
    case 'agent_update':
      return `${(data?.session_id as string)?.slice(0, 8)} → ${data?.status || data?.phase || ''}`;
    case 'stats_update':
      return `active: ${data?.active_agents}, idle: ${data?.idle_agents}`;
    default:
      return event.type;
  }
}

export default function EventBusFeed({ events }: Props) {
  const [filter, setFilter] = useState<string | null>(null);
  const [showFilter, setShowFilter] = useState(false);

  const filtered = filter
    ? events.filter((e) => e.type === filter)
    : events.filter((e) => e.type !== 'agent_stream'); // hide noisy stream events by default

  const eventTypes = [...new Set(events.map((e) => e.type))];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-1 pb-2">
        <Radio size={13} style={{ color: '#34d399' }} />
        <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.6)', letterSpacing: 1 }}>
          EVENT BUS
        </span>
        <button
          onClick={() => setShowFilter(!showFilter)}
          className="ml-auto p-1 rounded hover:bg-white/5 transition-colors"
        >
          <Filter size={11} style={{ color: filter ? '#67e8f9' : 'rgba(255,255,255,0.2)' }} />
        </button>
      </div>

      {/* Filter chips */}
      <AnimatePresence>
        {showFilter && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex flex-wrap gap-1 pb-2 overflow-hidden"
          >
            <button
              onClick={() => setFilter(null)}
              className="text-[9px] px-1.5 py-0.5 rounded"
              style={{
                background: !filter ? 'rgba(103, 232, 249, 0.15)' : 'rgba(255,255,255,0.03)',
                color: !filter ? '#67e8f9' : 'rgba(255,255,255,0.3)',
                border: `1px solid ${!filter ? 'rgba(103, 232, 249, 0.2)' : 'rgba(255,255,255,0.05)'}`,
              }}
            >
              all
            </button>
            {eventTypes.map((type) => (
              <button
                key={type}
                onClick={() => setFilter(filter === type ? null : type)}
                className="text-[9px] px-1.5 py-0.5 rounded"
                style={{
                  background: filter === type ? `${eventColors[type] || '#67e8f9'}20` : 'rgba(255,255,255,0.03)',
                  color: filter === type ? eventColors[type] || '#67e8f9' : 'rgba(255,255,255,0.3)',
                  border: `1px solid ${filter === type ? `${eventColors[type]}30` : 'rgba(255,255,255,0.05)'}`,
                }}
              >
                {type.replace('agent_', '').replace('_', ' ')}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Event list */}
      <div className="flex-1 overflow-y-auto space-y-1 pr-1" style={{ scrollbarWidth: 'thin' }}>
        <AnimatePresence initial={false}>
          {filtered.slice(0, 100).map((event, i) => {
            const color = eventColors[event.type] || '#94a3b8';
            return (
              <motion.div
                key={`${event.timestamp}-${i}`}
                initial={{ opacity: 0, x: 8, scale: 0.97 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-start gap-2 px-2 py-1.5 rounded-md"
                style={{
                  background: i === 0 ? `${color}08` : 'transparent',
                  borderLeft: `2px solid ${color}${i === 0 ? '60' : '20'}`,
                }}
              >
                <span className="text-[10px] shrink-0 mt-0.5" style={{ color }}>
                  {eventIcons[event.type] || '·'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    {eventSummary(event)}
                  </div>
                </div>
                <span className="text-[9px] tabular-nums shrink-0" style={{ color: 'rgba(255,255,255,0.15)' }}>
                  {formatTime(event.timestamp)}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {filtered.length === 0 && (
          <div className="flex items-center justify-center h-20">
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>Waiting for events...</span>
          </div>
        )}
      </div>
    </div>
  );
}
