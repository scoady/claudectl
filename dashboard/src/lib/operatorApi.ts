const API_BASE = '/api';

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

async function deleteJSON<T>(url: string): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

// ── Types matching Go models ──────────────────────────────────────────────────

export type AgentStatus = 'active' | 'idle' | 'done' | 'error' | 'pending';
export type SessionPhase = 'starting' | 'thinking' | 'generating' | 'tool_input' | 'tool_exec' | 'idle' | 'injecting' | 'cancelled' | 'error';

export interface AgentSessionInfo {
  session_id: string;
  project_name: string;
  project_path: string;
  task?: string;
  status: AgentStatus;
  phase: SessionPhase;
  model?: string;
  started_at?: string;
  turn_count: number;
  milestones: string[];
  last_chunk?: string;
  is_controller: boolean;
  task_index?: number;
  has_pending_injection: boolean;
  pid?: number;
}

export interface ManagedProject {
  name: string;
  path: string;
  description?: string;
  goal?: string;
  config: {
    parallelism: number;
    model?: string;
    mcp_config?: string;
  };
  active_session_ids: string[];
}

export interface HealthResponse {
  status: string;
  uptime: number;
  version: string;
  agents: number;
  ws_connections: number;
}

export interface StatsResponse {
  active_agents: number;
  idle_agents: number;
  total_projects: number;
  uptime_seconds: number;
}

export interface OperatorStateResponse {
  tasks: Array<{
    id: string;
    project_name: string;
    task: string;
    status: string;
    session_id?: string;
  }>;
  total: number;
}

export interface WSEvent {
  type: string;
  data: unknown;
  timestamp: string;
}

// ── API Functions ─────────────────────────────────────────────────────────────

export const fetchHealth = () => fetchJSON<HealthResponse>('/health');
export const fetchStats = () => fetchJSON<StatsResponse>('/stats');
export const fetchOperatorState = () => fetchJSON<OperatorStateResponse>('/operator/state');
export const fetchAgentList = () => fetchJSON<AgentSessionInfo[]>('/agents');
export const fetchProjectList = () => fetchJSON<ManagedProject[]>('/projects');
export const fetchAgentMessages = (id: string) => fetchJSON<Array<Record<string, unknown>>>(`/agents/${id}/messages`);

export const dispatchTask = (project: string, task: string, model?: string) =>
  postJSON<{ status: string }>(`/projects/${project}/dispatch`, { task, model });

export const killAgent = (id: string) =>
  deleteJSON<{ status: string }>(`/agents/${id}`);

export const injectMessage = (id: string, message: string) =>
  postJSON<{ status: string }>(`/agents/${id}/inject`, { message });

export const fetchProjectTasks = (name: string) =>
  fetchJSON<Array<{ text: string; status: string; index: number }>>(`/projects/${name}/tasks`);

export const fetchGitBranch = (name: string) =>
  fetchJSON<{ branch: string }>(`/projects/${name}/files/branch`);
