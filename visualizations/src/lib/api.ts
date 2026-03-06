// Data fetching layer for the c9s backend API
// Uses delayRender/continueRender for async data loading in Remotion compositions

const API_BASE = 'http://localhost:4040';

export interface Agent {
  session_id: string;
  project_name: string;
  project_path: string;
  task: string;
  status: 'working' | 'idle' | 'done' | 'error';
  phase: string;
  model: string;
  started_at: string;
  turn_count: number;
  milestones: string[];
  is_controller: boolean;
  task_index: number;
  pid: number;
}

export interface Project {
  name: string;
  path: string;
  description: string;
  goal: string;
  config?: {
    parallelism?: number;
    model?: string;
  };
}

export interface Stats {
  total_projects: number;
  total_agents: number;
  working_agents: number;
  idle_agents: number;
  uptime_seconds: number;
}

export async function fetchAgents(): Promise<Agent[]> {
  try {
    const res = await fetch(`${API_BASE}/api/agents`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    // Return mock data for development/preview when backend is unavailable
    return getMockAgents();
  }
}

export async function fetchProjects(): Promise<Project[]> {
  try {
    const res = await fetch(`${API_BASE}/api/projects`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return getMockProjects();
  }
}

export async function fetchStats(): Promise<Stats> {
  try {
    const res = await fetch(`${API_BASE}/api/stats`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return getMockStats();
  }
}

// Mock data for when the backend is not running
function getMockAgents(): Agent[] {
  const statuses: Agent['status'][] = ['working', 'idle', 'done', 'error'];
  const models = ['claude-opus-4-6', 'claude-sonnet-4-20250514', 'claude-haiku-3-5-20241022'];
  const projects = ['claude-manager', 'kind-infra', 'helm-platform', 'agent-reports', 'claudectl'];

  return Array.from({ length: 12 }, (_, i) => ({
    session_id: `mock-${i}-${Math.random().toString(36).slice(2, 10)}`,
    project_name: projects[i % projects.length],
    project_path: `/Users/mock/git/claude-managed-projects/${projects[i % projects.length]}`,
    task: `Task ${i + 1}: ${['Implement feature', 'Fix bug', 'Write tests', 'Refactor code', 'Deploy service'][i % 5]}`,
    status: statuses[i % statuses.length],
    phase: statuses[i % statuses.length],
    model: models[i % models.length],
    started_at: new Date(Date.now() - Math.random() * 3600000).toISOString(),
    turn_count: Math.floor(Math.random() * 20) + 1,
    milestones: [],
    is_controller: i === 0,
    task_index: i,
    pid: 1000 + i,
  }));
}

function getMockProjects(): Project[] {
  return [
    { name: 'claude-manager', path: '/mock/claude-manager', description: 'Agent orchestration dashboard', goal: 'Build agent management platform' },
    { name: 'kind-infra', path: '/mock/kind-infra', description: 'Kubernetes infrastructure', goal: 'Manage local k8s cluster' },
    { name: 'helm-platform', path: '/mock/helm-platform', description: 'Platform Helm charts', goal: 'Deploy platform services' },
    { name: 'agent-reports', path: '/mock/agent-reports', description: 'Agent reporting app', goal: 'Visualize agent productivity' },
    { name: 'claudectl', path: '/mock/claudectl', description: 'CLI for agent management', goal: 'Build Go TUI for agents' },
    { name: 'web-scraper', path: '/mock/web-scraper', description: 'Data collection service', goal: 'Scrape and index web data' },
    { name: 'ml-pipeline', path: '/mock/ml-pipeline', description: 'ML training pipeline', goal: 'Train and deploy models' },
    { name: 'api-gateway', path: '/mock/api-gateway', description: 'API gateway service', goal: 'Route and auth API requests' },
  ];
}

function getMockStats(): Stats {
  return {
    total_projects: 8,
    total_agents: 12,
    working_agents: 4,
    idle_agents: 5,
    uptime_seconds: 14400,
  };
}

// Generate mock time-series data for metrics
export function getMockTimeSeries(points = 60): { time: number; active: number; cost: number; tasks: number }[] {
  return Array.from({ length: points }, (_, i) => ({
    time: i,
    active: Math.max(0, 3 + Math.sin(i * 0.2) * 2 + Math.sin(i * 0.07) * 3 + (Math.random() - 0.5) * 1.5),
    cost: Math.max(0, 0.5 + Math.sin(i * 0.15) * 0.3 + i * 0.01 + (Math.random() - 0.5) * 0.1),
    tasks: Math.max(0, Math.floor(2 + Math.sin(i * 0.1) * 1.5 + Math.random() * 2)),
  }));
}

// Generate mock cost breakdown by model
export function getMockCostBreakdown(): { model: string; cost: number; color: string }[] {
  return [
    { model: 'Sonnet 4', cost: 12.45, color: '#67e8f9' },
    { model: 'Opus 4', cost: 34.20, color: '#c084fc' },
    { model: 'Haiku 3.5', cost: 3.80, color: '#34d399' },
    { model: 'Sonnet 3.5', cost: 6.15, color: '#fbbf24' },
  ];
}

// Generate mock heatmap data
export function getMockHeatmap(projects: string[], hours = 24): number[][] {
  return projects.map(() =>
    Array.from({ length: hours }, () => Math.random() * Math.random() * 10)
  );
}
