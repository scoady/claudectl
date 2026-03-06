// ── Centralized API Client ───────────────────────────────────────────────────
// All fetch calls consolidated behind a namespaced `api` object.
// Usage: api.projects.list(), api.agents.kill(id), api.canvas.list(project), etc.

import type {
  Agent,
  Project,
  Stats,
  Task,
  WorkflowTemplate,
  DispatchPayload,
  InjectPayload,
  CanvasWidget,
  WidgetCreate,
  WidgetUpdate,
  WidgetCatalogEntry,
  LayoutPreset,
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

async function apiPut<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    throw new ApiError(resp.status, `${resp.status} ${resp.statusText} — PUT ${path}`);
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

  // ── Canvas Widget API ──────────────────────────────────────────────────────

  canvas: {
    /** List all widgets for a project. */
    list: (project: string) =>
      apiFetch<CanvasWidget[]>(`/api/canvas/${encodeURIComponent(project)}`),

    /** List widgets (returns null on error). */
    listSafe: (project: string) =>
      safeFetch<CanvasWidget[]>(`/api/canvas/${encodeURIComponent(project)}`),

    /** Create a widget. */
    create: (project: string, widget: WidgetCreate) =>
      apiPost<CanvasWidget>(`/api/canvas/${encodeURIComponent(project)}/widgets`, widget as unknown as Record<string, unknown>),

    /** Update a widget. */
    update: (project: string, id: string, data: WidgetUpdate) =>
      apiPut<CanvasWidget>(
        `/api/canvas/${encodeURIComponent(project)}/widgets/${encodeURIComponent(id)}`,
        data as unknown as Record<string, unknown>,
      ),

    /** Delete a widget. */
    remove: (project: string, id: string) =>
      apiDelete(`/api/canvas/${encodeURIComponent(project)}/widgets/${encodeURIComponent(id)}`),

    /** Delete a widget (returns true on success). */
    removeSafe: (project: string, id: string) =>
      safeDelete(`/api/canvas/${encodeURIComponent(project)}/widgets/${encodeURIComponent(id)}`),
  },

  // ── Widget Catalog API ─────────────────────────────────────────────────────

  widgetCatalog: {
    /** List all catalog entries. */
    list: () => apiFetch<WidgetCatalogEntry[]>('/api/widget-catalog'),

    /** List catalog entries (returns null on error). */
    listSafe: () => safeFetch<WidgetCatalogEntry[]>('/api/widget-catalog'),

    /** Get a single catalog entry. */
    get: (id: string) =>
      apiFetch<WidgetCatalogEntry>(`/api/widget-catalog/${encodeURIComponent(id)}`),

    /** Generate a new widget via AI prompt. */
    generate: (prompt: string) =>
      apiPost<WidgetCatalogEntry>('/api/widget-catalog/generate', { prompt }),

    /** Delete a catalog entry. */
    delete: (id: string) =>
      apiDelete(`/api/widget-catalog/${encodeURIComponent(id)}`),

    /** Delete a catalog entry (returns true on success). */
    deleteSafe: (id: string) =>
      safeDelete(`/api/widget-catalog/${encodeURIComponent(id)}`),
  },

  // ── Layout Presets API ─────────────────────────────────────────────────────

  layoutPresets: {
    /** List all layout presets. */
    list: () => apiFetch<LayoutPreset[]>('/api/layout-presets'),

    /** List presets (returns null on error). */
    listSafe: () => safeFetch<LayoutPreset[]>('/api/layout-presets'),

    /** Save a new preset. */
    save: (preset: LayoutPreset) =>
      apiPost<LayoutPreset>('/api/layout-presets', preset as unknown as Record<string, unknown>),

    /** Delete a preset. */
    delete: (id: string) =>
      apiDelete(`/api/layout-presets/${encodeURIComponent(id)}`),

    /** Delete a preset (returns true on success). */
    deleteSafe: (id: string) =>
      safeDelete(`/api/layout-presets/${encodeURIComponent(id)}`),

    /** Apply a preset to a project. */
    apply: (project: string, presetId: string) =>
      apiPost<Record<string, unknown>>(
        `/api/canvas/${encodeURIComponent(project)}/apply-preset/${encodeURIComponent(presetId)}`,
        {},
      ),
  },
} as const;

export { API_BASE };
export default api;
