// ── Centralized API Client ───────────────────────────────────────────────────
// All fetch calls consolidated behind a namespaced `api` object.
// Usage: api.projects.list(), api.agents.kill(id), etc.

import type {
  Agent,
  Project,
  Stats,
  Task,
  WorkflowTemplate,
  DispatchPayload,
  InjectPayload,
} from '../types';

const API_BASE = 'http://localhost:4040';

// ── Low-level helpers ────────────────────────────────────────────────────────

async function apiFetch<T>(path: string): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`);
  if (!resp.ok) {
    throw new ApiError(resp.status, `${resp.status} ${resp.statusText} — ${path}`);
  }
  return resp.json();
}

async function apiPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    throw new ApiError(resp.status, `${resp.status} ${resp.statusText} — POST ${path}`);
  }
  return resp.json();
}

async function apiDelete(path: string): Promise<void> {
  const resp = await fetch(`${API_BASE}${path}`, { method: 'DELETE' });
  if (!resp.ok) {
    throw new ApiError(resp.status, `${resp.status} ${resp.statusText} — DELETE ${path}`);
  }
}

// ── Error class ──────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── Safe wrappers (return null on failure — useful for polling) ──────────────

async function safeFetch<T>(path: string): Promise<T | null> {
  try {
    return await apiFetch<T>(path);
  } catch {
    return null;
  }
}

async function safePost<T>(path: string, body: Record<string, unknown>): Promise<T | null> {
  try {
    return await apiPost<T>(path, body);
  } catch {
    return null;
  }
}

async function safeDelete(path: string): Promise<boolean> {
  try {
    await apiDelete(path);
    return true;
  } catch {
    return false;
  }
}

// ── Namespaced API ───────────────────────────────────────────────────────────

export const api = {
  projects: {
    /** List all projects. */
    list: () => apiFetch<Project[]>('/api/projects'),

    /** List all projects (returns null on error). */
    listSafe: () => safeFetch<Project[]>('/api/projects'),

    /** Get tasks for a project. */
    tasks: (name: string) => apiFetch<Task[]>(`/api/projects/${encodeURIComponent(name)}/tasks`),

    /** Dispatch an agent to a project. */
    dispatch: (name: string, payload: DispatchPayload) =>
      apiPost<Record<string, unknown>>(`/api/projects/${encodeURIComponent(name)}/dispatch`, payload as Record<string, unknown>),
  },

  agents: {
    /** List all agents. */
    list: () => apiFetch<Agent[]>('/api/agents'),

    /** List all agents (returns null on error). */
    listSafe: () => safeFetch<Agent[]>('/api/agents'),

    /** Kill an agent by session ID. Returns true on success. */
    kill: (sessionId: string) => safeDelete(`/api/agents/${encodeURIComponent(sessionId)}`),

    /** Inject a message into a running agent. */
    inject: (sessionId: string, payload: InjectPayload) =>
      safePost<Record<string, unknown>>(`/api/agents/${encodeURIComponent(sessionId)}/inject`, payload as Record<string, unknown>),
  },

  stats: {
    /** Get system stats. */
    get: () => apiFetch<Stats>('/api/stats'),

    /** Get system stats (returns null on error). */
    getSafe: () => safeFetch<Stats>('/api/stats'),
  },

  templates: {
    /** List all workflow templates. */
    list: () => apiFetch<WorkflowTemplate[]>('/api/templates'),

    /** List all templates (returns null on error). */
    listSafe: () => safeFetch<WorkflowTemplate[]>('/api/templates'),
  },
} as const;

export { API_BASE };
export default api;
