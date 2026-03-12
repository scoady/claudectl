import React, { useEffect, useRef, useState, useCallback } from 'react';
import { css, keyframes } from '@emotion/css';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Project {
  name: string;
  path?: string;
  description?: string;
  active_session_ids?: string[];
}

interface Agent {
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

interface Stats {
  total_projects: number;
  total_agents: number;
  working_agents: number;
  idle_agents: number;
  uptime_seconds: number;
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
  chunk?: string;
  text?: string;
  content?: string;
  milestone?: string;
  tool?: string;
  label?: string;
  timestamp?: string;
}

import { API_BASE } from '../services/api';
import { WS_URL } from '../services/websocket';

// ── Constants ──────────────────────────────────────────────────────────────────

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

/** Parse model string like "claude-opus-4-6" → "opus", "claude-sonnet-4-6" → "sonnet" */
function shortModel(model: string): string {
  if (!model) return '??';
  const lower = model.toLowerCase();
  if (lower.includes('opus')) return 'opus';
  if (lower.includes('sonnet')) return 'sonnet';
  if (lower.includes('haiku')) return 'haiku';
  // fallback: last meaningful segment
  const parts = lower.split('-').filter((p) => !/^\d+$/.test(p) && p !== 'claude');
  return parts[0] || model.slice(0, 8);
}

const MODEL_COLORS: Record<string, string> = {
  opus: '#c084fc',
  sonnet: '#60a5fa',
  haiku: '#34d399',
};

function modelColor(model: string): string {
  return MODEL_COLORS[shortModel(model)] || '#888';
}

const TASK_STATUS_COLORS: Record<string, { bg: string; fg: string; border: string }> = {
  done: { bg: 'rgba(0,255,204,0.08)', fg: '#00ffcc', border: 'rgba(0,255,204,0.2)' },
  'in-progress': { bg: 'rgba(96,165,250,0.08)', fg: '#60a5fa', border: 'rgba(96,165,250,0.2)' },
  pending: { bg: 'rgba(255,170,0,0.08)', fg: '#ffaa00', border: 'rgba(255,170,0,0.2)' },
  blocked: { bg: 'rgba(255,68,102,0.08)', fg: '#ff4466', border: 'rgba(255,68,102,0.2)' },
};

function taskColors(status: string) {
  return TASK_STATUS_COLORS[status] || TASK_STATUS_COLORS['pending'];
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
  50%      { opacity: 0.4; }
`;

const slideInRight = keyframes`
  from { opacity: 0; transform: translateX(16px); }
  to   { opacity: 1; transform: translateX(0); }
`;

const slideInLeft = keyframes`
  from { opacity: 0; transform: translateX(-12px); }
  to   { opacity: 1; transform: translateX(0); }
`;

const scanline = keyframes`
  0%   { transform: translateY(-100%); }
  100% { transform: translateY(100%); }
`;

const glowPulse = keyframes`
  0%, 100% { box-shadow: 0 0 4px rgba(0,255,204,0.15); }
  50%      { box-shadow: 0 0 12px rgba(0,255,204,0.3); }
`;

const staggerIn = keyframes`
  from { opacity: 0; transform: translateY(6px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
`;

const shimmer = keyframes`
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = {
  root: css`
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 600px;
    color: #c8cdd5;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: linear-gradient(170deg, #0a0e14 0%, #0d1117 40%, #0f1419 100%);
    border-radius: 8px;
    overflow: hidden;
    animation: ${fadeIn} 0.35s ease;
    position: relative;

    /* subtle noise texture */
    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
      pointer-events: none;
      z-index: 0;
    }

    & > * { position: relative; z-index: 1; }
  `,

  /* ── Stats Bar ── */
  statsBar: css`
    display: flex;
    align-items: stretch;
    gap: 0;
    padding: 0;
    background: linear-gradient(135deg, rgba(15, 20, 30, 0.95), rgba(10, 14, 20, 0.98));
    border-bottom: 1px solid rgba(0, 255, 204, 0.08);
    flex-shrink: 0;
  `,
  statsTitle: css`
    display: flex;
    align-items: center;
    padding: 14px 20px;
    gap: 10px;
    border-right: 1px solid rgba(255,255,255,0.04);
    min-width: 180px;
  `,
  statsTitleText: css`
    font-size: 13px;
    font-weight: 800;
    color: #00ffcc;
    text-shadow: 0 0 16px rgba(0, 255, 204, 0.5);
    letter-spacing: 2px;
    text-transform: uppercase;
  `,
  statsTitleIcon: css`
    width: 20px;
    height: 20px;
    border-radius: 4px;
    background: rgba(0, 255, 204, 0.12);
    border: 1px solid rgba(0, 255, 204, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: #00ffcc;
  `,
  statCell: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 10px 20px;
    border-right: 1px solid rgba(255,255,255,0.04);
    min-width: 90px;
    transition: background 0.2s;
    &:hover { background: rgba(255,255,255,0.02); }
  `,
  statNumber: css`
    font-size: 22px;
    font-weight: 800;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    line-height: 1;
    margin-bottom: 2px;
  `,
  statLabel: css`
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    color: rgba(255,255,255,0.35);
  `,
  statsRight: css`
    display: flex;
    align-items: center;
    gap: 10px;
    margin-left: auto;
    padding: 10px 16px;
  `,
  projectSelect: css`
    appearance: none;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(0, 255, 204, 0.12);
    border-radius: 6px;
    color: #ddd;
    padding: 7px 32px 7px 12px;
    font-size: 12px;
    font-family: 'JetBrains Mono', monospace;
    cursor: pointer;
    outline: none;
    min-width: 150px;
    transition: all 0.2s;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2300ffcc' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    &:hover { border-color: rgba(0, 255, 204, 0.3); background-color: rgba(255,255,255,0.06); }
    &:focus { border-color: #00ffcc; box-shadow: 0 0 0 2px rgba(0, 255, 204, 0.12); }
    option { background: #0d1117; color: #ddd; }
  `,
  uptime: css`
    font-size: 10px;
    color: rgba(255, 255, 255, 0.3);
    font-family: 'JetBrains Mono', monospace;
    white-space: nowrap;
    letter-spacing: 0.5px;
  `,
  dispatchBtn: css`
    background: linear-gradient(135deg, rgba(0, 255, 204, 0.15), rgba(0, 204, 170, 0.1));
    color: #00ffcc;
    border: 1px solid rgba(0, 255, 204, 0.25);
    border-radius: 6px;
    padding: 7px 16px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.25s;
    text-transform: uppercase;
    letter-spacing: 1px;
    white-space: nowrap;
    &:hover {
      background: linear-gradient(135deg, rgba(0, 255, 204, 0.25), rgba(0, 204, 170, 0.2));
      box-shadow: 0 0 24px rgba(0, 255, 204, 0.2);
      transform: translateY(-1px);
    }
    &:active { transform: translateY(0); }
  `,

  /* ── Main Split ── */
  main: css`
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  `,

  /* ── Left Column ── */
  leftCol: css`
    width: 340px;
    min-width: 280px;
    max-width: 400px;
    border-right: 1px solid rgba(0, 255, 204, 0.06);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: rgba(0, 0, 0, 0.15);
  `,
  sectionHeader: css`
    padding: 10px 16px;
    font-size: 10px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.4);
    text-transform: uppercase;
    letter-spacing: 1.5px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    flex-shrink: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(0, 0, 0, 0.2);
  `,
  sectionCount: css`
    font-size: 11px;
    font-weight: 600;
    color: rgba(0, 255, 204, 0.5);
    font-family: 'JetBrains Mono', monospace;
  `,

  /* ── Agent List ── */
  agentList: css`
    flex: 1;
    overflow-y: auto;
    padding: 6px 8px;
    &::-webkit-scrollbar { width: 3px; }
    &::-webkit-scrollbar-track { background: transparent; }
    &::-webkit-scrollbar-thumb { background: rgba(0, 255, 204, 0.1); border-radius: 3px; }
  `,
  agentRow: css`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    margin-bottom: 2px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid transparent;
    background: transparent;
    font-size: 12px;
    &:hover {
      background: rgba(255, 255, 255, 0.03);
      border-color: rgba(255, 255, 255, 0.05);
    }
  `,
  agentRowSelected: css`
    background: rgba(0, 255, 204, 0.05) !important;
    border-color: rgba(0, 255, 204, 0.15) !important;
    box-shadow: inset 0 0 20px rgba(0, 255, 204, 0.03);
  `,
  agentDot: css`
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  `,
  agentDotActive: css`
    animation: ${pulse} 1.5s ease-in-out infinite;
    box-shadow: 0 0 6px currentColor;
  `,
  agentId: css`
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.75);
    flex-shrink: 0;
    min-width: 72px;
  `,
  modelBadge: css`
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    padding: 1px 6px;
    border-radius: 3px;
    flex-shrink: 0;
  `,
  agentTurns: css`
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: rgba(255, 255, 255, 0.35);
    flex-shrink: 0;
    min-width: 32px;
    text-align: right;
  `,
  agentDuration: css`
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: rgba(255, 255, 255, 0.25);
    flex-shrink: 0;
    min-width: 40px;
    text-align: right;
  `,
  killBtnSmall: css`
    background: transparent;
    border: none;
    color: rgba(255, 68, 102, 0.4);
    font-size: 13px;
    cursor: pointer;
    padding: 0 2px;
    line-height: 1;
    flex-shrink: 0;
    margin-left: auto;
    transition: all 0.2s;
    opacity: 0;
    .${css`&`}:hover & { opacity: 1; }
    &:hover { color: #ff4466; text-shadow: 0 0 8px rgba(255, 68, 102, 0.5); }
  `,

  /* ── Right Column ── */
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
    color: rgba(255, 255, 255, 0.15);
    font-size: 13px;
    gap: 10px;
    animation: ${fadeIn} 0.5s ease;
  `,
  placeholderIcon: css`
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 1px solid rgba(0, 255, 204, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    color: rgba(0, 255, 204, 0.2);
    margin-bottom: 4px;
  `,

  /* ── Task List ── */
  taskList: css`
    flex: 1;
    overflow-y: auto;
    padding: 8px 16px;
    &::-webkit-scrollbar { width: 3px; }
    &::-webkit-scrollbar-thumb { background: rgba(0, 255, 204, 0.1); border-radius: 3px; }
  `,
  taskItem: css`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.7);
    background: rgba(255, 255, 255, 0.015);
    margin-bottom: 3px;
    transition: all 0.2s;
    border: 1px solid transparent;
    &:hover {
      background: rgba(255, 255, 255, 0.03);
      border-color: rgba(255, 255, 255, 0.04);
    }
  `,
  taskStatus: css`
    font-size: 9px;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 2px 8px;
    border-radius: 3px;
    flex-shrink: 0;
  `,
  taskTitle: css`
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  taskAgent: css`
    font-size: 10px;
    color: rgba(255, 255, 255, 0.25);
    font-family: 'JetBrains Mono', monospace;
    flex-shrink: 0;
  `,

  /* ── Agent Detail ── */
  detailPanel: css`
    display: flex;
    flex-direction: column;
    height: 100%;
    animation: ${slideInRight} 0.3s ease;
  `,
  detailHeader: css`
    padding: 14px 20px 12px;
    border-bottom: 1px solid rgba(0, 255, 204, 0.06);
    flex-shrink: 0;
    background: linear-gradient(180deg, rgba(0,255,204,0.02) 0%, transparent 100%);
  `,
  detailTopRow: css`
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  `,
  detailSessionId: css`
    font-family: 'JetBrains Mono', monospace;
    font-size: 15px;
    font-weight: 700;
    color: #eee;
  `,
  detailStatusBadge: css`
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    padding: 2px 10px;
    border-radius: 4px;
  `,
  detailModelBadge: css`
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    padding: 2px 10px;
    border-radius: 4px;
  `,
  detailMeta: css`
    display: flex;
    gap: 16px;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.35);
    font-family: 'JetBrains Mono', monospace;
    flex-wrap: wrap;
  `,
  detailMetaItem: css`
    display: flex;
    align-items: center;
    gap: 4px;
    & > span:first-child {
      color: rgba(255,255,255,0.2);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  `,
  detailTask: css`
    padding: 8px 20px;
    border-bottom: 1px solid rgba(255,255,255,0.03);
    flex-shrink: 0;
    font-size: 12px;
    color: rgba(255,255,255,0.5);
    line-height: 1.5;
    max-height: 60px;
    overflow-y: auto;
    &::-webkit-scrollbar { width: 2px; }
    &::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); }
  `,

  /* ── Milestones ── */
  milestonesBar: css`
    padding: 8px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 8px;
  `,
  milestonesLabel: css`
    font-size: 9px;
    color: rgba(255, 255, 255, 0.3);
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 700;
    flex-shrink: 0;
  `,
  milestonesTrack: css`
    display: flex;
    gap: 4px;
    overflow-x: auto;
    padding: 2px 0;
    flex: 1;
    &::-webkit-scrollbar { height: 2px; }
    &::-webkit-scrollbar-thumb { background: rgba(0, 255, 204, 0.1); border-radius: 2px; }
  `,
  milestonePill: css`
    padding: 3px 8px;
    border-radius: 10px;
    font-size: 10px;
    font-family: 'JetBrains Mono', monospace;
    white-space: nowrap;
    background: rgba(0, 255, 204, 0.06);
    border: 1px solid rgba(0, 255, 204, 0.1);
    color: rgba(255, 255, 255, 0.6);
    flex-shrink: 0;
    transition: all 0.2s;
    &:hover {
      background: rgba(0, 255, 204, 0.1);
      color: rgba(255, 255, 255, 0.8);
    }
  `,
  milestonePillLatest: css`
    background: rgba(0, 255, 204, 0.12);
    border-color: rgba(0, 255, 204, 0.25);
    color: #00ffcc;
    animation: ${glowPulse} 2s ease-in-out infinite;
  `,

  /* ── Terminal Output ── */
  outputSection: css`
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
    position: relative;
  `,
  outputLabel: css`
    font-size: 9px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.3);
    text-transform: uppercase;
    letter-spacing: 1.5px;
    padding: 8px 20px 4px;
    flex-shrink: 0;
  `,
  outputTerminal: css`
    flex: 1;
    background: #060a0f;
    margin: 0 12px 8px;
    border-radius: 6px;
    border: 1px solid rgba(0, 255, 204, 0.06);
    padding: 12px 14px;
    overflow-y: auto;
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    font-size: 11px;
    line-height: 1.7;
    color: rgba(255, 255, 255, 0.65);
    white-space: pre-wrap;
    word-break: break-word;
    position: relative;
    &::-webkit-scrollbar { width: 3px; }
    &::-webkit-scrollbar-thumb { background: rgba(0, 255, 204, 0.08); border-radius: 3px; }

    /* Scanline effect */
    &::after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent, rgba(0, 255, 204, 0.15), transparent);
      animation: ${scanline} 4s linear infinite;
      pointer-events: none;
    }
  `,
  outputEmpty: css`
    color: rgba(255, 255, 255, 0.15);
    font-style: italic;
    display: flex;
    align-items: center;
    gap: 6px;
    &::before {
      content: '';
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: rgba(0, 255, 204, 0.2);
      animation: ${pulse} 2s ease-in-out infinite;
    }
  `,

  /* ── Info Row ── */
  infoRow: css`
    display: flex;
    gap: 20px;
    padding: 6px 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.03);
    flex-shrink: 0;
    font-size: 10px;
    font-family: 'JetBrains Mono', monospace;
    color: rgba(255, 255, 255, 0.3);
    flex-wrap: wrap;
  `,

  /* ── Send Message ── */
  sendRow: css`
    display: flex;
    gap: 6px;
    padding: 8px 12px;
    border-top: 1px solid rgba(0, 255, 204, 0.05);
    flex-shrink: 0;
    background: rgba(0, 0, 0, 0.15);
  `,
  sendInput: css`
    flex: 1;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(0, 255, 204, 0.08);
    border-radius: 6px;
    color: #ddd;
    padding: 8px 12px;
    font-size: 12px;
    font-family: 'JetBrains Mono', monospace;
    outline: none;
    transition: all 0.25s;
    &:focus {
      border-color: rgba(0, 255, 204, 0.3);
      box-shadow: 0 0 0 2px rgba(0, 255, 204, 0.06);
      background: rgba(255, 255, 255, 0.04);
    }
    &::placeholder { color: rgba(255, 255, 255, 0.2); }
  `,
  sendBtn: css`
    background: rgba(0, 255, 204, 0.1);
    border: 1px solid rgba(0, 255, 204, 0.2);
    border-radius: 6px;
    color: #00ffcc;
    padding: 8px 14px;
    font-size: 11px;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
    cursor: pointer;
    transition: all 0.2s;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    &:hover { background: rgba(0, 255, 204, 0.18); box-shadow: 0 0 12px rgba(0, 255, 204, 0.15); }
    &:disabled { opacity: 0.3; cursor: default; box-shadow: none; }
  `,

  /* ── Dispatch Modal ── */
  modalBackdrop: css`
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(12px);
    animation: ${fadeIn} 0.2s ease;
  `,
  modal: css`
    background: linear-gradient(145deg, rgba(20, 26, 38, 0.98), rgba(13, 17, 23, 0.99));
    border: 1px solid rgba(0, 255, 204, 0.12);
    border-radius: 14px;
    padding: 28px 32px;
    width: 480px;
    max-width: 90vw;
    box-shadow: 0 32px 80px rgba(0, 0, 0, 0.7), 0 0 60px rgba(0, 255, 204, 0.06);
    backdrop-filter: blur(20px);
  `,
  modalTitle: css`
    font-size: 16px;
    font-weight: 800;
    color: #00ffcc;
    margin-bottom: 22px;
    text-shadow: 0 0 16px rgba(0, 255, 204, 0.4);
    letter-spacing: 1.5px;
    text-transform: uppercase;
  `,
  formGroup: css`
    margin-bottom: 16px;
  `,
  formLabel: css`
    display: block;
    font-size: 10px;
    font-weight: 700;
    color: rgba(255, 255, 255, 0.4);
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 1px;
  `,
  formSelect: css`
    width: 100%;
    appearance: none;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(0, 255, 204, 0.1);
    border-radius: 6px;
    color: #ddd;
    padding: 9px 12px;
    font-size: 13px;
    font-family: 'JetBrains Mono', monospace;
    outline: none;
    transition: border-color 0.2s;
    &:focus { border-color: rgba(0, 255, 204, 0.4); }
    option { background: #0d1117; color: #ddd; }
  `,
  formTextarea: css`
    width: 100%;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(0, 255, 204, 0.1);
    border-radius: 6px;
    color: #ddd;
    padding: 10px 12px;
    font-size: 13px;
    font-family: 'JetBrains Mono', monospace;
    outline: none;
    resize: vertical;
    min-height: 80px;
    transition: border-color 0.2s;
    &:focus { border-color: rgba(0, 255, 204, 0.4); }
    &::placeholder { color: rgba(255, 255, 255, 0.2); }
  `,
  radioGroup: css`
    display: flex;
    gap: 8px;
  `,
  radioLabel: css`
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.6);
    padding: 6px 16px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    transition: all 0.2s;
    &:hover { background: rgba(255, 255, 255, 0.03); }
    input { display: none; }
  `,
  radioSelected: css`
    border-color: rgba(0, 255, 204, 0.35);
    background: rgba(0, 255, 204, 0.06);
    color: #00ffcc;
    box-shadow: 0 0 12px rgba(0, 255, 204, 0.08);
  `,
  modalActions: css`
    display: flex;
    gap: 10px;
    justify-content: flex-end;
    margin-top: 24px;
  `,
  cancelBtn: css`
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.5);
    padding: 8px 20px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    &:hover { background: rgba(255, 255, 255, 0.04); color: #fff; }
  `,
  launchBtn: css`
    background: linear-gradient(135deg, rgba(0, 255, 204, 0.2), rgba(0, 204, 170, 0.15));
    border: 1px solid rgba(0, 255, 204, 0.35);
    border-radius: 6px;
    color: #00ffcc;
    padding: 8px 24px;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
    transition: all 0.25s;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    &:hover {
      box-shadow: 0 0 24px rgba(0, 255, 204, 0.25);
      transform: translateY(-1px);
    }
    &:disabled { opacity: 0.4; cursor: default; transform: none; box-shadow: none; }
  `,

  /* ── Toast ── */
  toast: css`
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 10001;
    padding: 10px 18px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
    animation: ${fadeIn} 0.2s ease;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(12px);
  `,
  toastSuccess: css`
    background: rgba(0, 255, 204, 0.12);
    border: 1px solid rgba(0, 255, 204, 0.25);
    color: #00ffcc;
  `,
  toastError: css`
    background: rgba(255, 68, 102, 0.12);
    border: 1px solid rgba(255, 68, 102, 0.25);
    color: #ff4466;
  `,

  /* ── Confirm Kill ── */
  confirmOverlay: css`
    position: fixed;
    inset: 0;
    z-index: 10002;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(6px);
    animation: ${fadeIn} 0.15s ease;
  `,
  confirmBox: css`
    background: linear-gradient(145deg, rgba(25, 20, 25, 0.98), rgba(17, 12, 18, 0.99));
    border: 1px solid rgba(255, 68, 102, 0.2);
    border-radius: 12px;
    padding: 24px 28px;
    max-width: 360px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6), 0 0 30px rgba(255, 68, 102, 0.05);
  `,
  confirmText: css`
    font-size: 13px;
    color: rgba(255, 255, 255, 0.75);
    margin-bottom: 18px;
    line-height: 1.6;
    & strong { color: #ff4466; font-family: 'JetBrains Mono', monospace; }
  `,
  confirmActions: css`
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  `,
  confirmKillBtn: css`
    background: rgba(255, 68, 102, 0.15);
    border: 1px solid rgba(255, 68, 102, 0.35);
    border-radius: 6px;
    color: #ff4466;
    padding: 7px 18px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    &:hover { background: rgba(255, 68, 102, 0.25); box-shadow: 0 0 16px rgba(255, 68, 102, 0.15); }
  `,

  /* ── Empty state ── */
  emptyState: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: rgba(255, 255, 255, 0.15);
    font-size: 12px;
    gap: 6px;
    padding: 40px;
    text-align: center;
  `,
};

