import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';
import { Bot, DollarSign, FolderKanban, Clock, Cpu, CheckCircle, AlertCircle } from 'lucide-react';
import MetricCard from '../components/MetricCard';
import ChartPanel from '../components/ChartPanel';
import RemotionPanel from '../components/RemotionPanel';
import { MetricsTimeline } from '../compositions/MetricsTimeline';
import { CostTracker } from '../compositions/CostTracker';
import { ProjectHeatmap } from '../compositions/ProjectHeatmap';
import { useMetrics } from '../hooks/useMetrics';
import { useDashboard, getSince, getResolution } from '../context/DashboardContext';
import LoadingState from '../components/LoadingState';
import {
  fetchSummary, fetchAgentMetrics, fetchCostMetrics, fetchTaskMetrics, fetchModelUsage,
  mockSummary, mockAgentMetrics, mockCostMetrics, mockTaskMetrics, mockModelUsage,
  type SummaryResponse,
} from '../lib/api';

const MODEL_COLORS = ['#67e8f9', '#c084fc', '#fbbf24', '#34d399', '#fb7185'];

function formatTime(ts: string) {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass px-3 py-2 text-xs min-w-[120px]">
      <p className="text-dim mb-1">{typeof label === 'string' && label.includes('T') ? formatTime(label) : label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-subtext capitalize">{p.name}</span>
          </span>
          <span className="text-text font-medium">{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function Overview() {
  const { timeRange, refreshInterval } = useDashboard();
  const since = getSince(timeRange);
  const res = getResolution(timeRange);

  const { data: summary } = useMetrics<SummaryResponse>(
    () => fetchSummary(), refreshInterval, mockSummary,
  );
  const { data: agentData } = useMetrics(
    () => fetchAgentMetrics(since, res), refreshInterval, mockAgentMetrics,
  );
  const { data: costData } = useMetrics(
    () => fetchCostMetrics(since, res), refreshInterval, mockCostMetrics,
  );
  const { data: taskData } = useMetrics(
    () => fetchTaskMetrics(since, res), refreshInterval, mockTaskMetrics,
  );
  const { data: modelData } = useMetrics(
    () => fetchModelUsage(since), refreshInterval, mockModelUsage,
  );

  if (!summary) return <LoadingState />;

  // Derive Remotion input data from metrics hooks
  const timelineSeries = agentData
    ? [
        { name: 'Active', color: '#34d399', data: agentData.series.active.map((p: any) => p.value) },
        { name: 'Spawned', color: '#67e8f9', data: agentData.series.spawned.map((p: any) => p.value) },
        { name: 'Completed', color: '#c084fc', data: agentData.series.completed.map((p: any) => p.value) },
      ]
    : undefined;
  const costSegments = modelData
    ? modelData.models.map((m: any, i: number) => ({
        model: m.name.split('-').slice(-2).join('-'),
        cost: m.cost ?? m.requests,
        color: MODEL_COLORS[i % MODEL_COLORS.length],
      }))
    : undefined;

  return (
    <div className="space-y-4">
      {/* Top metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <MetricCard title="Active Agents" value={summary.active_agents} icon={<Bot size={16} />} color="#34d399" sparkline={agentData?.series.active} trend="up" trendValue="+2" delay={0} />
        <MetricCard title="Total Agents" value={summary.total_agents} icon={<Bot size={16} />} color="#67e8f9" sparkline={agentData?.series.spawned} delay={1} />
        <MetricCard title="Tasks Done" value={summary.completed_tasks} subtitle={`of ${summary.total_tasks} total`} icon={<CheckCircle size={16} />} color="#c084fc" sparkline={taskData?.series.completed} trend="up" trendValue="+12" delay={2} />
        <MetricCard title="Failed" value={summary.total_tasks - summary.completed_tasks} icon={<AlertCircle size={16} />} color="#fb7185" sparkline={taskData?.series.failed} delay={3} />
        <MetricCard title="Total Cost" value={`$${summary.total_cost.toFixed(2)}`} icon={<DollarSign size={16} />} color="#fbbf24" sparkline={costData?.series.cumulative} trend="up" trendValue="+$0.42" delay={4} />
        <MetricCard title="Projects" value={summary.projects} icon={<FolderKanban size={16} />} color="#60a5fa" delay={5} />
        <MetricCard title="Models" value={summary.models_used} icon={<Cpu size={16} />} color="#c084fc" delay={6} />
        <MetricCard title="Uptime" value={`${summary.uptime_hours.toFixed(1)}h`} icon={<Clock size={16} />} color="#34d399" delay={7} />
      </div>

      {/* Remotion: Agent Activity Timeline (full width) */}
      <RemotionPanel
        component={MetricsTimeline}
        inputProps={{ series: timelineSeries, title: 'AGENT ACTIVITY' }}
        title="Agent Activity"
        subtitle="Remotion-powered visualization"
        width={1920}
        height={400}
        durationInFrames={300}
        delay={1}
        borderColor="rgba(103, 232, 249, 0.15)"
        className="h-[260px]"
      />

      {/* Remotion: Cost Tracker + Project Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RemotionPanel
          component={CostTracker}
          inputProps={{ segments: costSegments, title: 'COST BREAKDOWN' }}
          title="Cost Breakdown"
          subtitle="by model"
          width={800}
          height={800}
          durationInFrames={300}
          delay={2}
          borderColor="rgba(192, 132, 252, 0.15)"
          className="h-[360px]"
        />
        <RemotionPanel
          component={ProjectHeatmap}
          inputProps={{}}
          title="Project Heatmap"
          subtitle="24h activity"
          width={1920}
          height={600}
          durationInFrames={300}
          delay={3}
          borderColor="rgba(251, 191, 36, 0.15)"
          className="h-[360px]"
        />
      </div>

      {/* Recharts detail row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartPanel title="Agent Activity" subtitle="Active, spawned, completed over time" delay={4}>
          {agentData ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={agentData.series.active.map((p, i) => ({
                timestamp: p.timestamp, active: p.value,
                spawned: agentData.series.spawned[i]?.value ?? 0,
                completed: agentData.series.completed[i]?.value ?? 0,
              }))}>
                <defs>
                  <linearGradient id="gActive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gSpawned" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#67e8f9" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#67e8f9" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c084fc" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#c084fc" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" tickFormatter={formatTime} tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                <Area type="monotone" dataKey="active" stroke="#34d399" strokeWidth={2} fill="url(#gActive)" dot={false} animationDuration={800} />
                <Area type="monotone" dataKey="spawned" stroke="#67e8f9" strokeWidth={1.5} fill="url(#gSpawned)" dot={false} animationDuration={800} />
                <Area type="monotone" dataKey="completed" stroke="#c084fc" strokeWidth={1.5} fill="url(#gCompleted)" dot={false} animationDuration={800} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <LoadingState />}
        </ChartPanel>

        <ChartPanel title="Cost Accumulation" subtitle="Cumulative cost over time" delay={2}>
          {costData ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={costData.series.cumulative}>
                <defs>
                  <linearGradient id="gCost" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#fbbf24" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" tickFormatter={formatTime} tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="value" name="cost" stroke="#fbbf24" strokeWidth={2} fill="url(#gCost)" dot={false} animationDuration={800} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <LoadingState />}
        </ChartPanel>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartPanel title="Task Throughput" subtitle="Created vs completed per interval" delay={3}>
          {taskData ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={taskData.series.created.map((p, i) => ({
                timestamp: p.timestamp, created: p.value,
                completed: taskData.series.completed[i]?.value ?? 0,
                failed: taskData.series.failed[i]?.value ?? 0,
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" tickFormatter={formatTime} tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="created" fill="#67e8f9" radius={[2, 2, 0, 0]} animationDuration={600} />
                <Bar dataKey="completed" fill="#34d399" radius={[2, 2, 0, 0]} animationDuration={600} />
                <Bar dataKey="failed" fill="#fb7185" radius={[2, 2, 0, 0]} animationDuration={600} />
              </BarChart>
            </ResponsiveContainer>
          ) : <LoadingState />}
        </ChartPanel>

        <ChartPanel title="Model Usage" subtitle="Requests by model" delay={4}>
          {modelData ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={modelData.models.map((m) => ({ name: m.name.split('-').slice(-2).join('-'), value: m.requests }))}
                  cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value" animationDuration={800}
                >
                  {modelData.models.map((_, i) => (
                    <Cell key={i} fill={MODEL_COLORS[i % MODEL_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <LoadingState />}
        </ChartPanel>

        <ChartPanel title="Cost per Interval" subtitle="Spending rate" delay={5}>
          {costData ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costData.series.per_interval}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="timestamp" tickFormatter={formatTime} tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" name="cost" fill="#c084fc" radius={[2, 2, 0, 0]} animationDuration={600}>
                  {costData.series.per_interval.map((_, i) => (
                    <Cell key={i} fill={`rgba(192, 132, 252, ${0.4 + (i / costData.series.per_interval.length) * 0.6})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <LoadingState />}
        </ChartPanel>
      </div>
    </div>
  );
}
