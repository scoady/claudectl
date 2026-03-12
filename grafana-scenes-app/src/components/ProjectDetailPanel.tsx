import React, { useEffect, useState, useCallback, useRef } from 'react';
import { css, keyframes } from '@emotion/css';
import {
  colors, fonts, anim, glassmorphism, glassCard, neonText,
  inputField, primaryButton, ghostButton, dangerButton, thinScrollbar,
  statusDot, statusBadge, compactBadge, terminalOutput,
  statusColor, shortModel, formatDuration,
} from '../styles/theme';
import { api } from '../services/api';
import { agentWS } from '../services/websocket';
import type { Agent, Task, StreamEvent } from '../types';

// ── Props ───────────────────────────────────────────────────────────────────

interface ProjectDetailPanelProps {
  projectName: string;
  onBack: () => void;
}

// ── Model color helper ──────────────────────────────────────────────────────

function modelColor(model: string): string {
  const m = shortModel(model);
  if (m === 'Opus') return colors.purple;
  if (m === 'Sonnet') return '#4488ff';
  if (m === 'Haiku') return colors.success;
  return colors.textMuted;
}

// ── Task status color ───────────────────────────────────────────────────────

function taskColor(status: string): string {
  switch (status) {
    case 'pending': return colors.textDim;
    case 'in_progress': return colors.primary;
    case 'done': return colors.success;
    case 'blocked': return colors.danger;
    default: return colors.textDim;
  }
}

function taskLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ── Terminal line type ──────────────────────────────────────────────────────

interface TerminalTab {
  sessionId: string;
  label: string;
  lines: string[];
  milestones: string[];
}

// ── Component ───────────────────────────────────────────────────────────────