// Kill button visibility trick: make it show on parent hover
const agentRowHoverKill = css`
  &:hover .kill-btn-hover { opacity: 1 !important; }
`;

// ── Component ──────────────────────────────────────────────────────────────────

export function ControlCenterPanel() {
  // ── State ──
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [stats, setStats] = useState<Stats>({ total_projects: 0, total_agents: 0, working_agents: 0, idle_agents: 0, uptime_seconds: 0 });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showDispatch, setShowDispatch] = useState(false);
  const [streamLines, setStreamLines] = useState<string[]>([]);
  const [liveMilestones, setLiveMilestones] = useState<string[]>([]);
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
  const milestonesTrackRef = useRef<HTMLDivElement>(null);

  // Keep ref in sync with selectedAgent
  useEffect(() => {
    selectedAgentRef.current = selectedAgent?.session_id || null;
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
      if (selectedAgentRef.current) {
        const updated = data.find((a) => a.session_id === selectedAgentRef.current);
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
              const text = event.chunk || event.text || event.content || event.data?.text || '';
              if (text) {
                setStreamLines((prev) => {
                  const next = [...prev, text];
                  return next.length > 500 ? next.slice(-500) : next;
                });
              }
            }

            if (event.type === 'agent_milestone' && agentId && agentId === selectedAgentRef.current) {
              const milestone = event.milestone || event.label || event.data?.label || '';
              if (milestone) {
                setLiveMilestones((prev) => [...prev, milestone]);
              }
            }

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
  }, [selectedAgent?.session_id]);

  // ── Auto-scroll terminal ──
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [streamLines]);

  // ── Auto-scroll milestones track to end ──
  useEffect(() => {
    if (milestonesTrackRef.current) {
      milestonesTrackRef.current.scrollLeft = milestonesTrackRef.current.scrollWidth;
    }
  }, [liveMilestones]);

  // ── Filter agents by project ──
  const filteredAgents = selectedProject
    ? agents.filter((a) => a.project_name === selectedProject)
    : agents;

  // ── Handlers ──

  const handleKill = async (sessionId: string) => {
    const ok = await apiDelete(`/api/agents/${sessionId}`);
    if (ok) {
      setToast({ msg: 'Agent terminated', type: 'success' });
      if (selectedAgent?.session_id === sessionId) setSelectedAgent(null);
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
    const result = await apiPost(`/api/agents/${selectedAgent.session_id}/inject`, { message: sendMsg.trim() });
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
  const allMilestones: string[] = [
    ...(selectedAgent?.milestones || []),
    ...liveMilestones,
  ];

  function formatUptime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m ${seconds % 60}s`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ${mins % 60}m`;
    const days = Math.floor(hrs / 24);
    return `${days}d ${hrs % 24}h`;
  }

  function formatDuration(started?: string): string {
    if (!started) return '--';
    const ms = Date.now() - new Date(started).getTime();
    const secs = Math.floor(ms / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  }

  const isAgentAlive = (status: string) => ['working', 'active', 'idle'].includes(status);

  // ── Render ──
  return (
    <div className={s.root}>
      {/* ── Stats Bar ── */}
      <div className={s.statsBar}>
        <div className={s.statsTitle}>
          <div className={s.statsTitleIcon}>&#9670;</div>
          <span className={s.statsTitleText}>Control</span>
        </div>

        <div className={s.statCell}>
          <span className={s.statNumber} style={{ color: '#00ffcc', textShadow: '0 0 12px rgba(0,255,204,0.4)' }}>
            {stats.working_agents}
          </span>
          <span className={s.statLabel}>Working</span>
        </div>

        <div className={s.statCell}>
          <span className={s.statNumber} style={{ color: '#ffaa00', textShadow: '0 0 10px rgba(255,170,0,0.3)' }}>
            {stats.idle_agents}
          </span>
          <span className={s.statLabel}>Idle</span>
        </div>

        <div className={s.statCell}>
          <span className={s.statNumber} style={{ color: 'rgba(255,255,255,0.6)' }}>
            {stats.total_agents}
          </span>
          <span className={s.statLabel}>Total</span>
        </div>

        <div className={s.statCell}>
          <span className={s.statNumber} style={{ color: '#60a5fa', textShadow: '0 0 10px rgba(96,165,250,0.3)' }}>
            {stats.total_projects}
          </span>
          <span className={s.statLabel}>Projects</span>
        </div>

        <div className={s.statsRight}>
          <select
            className={s.projectSelect}
            value={selectedProject}
            onChange={(e) => { setSelectedProject(e.target.value); setSelectedAgent(null); }}
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.name} value={p.name}>{p.name}</option>
            ))}
          </select>

          {stats.uptime_seconds != null && (
            <span className={s.uptime}>UP {formatUptime(stats.uptime_seconds)}</span>
          )}

          <button className={s.dispatchBtn} onClick={() => {
            setDispatchProject(selectedProject || (projects[0]?.name || ''));
            setShowDispatch(true);
          }}>
            + Dispatch
          </button>
        </div>
      </div>

      {/* ── Main Split ── */}
      <div className={s.main}>
        {/* ── Left: Agent List ── */}
        <div className={s.leftCol}>
          <div className={s.sectionHeader}>
            <span>Agents</span>
            <span className={s.sectionCount}>{filteredAgents.length}</span>
          </div>
          <div className={s.agentList}>
            {filteredAgents.length === 0 && (
              <div className={s.emptyState}>
                <span style={{ fontSize: 18, opacity: 0.3 }}>&#9673;</span>
                No agents active
              </div>
            )}
            {filteredAgents.map((agent, idx) => {
              const sm = shortModel(agent.model);
              const mc = modelColor(agent.model);
              const sc = statusColor(agent.status);
              const isActive = agent.status === 'working' || agent.status === 'active';
              const isSelected = selectedAgent?.session_id === agent.session_id;

              return (
                <div
                  key={agent.session_id}
                  className={`${s.agentRow} ${isSelected ? s.agentRowSelected : ''} ${agentRowHoverKill}`}
                  onClick={() => setSelectedAgent(agent)}
                  style={{ animationDelay: `${idx * 30}ms`, animation: `${staggerIn} 0.3s ease both` }}
                >
                  {/* Status dot */}
                  <span
                    className={`${s.agentDot} ${isActive ? s.agentDotActive : ''}`}
                    style={{ background: sc, color: sc }}
                  />

                  {/* Short ID */}
                  <span className={s.agentId}>{agent.session_id.slice(0, 8)}</span>

                  {/* Model badge */}
                  <span
                    className={s.modelBadge}
                    style={{
                      background: mc + '15',
                      color: mc,
                      border: `1px solid ${mc}30`,
                    }}
                  >
                    {sm}
                  </span>

                  {/* Turn count */}
                  <span className={s.agentTurns}>
                    {agent.turn_count != null ? `${agent.turn_count}t` : ''}
                  </span>

                  {/* Duration */}
                  <span className={s.agentDuration}>
                    {formatDuration(agent.started_at)}
                  </span>

                  {/* Kill btn */}
                  {isAgentAlive(agent.status) && (
                    <button
                      className={`kill-btn-hover`}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'rgba(255, 68, 102, 0.4)',
                        fontSize: 14,
                        cursor: 'pointer',
                        padding: '0 2px',
                        lineHeight: 1,
                        flexShrink: 0,
                        marginLeft: 'auto',
                        transition: 'all 0.2s',
                        opacity: 0,
                      }}
                      onClick={(e) => { e.stopPropagation(); setConfirmKill(agent.session_id); }}
                      title="Kill agent"
                    >
                      &#10005;
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Task List (below agents when project selected) ── */}
          {selectedProject && (
            <>
              <div className={s.sectionHeader}>
                <span>Tasks</span>
                <span className={s.sectionCount}>{tasks.length}</span>
              </div>
              <div className={s.taskList} style={{ maxHeight: '35%' }}>
                {tasks.length === 0 && (
                  <div className={s.emptyState} style={{ padding: 20 }}>No tasks</div>
                )}
                {tasks.map((task, i) => {
                  const tc = taskColors(task.status);
                  return (
                    <div
                      key={task.index ?? i}
                      className={s.taskItem}
                      style={{ animation: `${staggerIn} 0.25s ease both`, animationDelay: `${i * 25}ms` }}
                    >
                      <span
                        className={s.taskStatus}
                        style={{ background: tc.bg, color: tc.fg, border: `1px solid ${tc.border}` }}
                      >
                        {task.status}
                      </span>
                      <span className={s.taskTitle}>{task.text}</span>
                      {task.agent && <span className={s.taskAgent}>{task.agent}</span>}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* ── Right: Detail ── */}
        <div className={s.rightCol}>
          {!selectedAgent ? (
            <div className={s.rightPlaceholder}>
              <div className={s.placeholderIcon}>&#9678;</div>
              <div style={{ color: 'rgba(255,255,255,0.25)' }}>Select an agent to view details</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.12)' }}>
                {selectedProject ? `Showing agents for ${selectedProject}` : 'or choose a project to filter'}
              </div>
            </div>
          ) : (
            <div className={s.detailPanel}>
              {/* ── Detail Header ── */}
              <div className={s.detailHeader}>
                <div className={s.detailTopRow}>
                  <span
                    className={`${s.agentDot} ${(selectedAgent.status === 'working' || selectedAgent.status === 'active') ? s.agentDotActive : ''}`}
                    style={{
                      background: statusColor(selectedAgent.status),
                      color: statusColor(selectedAgent.status),
                      width: 9,
                      height: 9,
                    }}
                  />
                  <span className={s.detailSessionId}>
                    {selectedAgent.session_id.slice(0, 16)}
                  </span>
                  <span
                    className={s.detailStatusBadge}
                    style={{
                      background: statusColor(selectedAgent.status) + '15',
                      color: statusColor(selectedAgent.status),
                      border: `1px solid ${statusColor(selectedAgent.status)}30`,
                    }}
                  >
                    {selectedAgent.status}
                  </span>
                  <span
                    className={s.detailModelBadge}
                    style={{
                      background: modelColor(selectedAgent.model) + '15',
                      color: modelColor(selectedAgent.model),
                      border: `1px solid ${modelColor(selectedAgent.model)}30`,
                    }}
                  >
                    {shortModel(selectedAgent.model)}
                  </span>
                </div>
                <div className={s.detailMeta}>
                  <span className={s.detailMetaItem}>
                    <span>project</span> {selectedAgent.project_name}
                  </span>
                  <span className={s.detailMetaItem}>
                    <span>turns</span> {selectedAgent.turn_count ?? '--'}
                  </span>
                  <span className={s.detailMetaItem}>
                    <span>duration</span> {formatDuration(selectedAgent.started_at)}
                  </span>
                  <span className={s.detailMetaItem}>
                    <span>phase</span> {selectedAgent.phase || '--'}
                  </span>
                  <span className={s.detailMetaItem}>
                    <span>pid</span> {selectedAgent.pid ?? '--'}
                  </span>
                </div>
              </div>

              {/* ── Task description ── */}
              {selectedAgent.task && (
                <div className={s.detailTask}>
                  {selectedAgent.task}
                </div>
              )}

              {/* ── Milestones Track ── */}
              {allMilestones.length > 0 && (
                <div className={s.milestonesBar}>
                  <span className={s.milestonesLabel}>Milestones</span>
                  <div className={s.milestonesTrack} ref={milestonesTrackRef}>
                    {allMilestones.map((m, i) => (
                      <span
                        key={i}
                        className={`${s.milestonePill} ${i === allMilestones.length - 1 ? s.milestonePillLatest : ''}`}
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Terminal Output ── */}
              <div className={s.outputSection}>
                <div className={s.outputLabel}>Live Output</div>
                <div className={s.outputTerminal} ref={terminalRef}>
                  {streamLines.length === 0 && (
                    <span className={s.outputEmpty}>
                      Waiting for stream data...
                    </span>
                  )}
                  {streamLines.map((line, i) => (
                    <div key={i}>{line}</div>
                  ))}
                </div>
              </div>

              {/* ── Send Message ── */}
              {isAgentAlive(selectedAgent.status) && (
                <div className={s.sendRow}>
                  <input
                    className={s.sendInput}
                    type="text"
                    placeholder="Send message to agent..."
                    value={sendMsg}
                    onChange={(e) => setSendMsg(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !sending) handleSendMessage(); }}
                  />
                  <button
                    className={s.sendBtn}
                    disabled={sending || !sendMsg.trim()}
                    onClick={handleSendMessage}
                  >
                    {sending ? '...' : 'Send'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Dispatch Modal ── */}
      {showDispatch && (
        <div className={s.modalBackdrop} onClick={() => setShowDispatch(false)}>
          <div className={s.modal} onClick={(e) => e.stopPropagation()}>
            <div className={s.modalTitle}>Dispatch Agent</div>

            <div className={s.formGroup}>
              <label className={s.formLabel}>Project</label>
              <select
                className={s.formSelect}
                value={dispatchProject}
                onChange={(e) => setDispatchProject(e.target.value)}
              >
                <option value="">Select project...</option>
                {projects.map((p) => (
                  <option key={p.name} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className={s.formGroup}>
              <label className={s.formLabel}>Task Description</label>
              <textarea
                className={s.formTextarea}
                placeholder="Describe the task for the agent..."
                value={dispatchTask}
                onChange={(e) => setDispatchTask(e.target.value)}
              />
            </div>

            <div className={s.formGroup}>
              <label className={s.formLabel}>Model</label>
              <div className={s.radioGroup}>
                {[
                  { value: 'opus', label: 'Opus', color: '#c084fc' },
                  { value: 'sonnet', label: 'Sonnet', color: '#60a5fa' },
                  { value: 'haiku', label: 'Haiku', color: '#34d399' },
                ].map((m) => (
                  <label
                    key={m.value}
                    className={`${s.radioLabel} ${dispatchModel === m.value ? s.radioSelected : ''}`}
                    style={dispatchModel === m.value ? { borderColor: m.color + '60', color: m.color, background: m.color + '10' } : {}}
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

            <div className={s.modalActions}>
              <button className={s.cancelBtn} onClick={() => setShowDispatch(false)}>
                Cancel
              </button>
              <button
                className={s.launchBtn}
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
        <div className={s.confirmOverlay} onClick={() => setConfirmKill(null)}>
          <div className={s.confirmBox} onClick={(e) => e.stopPropagation()}>
            <div className={s.confirmText}>
              Terminate agent <strong>{confirmKill.slice(0, 12)}</strong>?
              This action cannot be undone.
            </div>
            <div className={s.confirmActions}>
              <button className={s.cancelBtn} onClick={() => setConfirmKill(null)}>
                Cancel
              </button>
              <button className={s.confirmKillBtn} onClick={() => handleKill(confirmKill)}>
                Kill Agent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className={`${s.toast} ${toast.type === 'success' ? s.toastSuccess : s.toastError}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
