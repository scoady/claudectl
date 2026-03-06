// ── Agent Orchestration Types ────────────────────────────────────────────────
// Centralized TypeScript interfaces matching the claude-manager API responses.
// IMPORTANT: Agent uses `session_id` (not `id`), `project_name` (not `project`),
// `turn_count` (not `turns`).

export interface Agent {
  session_id: string;
  project_name: string;
  model: string;
  status: string;
  phase?: string;
  turn_count: number;
  started_at?: string;
  milestones?: string[];
  task?: string;
  pid?: number;
}

export interface Project {
  name: string;
  path?: string;
  description?: string;
  active_session_ids?: string[];
}

export interface Stats {
  total_projects: number;
  total_agents: number;
  working_agents: number;
  idle_agents: number;
  uptime_seconds: number;
}

export interface Task {
  id: string;
  title: string;
  status: string;
  agent?: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon?: string;
  version?: number;
  role_presets: RolePreset[];
  config_schema: Record<string, ConfigField>;
  phases: PhaseDefinition[];
  isolation_strategy?: string;
}

export interface RolePreset {
  role: string;
  label: string;
  is_worker: boolean;
  persona?: string;
  expertise?: string[];
  builtin?: boolean;
}

export interface ConfigField {
  type: 'number' | 'string' | 'boolean' | 'select';
  label: string;
  default: any;
  min?: number;
  max?: number;
  options?: string[];
}

export interface PhaseDefinition {
  id: string;
  label: string;
  repeats?: boolean;
  creates_isolation?: boolean;
  cleanup_isolation?: boolean;
  prompt?: string;
}

export interface StreamEvent {
  type: string;
  agent_id?: string;
  session_id?: string;
  data?: any;
  text?: string;
  content?: string;
  milestone?: string;
  tool?: string;
  label?: string;
  timestamp?: string;
}

// ── Dispatch / Inject payloads ───────────────────────────────────────────────

export interface DispatchPayload {
  task: string;
  model?: string;
}

export interface InjectPayload {
  message: string;
}

// ── WebSocket event type literals ────────────────────────────────────────────

export type WSEventType =
  | 'agent_stream'
  | 'agent_milestone'
  | 'agent_spawned'
  | 'agent_done'
  | 'agent_update'
  | 'agent_id_assigned'
  | 'stats_update'
  | 'project_list';
