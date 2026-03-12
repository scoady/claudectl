import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, ChevronDown, Trash2, MessageSquare, Send } from 'lucide-react';
import type { AgentSessionInfo } from '../../lib/operatorApi';
import { killAgent, injectMessage, fetchAgentMessages } from '../../lib/operatorApi';

interface Props {
  agents: AgentSessionInfo[];
}

const statusColors: Record<string, string> = {
  active: '#fbbf24',
  idle: '#67e8f9',
  done: '#34d399',
  error: '#fb7185',
  pending: '#94a3b8',
};

const phaseLabels: Record<string, string> = {
  starting: 'Starting',
  thinking: 'Thinking',
  generating: 'Writing',
  tool_input: 'Tool Call',
  tool_exec: 'Executing',
  idle: 'Idle',
  injecting: 'Injecting',
  cancelled: 'Cancelled',
  error: 'Error',
};

function timeAgo(iso?: string): string {
  if (!iso) return '--';
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function AgentRow({ agent }: { agent: AgentSessionInfo }) {
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Array<Record<string, unknown>>>([]);
  const [injectText, setInjectText] = useState('');
  const [loading, setLoading] = useState(false);
  const color = statusColors[agent.status] || '#94a3b8';
  const lastMilestone = agent.milestones?.[agent.milestones.length - 1] || agent.phase;

  const handleExpand = async () => {
    if (!expanded) {
      try {
        const msgs = await fetchAgentMessages(agent.session_id);
        setMessages(msgs);
      } catch { /* ignore */ }
    }
    setExpanded(!expanded);
  };

  const handleKill = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Kill agent ${agent.session_id.slice(0, 8)}?`)) return;
    try {
      await killAgent(agent.session_id);
    } catch { /* ignore */ }
  };

  const handleInject = async () => {
    if (!injectText.trim()) return;
    setLoading(true);
    try {
      await injectMessage(agent.session_id, injectText);
      setInjectText('');
    } catch { /* ignore */ }
    setLoading(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      className="rounded-lg overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${expanded ? color + '30' : 'rgba(255,255,255,0.05)'}`,
      }}
    >
      {/* Collapsed row */}
      <button
        onClick={handleExpand}
        className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-white/[0.02]"
      >
        {/* Status dot */}
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{
            background: color,
            boxShadow: agent.status === 'active' ? `0 0 6px ${color}` : 'none',
          }}
        />

        {/* Session ID */}
        <span className="text-xs font-mono w-20 truncate" style={{ color: 'rgba(255,255,255,0.6)' }}>
          {agent.session_id.slice(0, 8)}
        </span>

        {/* Project */}
        <span className="text-xs w-28 truncate" style={{ color: '#c084fc' }}>
          {agent.project_name}
        </span>

        {/* Phase/milestone */}
        <span className="text-xs flex-1 truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {phaseLabels[agent.phase] || agent.phase} · {lastMilestone}
        </span>

        {/* Turns */}
        <span className="text-[10px] tabular-nums" style={{ color: 'rgba(255,255,255,0.25)' }}>
          {agent.turn_count}t
        </span>

        {/* Uptime */}
        <span className="text-[10px] tabular-nums w-12 text-right" style={{ color: 'rgba(255,255,255,0.25)' }}>
          {timeAgo(agent.started_at)}
        </span>

        {/* Kill button */}
        {(agent.status === 'active' || agent.status === 'idle') && (
          <button
            onClick={handleKill}
            className="p-1 rounded hover:bg-red-500/20 transition-colors"
            title="Kill agent"
          >
            <Trash2 size={12} style={{ color: '#fb7185' }} />
          </button>
        )}

        <ChevronDown
          size={12}
          className="transition-transform"
          style={{
            color: 'rgba(255,255,255,0.2)',
            transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
          }}
        />
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              {/* Task */}
              {agent.task && (
                <div className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.25)' }}>Task: </span>
                  {agent.task}
                </div>
              )}

              {/* Output buffer */}
              <div
                className="rounded-md p-2 font-mono text-[10px] leading-relaxed max-h-40 overflow-y-auto"
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  color: 'rgba(255,255,255,0.5)',
                  border: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                {messages.length > 0
                  ? messages.slice(-20).map((m, i) => (
                      <div key={i} className="truncate">
                        {JSON.stringify(m).slice(0, 200)}
                      </div>
                    ))
                  : <span style={{ color: 'rgba(255,255,255,0.2)' }}>No output yet</span>
                }
              </div>

              {/* Inject input */}
              {(agent.status === 'active' || agent.status === 'idle') && (
                <div className="flex gap-2">
                  <div className="flex-1 flex items-center gap-1 rounded-md px-2" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <MessageSquare size={10} style={{ color: 'rgba(255,255,255,0.2)' }} />
                    <input
                      type="text"
                      value={injectText}
                      onChange={(e) => setInjectText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleInject()}
                      placeholder="Inject message..."
                      className="flex-1 bg-transparent text-xs py-1.5 outline-none"
                      style={{ color: 'rgba(255,255,255,0.7)' }}
                    />
                  </div>
                  <button
                    onClick={handleInject}
                    disabled={loading || !injectText.trim()}
                    className="px-2 py-1 rounded-md text-xs transition-colors"
                    style={{
                      background: 'rgba(103, 232, 249, 0.1)',
                      border: '1px solid rgba(103, 232, 249, 0.2)',
                      color: '#67e8f9',
                      opacity: loading || !injectText.trim() ? 0.3 : 1,
                    }}
                  >
                    <Send size={12} />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function AgentFleetView({ agents }: Props) {
  const sorted = [...agents].sort((a, b) => {
    const order: Record<string, number> = { active: 0, idle: 1, pending: 2, done: 3, error: 4 };
    return (order[a.status] ?? 5) - (order[b.status] ?? 5);
  });

  return (
    <div className="flex flex-col gap-1.5 h-full overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
      <div className="flex items-center gap-2 px-1 pb-1">
        <Bot size={13} style={{ color: '#67e8f9' }} />
        <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.6)', letterSpacing: 1 }}>
          AGENT FLEET
        </span>
        <span className="text-[10px] ml-auto tabular-nums" style={{ color: 'rgba(255,255,255,0.25)' }}>
          {agents.length} total
        </span>
      </div>
      <AnimatePresence mode="popLayout">
        {sorted.map((agent) => (
          <AgentRow key={agent.session_id} agent={agent} />
        ))}
      </AnimatePresence>
      {agents.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>No active agents</span>
        </div>
      )}
    </div>
  );
}
