import { motion } from 'framer-motion';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { Server, Cpu, HardDrive, Clock, Wifi, Activity, MemoryStick } from 'lucide-react';
import StatusDot from '../components/StatusDot';
import { useMetrics } from '../hooks/useMetrics';
import { useDashboard } from '../context/DashboardContext';
import LoadingState from '../components/LoadingState';
import { fetchSystemHealth, mockSystemHealth, type SystemHealthResponse } from '../lib/api';

function formatUptime(seconds: number) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

// Generate fake historical data for gauge sparklines
function fakeHistory(base: number, variance: number, count = 30) {
  return Array.from({ length: count }, () => ({
    value: Math.max(0, Math.min(100, base + (Math.random() - 0.5) * variance)),
  }));
}

interface GaugeCardProps {
  title: string;
  value: number;
  unit: string;
  max?: number;
  icon: React.ReactNode;
  color: string;
  delay: number;
  history?: { value: number }[];
}

function GaugeCard({ title, value, unit, max = 100, icon, color, delay, history }: GaugeCardProps) {
  const pct = Math.min((value / max) * 100, 100);
  const isWarning = pct > 70;
  const isCritical = pct > 90;
  const barColor = isCritical ? '#fb7185' : isWarning ? '#fbbf24' : color;

  return (
    <motion.div
      className="glass glass-hover p-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.1 }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span style={{ color }}>{icon}</span>
          <span className="text-xs font-medium text-subtext uppercase tracking-wider">{title}</span>
        </div>
        <span className="text-xs text-dim">{unit}</span>
      </div>

      <div className="flex items-end gap-3 mb-3">
        <span className="text-3xl font-bold text-text">{typeof value === 'number' ? Math.round(value) : value}</span>
        {max !== 100 && <span className="text-xs text-dim pb-1">/ {max}</span>}
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-bg-surface-2 overflow-hidden mb-2">
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${barColor}80, ${barColor})` }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, delay: delay * 0.1, ease: 'easeOut' }}
        />
      </div>

      {/* Mini sparkline */}
      {history && (
        <div className="h-8 -mx-1 mt-1 opacity-40">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history}>
              <defs>
                <linearGradient id={`gSys-${title.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1} fill={`url(#gSys-${title.replace(/\s/g, '')})`} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  );
}

export default function System() {
  const { refreshInterval } = useDashboard();
  const { data: health } = useMetrics<SystemHealthResponse>(
    () => fetchSystemHealth(), refreshInterval, mockSystemHealth,
  );

  if (!health) return <LoadingState />;

  return (
    <div className="space-y-4">
      {/* System status header */}
      <motion.div
        className="glass p-5"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Server size={20} className="text-cyan" />
            <div>
              <h2 className="text-base font-semibold text-text">System Health</h2>
              <p className="text-xs text-dim mt-0.5">c9s agent platform runtime status</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <StatusDot
              status={health.status}
              label={health.status}
              size={10}
            />
            <div className="text-right">
              <span className="text-xs text-dim">Uptime</span>
              <p className="text-sm font-mono text-green">{formatUptime(health.uptime_seconds)}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Gauge grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <GaugeCard
          title="CPU"
          value={health.cpu_percent}
          unit="%"
          icon={<Cpu size={14} />}
          color="#67e8f9"
          delay={0}
          history={fakeHistory(health.cpu_percent, 20)}
        />
        <GaugeCard
          title="Memory"
          value={health.memory_mb}
          unit="MB"
          max={2048}
          icon={<MemoryStick size={14} />}
          color="#c084fc"
          delay={1}
          history={fakeHistory(health.memory_mb / 2048 * 100, 15)}
        />
        <GaugeCard
          title="Disk"
          value={health.disk_usage_percent}
          unit="%"
          icon={<HardDrive size={14} />}
          color="#fbbf24"
          delay={2}
          history={fakeHistory(health.disk_usage_percent, 5)}
        />
        <GaugeCard
          title="Active Agents"
          value={health.active_agents}
          unit="agents"
          max={20}
          icon={<Activity size={14} />}
          color="#34d399"
          delay={3}
          history={fakeHistory(health.active_agents / 20 * 100, 30)}
        />
        <GaugeCard
          title="WebSocket Clients"
          value={health.websocket_clients}
          unit="clients"
          max={10}
          icon={<Wifi size={14} />}
          color="#60a5fa"
          delay={4}
          history={fakeHistory(health.websocket_clients / 10 * 100, 25)}
        />
        <GaugeCard
          title="Uptime"
          value={Math.round(health.uptime_seconds / 3600)}
          unit="hours"
          max={720}
          icon={<Clock size={14} />}
          color="#34d399"
          delay={5}
          history={fakeHistory(health.uptime_seconds / 7200, 2)}
        />
      </div>

      {/* System info */}
      <motion.div
        className="glass p-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <h3 className="text-sm font-medium text-text mb-3">Runtime Info</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Platform', value: 'darwin arm64' },
            { label: 'Cluster', value: 'kind/scoady' },
            { label: 'Backend', value: 'FastAPI (docker)' },
            { label: 'Frontend', value: 'Vite SPA (k8s)' },
            { label: 'Registry', value: 'registry:5000' },
            { label: 'CI/CD', value: 'Jenkins' },
            { label: 'Ingress', value: 'NGINX' },
            { label: 'Version', value: 'v0.1.0' },
          ].map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 + i * 0.03 }}
            >
              <span className="text-[10px] text-dim uppercase tracking-wider">{item.label}</span>
              <p className="text-xs text-subtext font-mono mt-0.5">{item.value}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
