import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FolderKanban, Bot, CheckCircle } from 'lucide-react';
import ChartPanel from '../components/ChartPanel';
import StatusDot from '../components/StatusDot';
import { useMetrics } from '../hooks/useMetrics';
import { useDashboard, getSince, getResolution } from '../context/DashboardContext';
import LoadingState from '../components/LoadingState';
import {
  fetchProjects, fetchProjectMetrics,
  mockProjects, mockProjectMetrics,
} from '../lib/api';

const PROJECT_COLORS = ['#67e8f9', '#c084fc', '#fbbf24', '#34d399', '#fb7185', '#60a5fa'];

function formatTime(ts: string) {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
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

export default function Projects() {
  const { timeRange, refreshInterval } = useDashboard();
  const since = getSince(timeRange);
  const res = getResolution(timeRange);

  const { data: projects } = useMetrics(() => fetchProjects(), refreshInterval, mockProjects);
  const { data: metrics } = useMetrics(() => fetchProjectMetrics(since, res), refreshInterval, mockProjectMetrics);

  return (
    <div className="space-y-4">
      {/* Combined chart */}
      <ChartPanel title="Project Activity" subtitle="Agent activity per project" delay={0} height={260}>
        {metrics ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={metrics.projects[0]?.series.map((p, i) => {
              const point: Record<string, any> = { timestamp: p.timestamp };
              metrics.projects.forEach((proj) => {
                point[proj.name] = proj.series[i]?.value ?? 0;
              });
              return point;
            }) ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" tickFormatter={formatTime} tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              {metrics.projects.map((proj, i) => (
                <Area
                  key={proj.name}
                  type="monotone"
                  dataKey={proj.name}
                  stroke={PROJECT_COLORS[i % PROJECT_COLORS.length]}
                  strokeWidth={1.5}
                  fill="none"
                  dot={false}
                  animationDuration={800}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        ) : <LoadingState />}
      </ChartPanel>

      {/* Project cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {projects?.map((proj, i) => {
          const color = PROJECT_COLORS[i % PROJECT_COLORS.length];
          const pm = metrics?.projects.find(p => p.name === proj.name);
          return (
            <motion.div
              key={proj.name}
              className="glass glass-hover p-4"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ borderColor: `${color}40` }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FolderKanban size={14} style={{ color }} />
                  <span className="text-sm font-medium text-text">{proj.name}</span>
                </div>
                <StatusDot status={proj.status === 'active' ? 'active' : 'idle'} />
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <span className="text-xs text-dim flex items-center gap-1"><Bot size={10} /> Agents</span>
                  <span className="text-lg font-semibold text-text">{pm?.total_agents ?? proj.agents ?? 0}</span>
                </div>
                <div>
                  <span className="text-xs text-dim flex items-center gap-1"><CheckCircle size={10} /> Tasks</span>
                  <span className="text-lg font-semibold text-text">{pm?.total_tasks ?? 0}</span>
                </div>
              </div>

              {pm && pm.series.length > 0 && (
                <div className="h-12 -mx-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={pm.series}>
                      <defs>
                        <linearGradient id={`gProj-${proj.name}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} fill={`url(#gProj-${proj.name})`} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              <p className="text-[10px] text-dim mt-2 font-mono truncate">{proj.path}</p>
            </motion.div>
          );
        })}
        {!projects && <LoadingState />}
      </div>
    </div>
  );
}
