import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useTheme2 } from '@grafana/ui';
import { GrafanaTheme2 } from '@grafana/data';
import { css, cx } from '@emotion/css';

// --- Types ---

interface HeatmapCell {
  hour: number;       // 0-23
  project: string;
  count: number;
}

interface AgentHeatmapProps {
  /** Raw data: array of { timestamp, project, agent_count } records */
  data: Array<{
    timestamp: string;
    project: string;
    agent_count: number;
  }>;
  /** Number of hours to show on X axis (default: 24) */
  hours?: number;
  /** Maximum expected agent count for color scaling (auto-detected if omitted) */
  maxCount?: number;
  /** Cell size in pixels (default: 36) */
  cellSize?: number;
  /** Called when a cell is clicked */
  onCellClick?: (project: string, hour: number, count: number) => void;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  project: string;
  hour: number;
  count: number;
}

// --- Color Interpolation ---

function interpolateColor(ratio: number, theme: GrafanaTheme2): string {
  // Cool-to-hot gradient: dark blue -> cyan -> green -> yellow -> orange -> red
  const stops = [
    { r: 13, g: 22, b: 56 },    // deep space blue (0)
    { r: 20, g: 80, b: 140 },   // dark blue (0.15)
    { r: 30, g: 170, b: 200 },  // cyan (0.3)
    { r: 50, g: 200, b: 100 },  // green (0.5)
    { r: 255, g: 210, b: 50 },  // yellow (0.7)
    { r: 255, g: 130, b: 30 },  // orange (0.85)
    { r: 220, g: 40, b: 40 },   // red (1.0)
  ];

  const positions = [0, 0.15, 0.3, 0.5, 0.7, 0.85, 1.0];

  if (ratio <= 0) {
    return theme.isDark
      ? `rgba(${stops[0].r}, ${stops[0].g}, ${stops[0].b}, 0.4)`
      : `rgba(200, 210, 230, 0.5)`;
  }

  const clamped = Math.min(1, Math.max(0, ratio));

  let i = 0;
  for (; i < positions.length - 1; i++) {
    if (clamped <= positions[i + 1]) break;
  }

  const segStart = positions[i];
  const segEnd = positions[i + 1];
  const t = (clamped - segStart) / (segEnd - segStart);

  const from = stops[i];
  const to = stops[i + 1];

  const r = Math.round(from.r + (to.r - from.r) * t);
  const g = Math.round(from.g + (to.g - from.g) * t);
  const b = Math.round(from.b + (to.b - from.b) * t);

  return `rgb(${r}, ${g}, ${b})`;
}

// --- Data Processing ---

function processData(
  rawData: AgentHeatmapProps['data'],
  hoursCount: number
): { cells: Map<string, HeatmapCell[]>; projects: string[]; maxValue: number } {
  const now = new Date();
  const cellMap = new Map<string, Map<number, number>>();

  for (const record of rawData) {
    const ts = new Date(record.timestamp);
    const hoursAgo = Math.floor((now.getTime() - ts.getTime()) / (1000 * 60 * 60));

    if (hoursAgo >= hoursCount || hoursAgo < 0) continue;

    const hourSlot = hoursCount - 1 - hoursAgo; // 0 = oldest, hoursCount-1 = newest
    const project = record.project;

    if (!cellMap.has(project)) {
      cellMap.set(project, new Map());
    }

    const projectMap = cellMap.get(project)!;
    const current = projectMap.get(hourSlot) || 0;
    projectMap.set(hourSlot, Math.max(current, record.agent_count));
  }

  const projects = Array.from(cellMap.keys()).sort();
  let maxValue = 0;

  const cells = new Map<string, HeatmapCell[]>();
  for (const project of projects) {
    const projectCells: HeatmapCell[] = [];
    const projectMap = cellMap.get(project)!;

    for (let h = 0; h < hoursCount; h++) {
      const count = projectMap.get(h) || 0;
      maxValue = Math.max(maxValue, count);
      projectCells.push({ hour: h, project, count });
    }

    cells.set(project, projectCells);
  }

  return { cells, projects, maxValue: maxValue || 1 };
}

// --- Hour Labels ---

