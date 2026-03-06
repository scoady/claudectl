const API_BASE = '/api';

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`);
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

// Metrics endpoints
export async function fetchAgentMetrics(since: string, resolution: string) {
  return fetchJSON<AgentMetricsResponse>(`/metrics/agents?since=${since}&resolution=${resolution}`);
}

export async function fetchCostMetrics(since: string, resolution: string) {
  return fetchJSON<CostMetricsResponse>(`/metrics/costs?since=${since}&resolution=${resolution}`);
}

export async function fetchTaskMetrics(since: string, resolution: string) {
  return fetchJSON<TaskMetricsResponse>(`/metrics/tasks?since=${since}&resolution=${resolution}`);
}

export async function fetchModelUsage(since: string) {
  return fetchJSON<ModelUsageResponse>(`/metrics/models?since=${since}`);
}

export async function fetchProjectMetrics(since: string, resolution: string) {
  return fetchJSON<ProjectMetricsResponse>(`/metrics/projects?since=${since}&resolution=${resolution}`);
}

export async function fetchSystemHealth() {
  return fetchJSON<SystemHealthResponse>('/metrics/health');
}

export async function fetchSummary() {
  return fetchJSON<SummaryResponse>('/metrics/summary');
}

// Entity endpoints
export async function fetchAgents() {
  return fetchJSON<Agent[]>('/agents');
}

export async function fetchProjects() {
  return fetchJSON<Project[]>('/projects');
}

// Types
export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
}

export interface AgentMetricsResponse {
  series: {
    active: TimeSeriesPoint[];
    spawned: TimeSeriesPoint[];
    completed: TimeSeriesPoint[];
    errored: TimeSeriesPoint[];
  };
}

export interface CostMetricsResponse {
  series: {
    cumulative: TimeSeriesPoint[];
    per_interval: TimeSeriesPoint[];
  };
  total: number;
  by_model: Record<string, number>;
}

export interface TaskMetricsResponse {
  series: {
    created: TimeSeriesPoint[];
    completed: TimeSeriesPoint[];
    failed: TimeSeriesPoint[];
  };
  throughput: number;
}

export interface ModelUsageResponse {
  models: {
    name: string;
    requests: number;
    tokens_in: number;
    tokens_out: number;
    cost: number;
  }[];
}

export interface ProjectMetricsResponse {
  projects: {
    name: string;
    series: TimeSeriesPoint[];
    total_agents: number;
    total_tasks: number;
  }[];
}

export interface SystemHealthResponse {
  status: 'healthy' | 'degraded' | 'down';
  uptime_seconds: number;
  memory_mb: number;
  cpu_percent: number;
  active_agents: number;
  websocket_clients: number;
  disk_usage_percent: number;
}

export interface SummaryResponse {
  total_agents: number;
  active_agents: number;
  total_tasks: number;
  completed_tasks: number;
  total_cost: number;
  uptime_hours: number;
  projects: number;
  models_used: number;
}

export interface Agent {
  id: string;
  session_id?: string;
  project: string;
  status: 'running' | 'done' | 'error' | 'pending' | 'active' | 'idle';
  model?: string;
  started_at?: string;
  milestone?: string;
  cost?: number;
  tokens_in?: number;
  tokens_out?: number;
}

export interface Project {
  name: string;
  path: string;
  agents?: number;
  status?: string;
}

// Mock data generators for when backend is unavailable
export function mockSummary(): SummaryResponse {
  return {
    total_agents: 47,
    active_agents: 3,
    total_tasks: 128,
    completed_tasks: 115,
    total_cost: 12.47,
    uptime_hours: 72.5,
    projects: 6,
    models_used: 3,
  };
}

export function mockAgentMetrics(): AgentMetricsResponse {
  const now = Date.now();
  const points = 60;
  const gen = (base: number, variance: number) =>
    Array.from({ length: points }, (_, i) => ({
      timestamp: new Date(now - (points - i) * 60000).toISOString(),
      value: Math.max(0, base + Math.floor(Math.random() * variance - variance / 2)),
    }));
  return {
    series: {
      active: gen(3, 4),
      spawned: gen(2, 3),
      completed: gen(2, 3),
      errored: gen(0, 2),
    },
  };
}

export function mockCostMetrics(): CostMetricsResponse {
  const now = Date.now();
  const points = 60;
  let cum = 8.0;
  const cumulative = Array.from({ length: points }, (_, i) => {
    cum += Math.random() * 0.08;
    return {
      timestamp: new Date(now - (points - i) * 60000).toISOString(),
      value: parseFloat(cum.toFixed(3)),
    };
  });
  const per_interval = Array.from({ length: points }, (_, i) => ({
    timestamp: new Date(now - (points - i) * 60000).toISOString(),
    value: parseFloat((Math.random() * 0.1).toFixed(4)),
  }));
  return {
    series: { cumulative, per_interval },
    total: cum,
    by_model: { 'claude-opus-4-6': 8.2, 'claude-sonnet-4-20250514': 3.1, 'claude-haiku-3': 1.17 },
  };
}

export function mockTaskMetrics(): TaskMetricsResponse {
  const now = Date.now();
  const points = 60;
  const gen = (base: number, variance: number) =>
    Array.from({ length: points }, (_, i) => ({
      timestamp: new Date(now - (points - i) * 60000).toISOString(),
      value: Math.max(0, base + Math.floor(Math.random() * variance - variance / 2)),
    }));
  return {
    series: {
      created: gen(3, 4),
      completed: gen(3, 3),
      failed: gen(0, 1),
    },
    throughput: 2.3,
  };
}

export function mockModelUsage(): ModelUsageResponse {
  return {
    models: [
      { name: 'claude-opus-4-6', requests: 142, tokens_in: 2_450_000, tokens_out: 890_000, cost: 8.2 },
      { name: 'claude-sonnet-4-20250514', requests: 89, tokens_in: 1_200_000, tokens_out: 540_000, cost: 3.1 },
      { name: 'claude-haiku-3', requests: 234, tokens_in: 890_000, tokens_out: 320_000, cost: 1.17 },
    ],
  };
}

export function mockProjectMetrics(): ProjectMetricsResponse {
  const now = Date.now();
  const points = 12;
  const gen = (base: number) =>
    Array.from({ length: points }, (_, i) => ({
      timestamp: new Date(now - (points - i) * 300000).toISOString(),
      value: Math.max(0, base + Math.floor(Math.random() * 4 - 2)),
    }));
  return {
    projects: [
      { name: 'agent-reports', series: gen(2), total_agents: 12, total_tasks: 34 },
      { name: 'claude-manager', series: gen(4), total_agents: 23, total_tasks: 56 },
      { name: 'claudectl', series: gen(1), total_agents: 8, total_tasks: 21 },
      { name: 'helm-platform', series: gen(1), total_agents: 5, total_tasks: 12 },
    ],
  };
}

export function mockSystemHealth(): SystemHealthResponse {
  return {
    status: 'healthy',
    uptime_seconds: 261000,
    memory_mb: 512,
    cpu_percent: 23,
    active_agents: 3,
    websocket_clients: 2,
    disk_usage_percent: 42,
  };
}

export function mockAgents(): Agent[] {
  return [
    { id: 'agent-001', session_id: 'sess-abc123', project: 'claude-manager', status: 'running', model: 'claude-opus-4-6', started_at: new Date(Date.now() - 3600000).toISOString(), milestone: 'Edit - src/components/Dashboard.tsx', cost: 0.42, tokens_in: 125000, tokens_out: 45000 },
    { id: 'agent-002', session_id: 'sess-def456', project: 'agent-reports', status: 'running', model: 'claude-sonnet-4-20250514', started_at: new Date(Date.now() - 1800000).toISOString(), milestone: 'Bash - npm test', cost: 0.18, tokens_in: 67000, tokens_out: 23000 },
    { id: 'agent-003', session_id: 'sess-ghi789', project: 'claudectl', status: 'running', model: 'claude-opus-4-6', started_at: new Date(Date.now() - 900000).toISOString(), milestone: 'Read - internal/server/handlers.go', cost: 0.31, tokens_in: 98000, tokens_out: 38000 },
    { id: 'agent-004', session_id: 'sess-jkl012', project: 'claude-manager', status: 'done', model: 'claude-sonnet-4-20250514', started_at: new Date(Date.now() - 7200000).toISOString(), milestone: 'Done', cost: 0.56, tokens_in: 234000, tokens_out: 89000 },
    { id: 'agent-005', session_id: 'sess-mno345', project: 'helm-platform', status: 'done', model: 'claude-haiku-3', started_at: new Date(Date.now() - 5400000).toISOString(), milestone: 'Done', cost: 0.08, tokens_in: 45000, tokens_out: 12000 },
    { id: 'agent-006', session_id: 'sess-pqr678', project: 'agent-reports', status: 'error', model: 'claude-opus-4-6', started_at: new Date(Date.now() - 4500000).toISOString(), milestone: 'Error: timeout', cost: 0.22, tokens_in: 89000, tokens_out: 31000 },
  ];
}

export function mockProjects(): Project[] {
  return [
    { name: 'claude-manager', path: '~/git/claude-manager', agents: 8, status: 'active' },
    { name: 'agent-reports', path: '~/git/claude-managed-projects/agent-reports', agents: 4, status: 'active' },
    { name: 'claudectl', path: '~/git/claudectl', agents: 3, status: 'active' },
    { name: 'helm-platform', path: '~/git/helm-platform', agents: 2, status: 'idle' },
    { name: 'kind-infra', path: '~/git/kind-infra', agents: 0, status: 'idle' },
  ];
}
