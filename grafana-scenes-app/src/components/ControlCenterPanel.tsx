import React, { useEffect, useRef, useState, useCallback } from 'react';
import { css, keyframes } from '@emotion/css';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Project {
  name: string;
  status: string;
  agent_count: number;
}

interface Agent {
  id: string;
  session_id?: string;
  star_name?: string;
  model?: string;
  status: 'working' | 'idle' | 'done' | 'error' | string;
  project?: string;
  turns?: number;
  cost?: number;
  input_tokens?: number;
  output_tokens?: number;
  started_at?: string;
  milestones?: Milestone[];
  task?: string;
}

interface Milestone {
  tool: string;
  label: string;
  timestamp: string;
}

interface Stats {
  active_agents: number;
  idle_agents: number;
  done_agents: number;
  error_agents: number;
  uptime?: string;
  total_agents_spawned?: number;
  cumulative_cost?: number;
}

interface Task {
  id: string;
  title: string;
  status: string;
  agent?: string;
}

interface StreamEvent {
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

// ── Constants ──────────────────────────────────────────────────────────────────

const API_BASE = 'http://localhost:4040';
const WS_URL = 'ws://localhost:4040/ws';

const STATUS_COLORS: Record<string, string> = {
  working: '#00ffcc',
  active: '#00ffcc',
  idle: '#ffaa00',
  done: '#666',
  error: '#ff4466',
};

function statusColor(status: string): string {
  return STATUS_COLORS[status] || '#666';
}

// ── API Helpers ────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string): Promise<T | null> {
  try {
    const resp = await fetch(`${API_BASE}${path}`);
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

async function apiPost<T>(path: string, body: Record<string, any>): Promise<T | null> {
  try {
    const resp = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

async function apiDelete(path: string): Promise<boolean> {
  try {
    const resp = await fetch(`${API_BASE}${path}`, { method: 'DELETE' });
    return resp.ok;
  } catch {
    return false;
  }
}

// ── Animations ─────────────────────────────────────────────────────────────────

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.5; }
`;

const slideIn = keyframes`
  from { opacity: 0; transform: translateX(12px); }
  to   { opacity: 1; transform: translateX(0); }
`;

const shimmer = keyframes`
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = {
  root: css`
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 600px;
    color: #ccc;
    font-family: 'Inter', -apple-system, sans-serif;
    background: #0d1117;
    border-radius: 6px;
    overflow: hidden;
    animation: ${fadeIn} 0.3s ease;
  `,

  // ── Top Bar ──
  topBar: css`
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 20px;
    background: linear-gradient(135deg, rgba(20, 25, 35, 0.95), rgba(15, 20, 30, 0.98));
    border-bottom: 1px solid rgba(0, 255, 204, 0.12);
    flex-shrink: 0;
    flex-wrap: wrap;
  `,
  topBarTitle: css`
    font-size: 15px;
    font-weight: 700;
    color: #00ffcc;
    text-shadow: 0 0 12px rgba(0, 255, 204, 0.4);
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-right: 8px;
    white-space: nowrap;
  `,
  projectSelect: css`
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    color: #ddd;
    padding: 6px 12px;
    font-size: 13px;
    cursor: pointer;
    outline: none;
    min-width: 160px;
    transition: border-color 0.2s;
    &:hover { border-color: rgba(0, 255, 204, 0.4); }
    &:focus { border-color: #00ffcc; box-shadow: 0 0 0 2px rgba(0, 255, 204, 0.15); }
    option { background: #1a1f2e; color: #ddd; }
  `,
  badges: css`
    display: flex;
    gap: 10px;
    flex: 1;
    justify-content: center;
    flex-wrap: wrap;
  `,
  badge: css`
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    white-space: nowrap;
  `,
  badgeDot: css`
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  `,
  uptime: css`
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
    font-family: monospace;
    white-space: nowrap;
  `,
  dispatchBtn: css`
    background: linear-gradient(135deg, #00ffcc, #00ccaa);
    color: #0d1117;
    border: none;
    border-radius: 6px;
    padding: 7px 18px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 20px rgba(0, 255, 204, 0.35);
    }
    &:active { transform: translateY(0); }
  `,

  // ── Main Content ──
  main: css`
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  `,

  // ── Left Column — Agent List ──
  leftCol: css`
    width: 40%;
    min-width: 280px;
    border-right: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  `,
  leftHeader: css`
    padding: 10px 16px;
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.5);
    text-transform: uppercase;
    letter-spacing: 1px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    flex-shrink: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `,
  agentList: css`
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    &::-webkit-scrollbar { width: 4px; }
    &::-webkit-scrollbar-track { background: transparent; }
    &::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 4px; }
  `,
  agentCard: css`
    padding: 10px 14px;
    margin-bottom: 4px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    border: 1px solid transparent;
    background: rgba(255, 255, 255, 0.02);
    &:hover {
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(255, 255, 255, 0.08);
    }
  `,
  agentCardSelected: css`
    background: rgba(0, 255, 204, 0.06) !important;
    border-color: rgba(0, 255, 204, 0.25) !important;
    box-shadow: 0 0 20px rgba(0, 255, 204, 0.05);
  `,
  agentCardTop: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  `,
  agentName: css`
    font-size: 14px;
    font-weight: 600;
    color: #eee;
    display: flex;
    align-items: center;
    gap: 8px;
  `,
  agentStatusDot: css`
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  `,
  agentMeta: css`
    display: flex;
    gap: 12px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
    font-family: monospace;
  `,
  killBtn: css`
    background: transparent;
    border: 1px solid rgba(255, 68, 102, 0.3);
    color: #ff4466;
    border-radius: 4px;
    padding: 2px 8px;
    font-size: 11px;
    cursor: pointer;
    opacity: 0.6;
    transition: all 0.2s;
    &:hover { opacity: 1; background: rgba(255, 68, 102, 0.15); }
  `,

  // ── Right Column ──
  rightCol: css`
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  `,
  rightPlaceholder: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: rgba(255, 255, 255, 0.25);
    font-size: 14px;
    gap: 8px;
  `,

  // ── Agent Detail ──
  detailHeader: css`
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    flex-shrink: 0;
    animation: ${slideIn} 0.25s ease;
  `,
  detailTitle: css`
    font-size: 18px;
    font-weight: 700;
    color: #fff;
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    gap: 10px;
  `,
  detailMeta: css`
    display: flex;
    gap: 16px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.45);
    font-family: monospace;
    flex-wrap: wrap;
  `,
  detailMetaItem: css`
    display: flex;
    align-items: center;
    gap: 4px;
  `,

  // ── Milestones ──
  milestonesSection: css`
    padding: 12px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    flex-shrink: 0;
  `,
  milestonesLabel: css`
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 8px;
  `,
  milestonesTrack: css`
    display: flex;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 4px;
    &::-webkit-scrollbar { height: 3px; }
    &::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 3px; }
  `,
  milestonePill: css`
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 11px;
    font-family: monospace;
    white-space: nowrap;
    background: rgba(0, 255, 204, 0.08);
    border: 1px solid rgba(0, 255, 204, 0.15);
    color: rgba(255, 255, 255, 0.7);
    flex-shrink: 0;
  `,

  // ── Live Output ──
  outputSection: css`
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  `,
  outputLabel: css`
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
    text-transform: uppercase;
    letter-spacing: 1px;
    padding: 10px 20px 6px;
    flex-shrink: 0;
  `,
  outputTerminal: css`
    flex: 1;
    background: #0a0e14;
    margin: 0 12px 12px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    padding: 12px;
    overflow-y: auto;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 12px;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.7);
    white-space: pre-wrap;
    word-break: break-word;
    &::-webkit-scrollbar { width: 4px; }
    &::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 4px; }
  `,

  // ── Cost Breakdown ──
  costRow: css`
    display: flex;
    gap: 20px;
    padding: 10px 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    flex-shrink: 0;
    font-size: 12px;
    font-family: monospace;
    color: rgba(255, 255, 255, 0.5);
    flex-wrap: wrap;
  `,

  // ── Send Message ──
  sendRow: css`
    display: flex;
    gap: 8px;
    padding: 10px 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    flex-shrink: 0;
  `,
  sendInput: css`
    flex: 1;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: #ddd;
    padding: 8px 12px;
    font-size: 13px;
    outline: none;
    transition: border-color 0.2s;
    &:focus { border-color: #00ffcc; box-shadow: 0 0 0 2px rgba(0, 255, 204, 0.1); }
    &::placeholder { color: rgba(255, 255, 255, 0.25); }
  `,
  sendBtn: css`
    background: rgba(0, 255, 204, 0.15);
    border: 1px solid rgba(0, 255, 204, 0.3);
    border-radius: 6px;
    color: #00ffcc;
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    &:hover { background: rgba(0, 255, 204, 0.25); }
    &:disabled { opacity: 0.4; cursor: default; }
  `,

  // ── Task List (project overview) ──
  taskList: css`
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
    &::-webkit-scrollbar { width: 4px; }
    &::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 4px; }
  `,
  taskItem: css`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.7);
    background: rgba(255, 255, 255, 0.02);
    margin-bottom: 4px;
    transition: background 0.15s;
    &:hover { background: rgba(255, 255, 255, 0.04); }
  `,
  taskStatus: css`
    font-size: 11px;
    font-family: monospace;
    padding: 2px 8px;
    border-radius: 4px;
    flex-shrink: 0;
  `,

  // ── Dispatch Modal ──
  modalBackdrop: css`
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    animation: ${fadeIn} 0.2s ease;
  `,
  modal: css`
    background: linear-gradient(145deg, #1a1f2e, #151a26);
    border: 1px solid rgba(0, 255, 204, 0.15);
    border-radius: 12px;
    padding: 28px 32px;
    width: 480px;
    max-width: 90vw;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6), 0 0 40px rgba(0, 255, 204, 0.08);
  `,
  modalTitle: css`
    font-size: 18px;
    font-weight: 700;
    color: #00ffcc;
    margin-bottom: 20px;
    text-shadow: 0 0 12px rgba(0, 255, 204, 0.3);
  `,
  formGroup: css`
    margin-bottom: 16px;
  `,
  formLabel: css`
    display: block;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  `,
  formSelect: css`
    width: 100%;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    color: #ddd;
    padding: 8px 12px;
    font-size: 13px;
    outline: none;
    transition: border-color 0.2s;
    &:focus { border-color: #00ffcc; }
    option { background: #1a1f2e; color: #ddd; }
  `,
  formTextarea: css`
    width: 100%;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    color: #ddd;
    padding: 10px 12px;
    font-size: 13px;
    outline: none;
    resize: vertical;
    min-height: 80px;
    font-family: inherit;
    transition: border-color 0.2s;
    &:focus { border-color: #00ffcc; }
    &::placeholder { color: rgba(255, 255, 255, 0.25); }
  `,
  radioGroup: css`
    display: flex;
    gap: 12px;
  `,
  radioLabel: css`
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.7);
    padding: 6px 14px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.2s;
    &:hover { background: rgba(255, 255, 255, 0.04); }
    input { display: none; }
  `,
  radioSelected: css`
    border-color: rgba(0, 255, 204, 0.4);
    background: rgba(0, 255, 204, 0.08);
    color: #00ffcc;
  `,
  modalActions: css`
    display: flex;
    gap: 10px;
    justify-content: flex-end;
    margin-top: 24px;
  `,
  cancelBtn: css`
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.6);
    padding: 8px 20px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
    &:hover { background: rgba(255, 255, 255, 0.05); color: #fff; }
  `,
  launchBtn: css`
    background: linear-gradient(135deg, #00ffcc, #00ccaa);
    border: none;
    border-radius: 6px;
    color: #0d1117;
    padding: 8px 24px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    &:hover { box-shadow: 0 4px 20px rgba(0, 255, 204, 0.35); transform: translateY(-1px); }
    &:disabled { opacity: 0.5; cursor: default; transform: none; box-shadow: none; }
  `,

  // ── Toast ──
  toast: css`
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 10001;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    animation: ${fadeIn} 0.2s ease;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  `,
  toastSuccess: css`
    background: rgba(0, 255, 204, 0.15);
    border: 1px solid rgba(0, 255, 204, 0.3);
    color: #00ffcc;
  `,
  toastError: css`
    background: rgba(255, 68, 102, 0.15);
    border: 1px solid rgba(255, 68, 102, 0.3);
    color: #ff4466;
  `,

  // ── Status badge ──
  statusBadge: css`
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  `,

  // ── Pulsing dot for active ──
  pulsingDot: css`
    animation: ${pulse} 1.5s ease-in-out infinite;
  `,

  // ── Empty state ──
  emptyState: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: rgba(255, 255, 255, 0.2);
    font-size: 13px;
    gap: 8px;
    padding: 40px;
    text-align: center;
  `,

  // ── Confirm overlay ──
  confirmOverlay: css`
    position: fixed;
    inset: 0;
    z-index: 10002;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    animation: ${fadeIn} 0.15s ease;
  `,
  confirmBox: css`
    background: #1a1f2e;
    border: 1px solid rgba(255, 68, 102, 0.3);
    border-radius: 10px;
    padding: 24px 28px;
    max-width: 360px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
  `,
  confirmText: css`
    font-size: 14px;
    color: rgba(255, 255, 255, 0.8);
    margin-bottom: 18px;
    line-height: 1.5;
  `,
  confirmActions: css`
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  `,
  confirmKillBtn: css`
    background: rgba(255, 68, 102, 0.2);
    border: 1px solid rgba(255, 68, 102, 0.4);
    border-radius: 6px;
    color: #ff4466;
    padding: 7px 18px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    &:hover { background: rgba(255, 68, 102, 0.35); }
  `,
};

// ── Component ──────────────────────────────────────────────────────────────────

export function ControlCenterPanel() {
  // ── State ──
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [stats, setStats] = useState<Stats>({ active_agents: 0, idle_agents: 0, done_agents: 0, error_agents: 0 });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showDispatch, setShowDispatch] = useState(false);
  const [streamLines, setStreamLines] = useState<string[]>([]);
  const [liveMilestones, setLiveMilestones] = useState<Milestone[]>([]);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [confirmKill, setConfirmKill] = useState<string | null>(null);
  const [sendMsg, setSendMsg] = useState('');
  const [sending, setSending] = useState(false);

  // Dispatch form state
  const [dispatchProject, setDispatchProject] = useState('');
  const [dispatchTask, setDispatchTask] = useState('');
  const [dispatchModel, setDispatchModel] = useState('sonnet');
  const [dispatching, setDispatching] = useState(false);

  const terminalRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const selectedAgentRef = useRef<string | null>(null);

  // Keep ref in sync with selectedAgent
  useEffect(() => {
    selectedAgentRef.current = selectedAgent?.id || null;
  }, [selectedAgent]);

  // ── Toast auto-dismiss ──
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── Fetch projects ──
  const fetchProjects = useCallback(async () => {
    const data = await apiFetch<Project[]>('/api/projects');
    if (data) setProjects(data);
  }, []);

  // ── Fetch agents ──
  const fetchAgents = useCallback(async () => {
    const data = await apiFetch<Agent[]>('/api/agents');
    if (data) {
      setAgents(data);
      // Update selected agent data if still exists
      if (selectedAgentRef.current) {
        const updated = data.find((a) => a.id === selectedAgentRef.current);
        if (updated) setSelectedAgent(updated);
      }
    }
  }, []);

  // ── Fetch stats ──
  const fetchStats = useCallback(async () => {
    const data = await apiFetch<Stats>('/api/stats');
    if (data) setStats(data);
  }, []);

  // ── Fetch tasks for a project ──
  const fetchTasks = useCallback(async (project: string) => {
    if (!project) { setTasks([]); return; }
    const data = await apiFetch<Task[]>(`/api/projects/${project}/tasks`);
    if (data) setTasks(data);
    else setTasks([]);
  }, []);

  // ── Initial fetch + polling ──
  useEffect(() => {
    fetchProjects();
    fetchAgents();
    fetchStats();
    const interval = setInterval(() => {
      fetchAgents();
      fetchStats();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchProjects, fetchAgents, fetchStats]);

  // ── Fetch tasks when project changes ──
  useEffect(() => {
    fetchTasks(selectedProject);
  }, [selectedProject, fetchTasks]);

  // ── WebSocket connection ──
  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      try {
        ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onmessage = (ev) => {
          try {
            const event: StreamEvent = JSON.parse(ev.data);
            const agentId = event.agent_id || event.session_id;

            if (event.type === 'agent_stream' && agentId && agentId === selectedAgentRef.current) {
              const text = event.text || event.content || event.data?.text || '';
              if (text) {
                setStreamLines((prev) => {
                  const next = [...prev, text];
                  // Keep last 500 lines
                  return next.length > 500 ? next.slice(-500) : next;
                });
              }
            }

            if (event.type === 'agent_milestone' && agentId && agentId === selectedAgentRef.current) {
              setLiveMilestones((prev) => [
                ...prev,
                {
                  tool: event.tool || event.data?.tool || '?',
                  label: event.label || event.milestone || event.data?.label || '',
                  timestamp: event.timestamp || new Date().toISOString(),
                },
              ]);
            }

            // Refresh agent list on key events
            if (['agent_spawned', 'agent_done', 'agent_id_assigned', 'agent_update'].includes(event.type)) {
              fetchAgents();
              fetchStats();
            }
          } catch {
            // ignore parse errors
          }
        };

        ws.onclose = () => {
          reconnectTimer = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        reconnectTimer = setTimeout(connect, 3000);
      }
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [fetchAgents, fetchStats]);

  // ── Reset stream when selecting different agent ──
  useEffect(() => {
    setStreamLines([]);
    setLiveMilestones([]);
  }, [selectedAgent?.id]);

  // ── Auto-scroll terminal ──
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [streamLines]);

  // ── Filter agents by project ──
  const filteredAgents = selectedProject
    ? agents.filter((a) => a.project === selectedProject)
    : agents;

  // ── Handlers ──

  const handleKill = async (agentId: string) => {
    const ok = await apiDelete(`/api/agents/${agentId}`);
    if (ok) {
      setToast({ msg: 'Agent terminated', type: 'success' });
      if (selectedAgent?.id === agentId) setSelectedAgent(null);
      fetchAgents();
      fetchStats();
    } else {
      setToast({ msg: 'Failed to kill agent', type: 'error' });
    }
    setConfirmKill(null);
  };

  const handleSendMessage = async () => {
    if (!selectedAgent || !sendMsg.trim()) return;
    setSending(true);
    const result = await apiPost(`/api/agents/${selectedAgent.id}/inject`, { message: sendMsg.trim() });
    if (result !== null) {
      setToast({ msg: 'Message sent', type: 'success' });
      setSendMsg('');
    } else {
      setToast({ msg: 'Failed to send message', type: 'error' });
    }
    setSending(false);
  };

  const handleDispatch = async () => {
    if (!dispatchProject || !dispatchTask.trim()) return;
    setDispatching(true);
    const result = await apiPost(`/api/projects/${dispatchProject}/dispatch`, {
      task: dispatchTask.trim(),
      model: dispatchModel,
    });
    if (result !== null) {
      setToast({ msg: 'Agent dispatched', type: 'success' });
      setShowDispatch(false);
      setDispatchTask('');
      fetchAgents();
      fetchStats();
    } else {
      setToast({ msg: 'Failed to dispatch agent', type: 'error' });
    }
    setDispatching(false);
  };

  // ── Computed ──
  const allMilestones = [
    ...(selectedAgent?.milestones || []),
    ...liveMilestones,
  ];

  function formatDuration(started?: string): string {
    if (!started) return '--';
    const ms = Date.now() - new Date(started).getTime();
    const secs = Math.floor(ms / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ${secs % 60}s`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  }

  // ── Render ──
  return (
    <div className={styles.root}>
      {/* ── Top Bar ── */}
      <div className={styles.topBar}>
        <div className={styles.topBarTitle}>Control Center</div>

        <select
          className={styles.projectSelect}
          value={selectedProject}
          onChange={(e) => { setSelectedProject(e.target.value); setSelectedAgent(null); }}
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.name} value={p.name}>{p.name}</option>
          ))}
        </select>

        <div className={styles.badges}>
          <span className={styles.badge}>
            <span className={`${styles.badgeDot} ${styles.pulsingDot}`} style={{ background: '#00ffcc' }} />
            Active {stats.active_agents}
          </span>
          <span className={styles.badge}>
            <span className={styles.badgeDot} style={{ background: '#ffaa00' }} />
            Idle {stats.idle_agents}
          </span>
          <span className={styles.badge}>
            <span className={styles.badgeDot} style={{ background: '#666' }} />
            Done {stats.done_agents}
          </span>
          <span className={styles.badge}>
            <span className={styles.badgeDot} style={{ background: '#ff4466' }} />
            Error {stats.error_agents}
          </span>
        </div>

        {stats.uptime && <span className={styles.uptime}>UP {stats.uptime}</span>}

        <button className={styles.dispatchBtn} onClick={() => {
          setDispatchProject(selectedProject || (projects[0]?.name || ''));
          setShowDispatch(true);
        }}>
          + Dispatch Agent
        </button>
      </div>

      {/* ── Main ── */}
      <div className={styles.main}>
        {/* ── Left: Agent List ── */}
        <div className={styles.leftCol}>
          <div className={styles.leftHeader}>
            <span>Agents</span>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>{filteredAgents.length}</span>
          </div>
          <div className={styles.agentList}>
            {filteredAgents.length === 0 && (
              <div className={styles.emptyState}>No agents found</div>
            )}
            {filteredAgents.map((agent) => (
              <div
                key={agent.id}
                className={`${styles.agentCard} ${selectedAgent?.id === agent.id ? styles.agentCardSelected : ''}`}
                onClick={() => setSelectedAgent(agent)}
              >
                <div className={styles.agentCardTop}>
                  <span className={styles.agentName}>
                    <span
                      className={`${styles.agentStatusDot} ${agent.status === 'working' ? styles.pulsingDot : ''}`}
                      style={{ background: statusColor(agent.status) }}
                    />
                    {agent.star_name || agent.id.slice(0, 12)}
                  </span>
                  {(agent.status === 'working' || agent.status === 'active' || agent.status === 'idle') && (
                    <button
                      className={styles.killBtn}
                      onClick={(e) => { e.stopPropagation(); setConfirmKill(agent.id); }}
                    >
                      Kill
                    </button>
                  )}
                </div>
                <div className={styles.agentMeta}>
                  <span>{agent.model || 'unknown'}</span>
                  <span
                    className={styles.statusBadge}
                    style={{
                      background: statusColor(agent.status) + '18',
                      color: statusColor(agent.status),
                      border: `1px solid ${statusColor(agent.status)}33`,
                    }}
                  >
                    {agent.status}
                  </span>
                  {agent.turns != null && <span>{agent.turns} turns</span>}
                  {agent.cost != null && <span>${agent.cost.toFixed(3)}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: Detail ── */}
        <div className={styles.rightCol}>
          {!selectedAgent ? (
            // ── Project Overview / Placeholder ──
            selectedProject ? (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div className={styles.leftHeader}>
                  <span>Tasks - {selectedProject}</span>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>{tasks.length}</span>
                </div>
                <div className={styles.taskList}>
                  {tasks.length === 0 && <div className={styles.emptyState}>No tasks found</div>}
                  {tasks.map((task, i) => (
                    <div key={task.id || i} className={styles.taskItem}>
                      <span
                        className={styles.taskStatus}
                        style={{
                          background: task.status === 'done' ? 'rgba(0,255,204,0.1)' : 'rgba(255,170,0,0.1)',
                          color: task.status === 'done' ? '#00ffcc' : '#ffaa00',
                          border: `1px solid ${task.status === 'done' ? 'rgba(0,255,204,0.2)' : 'rgba(255,170,0,0.2)'}`,
                        }}
                      >
                        {task.status}
                      </span>
                      <span style={{ flex: 1 }}>{task.title}</span>
                      {task.agent && (
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
                          {task.agent}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className={styles.rightPlaceholder}>
                <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.3 }}>&#9678;</div>
                <div>Select an agent to view details</div>
                <div style={{ fontSize: 12 }}>or choose a project to see its tasks</div>
              </div>
            )
          ) : (
            // ── Agent Detail ──
            <>
              {/* Header */}
              <div className={styles.detailHeader}>
                <div className={styles.detailTitle}>
                  <span
                    className={`${styles.agentStatusDot} ${selectedAgent.status === 'working' ? styles.pulsingDot : ''}`}
                    style={{ background: statusColor(selectedAgent.status), width: 10, height: 10 }}
                  />
                  {selectedAgent.star_name || selectedAgent.id.slice(0, 16)}
                  <span
                    className={styles.statusBadge}
                    style={{
                      background: statusColor(selectedAgent.status) + '18',
                      color: statusColor(selectedAgent.status),
                      border: `1px solid ${statusColor(selectedAgent.status)}33`,
                      fontSize: 12,
                    }}
                  >
                    {selectedAgent.status}
                  </span>
                </div>
                <div className={styles.detailMeta}>
                  <span className={styles.detailMetaItem}>Session: {selectedAgent.session_id?.slice(0, 16) || '--'}...</span>
                  <span className={styles.detailMetaItem}>Model: {selectedAgent.model || '--'}</span>
                  <span className={styles.detailMetaItem}>Duration: {formatDuration(selectedAgent.started_at)}</span>
                  {selectedAgent.project && <span className={styles.detailMetaItem}>Project: {selectedAgent.project}</span>}
                </div>
              </div>

              {/* Milestones */}
              {allMilestones.length > 0 && (
                <div className={styles.milestonesSection}>
                  <div className={styles.milestonesLabel}>Milestones</div>
                  <div className={styles.milestonesTrack}>
                    {allMilestones.map((m, i) => (
                      <span key={i} className={styles.milestonePill} title={m.timestamp}>
                        {m.tool} {m.label ? `\u00b7 ${m.label}` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Live Output */}
              <div className={styles.outputSection}>
                <div className={styles.outputLabel}>Live Output</div>
                <div className={styles.outputTerminal} ref={terminalRef}>
                  {streamLines.length === 0 && (
                    <span style={{ color: 'rgba(255,255,255,0.2)' }}>
                      Waiting for stream data...
                    </span>
                  )}
                  {streamLines.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              </div>

              {/* Cost Breakdown */}
              <div className={styles.costRow}>
                <span>Turns: {selectedAgent.turns ?? '--'}</span>
                <span>Input: {selectedAgent.input_tokens?.toLocaleString() ?? '--'} tokens</span>
                <span>Output: {selectedAgent.output_tokens?.toLocaleString() ?? '--'} tokens</span>
                <span>Cost: ${selectedAgent.cost?.toFixed(4) ?? '--'}</span>
              </div>

              {/* Send Message */}
              {(selectedAgent.status === 'working' || selectedAgent.status === 'active' || selectedAgent.status === 'idle') && (
                <div className={styles.sendRow}>
                  <input
                    className={styles.sendInput}
                    type="text"
                    placeholder="Send message to agent..."
                    value={sendMsg}
                    onChange={(e) => setSendMsg(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !sending) handleSendMessage(); }}
                  />
                  <button
                    className={styles.sendBtn}
                    disabled={sending || !sendMsg.trim()}
                    onClick={handleSendMessage}
                  >
                    {sending ? 'Sending...' : 'Send'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Dispatch Modal ── */}
      {showDispatch && (
        <div className={styles.modalBackdrop} onClick={() => setShowDispatch(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalTitle}>Dispatch Agent</div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Project</label>
              <select
                className={styles.formSelect}
                value={dispatchProject}
                onChange={(e) => setDispatchProject(e.target.value)}
              >
                <option value="">Select project...</option>
                {projects.map((p) => (
                  <option key={p.name} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Task Description</label>
              <textarea
                className={styles.formTextarea}
                placeholder="Describe the task for the agent..."
                value={dispatchTask}
                onChange={(e) => setDispatchTask(e.target.value)}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Model</label>
              <div className={styles.radioGroup}>
                {[
                  { value: 'opus', label: 'Opus' },
                  { value: 'sonnet', label: 'Sonnet' },
                  { value: 'haiku', label: 'Haiku' },
                ].map((m) => (
                  <label
                    key={m.value}
                    className={`${styles.radioLabel} ${dispatchModel === m.value ? styles.radioSelected : ''}`}
                  >
                    <input
                      type="radio"
                      name="model"
                      value={m.value}
                      checked={dispatchModel === m.value}
                      onChange={() => setDispatchModel(m.value)}
                    />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>

            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setShowDispatch(false)}>
                Cancel
              </button>
              <button
                className={styles.launchBtn}
                disabled={dispatching || !dispatchProject || !dispatchTask.trim()}
                onClick={handleDispatch}
              >
                {dispatching ? 'Launching...' : 'Launch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Kill Confirm ── */}
      {confirmKill && (
        <div className={styles.confirmOverlay} onClick={() => setConfirmKill(null)}>
          <div className={styles.confirmBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmText}>
              Terminate agent <strong>{agents.find((a) => a.id === confirmKill)?.star_name || confirmKill.slice(0, 12)}</strong>?
              This action cannot be undone.
            </div>
            <div className={styles.confirmActions}>
              <button className={styles.cancelBtn} onClick={() => setConfirmKill(null)}>
                Cancel
              </button>
              <button className={styles.confirmKillBtn} onClick={() => handleKill(confirmKill)}>
                Kill Agent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className={`${styles.toast} ${toast.type === 'success' ? styles.toastSuccess : styles.toastError}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
