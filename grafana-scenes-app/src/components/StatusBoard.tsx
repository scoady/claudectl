import React, { useEffect, useState, useRef } from 'react';
import { useTheme2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { css, cx, keyframes } from '@emotion/css';

// --- Types ---

export type HealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown';

export interface ProjectHealth {
  name: string;
  status: HealthStatus;
  activeAgents: number;
  totalAgents: number;
  errorRate: number;
  lastActivity: string;
  taskCompletion: number;
  cost: number;
}

interface StatusBoardProps {
  /** Array of project health data */
  projects: ProjectHealth[];
  /** Polling interval in ms (default: 5000) */
  refreshInterval?: number;
  /** Called when a project card is clicked */
  onProjectClick?: (project: ProjectHealth) => void;
  /** Enable animated transitions (default: true) */
  animated?: boolean;
}

// --- Status Derivation ---

function deriveStatus(project: ProjectHealth): HealthStatus {
  if (project.errorRate > 0.15) return 'critical';
  if (project.errorRate > 0.05 || project.activeAgents >= 10) return 'warning';
  if (project.activeAgents > 0 || project.totalAgents > 0) return 'healthy';
  return 'unknown';
}

function statusConfig(status: HealthStatus, theme: GrafanaTheme2) {
  const configs: Record<HealthStatus, { color: string; bg: string; glow: string; label: string; icon: string }> = {
    healthy: {
      color: theme.visualization.getColorByName('green'),
      bg: theme.isDark ? 'rgba(55, 200, 100, 0.08)' : 'rgba(55, 200, 100, 0.06)',
      glow: 'rgba(55, 200, 100, 0.3)',
      label: 'Healthy',
      icon: '\u25CF', // filled circle
    },
    warning: {
      color: theme.visualization.getColorByName('yellow'),
      bg: theme.isDark ? 'rgba(255, 200, 50, 0.08)' : 'rgba(255, 200, 50, 0.06)',
      glow: 'rgba(255, 200, 50, 0.3)',
      label: 'Warning',
      icon: '\u25B2', // triangle
    },
    critical: {
      color: theme.visualization.getColorByName('red'),
      bg: theme.isDark ? 'rgba(220, 50, 50, 0.08)' : 'rgba(220, 50, 50, 0.06)',
      glow: 'rgba(220, 50, 50, 0.4)',
      label: 'Critical',
      icon: '\u2716', // heavy X
    },
    unknown: {
      color: theme.colors.text.disabled,
      bg: theme.isDark ? 'rgba(120, 120, 140, 0.06)' : 'rgba(120, 120, 140, 0.04)',
      glow: 'rgba(120, 120, 140, 0.15)',
      label: 'Idle',
      icon: '\u25CB', // empty circle
    },
  };
  return configs[status];
}

// --- Time Formatting ---

function timeAgo(isoStr: string): string {
  if (!isoStr) return 'never';
  const diff = Date.now() - new Date(isoStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// --- Component ---

export const StatusBoard: React.FC<StatusBoardProps> = ({
  projects,
  refreshInterval = 5000,
  onProjectClick,
  animated = true,
}) => {
  const theme = useTheme2();
  const [prevStatuses, setPrevStatuses] = useState<Map<string, HealthStatus>>(new Map());
  const [changedCards, setChangedCards] = useState<Set<string>>(new Set());
  const animTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Track status changes for transition animations
  useEffect(() => {
    const newChanges = new Set<string>();

    for (const project of projects) {
      const currentStatus = deriveStatus(project);
      const previousStatus = prevStatuses.get(project.name);

      if (previousStatus && previousStatus !== currentStatus) {
        newChanges.add(project.name);

        // Clear previous timeout
        const existingTimeout = animTimeouts.current.get(project.name);
        if (existingTimeout) clearTimeout(existingTimeout);

        // Remove animation class after duration
        const timeout = setTimeout(() => {
          setChangedCards((prev) => {
            const next = new Set(prev);
            next.delete(project.name);
            return next;
          });
          animTimeouts.current.delete(project.name);
        }, 1200);

        animTimeouts.current.set(project.name, timeout);
      }
    }

    if (newChanges.size > 0) {
      setChangedCards((prev) => new Set([...prev, ...newChanges]));
    }

    const statusMap = new Map<string, HealthStatus>();
    for (const p of projects) {
      statusMap.set(p.name, deriveStatus(p));
    }
    setPrevStatuses(statusMap);

    return () => {
      animTimeouts.current.forEach((t) => clearTimeout(t));
    };
  }, [projects]);

  const styles = getStyles(theme, animated);

  if (projects.length === 0) {
    return (
      <div className={styles.empty}>
        <span>No projects to display</span>
      </div>
    );
  }

  // Sort: critical first, then warning, then healthy, then unknown
  const sortOrder: Record<HealthStatus, number> = { critical: 0, warning: 1, healthy: 2, unknown: 3 };
  const sorted = [...projects].sort((a, b) => {
    const sa = sortOrder[deriveStatus(a)];
    const sb = sortOrder[deriveStatus(b)];
    return sa - sb;
  });

  return (
    <div className={styles.container}>
      <div className={styles.grid}>
        {sorted.map((project, index) => {
          const status = deriveStatus(project);
          const config = statusConfig(status, theme);
          const isChanged = changedCards.has(project.name);

          return (
            <div
              key={project.name}
              className={cx(
                styles.card,
                isChanged && animated && styles.cardTransition
              )}
              style={{
                borderLeftColor: config.color,
                backgroundColor: config.bg,
                animationDelay: animated ? `${index * 60}ms` : '0ms',
                boxShadow: isChanged ? `0 0 20px ${config.glow}` : undefined,
              }}
              onClick={() => onProjectClick?.(project)}
            >
              {/* Status indicator with pulse */}
              <div className={styles.statusRow}>
                <div className={styles.statusIndicator}>
                  <span
                    className={cx(
                      styles.statusDot,
                      status === 'critical' && animated && styles.pulseCritical,
                      status === 'warning' && animated && styles.pulseWarning
                    )}
                    style={{ color: config.color }}
                  >
                    {config.icon}
                  </span>
                  <span className={styles.statusLabel} style={{ color: config.color }}>
                    {config.label}
                  </span>
                </div>
                <span className={styles.lastActivity}>{timeAgo(project.lastActivity)}</span>
              </div>

              {/* Project name */}
              <h3 className={styles.projectName}>{project.name}</h3>

              {/* Metric grid */}
              <div className={styles.metricsGrid}>
                <div className={styles.metric}>
                  <span className={styles.metricValue}>{project.activeAgents}</span>
                  <span className={styles.metricLabel}>Active</span>
                </div>
                <div className={styles.metric}>
                  <span className={styles.metricValue}>{project.totalAgents}</span>
                  <span className={styles.metricLabel}>Total</span>
                </div>
                <div className={styles.metric}>
                  <span className={styles.metricValue}>
                    {(project.taskCompletion * 100).toFixed(0)}%
                  </span>
                  <span className={styles.metricLabel}>Done</span>
                </div>
                <div className={styles.metric}>
                  <span className={styles.metricValue}>${project.cost.toFixed(2)}</span>
                  <span className={styles.metricLabel}>Cost</span>
                </div>
              </div>

              {/* Error rate bar */}
              <div className={styles.errorBarContainer}>
                <div className={styles.errorBarLabel}>
                  <span>Error Rate</span>
                  <span style={{ color: config.color }}>
                    {(project.errorRate * 100).toFixed(1)}%
                  </span>
                </div>
                <div className={styles.errorBarTrack}>
                  <div
                    className={styles.errorBarFill}
                    style={{
                      width: `${Math.min(100, project.errorRate * 100)}%`,
                      backgroundColor: config.color,
                      transition: animated ? 'width 0.6s ease-out' : 'none',
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// --- Keyframe Animations ---

const pulseRed = keyframes`
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.3); }
`;

const pulseYellow = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

const cardFlash = keyframes`
  0% { transform: scale(1); filter: brightness(1); }
  25% { transform: scale(1.02); filter: brightness(1.2); }
  75% { transform: scale(1.01); filter: brightness(1.1); }
  100% { transform: scale(1); filter: brightness(1); }
`;

const slideIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

// --- Styles ---

function getStyles(theme: GrafanaTheme2, animated: boolean) {
  return {
    container: css`
      width: 100%;
      height: 100%;
      overflow: auto;
      padding: ${theme.spacing(2)};
    `,

    empty: css`
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: ${theme.colors.text.secondary};
      font-size: ${theme.typography.h5.fontSize};
    `,

    grid: css`
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
      gap: ${theme.spacing(2)};
    `,

    card: css`
      border-radius: ${theme.shape.radius.default};
      border-left: 4px solid transparent;
      padding: ${theme.spacing(2)};
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.3s ease, background-color 0.4s ease;
      ${animated ? `animation: ${slideIn} 0.4s ease-out both;` : ''}

      &:hover {
        transform: translateY(-2px);
        box-shadow: ${theme.shadows.z3};
      }
    `,

    cardTransition: css`
      animation: ${cardFlash} 1.2s ease-out !important;
    `,

    statusRow: css`
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: ${theme.spacing(1)};
    `,

    statusIndicator: css`
      display: flex;
      align-items: center;
      gap: ${theme.spacing(0.75)};
    `,

    statusDot: css`
      font-size: 14px;
      line-height: 1;
    `,

    pulseCritical: css`
      animation: ${pulseRed} 1.5s ease-in-out infinite;
    `,

    pulseWarning: css`
      animation: ${pulseYellow} 2s ease-in-out infinite;
    `,

    statusLabel: css`
      font-size: ${theme.typography.bodySmall.fontSize};
      font-weight: ${theme.typography.fontWeightMedium};
      text-transform: uppercase;
      letter-spacing: 0.05em;
    `,

    lastActivity: css`
      font-size: ${theme.typography.bodySmall.fontSize};
      color: ${theme.colors.text.disabled};
    `,

    projectName: css`
      font-size: ${theme.typography.h4.fontSize};
      font-weight: ${theme.typography.fontWeightBold};
      color: ${theme.colors.text.primary};
      margin: 0 0 ${theme.spacing(1.5)} 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `,

    metricsGrid: css`
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: ${theme.spacing(1)};
      margin-bottom: ${theme.spacing(1.5)};
    `,

    metric: css`
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    `,

    metricValue: css`
      font-size: ${theme.typography.h5.fontSize};
      font-weight: ${theme.typography.fontWeightBold};
      color: ${theme.colors.text.primary};
      line-height: 1.2;
    `,

    metricLabel: css`
      font-size: 10px;
      color: ${theme.colors.text.secondary};
      text-transform: uppercase;
      letter-spacing: 0.04em;
    `,

    errorBarContainer: css`
      margin-top: ${theme.spacing(0.5)};
    `,

    errorBarLabel: css`
      display: flex;
      justify-content: space-between;
      font-size: ${theme.typography.bodySmall.fontSize};
      color: ${theme.colors.text.secondary};
      margin-bottom: 4px;
    `,

    errorBarTrack: css`
      height: 4px;
      border-radius: 2px;
      background: ${theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'};
      overflow: hidden;
    `,

    errorBarFill: css`
      height: 100%;
      border-radius: 2px;
      min-width: 0;
    `,
  };
}

export default StatusBoard;
