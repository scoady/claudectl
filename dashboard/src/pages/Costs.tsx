import { motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { DollarSign, TrendingUp, Layers, Zap } from 'lucide-react';
import MetricCard from '../components/MetricCard';
import ChartPanel from '../components/ChartPanel';
import { useMetrics } from '../hooks/useMetrics';
import { useDashboard, getSince, getResolution } from '../context/DashboardContext';
import LoadingState from '../components/LoadingState';
import {
  fetchCostMetrics, fetchModelUsage,
  mockCostMetrics, mockModelUsage,
} from '../lib/api';

const MODEL_COLORS: Record<string, string> = {
  'claude-opus-4-6': '#67e8f9',
  'claude-sonnet-4-20250514': '#c084fc',
  'claude-haiku-3': '#fbbf24',
};

function formatTime(ts: string) {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass px-3 py-2 text-xs">
      <p className="text-dim mb-1">{typeof label === 'string' && label.includes('T') ? formatTime(label) : label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-subtext">{p.name}</span>
          </span>
          <span className="text-text font-medium">
            {typeof p.value === 'number' && p.name?.toLowerCase().includes('cost') ? `$${p.value.toFixed(4)}` : p.value?.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Costs() {
  const { timeRange, refreshInterval } = useDashboard();
  const since = getSince(timeRange);
  const res = getResolution(timeRange);

  const { data: costData } = useMetrics(
    () => fetchCostMetrics(since, res), refreshInterval, mockCostMetrics,
  );
  const { data: modelData } = useMetrics(
    () => fetchModelUsage(since), refreshInterval, mockModelUsage,
  );

  const totalCost = costData?.total ?? 0;
  const avgPerInterval = costData ? costData.series.per_interval.reduce((s, p) => s + p.value, 0) / Math.max(costData.series.per_interval.length, 1) : 0;

  return (
    <div className="space-y-4">
      {/* Top cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard title="Total Cost" value={`$${totalCost.toFixed(2)}`} icon={<DollarSign size={16} />} color="#fbbf24" sparkline={costData?.series.cumulative} trend="up" trendValue="+$0.42" delay={0} />
        <MetricCard title="Avg / Interval" value={`$${avgPerInterval.toFixed(4)}`} icon={<TrendingUp size={16} />} color="#c084fc" delay={1} />
        <MetricCard title="Models Used" value={modelData?.models.length ?? 0} icon={<Layers size={16} />} color="#67e8f9" delay={2} />
        <MetricCard title="Total Requests" value={modelData?.models.reduce((s, m) => s + m.requests, 0) ?? 0} icon={<Zap size={16} />} color="#34d399" delay={3} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartPanel title="Cost Over Time" subtitle="Cumulative spending" delay={0} height={300}>
          {costData ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={costData.series.cumulative}>
                <defs>
                  <linearGradient id="gCostCum" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#fbbf24" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" tickFormatter={formatTime} tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="value" name="cost" stroke="#fbbf24" strokeWidth={2} fill="url(#gCostCum)" dot={false} animationDuration={800} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <LoadingState />}
        </ChartPanel>

        <ChartPanel title="Spending Rate" subtitle="Cost per interval" delay={1} height={300}>
          {costData ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costData.series.per_interval}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" tickFormatter={formatTime} tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="cost" radius={[2, 2, 0, 0]} animationDuration={600}>
                  {costData.series.per_interval.map((_, i) => (
                    <Cell key={i} fill={`rgba(192, 132, 252, ${0.3 + (i / costData.series.per_interval.length) * 0.7})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <LoadingState />}
        </ChartPanel>
      </div>

      {/* Model breakdown table */}
      <motion.div
        className="glass overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="px-4 pt-4 pb-2">
          <h3 className="text-sm font-medium text-text">Cost by Model</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-muted/30">
                <th className="px-4 py-2 text-xs font-medium text-subtext">Model</th>
                <th className="px-4 py-2 text-xs font-medium text-subtext">Requests</th>
                <th className="px-4 py-2 text-xs font-medium text-subtext">Tokens In</th>
                <th className="px-4 py-2 text-xs font-medium text-subtext">Tokens Out</th>
                <th className="px-4 py-2 text-xs font-medium text-subtext">Cost</th>
                <th className="px-4 py-2 text-xs font-medium text-subtext">Share</th>
              </tr>
            </thead>
            <tbody>
              {modelData?.models.map((m, i) => {
                const totalModelCost = modelData.models.reduce((s, x) => s + x.cost, 0);
                const pct = totalModelCost > 0 ? (m.cost / totalModelCost) * 100 : 0;
                const color = MODEL_COLORS[m.name] ?? '#67e8f9';
                return (
                  <motion.tr
                    key={m.name}
                    className="border-b border-muted/20 hover:bg-bg-surface-1/40 transition-colors"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                        <span className="text-xs font-mono text-text">{m.name}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-subtext">{m.requests.toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-dim font-mono">{formatTokens(m.tokens_in)}</td>
                    <td className="px-4 py-3 text-xs text-dim font-mono">{formatTokens(m.tokens_out)}</td>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color }}>${m.cost.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-bg-surface-2 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8, delay: i * 0.1 }}
                          />
                        </div>
                        <span className="text-xs text-dim w-10 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
