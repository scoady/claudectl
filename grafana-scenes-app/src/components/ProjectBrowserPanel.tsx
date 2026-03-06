import React, { useEffect, useState, useCallback } from 'react';
import { css } from '@emotion/css';
import {
  colors, fonts, anim, glassmorphism, glassCard, neonText,
  inputField, primaryButton, ghostButton, modalBackdrop, thinScrollbar,
  statusDot, formatDuration,
} from '../styles/theme';
import { api } from '../services/api';
import { agentWS } from '../services/websocket';
import type { Project, Agent, Stats, Task } from '../types';

// ── Props ───────────────────────────────────────────────────────────────────

interface ProjectBrowserPanelProps {
  onSelectProject?: (name: string) => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(iso?: string): string {
  if (!iso) return '--';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'just now';
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Component ───────────────────────────────────────────────────────────────

const ProjectBrowserPanel: React.FC<ProjectBrowserPanelProps> = ({ onSelectProject: onSelectProjectProp }) => {
  const onSelectProject = (name: string) => {
    if (onSelectProjectProp) {
      onSelectProjectProp(name);
    } else if ((window as any).__c9s_selectProject) {
      (window as any).__c9s_selectProject(name);
    }
  };

  const [projects, setProjects] = useState<Project[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [taskCounts, setTaskCounts] = useState<Record<string, { done: number; total: number }>>({});
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newModel, setNewModel] = useState('sonnet');
  const [creating, setCreating] = useState(false);

  // ── Data fetching ───────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    const [p, a, s] = await Promise.all([
      api.projects.listSafe(),
      api.agents.listSafe(),
      api.stats.getSafe(),
    ]);
    if (p) setProjects(p);
    if (a) setAgents(a);
    if (s) setStats(s);