function getHourLabel(hourSlot: number, hoursCount: number): string {
  const now = new Date();
  const targetHour = new Date(now.getTime() - (hoursCount - 1 - hourSlot) * 60 * 60 * 1000);
  return targetHour.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// --- Component ---

export const AgentHeatmap: React.FC<AgentHeatmapProps> = ({
  data,
  hours = 24,
  maxCount,
  cellSize = 36,
  onCellClick,
}) => {
  const theme = useTheme2();
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    project: '',
    hour: 0,
    count: 0,
  });

  const { cells, projects, maxValue } = useMemo(() => processData(data, hours), [data, hours]);
  const effectiveMax = maxCount ?? maxValue;

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent, project: string, hour: number, count: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      setTooltip({
        visible: true,
        x: e.clientX - rect.left + 12,
        y: e.clientY - rect.top - 30,
        project,
        hour,
        count,
      });
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip((prev) => ({ ...prev, visible: false }));
  }, []);

  const styles = getStyles(theme, cellSize, hours);

  if (projects.length === 0) {
    return (
      <div className={styles.empty}>
        <span>No agent activity data available</span>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={styles.container}>
      {/* Color scale legend */}
      <div className={styles.legend}>
        <span className={styles.legendLabel}>0</span>
        <div className={styles.legendGradient} />
        <span className={styles.legendLabel}>{effectiveMax}</span>
        <span className={styles.legendTitle}>agents</span>
      </div>

      {/* Grid */}
      <div className={styles.grid}>
        {/* Header row: hour labels */}
        <div className={styles.cornerCell} />
        {Array.from({ length: hours }, (_, h) => (
          <div
            key={`header-${h}`}
            className={styles.hourLabel}
            title={getHourLabel(h, hours)}
          >
            {h % 3 === 0 ? getHourLabel(h, hours) : ''}
          </div>
        ))}

        {/* Data rows */}
        {projects.map((project) => (
          <React.Fragment key={project}>
            <div className={styles.projectLabel} title={project}>
              {project.length > 18 ? project.substring(0, 16) + '...' : project}
            </div>
            {cells.get(project)!.map((cell) => {
              const ratio = cell.count / effectiveMax;
              const bgColor = interpolateColor(ratio, theme);

              return (
                <div
                  key={`${project}-${cell.hour}`}
                  className={cx(styles.cell, cell.count > 0 && styles.cellActive)}
                  style={{ backgroundColor: bgColor }}
                  onMouseEnter={(e) => handleMouseEnter(e, project, cell.hour, cell.count)}
                  onMouseMove={(e) => handleMouseEnter(e, project, cell.hour, cell.count)}
                  onMouseLeave={handleMouseLeave}
                  onClick={() => onCellClick?.(project, cell.hour, cell.count)}
                >
                  {cell.count > 0 && cellSize >= 32 && (
                    <span className={styles.cellText}>{cell.count}</span>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      {/* Tooltip */}
      {tooltip.visible && (
        <div
          className={styles.tooltip}
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className={styles.tooltipTitle}>{tooltip.project}</div>
          <div className={styles.tooltipTime}>{getHourLabel(tooltip.hour, hours)}</div>
          <div className={styles.tooltipCount}>
            <strong>{tooltip.count}</strong> active agent{tooltip.count !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
};

// --- Styles ---

function getStyles(theme: GrafanaTheme2, cellSize: number, hours: number) {
  return {
    container: css`
      position: relative;
      padding: ${theme.spacing(2)};
      overflow: auto;
      width: 100%;
      height: 100%;
    `,

    empty: css`
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: ${theme.colors.text.secondary};
      font-size: ${theme.typography.h5.fontSize};
    `,

    legend: css`
      display: flex;
      align-items: center;
      gap: ${theme.spacing(1)};
      margin-bottom: ${theme.spacing(2)};
      justify-content: flex-end;
    `,

    legendLabel: css`
      font-size: ${theme.typography.bodySmall.fontSize};
      color: ${theme.colors.text.secondary};
    `,

    legendTitle: css`
      font-size: ${theme.typography.bodySmall.fontSize};
      color: ${theme.colors.text.disabled};
      margin-left: ${theme.spacing(0.5)};
    `,

    legendGradient: css`
      width: 120px;
      height: 12px;
      border-radius: ${theme.shape.radius.default};
      background: linear-gradient(
        to right,
        rgb(13, 22, 56),
        rgb(30, 170, 200),
        rgb(50, 200, 100),
        rgb(255, 210, 50),
        rgb(255, 130, 30),
        rgb(220, 40, 40)
      );
    `,

    grid: css`
      display: grid;
      grid-template-columns: 140px repeat(${hours}, ${cellSize}px);
      gap: 2px;
      align-items: center;
    `,

    cornerCell: css`
      /* Empty top-left corner */
    `,

    hourLabel: css`
      font-size: 10px;
      color: ${theme.colors.text.secondary};
      text-align: center;
      padding-bottom: ${theme.spacing(0.5)};
      white-space: nowrap;
      overflow: hidden;
    `,

    projectLabel: css`
      font-size: ${theme.typography.bodySmall.fontSize};
      color: ${theme.colors.text.primary};
      padding-right: ${theme.spacing(1)};
      text-align: right;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-weight: ${theme.typography.fontWeightMedium};
    `,

    cell: css`
      width: ${cellSize}px;
      height: ${cellSize}px;
      border-radius: ${theme.shape.radius.default};
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
      border: 1px solid ${theme.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)'};

      &:hover {
        transform: scale(1.15);
        z-index: 2;
        box-shadow: 0 0 12px rgba(100, 180, 255, 0.4);
      }
    `,

    cellActive: css`
      border-color: ${theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'};
    `,

    cellText: css`
      font-size: 11px;
      font-weight: ${theme.typography.fontWeightBold};
      color: white;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
      pointer-events: none;
    `,

    tooltip: css`
      position: absolute;
      background: ${theme.colors.background.secondary};
      border: 1px solid ${theme.colors.border.medium};
      border-radius: ${theme.shape.radius.default};
      padding: ${theme.spacing(1)} ${theme.spacing(1.5)};
      pointer-events: none;
      z-index: 100;
      box-shadow: ${theme.shadows.z3};
      min-width: 140px;
      transition: opacity 0.1s ease;
    `,

    tooltipTitle: css`
      font-weight: ${theme.typography.fontWeightBold};
      color: ${theme.colors.text.primary};
      margin-bottom: 2px;
    `,

    tooltipTime: css`
      font-size: ${theme.typography.bodySmall.fontSize};
      color: ${theme.colors.text.secondary};
      margin-bottom: 4px;
    `,

    tooltipCount: css`
      font-size: ${theme.typography.body.fontSize};
      color: ${theme.colors.text.primary};
    `,
  };
}

export default AgentHeatmap;
