import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import {
  Crosshair, CheckCircle, XCircle, Clock, ExternalLink,
  ChevronDown, ChevronRight, Search, Bot,
} from 'lucide-react';
import StatusDot from '../components/StatusDot';
import LoadingState from '../components/LoadingState';
import { useMetrics } from '../hooks/useMetrics';
import { useDashboard } from '../context/DashboardContext';
import {
  fetchAgents, mockAgents,
  type Agent,
} from '../lib/api';

// ---------- Prometheus-style scrape targets ----------

interface ScrapeTarget {
  job: string;
  endpoint: string;
  status: 'up' | 'down' | 'unknown';
  lastScrape: string;
  scrapeDuration: string;
  labels: Record<string, string>;
}

const SCRAPE_TARGETS: ScrapeTarget[] = [
  {
    job: 'claude-manager-api',
    endpoint: 'http://localhost:4040/api/metrics/health',
    status: 'up',
    lastScrape: '3s ago',
    scrapeDuration: '12ms',
    labels: { instance: 'localhost:4040', service: 'claude-manager' },
  },
  {
    job: 'agent-reports',
    endpoint: 'http://agent-reports.localhost/health',
    status: 'up',
    lastScrape: '7s ago',
    scrapeDuration: '8ms',
    labels: { instance: 'agent-reports.localhost', service: 'agent-reports' },
  },
  {
    job: 'jenkins',
    endpoint: 'http://jenkins.localhost/api/json',
    status: 'up',
    lastScrape: '15s ago',
    scrapeDuration: '45ms',
    labels: { instance: 'jenkins.localhost', service: 'jenkins' },
  },
  {
    job: 'kubernetes-api',
    endpoint: 'https://127.0.0.1:6443/healthz',
    status: 'up',
    lastScrape: '2s ago',
    scrapeDuration: '5ms',
    labels: { instance: 'scoady-control-plane', service: 'k8s' },
  },
  {
    job: 'registry',
    endpoint: 'http://registry.registry.svc.cluster.local:5000/v2/',
    status: 'up',
    lastScrape: '12s ago',
    scrapeDuration: '22ms',
    labels: { instance: 'registry:5000', service: 'registry' },
  },
  {
    job: 'websocket',
    endpoint: 'ws://localhost:4040/ws',
    status: 'up',
    lastScrape: '1s ago',
    scrapeDuration: '3ms',
    labels: { instance: 'localhost:4040', service: 'claude-manager', protocol: 'websocket' },
  },
];

// ---------- Shared helpers ----------

const STATUS_COLORS: Record<string, string> = {
  running: '#34d399', active: '#34d399',
  pending: '#fbbf24', idle: '#6b7280',
  done: '#60a5fa', error: '#fb7185',
  up: '#34d399', down: '#fb7185', unknown: '#fbbf24',
};

