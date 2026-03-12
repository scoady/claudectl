import React, { useEffect, useState, useCallback, useRef } from 'react';
import { css, keyframes } from '@emotion/css';
import {
  colors, fonts, anim, glassCard, neonText, glassmorphism,
  thinScrollbar, statusColor, shortModel, formatDuration,
  compactBadge, statusBadge,
} from '../styles/theme';
import { api, API_BASE } from '../services/api';
import { agentWS } from '../services/websocket';
import type { Agent } from '../types';

// ── Types ───────────────────────────────────────────────────────────────────

interface SessionMessages {
  session_id: string;
  messages: Array<{
    role: string;
    content: string;
    timestamp?: string;
    tool_name?: string;
    tool_use_id?: string;
  }>;
}

// ── Animations ──────────────────────────────────────────────────────────────

const traceBarFill = keyframes`
  from { width: 0; }
  to { width: var(--bar-width, 100%); }
`;

const scanPulse = keyframes`
  0% { opacity: 0.3; }
  50% { opacity: 0.8; }
  100% { opacity: 0.3; }
`;

// ── Component ───────────────────────────────────────────────────────────────

const ObservabilityPanel: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [sessionMessages, setSessionMessages] = useState<SessionMessages | null>(null);
  const [loading, setLoading] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);

  // Fetch agents
  const fetchAgents = useCallback(async () => {
    const list = await api.agents.listSafe();
    if (list) {
      // Sort: active first, then by start time (newest first)
      const sorted = [...list].sort((a, b) => {
        const statusOrder: Record<string, number> = { active: 0, working: 0, idle: 1, done: 2, error: 3 };
        const diff = (statusOrder[a.status] ?? 4) - (statusOrder[b.status] ?? 4);
        if (diff !== 0) return diff;
        return (b.started_at || '').localeCompare(a.started_at || '');
      });
      setAgents(sorted);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    const interval = setInterval(fetchAgents, 5000);
    const unsub1 = agentWS.on('agent_spawned', fetchAgents);
    const unsub2 = agentWS.on('agent_done', fetchAgents);
    const unsub3 = agentWS.on('agent_update', fetchAgents);
    return () => {
      clearInterval(interval);
      unsub1(); unsub2(); unsub3();
    };
  }, [fetchAgents]);

  // Fetch session detail when selected
  useEffect(() => {
    if (!selectedSession) {
      setSessionMessages(null);
      return;
    }
    setLoading(true);
    fetch(`${API_BASE}/api/agents/${encodeURIComponent(selectedSession)}/messages`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) setSessionMessages({ session_id: selectedSession, messages: data });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedSession]);

  // Expose selection globally for scene variable sync
  useEffect(() => {
    (window as any).__c9s_selectSession = (sid: string) => setSelectedSession(sid);
    return () => { delete (window as any).__c9s_selectSession; };
  }, []);

  const selectedAgent = agents.find(a => a.session_id === selectedSession);

  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Observability</h1>
        <div className={styles.headerStats}>
          <span className={styles.statChip}>
            <span className={styles.scanDot} /> {agents.filter(a => a.status === 'active' || a.status === 'working').length} active
          </span>
          <span className={styles.statChip}>
            {agents.length} total sessions
          </span>
        </div>
      </div>

      <div className={styles.splitPane}>
        {/* Left: Session List */}
        <div className={styles.sessionList}>
          <div className={styles.listHeader}>
            <span className={styles.listTitle}>Agent Sessions</span>
          </div>
          <div className={styles.listScroll}>
            {agents.map((agent, i) => (
              <div
                key={agent.session_id}
                className={`${styles.sessionCard} ${agent.session_id === selectedSession ? styles.sessionCardActive : ''}`}
                style={{ animationDelay: `${i * 30}ms` }}
                onClick={() => setSelectedSession(agent.session_id)}
              >
                <div className={styles.sessionCardHeader}>
                  <span className={statusBadge(statusColor(agent.status))}>{agent.status}</span>
                  <span className={styles.sessionModel}>{shortModel(agent.model)}</span>
                </div>
                <div className={styles.sessionProject}>{agent.project_name}</div>
                <div className={styles.sessionTask}>
                  {agent.task ? (agent.task.length > 80 ? agent.task.slice(0, 80) + '...' : agent.task) : 'No task'}
                </div>
                <div className={styles.sessionMeta}>
                  <span>{agent.turn_count} turns</span>
                  <span>{formatDuration(agent.started_at)}</span>
                </div>
              </div>
            ))}
            {agents.length === 0 && (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>&#9672;</div>
                <p>No agent sessions</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Session Detail */}
        <div className={styles.detailPane} ref={detailRef}>
          {!selectedSession ? (
            <div className={styles.emptyDetail}>
              <div className={styles.emptyDetailIcon}>&#9733;</div>
              <h2 className={styles.emptyDetailTitle}>Select a Session</h2>
              <p className={styles.emptyDetailText}>
                Choose an agent session to view its trace, logs, and metrics
              </p>
            </div>
          ) : (
            <>
              {/* Session header */}
              <div className={styles.detailHeader}>
                <div className={styles.detailHeaderTop}>
                  <h2 className={styles.detailTitle}>
                    Session Trace
                  </h2>
                  <span className={styles.sessionId}>{selectedSession.slice(0, 12)}...</span>
                </div>
                {selectedAgent && (
                  <div className={styles.detailMeta}>
                    <span className={compactBadge}>
                      <span className={css`width: 6px; height: 6px; border-radius: 50%; background: ${statusColor(selectedAgent.status)};`} />
                      {selectedAgent.status}
                    </span>
                    <span className={compactBadge}>{shortModel(selectedAgent.model)}</span>
                    <span className={compactBadge}>{selectedAgent.project_name}</span>
                    <span className={compactBadge}>{selectedAgent.turn_count} turns</span>
                    <span className={compactBadge}>{formatDuration(selectedAgent.started_at)}</span>
                  </div>
                )}
              </div>

              {/* Milestones as trace waterfall */}
              {selectedAgent?.milestones && selectedAgent.milestones.length > 0 && (
                <div className={styles.traceSection}>
                  <h3 className={styles.sectionTitle}>
                    <span className={styles.sectionIcon}>&#9674;</span>
                    Tool Call Trace
                  </h3>
                  <div className={styles.traceWaterfall}>
                    {selectedAgent.milestones.map((milestone, idx) => {
                      const barWidth = Math.max(15, Math.min(95, 30 + Math.random() * 60));
                      const offset = Math.max(0, Math.min(70, idx * 3));
                      return (
                        <div key={idx} className={styles.traceRow} style={{ animationDelay: `${idx * 50}ms` }}>
                          <div className={styles.traceLabel}>
                            <span className={styles.traceIndex}>{idx + 1}</span>
                            <span className={styles.traceName}>{milestone}</span>
                          </div>
                          <div className={styles.traceBarTrack}>
                            <div
                              className={styles.traceBar}
                              style={{
                                '--bar-width': `${barWidth}%`,
                                marginLeft: `${offset}%`,
                                animationDelay: `${idx * 80}ms`,
                              } as React.CSSProperties}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Structured logs from messages */}
              <div className={styles.traceSection}>
                <h3 className={styles.sectionTitle}>
                  <span className={styles.sectionIcon}>&#9776;</span>
                  Agent Output
                </h3>
                {loading ? (
                  <div className={styles.loadingBar}>
                    <div className={styles.loadingFill} />
                  </div>
                ) : sessionMessages?.messages && sessionMessages.messages.length > 0 ? (
                  <div className={styles.logStream}>
                    {sessionMessages.messages.slice(-50).map((msg, idx) => {
                      const role = msg.role || (msg.type === 'tool_use' ? 'tool' : 'assistant');
                      const text = typeof msg.content === 'string'
                        ? msg.content
                        : msg.type === 'tool_use'
                          ? `${msg.tool_name || 'tool'}: ${JSON.stringify(msg.tool_input || {}).slice(0, 150)}`
                          : JSON.stringify(msg.content ?? '').slice(0, 200);
                      return (
                        <div key={idx} className={styles.logEntry}>
                          <span className={styles.logRole} data-role={role}>
                            {role === 'assistant' ? 'AI' : role === 'tool' ? 'TOOL' : role === 'user' ? 'USR' : 'SYS'}
                          </span>
                          <span className={styles.logContent}>
                            {text.length > 200 ? text.slice(0, 200) + '...' : text}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className={styles.noLogs}>No output captured yet</div>
                )}
              </div>

              {/* OTel integration hint */}
              <div className={styles.traceSection}>
                <h3 className={styles.sectionTitle}>
                  <span className={styles.sectionIcon}>&#9881;</span>
                  OpenTelemetry
                </h3>
                <div className={styles.otelHint}>
                  <div className={styles.otelRow}>
                    <span className={styles.otelLabel}>Traces</span>
                    <span className={styles.otelValue}>
                      Tempo: <code>{`{.session.id = "${selectedSession?.slice(0, 12)}..."}`}</code>
                    </span>
                  </div>
                  <div className={styles.otelRow}>
                    <span className={styles.otelLabel}>Logs</span>
                    <span className={styles.otelValue}>
                      Loki: <code>{`{service_name="claudectl"} | json | session_id="${selectedSession?.slice(0, 12)}..."`}</code>
                    </span>
                  </div>
                  <div className={styles.otelRow}>
                    <span className={styles.otelLabel}>Metrics</span>
                    <span className={styles.otelValue}>
                      Prometheus: <code>claudectl_task_duration_seconds</code>, <code>claudectl_agents_active</code>
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Styles ──────────────────────────────────────────────────────────────────

const loadingSlide = keyframes`
  from { transform: translateX(-100%); }
  to { transform: translateX(300%); }
`;

const styles = {
  root: css`
    height: 100%;
    display: flex;
    flex-direction: column;
    background: ${colors.bg};
    font-family: ${fonts.system};
    color: ${colors.text};
  `,

  header: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid ${colors.border};
  `,

  title: css`
    ${neonText}
    font-size: 20px;
    font-weight: 700;
    margin: 0;
    letter-spacing: 1px;
    text-transform: uppercase;
  `,

  headerStats: css`
    display: flex;
    gap: 16px;
    align-items: center;
  `,

  statChip: css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: ${colors.textMuted};
    font-family: ${fonts.mono};
  `,

  scanDot: css`
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${colors.primary};
    animation: ${scanPulse} 1.5s ease-in-out infinite;
  `,

  splitPane: css`
    flex: 1;
    display: flex;
    min-height: 0;
    overflow: hidden;
  `,

  // ── Session List (left pane) ──────────────────────────────────────────────

  sessionList: css`
    width: 340px;
    min-width: 280px;
    border-right: 1px solid ${colors.border};
    display: flex;
    flex-direction: column;
    background: ${colors.whiteA2};
  `,

  listHeader: css`
    padding: 12px 16px;
    border-bottom: 1px solid ${colors.border};
    display: flex;
    align-items: center;
    justify-content: space-between;
  `,

  listTitle: css`
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: ${colors.textMuted};
  `,

  listScroll: css`
    flex: 1;
    overflow-y: auto;
    padding: 8px;
    ${thinScrollbar}
  `,

  sessionCard: css`
    ${glassCard}
    padding: 12px;
    margin-bottom: 6px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 6px;
    animation: ${anim.fadeIn} 0.3s ease both;

    &:hover {
      border-color: ${colors.primaryBorder};
      background: ${colors.whiteA5};
    }
  `,

  sessionCardActive: css`
    border-color: ${colors.primary} !important;
    background: ${colors.primaryMuted} !important;
    box-shadow: 0 0 12px ${colors.primaryGlow}, inset 0 0 12px rgba(0, 255, 204, 0.03);
  `,

  sessionCardHeader: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  `,

  sessionModel: css`
    font-size: 11px;
    font-family: ${fonts.mono};
    color: ${colors.textDim};
  `,

  sessionProject: css`
    font-size: 13px;
    font-weight: 600;
    color: ${colors.textBright};
  `,

  sessionTask: css`
    font-size: 11px;
    color: ${colors.textMuted};
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  `,

  sessionMeta: css`
    display: flex;
    gap: 12px;
    font-size: 10px;
    font-family: ${fonts.mono};
    color: ${colors.textDim};
  `,

  emptyState: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 200px;
    color: ${colors.textDim};
    gap: 8px;
  `,

  emptyIcon: css`
    font-size: 32px;
    opacity: 0.3;
  `,

  // ── Detail Pane (right) ───────────────────────────────────────────────────

  detailPane: css`
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    ${thinScrollbar}
  `,

  emptyDetail: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: ${colors.textDim};
  `,

  emptyDetailIcon: css`
    font-size: 48px;
    opacity: 0.2;
    color: ${colors.primary};
    margin-bottom: 16px;
  `,

  emptyDetailTitle: css`
    font-size: 18px;
    font-weight: 600;
    color: ${colors.textMuted};
    margin: 0 0 8px 0;
  `,

  emptyDetailText: css`
    font-size: 13px;
    color: ${colors.textDim};
    margin: 0;
  `,

  detailHeader: css`
    margin-bottom: 20px;
  `,

  detailHeaderTop: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  `,

  detailTitle: css`
    font-size: 16px;
    font-weight: 700;
    color: ${colors.textWhite};
    margin: 0;
  `,

  sessionId: css`
    font-size: 11px;
    font-family: ${fonts.mono};
    color: ${colors.textDim};
    background: ${colors.whiteA5};
    padding: 3px 8px;
    border-radius: 4px;
  `,

  detailMeta: css`
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  `,

  // ── Trace Waterfall ───────────────────────────────────────────────────────

  traceSection: css`
    ${glassmorphism}
    padding: 16px;
    margin-bottom: 16px;
  `,

  sectionTitle: css`
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: ${colors.primary};
    margin: 0 0 12px 0;
    display: flex;
    align-items: center;
    gap: 8px;
  `,

  sectionIcon: css`
    font-size: 14px;
    opacity: 0.7;
  `,

  traceWaterfall: css`
    display: flex;
    flex-direction: column;
    gap: 4px;
  `,

  traceRow: css`
    display: flex;
    align-items: center;
    gap: 12px;
    height: 28px;
    animation: ${anim.fadeIn} 0.3s ease both;
  `,

  traceLabel: css`
    width: 240px;
    min-width: 240px;
    display: flex;
    align-items: center;
    gap: 8px;
    overflow: hidden;
  `,

  traceIndex: css`
    width: 22px;
    height: 22px;
    border-radius: 4px;
    background: ${colors.whiteA5};
    border: 1px solid ${colors.border};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-family: ${fonts.mono};
    color: ${colors.textDim};
    flex-shrink: 0;
  `,

  traceName: css`
    font-size: 12px;
    font-family: ${fonts.mono};
    color: ${colors.textBright};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,

  traceBarTrack: css`
    flex: 1;
    height: 20px;
    background: ${colors.whiteA2};
    border-radius: 3px;
    overflow: hidden;
    position: relative;
  `,

  traceBar: css`
    height: 100%;
    border-radius: 3px;
    background: linear-gradient(90deg,
      rgba(0, 255, 204, 0.5),
      rgba(0, 255, 204, 0.25)
    );
    box-shadow: 0 0 8px rgba(0, 255, 204, 0.2);
    animation: ${traceBarFill} 0.6s ease both;

    &:hover {
      background: linear-gradient(90deg,
        rgba(0, 255, 204, 0.7),
        rgba(0, 255, 204, 0.4)
      );
    }
  `,

  // ── Log Stream ────────────────────────────────────────────────────────────

  logStream: css`
    max-height: 300px;
    overflow-y: auto;
    ${thinScrollbar}
    display: flex;
    flex-direction: column;
    gap: 2px;
    background: #0a0e14;
    border-radius: 6px;
    padding: 8px;
  `,

  logEntry: css`
    display: flex;
    gap: 8px;
    padding: 3px 6px;
    border-radius: 3px;
    font-size: 11px;
    line-height: 1.5;
    font-family: ${fonts.mono};

    &:hover {
      background: ${colors.whiteA4};
    }
  `,

  logRole: css`
    flex-shrink: 0;
    width: 28px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;

    &[data-role="assistant"] { color: ${colors.primary}; }
    &[data-role="user"]      { color: ${colors.purple}; }
    &[data-role="system"]    { color: ${colors.warning}; }
  `,

  logContent: css`
    color: ${colors.textMuted};
    word-break: break-word;
  `,

  noLogs: css`
    padding: 20px;
    text-align: center;
    color: ${colors.textDim};
    font-size: 12px;
  `,

  loadingBar: css`
    height: 2px;
    background: ${colors.whiteA5};
    border-radius: 1px;
    overflow: hidden;
    margin: 12px 0;
  `,

  loadingFill: css`
    width: 30%;
    height: 100%;
    background: ${colors.primary};
    animation: ${loadingSlide} 1.2s ease-in-out infinite;
  `,

  // ── OTel Integration ──────────────────────────────────────────────────────

  otelHint: css`
    display: flex;
    flex-direction: column;
    gap: 8px;
  `,

  otelRow: css`
    display: flex;
    align-items: baseline;
    gap: 12px;
  `,

  otelLabel: css`
    width: 60px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    color: ${colors.textDim};
    flex-shrink: 0;
  `,

  otelValue: css`
    font-size: 11px;
    color: ${colors.textMuted};
    font-family: ${fonts.mono};
    line-height: 1.4;

    code {
      background: ${colors.whiteA5};
      padding: 1px 5px;
      border-radius: 3px;
      color: ${colors.primary};
      font-size: 10px;
    }
  `,
};

export { ObservabilityPanel };
export default ObservabilityPanel;