    // Fetch task counts for each project
    if (p) {
      const counts: Record<string, { done: number; total: number }> = {};
      await Promise.all(
        p.map(async (proj) => {
          try {
            const tasks = await api.projects.tasks(proj.name);
            const done = tasks.filter((t: Task) => t.status === 'done').length;
            counts[proj.name] = { done, total: tasks.length };
          } catch {
            counts[proj.name] = { done: 0, total: 0 };
          }
        })
      );
      setTaskCounts(counts);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 10000);
    const unsub1 = agentWS.on('agent_spawned', fetchAll);
    const unsub2 = agentWS.on('agent_done', fetchAll);
    return () => {
      clearInterval(interval);
      unsub1();
      unsub2();
    };
  }, [fetchAll]);

  // ── Per-project agent info ──────────────────────────────────────────────

  const agentsByProject = (name: string) => agents.filter(a => a.project_name === name);
  const workingCount = (name: string) => agentsByProject(name).filter(a => a.status === 'working' || a.status === 'active').length;
  const lastActivity = (name: string) => {
    const pa = agentsByProject(name);
    if (!pa.length) return undefined;
    return pa.reduce((latest, a) => {
      if (!a.started_at) return latest;
      if (!latest) return a.started_at;
      return new Date(a.started_at) > new Date(latest) ? a.started_at : latest;
    }, undefined as string | undefined);
  };

  // ── Create project ──────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await fetch('http://localhost:4040/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim(), model: newModel }),
      });
      setShowModal(false);
      setNewName('');
      setNewDesc('');
      setNewModel('sonnet');
      onSelectProject(newName.trim());
    } catch (err) {
      console.error('Failed to create project:', err);
    } finally {
      setCreating(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Projects</h1>
          {stats && (
            <div className={styles.statsRow}>
              <span className={styles.statChip}>
                <span className={styles.statValue}>{stats.total_projects}</span> projects
              </span>
              <span className={styles.statChip}>
                <span className={styles.statValue}>{stats.total_agents}</span> agents
              </span>
              <span className={styles.statChip}>
                <span className={css`color: ${colors.primary};`}>{stats.working_agents}</span> working
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Card Grid */}
      <div className={styles.grid}>
        {projects.map((proj, i) => {
          const count = agentsByProject(proj.name).length;
          const working = workingCount(proj.name);
          const tc = taskCounts[proj.name] || { done: 0, total: 0 };
          const pct = tc.total > 0 ? (tc.done / tc.total) * 100 : 0;
          const activity = lastActivity(proj.name);

          return (
            <div
              key={proj.name}
              className={styles.card}
              style={{ animationDelay: `${i * 60}ms` }}
              onClick={() => onSelectProject(proj.name)}
            >
              <div className={styles.cardHeader}>
                <span className={styles.cardName}>{proj.name}</span>
                {working > 0 && <span className={statusDot(colors.primary, true)} />}
              </div>

              <div className={styles.cardDesc}>
                {proj.description || 'No description'}
              </div>

              <div className={styles.cardMeta}>
                {/* Agent count */}
                <span className={styles.metaChip}>
                  <span className={css`
                    width: 6px; height: 6px; border-radius: 50%;
                    background: ${working > 0 ? colors.primary : colors.textDim};
                    ${working > 0 ? `box-shadow: 0 0 6px ${colors.primaryGlow};` : ''}
                  `} />
                  {count} agent{count !== 1 ? 's' : ''}
                </span>

                {/* Task ratio */}
                {tc.total > 0 && (
                  <span className={styles.metaChip}>
                    {tc.done}/{tc.total} tasks
                  </span>
                )}

                {/* Last activity */}
                {activity && (
                  <span className={styles.metaChip}>
                    {timeAgo(activity)}
                  </span>
                )}
              </div>

              {/* Progress bar */}
              {tc.total > 0 && (
                <div className={styles.progressTrack}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* New Project card */}
        <div
          className={styles.newCard}
          onClick={() => setShowModal(true)}
        >
          <span className={styles.newCardPlus}>+</span>
          <span className={styles.newCardLabel}>New Project</span>
        </div>
      </div>

      {/* New Project Modal */}
      {showModal && (
        <div className={modalBackdrop} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Create Project</h2>

            <label className={styles.label}>Project Name</label>
            <input
              className={`${inputField} ${styles.fullInput}`}
              placeholder="my-project"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              autoFocus
            />

            <label className={styles.label}>Description</label>
            <textarea
              className={`${inputField} ${styles.fullInput} ${styles.textarea}`}
              placeholder="What this project does..."
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              rows={3}
            />

            <label className={styles.label}>Model</label>
            <div className={styles.radioGroup}>
              {(['opus', 'sonnet', 'haiku'] as const).map(m => (
                <label key={m} className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="model"
                    checked={newModel === m}
                    onChange={() => setNewModel(m)}
                    className={styles.radioInput}
                  />
                  <span className={styles.radioText} data-active={newModel === m ? '' : undefined}>
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </span>
                </label>
              ))}
            </div>

            <div className={styles.modalActions}>
              <button className={ghostButton} onClick={() => setShowModal(false)}>Cancel</button>
              <button
                className={primaryButton}
                onClick={handleCreate}
                disabled={!newName.trim() || creating}
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = {
  root: css`
    padding: 24px;
    min-height: 100%;
    background: ${colors.bg};
    font-family: ${fonts.system};
    ${thinScrollbar}
  `,

  header: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
  `,

  headerLeft: css`
    display: flex;
    align-items: baseline;
    gap: 20px;
  `,

  title: css`
    ${neonText}
    font-size: 22px;
    font-weight: 700;
    margin: 0;
    letter-spacing: 1px;
    text-transform: uppercase;
  `,

  statsRow: css`
    display: flex;
    gap: 12px;
  `,

  statChip: css`
    font-size: 12px;
    color: ${colors.textMuted};
    font-family: ${fonts.mono};
  `,

  statValue: css`
    color: ${colors.textBright};
    font-weight: 600;
  `,

  grid: css`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 16px;
  `,

  card: css`
    ${glassCard}
    padding: 18px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 10px;
    animation: ${anim.fadeIn} 0.4s ease both;
    &:hover {
      border-color: ${colors.primaryBorder};
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3), 0 0 1px ${colors.primaryGlow};
    }
  `,

  cardHeader: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  `,

  cardName: css`
    font-size: 15px;
    font-weight: 700;
    color: ${colors.textWhite};
    letter-spacing: 0.3px;
  `,

  cardDesc: css`
    font-size: 12px;
    color: ${colors.textMuted};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.4;
  `,

  cardMeta: css`
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  `,

  metaChip: css`
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: ${colors.textMuted};
    font-family: ${fonts.mono};
  `,

  progressTrack: css`
    height: 2px;
    background: ${colors.whiteA6};
    border-radius: 1px;
    overflow: hidden;
    margin-top: 2px;
  `,

  progressFill: css`
    height: 100%;
    background: linear-gradient(90deg, ${colors.primary}, ${colors.success});
    border-radius: 1px;
    transition: width 0.5s ease;
  `,

  newCard: css`
    ${glassCard}
    padding: 18px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 120px;
    border-style: dashed;
    border-color: ${colors.whiteA10};
    animation: ${anim.fadeIn} 0.4s ease both;
    &:hover {
      border-color: ${colors.primaryBorder};
      background: ${colors.primaryMuted};
    }
  `,

  newCardPlus: css`
    font-size: 28px;
    color: ${colors.textDim};
    font-weight: 300;
    line-height: 1;
  `,

  newCardLabel: css`
    font-size: 13px;
    color: ${colors.textMuted};
    font-weight: 500;
  `,

  modal: css`
    ${glassmorphism}
    padding: 28px;
    width: 420px;
    max-width: 90vw;
    display: flex;
    flex-direction: column;
    gap: 12px;
    animation: ${anim.slideInUp} 0.25s ease;
  `,

  modalTitle: css`
    ${neonText}
    font-size: 18px;
    font-weight: 700;
    margin: 0 0 4px 0;
  `,

  label: css`
    font-size: 12px;
    color: ${colors.textMuted};
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-top: 4px;
  `,

  fullInput: css`
    width: 100%;
    box-sizing: border-box;
  `,

  textarea: css`
    resize: vertical;
    font-family: ${fonts.system};
    min-height: 60px;
  `,

  radioGroup: css`
    display: flex;
    gap: 10px;
  `,

  radioLabel: css`
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
  `,

  radioInput: css`
    display: none;
  `,

  radioText: css`
    padding: 5px 14px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    color: ${colors.textMuted};
    background: ${colors.whiteA5};
    border: 1px solid ${colors.border};
    transition: all 0.2s ease;
    &[data-active] {
      color: ${colors.primary};
      border-color: ${colors.primaryBorder};
      background: ${colors.primaryMuted};
    }
  `,

  modalActions: css`
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 8px;
  `,
};

export { ProjectBrowserPanel };
export default ProjectBrowserPanel;
