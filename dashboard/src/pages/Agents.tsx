import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Bot, DollarSign } from 'lucide-react';
import ChartPanel from '../components/ChartPanel';
import StatusDot from '../components/StatusDot';
import { useMetrics } from '../hooks/useMetrics';
import { useDashboard, getSince, getResolution } from '../context/DashboardContext';
import LoadingState from '../components/LoadingState';
import {
  fetchAgents, fetchAgentMetrics,
  mockAgents, mockAgentMetrics,
  type Agent,
} from '../lib/api';

function formatTime(ts: string) {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function timeAgo(ts?: string) {
  if (!ts) return '-';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m ago`;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass px-3 py-2 text-xs">
      <p className="text-dim mb-1">{formatTime(label)}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-subtext">{p.name}</span>
          </span>
          <span className="text-text font-medium">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function AgentRow({ agent, index }: { agent: Agent; index: number }) {
  return (
    <motion.tr
      className="border-b border-muted/20 hover:bg-bg-surface-1/40 transition-colors"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <StatusDot status={agent.status} />
          <span className="text-xs font-mono text-text">{agent.id}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-subtext">{agent.project}</td>
      <td className="px-4 py-3 text-xs text-dim font-mono">{agent.model?.split('-').slice(-2).join('-') ?? '-'}</td>
      <td className="px-4 py-3">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          agent.status === 'running' ? 'bg-green/10 text-green' :
          agent.status === 'done' ? 'bg-blue/10 text-blue' :
          agent.status === 'error' ? 'bg-rose/10 text-rose' :
          'bg-muted/20 text-dim'
        }`}>
          {agent.status}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-subtext max-w-[200px] truncate">{agent.milestone ?? '-'}</td>
      <td className="px-4 py-3 text-xs text-amber font-mono">{agent.cost != null ? `$${agent.cost.toFixed(3)}` : '-'}</td>
      <td className="px-4 py-3 text-xs text-dim">{timeAgo(agent.started_at)}</td>
    </motion.tr>
  );
}

export default function Agents() {
  const { timeRange, refreshInterval } = useDashboard();
  const since = getSince(timeRange);
  const res = getResolution(timeRange);

  const { data: agents } = useMetrics(() => fetchAgents(), refreshInterval, mockAgents);
  const { data: metrics } = useMetrics(() => fetchAgentMetrics(since, res), refreshInterval, mockAgentMetrics);

  const running = agents?.filter(a => a.status === 'running').length ?? 0;
  const done = agents?.filter(a => a.status === 'done').length ?? 0;
  const errored = agents?.filter(a => a.status === 'error').length ?? 0;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        <motion.div className="glass p-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 text-green mb-1">
            <Bot size={14} />
            <span className="text-xs text-subtext">Running</span>
          </div>
          <span className="text-2xl font-bold text-text">{running}</span>
        </motion.div>
        <motion.div className="glass p-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <div className="flex items-center gap-2 text-blue mb-1">
            <Bot size={14} />
            <span className="text-xs text-subtext">Completed</span>
          </div>
          <span className="text-2xl font-bold text-text">{done}</span>
        </motion.div>
        <motion.div className="glass p-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center gap-2 text-rose mb-1">
            <Bot size={14} />
            <span className="text-xs text-subtext">Errored</span>
          </div>
          <span className="text-2xl font-bold text-text">{errored}</span>
        </motion.div>
        <motion.div className="glass p-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="flex items-center gap-2 text-cyan mb-1">
            <DollarSign size={14} />
            <span className="text-xs text-subtext">Total Cost</span>
          </div>
          <span className="text-2xl font-bold text-text">
            ${agents?.reduce((s, a) => s + (a.cost ?? 0), 0).toFixed(2) ?? '0.00'}
          </span>
        </motion.div>
      </div>

      {/* Chart */}
      <ChartPanel title="Agent Activity Timeline" subtitle="Active agents over selected time range" delay={0} height={220}>
        {metrics ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={metrics.series.active.map((p, i) => ({
              timestamp: p.timestamp, active: p.value,
              spawned: metrics.series.spawned[i]?.value ?? 0,
              errored: metrics.series.errored[i]?.value ?? 0,
            }))}>
              <defs>
                <linearGradient id="gAgActive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" tickFormatter={formatTime} tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="active" stroke="#34d399" strokeWidth={2} fill="url(#gAgActive)" dot={false} />
              <Area type="monotone" dataKey="spawned" stroke="#67e8f9" strokeWidth={1.5} fill="none" dot={false} />
              <Area type="monotone" dataKey="errored" stroke="#fb7185" strokeWidth={1.5} fill="none" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        ) : <LoadingState />}
      </ChartPanel>

      {/* Agent table */}
      <motion.div
        className="glass overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="px-4 pt-4 pb-2">
          <h3 className="text-sm font-medium text-text">All Agents</h3>
          <p className="text-xs text-dim mt-0.5">{agents?.length ?? 0} agents total</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-muted/30">
                <th className="px-4 py-2 text-xs font-medium text-subtext">ID</th>
                <th className="px-4 py-2 text-xs font-medium text-subtext">Project</th>
                <th className="px-4 py-2 text-xs font-medium text-subtext">Model</th>
                <th className="px-4 py-2 text-xs font-medium text-subtext">Status</th>
                <th className="px-4 py-2 text-xs font-medium text-subtext">Milestone</th>
                <th className="px-4 py-2 text-xs font-medium text-subtext">Cost</th>
                <th className="px-4 py-2 text-xs font-medium text-subtext">Started</th>
              </tr>
            </thead>
            <tbody>
              {agents?.map((agent, i) => (
                <AgentRow key={agent.id} agent={agent} index={i} />
              ))}
              {!agents && (
                <tr><td colSpan={7} className="py-8"><LoadingState /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