function timeAgo(ts?: string) {
  if (!ts) return 'unknown';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function agentSparkline(isUp: boolean) {
  return Array.from({ length: 12 }, (_, i) => ({
    value: isUp ? 1 + Math.sin(i * 0.8) * 0.3 : Math.random() * 0.2,
  }));
}

// ---------- Scrape Target Card ----------

function ScrapeTargetCard({ target, index }: { target: ScrapeTarget; index: number }) {
  const color = STATUS_COLORS[target.status] ?? '#6b7280';

  return (
    <motion.div
      className="glass glass-hover p-4"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <StatusDot status={target.status === 'up' ? 'healthy' : target.status === 'down' ? 'down' : 'degraded'} />
          <span className="text-sm font-medium text-text">{target.job}</span>
        </div>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider"
          style={{
            color,
            background: `${color}15`,
            border: `1px solid ${color}30`,
          }}
        >
          {target.status}
        </span>
      </div>

      <div className="flex items-center gap-1.5 mb-3">
        <ExternalLink size={10} className="text-dim shrink-0" />
        <span className="text-xs text-cyan font-mono truncate">{target.endpoint}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <span className="text-[10px] text-dim flex items-center gap-1"><Clock size={9} /> Last Scrape</span>
          <span className="text-xs text-subtext">{target.lastScrape}</span>
        </div>
        <div>
          <span className="text-[10px] text-dim">Duration</span>
          <span className="text-xs text-subtext">{target.scrapeDuration}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {Object.entries(target.labels).map(([k, v]) => (
          <span
            key={k}
            className="text-[10px] px-1.5 py-0.5 rounded border"
            style={{ background: 'rgba(42,42,62,0.4)', borderColor: 'rgba(74,74,94,0.3)', color: '#94a3b8' }}
          >
            {k}=<span className="text-text">{v}</span>
          </span>
        ))}
      </div>
    </motion.div>
  );
}

// ---------- Agent Target Card ----------

function AgentTargetCard({ agent, delay }: { agent: Agent; delay: number }) {
  const isUp = agent.status === 'running' || agent.status === 'active';
  const color = STATUS_COLORS[agent.status] ?? '#6b7280';
  const sparkData = useMemo(() => agentSparkline(isUp), [isUp]);

  return (
    <motion.div
      className="glass glass-hover p-3 flex items-start gap-3"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.03, duration: 0.3 }}
      whileHover={{ borderColor: `${color}40` }}
    >
      <div className="pt-0.5">
        <StatusDot status={agent.status as any} size={10} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text truncate">
            {agent.session_id ?? agent.id}
          </span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium"
            style={{ background: `${color}15`, color }}
          >
            {isUp ? 'UP' : agent.status === 'error' ? 'DOWN' : agent.status.toUpperCase()}
          </span>
        </div>

        {agent.milestone && (
          <p className="text-xs text-subtext mt-1 truncate">{agent.milestone}</p>
        )}

        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-dim">
          <span className="font-mono">{agent.model?.split('-').slice(-2).join('-') ?? '-'}</span>
          <span>Last seen: {timeAgo(agent.started_at)}</span>
          {agent.cost != null && <span>${agent.cost.toFixed(3)}</span>}
        </div>
      </div>

      <div className="shrink-0 w-16 h-6 opacity-60">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparkData}>
            <defs>
              <linearGradient id={`tgt-${agent.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone" dataKey="value"
              stroke={color} strokeWidth={1.5}
              fill={`url(#tgt-${agent.id})`}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

// ---------- Collapsible Project Group ----------

function ProjectGroup({ name, agents, defaultOpen }: { name: string; agents: Agent[]; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const upCount = agents.filter(a => a.status === 'running' || a.status === 'active').length;
  const downCount = agents.filter(a => a.status === 'error').length;

  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors cursor-pointer"
        style={{ background: open ? 'rgba(42,42,62,0.2)' : 'transparent' }}
      >
        {open
          ? <ChevronDown size={16} className="text-dim shrink-0" />
          : <ChevronRight size={16} className="text-dim shrink-0" />
        }
        <Bot size={14} className="text-subtext shrink-0" />
        <span className="text-sm font-medium text-text">{name}</span>
        <span className="text-xs text-dim">({agents.length})</span>
        <div className="flex-1" />
        {upCount > 0 && <span className="text-xs" style={{ color: '#34d399' }}>{upCount} up</span>}
        {downCount > 0 && <span className="text-xs ml-2" style={{ color: '#fb7185' }}>{downCount} down</span>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 mt-2 pl-6">
              {agents
                .sort((a, b) => {
                  const pri: Record<string, number> = { running: 0, active: 0, pending: 1, error: 2, done: 3, idle: 4 };
                  return (pri[a.status] ?? 9) - (pri[b.status] ?? 9);
                })
                .map((agent, i) => (
                  <AgentTargetCard key={agent.id} agent={agent} delay={i} />
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------- Main Page ----------

export default function Targets() {
  const { refreshInterval } = useDashboard();
  const { data: agents, loading } = useMetrics(() => fetchAgents(), refreshInterval, mockAgents);
  const [search, setSearch] = useState('');

  // Scrape target counts
  const scrapeUp = SCRAPE_TARGETS.filter(t => t.status === 'up').length;
  const scrapeDown = SCRAPE_TARGETS.filter(t => t.status === 'down').length;

  // Agent target filtering + grouping
  const filteredAgents = useMemo(() => {
    if (!agents) return [];
    if (!search) return agents;
    const q = search.toLowerCase();
    return agents.filter(a =>
      a.id.toLowerCase().includes(q) ||
      a.project.toLowerCase().includes(q) ||
      a.milestone?.toLowerCase().includes(q) ||
      a.status.includes(q)
    );
  }, [agents, search]);

  const grouped = useMemo(() => {
    const groups: Record<string, Agent[]> = {};
    for (const agent of filteredAgents) {
      const key = agent.project || 'ungrouped';
      if (!groups[key]) groups[key] = [];
      groups[key].push(agent);
    }
    return Object.fromEntries(
      Object.entries(groups).sort(
        ([, a], [, b]) =>
          b.filter(x => x.status === 'running' || x.status === 'active').length -
          a.filter(x => x.status === 'running' || x.status === 'active').length
      )
    );
  }, [filteredAgents]);

  const agentUp = filteredAgents.filter(a => a.status === 'running' || a.status === 'active').length;
  const agentDown = filteredAgents.filter(a => a.status === 'error').length;
  const agentOther = filteredAgents.length - agentUp - agentDown;

  return (
    <div className="space-y-5">
      {/* ===== Summary Bar ===== */}
      <motion.div
        className="glass p-4 flex items-center gap-6 flex-wrap"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-2">
          <Crosshair size={18} className="text-cyan" />
          <span className="text-sm font-medium text-text">Targets</span>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <CheckCircle size={12} className="text-green" />
            <span className="text-subtext">{scrapeUp + agentUp} up</span>
          </span>
          <span className="flex items-center gap-1.5">
            <XCircle size={12} className="text-rose" />
            <span className="text-subtext">{scrapeDown + agentDown} down</span>
          </span>
          {agentOther > 0 && (
            <span className="text-subtext">{agentOther} inactive</span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(42,42,62,0.5)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: '#34d399' }}
              initial={{ width: 0 }}
              animate={{ width: `${((scrapeUp + agentUp) / Math.max(SCRAPE_TARGETS.length + filteredAgents.length, 1)) * 100}%` }}
              transition={{ duration: 0.8 }}
            />
          </div>
          <span className="text-[10px] text-dim">
            {(((scrapeUp + agentUp) / Math.max(SCRAPE_TARGETS.length + filteredAgents.length, 1)) * 100).toFixed(0)}%
          </span>
        </div>
      </motion.div>

      {/* ===== Scrape Targets Section ===== */}
      <div>
        <motion.h3
          className="text-xs font-medium text-subtext uppercase tracking-wider mb-3 px-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          Service Endpoints
        </motion.h3>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {SCRAPE_TARGETS.map((target, i) => (
            <ScrapeTargetCard key={target.job} target={target} index={i} />
          ))}
        </div>
      </div>

      {/* ===== Agent Targets Section ===== */}
      <div>
        <motion.div
          className="flex items-center gap-3 mb-3 px-1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="text-xs font-medium text-subtext uppercase tracking-wider">
            Agent Targets
          </h3>
          <span className="text-xs text-dim">{filteredAgents.length} total</span>
          <div className="flex-1" />
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dim" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter agents..."
              className="pl-7 pr-3 py-1.5 rounded-lg text-xs text-text placeholder:text-dim focus:outline-none transition-colors w-48"
              style={{
                background: 'rgba(30, 30, 46, 0.6)',
                border: '1px solid rgba(74, 74, 94, 0.3)',
              }}
            />
          </div>
        </motion.div>

        {loading && !agents ? (
          <LoadingState message="Discovering agent targets..." />
        ) : Object.keys(grouped).length === 0 ? (
          <motion.div
            className="glass p-6 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-sm text-dim">{search ? 'No agents match your filter' : 'No agent targets discovered'}</p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
          >
            {Object.entries(grouped).map(([name, groupAgents], i) => (
              <ProjectGroup
                key={name}
                name={name}
                agents={groupAgents}
                defaultOpen={i < 3}
              />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
