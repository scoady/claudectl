import { motion } from 'framer-motion';
import { Activity, Bot, Coffee, FolderKanban, Radio, Clock } from 'lucide-react';
import type { HealthResponse, StatsResponse } from '../../lib/operatorApi';

interface Props {
  health: HealthResponse | null;
  stats: StatsResponse | null;
}

interface MetricDef {
  label: string;
  value: string | number;
  icon: typeof Activity;
  color: string;
  pulse?: boolean;
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function HealthStrip({ health, stats }: Props) {
  const metrics: MetricDef[] = [
    {
      label: 'Uptime',
      value: health ? formatUptime(health.uptime) : '--',
      icon: Clock,
      color: '#67e8f9',
    },
    {
      label: 'Active',
      value: stats?.active_agents ?? '--',
      icon: Bot,
      color: '#fbbf24',
      pulse: (stats?.active_agents ?? 0) > 0,
    },
    {
      label: 'Idle',
      value: stats?.idle_agents ?? '--',
      icon: Coffee,
      color: '#34d399',
    },
    {
      label: 'Projects',
      value: stats?.total_projects ?? '--',
      icon: FolderKanban,
      color: '#c084fc',
    },
    {
      label: 'WebSocket',
      value: health?.ws_connections ?? '--',
      icon: Radio,
      color: '#60a5fa',
    },
    {
      label: 'Status',
      value: health?.status === 'ok' ? 'NOMINAL' : health?.status?.toUpperCase() ?? '--',
      icon: Activity,
      color: health?.status === 'ok' ? '#34d399' : '#fb7185',
    },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto">
      {metrics.map((m, i) => (
        <motion.div
          key={m.label}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.3 }}
          className="flex-1 min-w-[120px] flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div
            className="flex items-center justify-center w-7 h-7 rounded-md"
            style={{ background: `${m.color}12` }}
          >
            <m.icon size={14} style={{ color: m.color }} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {m.label}
            </span>
            <span
              className="text-sm font-semibold tabular-nums truncate"
              style={{
                color: m.color,
                textShadow: m.pulse ? `0 0 8px ${m.color}40` : 'none',
              }}
            >
              {m.value}
            </span>
          </div>
          {m.pulse && (
            <span
              className="w-1.5 h-1.5 rounded-full ml-auto animate-pulse"
              style={{ background: m.color }}
            />
          )}
        </motion.div>
      ))}
    </div>
  );
}