const ProjectDetailPanel: React.FC<ProjectDetailPanelProps> = ({ projectName, onBack }) => {
  // ── State ─────────────────────────────────────────────────────────────────

  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [dispatchInput, setDispatchInput] = useState('');
  const [dispatching, setDispatching] = useState(false);
  const [description, setDescription] = useState('');

  // Terminal
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [injectInput, setInjectInput] = useState('');
  const terminalRef = useRef<HTMLDivElement>(null);

  // Kill confirmation
  const [confirmKill, setConfirmKill] = useState<string | null>(null);

  // ── Data fetching ─────────────────────────────────────────────────────────

  const fetchAgents = useCallback(async () => {
    const all = await api.agents.listSafe();
    if (all) {
      setAgents(all.filter(a => a.project_name === projectName));
    }
  }, [projectName]);

  const fetchTasks = useCallback(async () => {
    try {
      const t = await api.projects.tasks(projectName);
      setTasks(t);
    } catch {
      // tasks endpoint might not exist for all projects
    }
  }, [projectName]);

  const fetchProject = useCallback(async () => {
    const projects = await api.projects.listSafe();
    if (projects) {
      const p = projects.find(p => p.name === projectName);
      if (p?.description) setDescription(p.description);
    }
  }, [projectName]);

  useEffect(() => {
    fetchAgents();
    fetchTasks();
    fetchProject();
    const interval = setInterval(() => {
      fetchAgents();
      fetchTasks();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchAgents, fetchTasks, fetchProject]);

  // ── WebSocket ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const handleStream = (event: StreamEvent) => {
      const sid = event.session_id;
      if (!sid) return;
      // Only process if this agent is in our tabs
      setTabs(prev => {
        const tab = prev.find(t => t.sessionId === sid);
        if (!tab) return prev;
        const text = event.text || event.content || '';
        if (!text) return prev;
        return prev.map(t =>
          t.sessionId === sid
            ? { ...t, lines: [...t.lines, text] }
            : t
        );
      });
    };

    const handleMilestone = (event: StreamEvent) => {
      const sid = event.session_id;
      if (!sid) return;
      const label = event.milestone || event.label || event.tool || '';
      if (!label) return;
      setTabs(prev =>
        prev.map(t =>
          t.sessionId === sid
            ? { ...t, milestones: [...t.milestones, label] }
            : t
        )
      );
    };

    const unsubStream = agentWS.on('agent_stream', handleStream);
    const unsubMilestone = agentWS.on('agent_milestone', handleMilestone);
    const unsubSpawned = agentWS.on('agent_spawned', fetchAgents);
    const unsubDone = agentWS.on('agent_done', fetchAgents);
    const unsubUpdate = agentWS.on('agent_update', fetchAgents);

    return () => {
      unsubStream();
      unsubMilestone();
      unsubSpawned();
      unsubDone();
      unsubUpdate();
    };
  }, [fetchAgents]);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [tabs, activeTabId]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleDispatch = async () => {
    if (!dispatchInput.trim()) return;
    setDispatching(true);
    try {
      await api.projects.dispatch(projectName, { task: dispatchInput.trim() });
      setDispatchInput('');
      fetchAgents();
    } catch (err) {
      console.error('Dispatch failed:', err);
    } finally {
      setDispatching(false);
    }
  };

  const handleKill = async (sessionId: string) => {
    await api.agents.kill(sessionId);
    setConfirmKill(null);
    // Remove tab if open
    setTabs(prev => prev.filter(t => t.sessionId !== sessionId));
    if (activeTabId === sessionId) {
      setActiveTabId(null);
    }
    fetchAgents();
  };

  const openAgentTab = (agent: Agent) => {
    setTerminalOpen(true);
    const existing = tabs.find(t => t.sessionId === agent.session_id);
    if (!existing) {
      setTabs(prev => [...prev, {
        sessionId: agent.session_id,
        label: agent.session_id.substring(0, 8),
        lines: [],
        milestones: agent.milestones || [],
      }]);
    }
    setActiveTabId(agent.session_id);
  };

  const closeTab = (sessionId: string) => {
    setTabs(prev => prev.filter(t => t.sessionId !== sessionId));
    if (activeTabId === sessionId) {
      setActiveTabId(tabs.length > 1 ? tabs.find(t => t.sessionId !== sessionId)?.sessionId || null : null);
    }
  };

  const handleInject = async () => {
    if (!injectInput.trim() || !activeTabId) return;
    await api.agents.inject(activeTabId, { message: injectInput.trim() });
    setInjectInput('');
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const activeTab = tabs.find(t => t.sessionId === activeTabId);
  const taskColumns: Record<string, Task[]> = {
    pending: [],
    in_progress: [],
    done: [],
    blocked: [],
  };
  tasks.forEach(t => {
    const col = taskColumns[t.status] ? t.status : 'pending';
    taskColumns[col].push(t);
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.root}>
      {/* ── Top Bar ────────────────────────────────────────────────────────── */}
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={onBack} title="Back to projects">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <div className={styles.topInfo}>
          <span className={styles.projectName}>{projectName}</span>
          {description && <span className={styles.projectDesc}>{description}</span>}
        </div>

        <div className={styles.dispatchRow}>
          <input
            className={`${inputField} ${styles.dispatchInput}`}
            placeholder="Dispatch a task..."
            value={dispatchInput}
            onChange={e => setDispatchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleDispatch()}
          />
          <button
            className={primaryButton}
            onClick={handleDispatch}
            disabled={!dispatchInput.trim() || dispatching}
          >
            {dispatching ? '...' : 'Run'}
          </button>
        </div>
      </div>

      {/* ── Main Content ───────────────────────────────────────────────────── */}
      <div className={styles.mainContent}>
        {/* ── Left: Task Board ─────────────────────────────────────────────── */}
        <div className={styles.taskBoard}>
          <div className={styles.sectionLabel}>Tasks</div>
          <div className={styles.taskColumns}>
            {(['pending', 'in_progress', 'done', 'blocked'] as const).map(col => (
              <div key={col} className={styles.taskColumn}>
                <div className={styles.colHeader}>
                  <span className={css`
                    width: 6px; height: 6px; border-radius: 50%;
                    background: ${taskColor(col)};
                    box-shadow: 0 0 4px ${taskColor(col)}80;
                  `} />
                  <span className={styles.colTitle}>{taskLabel(col)}</span>
                  <span className={styles.colCount}>{taskColumns[col].length}</span>
                </div>
                <div className={styles.colItems}>
                  {taskColumns[col].map((task, i) => (
                    <div
                      key={task.index}
                      className={styles.taskItem}
                      style={{ animationDelay: `${i * 30}ms` }}
                    >
                      <span className={css`
                        width: 4px; height: 4px; border-radius: 50%;
                        background: ${taskColor(col)};
                        flex-shrink: 0;
                      `} />
                      <span className={styles.taskTitle}>{task.text}</span>
                    </div>
                  ))}
                  {taskColumns[col].length === 0 && (
                    <div className={styles.emptyCol}>--</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: Agent Panel ───────────────────────────────────────────── */}
        <div className={styles.agentPanel}>
          <div className={styles.sectionLabel}>
            Agents
            <span className={styles.agentCount}>{agents.length}</span>
          </div>
          <div className={styles.agentList}>
            {agents.map((agent, i) => {
              const isWorking = agent.status === 'working' || agent.status === 'active';
              const color = statusColor(agent.status);
              const mColor = modelColor(agent.model);
              const lastMs = agent.milestones?.length
                ? agent.milestones[agent.milestones.length - 1]
                : null;

              return (
                <div
                  key={agent.session_id}
                  className={styles.agentCard}
                  style={{ animationDelay: `${i * 50}ms` }}
                  onClick={() => openAgentTab(agent)}
                >
                  <div className={styles.agentRow1}>
                    <span className={statusDot(color, isWorking)} />
                    <span className={styles.agentId}>
                      {agent.session_id.substring(0, 8)}
                    </span>
                    <span className={css`
                      ${compactBadge}
                      font-size: 10px;
                      padding: 1px 7px;
                      color: ${mColor};
                      border-color: ${mColor}44;
                      background: ${mColor}15;
                    `}>
                      {shortModel(agent.model)}
                    </span>
                    <span className={styles.agentTurns}>
                      {agent.turn_count}t
                    </span>
                    <span className={styles.agentDuration}>
                      {formatDuration(agent.started_at)}
                    </span>

                    {/* Kill button */}
                    <button
                      className={styles.killBtn}
                      onClick={e => {
                        e.stopPropagation();
                        if (confirmKill === agent.session_id) {
                          handleKill(agent.session_id);
                        } else {
                          setConfirmKill(agent.session_id);
                          setTimeout(() => setConfirmKill(null), 3000);
                        }
                      }}
                      title={confirmKill === agent.session_id ? 'Click again to confirm' : 'Kill agent'}
                    >
                      {confirmKill === agent.session_id ? 'Confirm?' : 'Kill'}
                    </button>
                  </div>

                  {/* Task */}
                  {agent.task && (
                    <div className={styles.agentTask}>
                      {agent.task}
                    </div>
                  )}

                  {/* Last milestone */}
                  {lastMs && (
                    <div className={styles.agentMilestone}>
                      {lastMs}
                    </div>
                  )}
                </div>
              );
            })}

            {agents.length === 0 && (
              <div className={styles.emptyAgents}>
                No agents running. Dispatch a task above.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Terminal ──────────────────────────────────────────────────────── */}
      <div className={css`
        ${styles.terminalSection}
        ${terminalOpen ? '' : 'height: 36px; min-height: 36px;'}
      `}>
        {/* Terminal header / toggle */}
        <div className={styles.terminalHeader}>
          <button
            className={styles.terminalToggle}
            onClick={() => setTerminalOpen(!terminalOpen)}
          >
            <svg
              width="10" height="10" viewBox="0 0 10 10"
              className={css`
                transform: rotate(${terminalOpen ? '180deg' : '0deg'});
                transition: transform 0.2s ease;
              `}
            >
              <path d="M1 3L5 7L9 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            </svg>
            Terminal
          </button>

          {/* Tab bar */}
          <div className={styles.tabBar}>
            {tabs.map(tab => (
              <div
                key={tab.sessionId}
                className={css`
                  ${styles.tab}
                  ${tab.sessionId === activeTabId ? styles.tabActive : ''}
                `}
                onClick={() => setActiveTabId(tab.sessionId)}
              >
                <span className={statusDot(
                  agents.find(a => a.session_id === tab.sessionId)?.status === 'working'
                    ? colors.primary
                    : colors.textDim,
                  agents.find(a => a.session_id === tab.sessionId)?.status === 'working',
                )} />
                <span>{tab.label}</span>
                <button
                  className={styles.tabClose}
                  onClick={e => {
                    e.stopPropagation();
                    closeTab(tab.sessionId);
                  }}
                >
                  x
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Terminal body */}
        {terminalOpen && activeTab && (
          <div className={styles.terminalBody}>
            {/* Milestones track */}
            {activeTab.milestones.length > 0 && (
              <div className={styles.milestoneTrack}>
                {activeTab.milestones.map((ms, i) => (
                  <span key={i} className={styles.milestonePill}>{ms}</span>
                ))}
              </div>
            )}

            {/* Output area */}
            <div className={styles.terminalOutput} ref={terminalRef}>
              {/* Scan line effect */}
              <div className={styles.scanLine} />
              {activeTab.lines.length === 0 ? (
                <span className={css`color: ${colors.textDim};`}>
                  Waiting for output...
                </span>
              ) : (
                activeTab.lines.map((line, i) => (
                  <span key={i}>{line}</span>
                ))
              )}
            </div>

            {/* Input */}
            <div className={styles.terminalInputRow}>
              <span className={styles.promptChar}>&gt;</span>
              <input
                className={`${inputField} ${styles.terminalInput}`}
                placeholder="Send message to agent..."
                value={injectInput}
                onChange={e => setInjectInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleInject()}
              />
              <button
                className={primaryButton}
                onClick={handleInject}
                disabled={!injectInput.trim() || !activeTabId}
              >
                Send
              </button>
            </div>
          </div>
        )}

        {terminalOpen && !activeTab && tabs.length === 0 && (
          <div className={styles.terminalEmpty}>
            Click an agent to open its terminal.
          </div>
        )}
      </div>
    </div>
  );
};

// ── Animations ──────────────────────────────────────────────────────────────

const scanLineMove = keyframes`
  0%   { top: -2px; opacity: 0; }
  10%  { opacity: 0.4; }
  90%  { opacity: 0.4; }
  100% { top: 100%; opacity: 0; }
`;

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = {
  root: css`
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #0a0e14;
    font-family: ${fonts.system};
    color: ${colors.text};
    overflow: hidden;
  `,

  // ── Top Bar ─────────────────────────────────────────────────────────────

  topBar: css`
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 10px 16px;
    background: linear-gradient(135deg, rgba(20, 25, 35, 0.95), rgba(15, 20, 30, 0.98));
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid ${colors.primaryBorder};
    flex-shrink: 0;
    z-index: 10;
  `,

  backBtn: css`
    background: none;
    border: 1px solid ${colors.borderLight};
    border-radius: 6px;
    color: ${colors.textMuted};
    padding: 6px 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    transition: all 0.2s ease;
    flex-shrink: 0;
    &:hover {
      color: ${colors.textWhite};
      border-color: ${colors.primaryBorder};
      background: ${colors.primaryMuted};
    }
  `,

  topInfo: css`
    display: flex;
    align-items: baseline;
    gap: 12px;
    min-width: 0;
    flex-shrink: 1;
  `,

  projectName: css`
    ${neonText}
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0.5px;
    white-space: nowrap;
  `,

  projectDesc: css`
    font-size: 12px;
    color: ${colors.textMuted};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,

  dispatchRow: css`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
    flex-shrink: 0;
  `,

  dispatchInput: css`
    width: 260px;
    padding: 6px 12px;
    font-size: 12px;
  `,

  // ── Main Content ────────────────────────────────────────────────────────

  mainContent: css`
    display: flex;
    flex: 1;
    min-height: 0;
    border-bottom: 1px solid ${colors.primaryBorder};
  `,

  sectionLabel: css`
    font-size: 10px;
    font-weight: 700;
    color: ${colors.textMuted};
    text-transform: uppercase;
    letter-spacing: 1px;
    padding: 10px 14px 6px;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  `,

  // ── Task Board (left 40%) ───────────────────────────────────────────────

  taskBoard: css`
    width: 40%;
    min-width: 0;
    display: flex;
    flex-direction: column;
    border-right: 1px solid ${colors.primaryBorder};
    overflow: hidden;
  `,

  taskColumns: css`
    display: flex;
    flex: 1;
    min-height: 0;
    overflow-x: auto;
    ${thinScrollbar}
  `,

  taskColumn: css`
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    border-right: 1px solid ${colors.border};
    &:last-child { border-right: none; }
  `,

  colHeader: css`
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    border-bottom: 1px solid ${colors.border};
    flex-shrink: 0;
  `,

  colTitle: css`
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: ${colors.textMuted};
  `,

  colCount: css`
    font-size: 10px;
    color: ${colors.textDim};
    margin-left: auto;
    font-family: ${fonts.mono};
  `,

  colItems: css`
    flex: 1;
    overflow-y: auto;
    padding: 4px;
    ${thinScrollbar}
  `,

  taskItem: css`
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 5px 8px;
    border-radius: 4px;
    font-size: 11px;
    color: ${colors.text};
    cursor: default;
    animation: ${anim.fadeIn} 0.3s ease both;
    &:hover {
      background: ${colors.whiteA5};
    }
  `,

  taskTitle: css`
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  `,

  emptyCol: css`
    padding: 12px;
    text-align: center;
    font-size: 11px;
    color: ${colors.textDim};
  `,

  // ── Agent Panel (right 60%) ─────────────────────────────────────────────

  agentPanel: css`
    width: 60%;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  `,

  agentCount: css`
    font-family: ${fonts.mono};
    font-size: 11px;
    color: ${colors.primary};
    background: ${colors.primaryMuted};
    padding: 1px 7px;
    border-radius: 10px;
  `,

  agentList: css`
    flex: 1;
    overflow-y: auto;
    padding: 6px 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    ${thinScrollbar}
  `,

  agentCard: css`
    ${glassCard}
    padding: 10px 12px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 4px;
    animation: ${anim.slideInRight} 0.3s ease both;
    &:hover {
      border-color: ${colors.primaryBorder};
      box-shadow: 0 0 12px rgba(0, 255, 204, 0.08);
    }
  `,

  agentRow1: css`
    display: flex;
    align-items: center;
    gap: 8px;
  `,

  agentId: css`
    font-family: ${fonts.mono};
    font-size: 12px;
    font-weight: 600;
    color: ${colors.textBright};
    letter-spacing: 0.5px;
  `,

  agentTurns: css`
    font-family: ${fonts.mono};
    font-size: 10px;
    color: ${colors.textDim};
  `,

  agentDuration: css`
    font-family: ${fonts.mono};
    font-size: 10px;
    color: ${colors.textDim};
    margin-left: auto;
  `,

  agentTask: css`
    font-size: 11px;
    color: ${colors.textMuted};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-left: 16px;
  `,

  agentMilestone: css`
    font-size: 10px;
    color: ${colors.primaryDim};
    font-family: ${fonts.mono};
    padding-left: 16px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,

  killBtn: css`
    background: none;
    border: 1px solid ${colors.dangerBorder};
    border-radius: 4px;
    color: ${colors.danger};
    font-size: 10px;
    font-weight: 600;
    padding: 2px 8px;
    cursor: pointer;
    opacity: 0;
    transition: all 0.15s ease;
    margin-left: 4px;
    flex-shrink: 0;
    *:hover > * > & {
      opacity: 1;
    }
    &:hover {
      background: ${colors.dangerMuted};
    }
  `,

  emptyAgents: css`
    padding: 24px;
    text-align: center;
    color: ${colors.textDim};
    font-size: 12px;
  `,

  // ── Terminal ────────────────────────────────────────────────────────────

  terminalSection: css`
    flex-shrink: 0;
    height: 40%;
    min-height: 36px;
    display: flex;
    flex-direction: column;
    background: #050810;
    transition: height 0.3s ease;
    overflow: hidden;
  `,

  terminalHeader: css`
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 0 8px;
    height: 36px;
    flex-shrink: 0;
    border-top: 2px solid ${colors.primaryBorder};
    background: linear-gradient(180deg, rgba(0, 255, 204, 0.04), transparent);
  `,

  terminalToggle: css`
    background: none;
    border: none;
    color: ${colors.textMuted};
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 4px;
    flex-shrink: 0;
    transition: color 0.15s ease;
    &:hover { color: ${colors.textWhite}; }
  `,

  tabBar: css`
    display: flex;
    align-items: center;
    gap: 2px;
    overflow-x: auto;
    flex: 1;
    min-width: 0;
    ${thinScrollbar}
  `,

  tab: css`
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 11px;
    font-family: ${fonts.mono};
    color: ${colors.textMuted};
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
    &:hover {
      background: ${colors.whiteA5};
      color: ${colors.textBright};
    }
  `,

  tabActive: css`
    background: ${colors.whiteA8};
    color: ${colors.primary};
  `,

  tabClose: css`
    background: none;
    border: none;
    color: ${colors.textDim};
    font-size: 10px;
    cursor: pointer;
    padding: 0 2px;
    line-height: 1;
    &:hover { color: ${colors.danger}; }
  `,

  terminalBody: css`
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    animation: ${anim.fadeInFast} 0.2s ease;
  `,

  milestoneTrack: css`
    display: flex;
    gap: 4px;
    padding: 6px 12px;
    overflow-x: auto;
    flex-shrink: 0;
    border-bottom: 1px solid ${colors.border};
    ${thinScrollbar}
  `,

  milestonePill: css`
    display: inline-block;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 10px;
    font-family: ${fonts.mono};
    color: ${colors.primaryDim};
    background: ${colors.primaryMuted};
    border: 1px solid ${colors.primaryBorder};
    white-space: nowrap;
    flex-shrink: 0;
    animation: ${anim.slideInRight} 0.2s ease;
  `,

  terminalOutput: css`
    flex: 1;
    overflow-y: auto;
    padding: 12px 14px;
    font-family: ${fonts.mono};
    font-size: 12px;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.7);
    white-space: pre-wrap;
    word-break: break-word;
    position: relative;
    ${thinScrollbar}
  `,

  scanLine: css`
    position: absolute;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, ${colors.primaryGlow}, transparent);
    pointer-events: none;
    animation: ${scanLineMove} 8s linear infinite;
    opacity: 0.3;
  `,

  terminalInputRow: css`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-top: 1px solid ${colors.border};
    flex-shrink: 0;
  `,

  promptChar: css`
    font-family: ${fonts.mono};
    font-size: 13px;
    color: ${colors.primary};
    font-weight: 700;
    flex-shrink: 0;
  `,

  terminalInput: css`
    flex: 1;
    padding: 5px 10px;
    font-size: 12px;
    font-family: ${fonts.mono};
    background: rgba(255, 255, 255, 0.03);
  `,

  terminalEmpty: css`
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${colors.textDim};
    font-size: 12px;
  `,
};

export { ProjectDetailPanel };
export default ProjectDetailPanel;
