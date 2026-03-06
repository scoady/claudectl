import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from 'remotion';
import { colors, hexToRgb } from '../lib/theme';
import { getMockHeatmap } from '../lib/api';

const PROJECTS = [
  'claude-manager',
  'kind-infra',
  'helm-platform',
  'claudectl',
  'agent-reports',
  'web-scraper',
  'ml-pipeline',
  'api-gateway',
];

const HOURS = 24;

// Heat color interpolation: cold (muted blue) -> warm (amber) -> hot (rose)
function heatColor(value: number, maxVal: number): string {
  const t = Math.min(1, value / maxVal);
  if (t < 0.01) return colors.surface0;
  if (t < 0.33) {
    const s = t / 0.33;
    return lerpColor(colors.cyanMuted, colors.cyan, s);
  }
  if (t < 0.66) {
    const s = (t - 0.33) / 0.33;
    return lerpColor(colors.cyan, colors.amber, s);
  }
  const s = (t - 0.66) / 0.34;
  return lerpColor(colors.amber, colors.rose, s);
}

function lerpColor(a: string, b: string, t: number): string {
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bv = Math.round(ab + (bb - ab) * t);
  return `rgb(${r}, ${g}, ${bv})`;
}

export const ProjectHeatmap: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const heatData = useMemo(() => getMockHeatmap(PROJECTS, HOURS), []);
  const maxVal = useMemo(
    () => Math.max(...heatData.flat()),
    [heatData]
  );

  // Grid dimensions
  const gridLeft = 160;
  const gridTop = 70;
  const gridRight = 1880;
  const gridBottom = 540;
  const cellWidth = (gridRight - gridLeft) / HOURS;
  const cellHeight = (gridBottom - gridTop) / PROJECTS.length;
  const cellPadding = 2;

  // Entrance animation
  const entrance = spring({
    frame,
    fps,
    config: { damping: 80, stiffness: 30, mass: 1 },
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a1a' }}>
      {/* Background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at 50% 50%, rgba(103, 232, 249, 0.03) 0%, transparent 60%)',
        }}
      />

      <svg width="1920" height="600" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          {/* Shimmer filter for hot cells */}
          <filter id="heatShimmer" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Grid cells */}
        {heatData.map((row, ri) =>
          row.map((value, ci) => {
            // Staggered reveal: top-left to bottom-right
            const delay = ri * 2 + ci * 0.8;
            const cellSpring = spring({
              frame: frame - delay,
              fps,
              config: { damping: 40, stiffness: 100, mass: 0.3 },
            });

            const x = gridLeft + ci * cellWidth + cellPadding;
            const y = gridTop + ri * cellHeight + cellPadding;
            const w = cellWidth - cellPadding * 2;
            const h = cellHeight - cellPadding * 2;

            const color = heatColor(value, maxVal);
            const intensity = value / maxVal;

            // Heat shimmer for active cells
            const isHot = intensity > 0.6;
            const shimmer = isHot
              ? Math.sin(frame * 0.05 + ri * 3 + ci * 7) * 0.15 + 0.85
              : 1;

            return (
              <g key={`cell-${ri}-${ci}`}>
                {/* Cell background */}
                <rect
                  x={x}
                  y={y}
                  width={w * cellSpring}
                  height={h * cellSpring}
                  rx={3}
                  fill={color}
                  opacity={cellSpring * shimmer * (0.4 + intensity * 0.6)}
                  filter={isHot ? 'url(#heatShimmer)' : undefined}
                />

                {/* Hot cell glow overlay */}
                {isHot && cellSpring > 0.5 && (
                  <rect
                    x={x}
                    y={y}
                    width={w * cellSpring}
                    height={h * cellSpring}
                    rx={3}
                    fill={color}
                    opacity={0.2 * (Math.sin(frame * 0.08 + ci) * 0.5 + 0.5)}
                  />
                )}

                {/* Cell border */}
                <rect
                  x={x}
                  y={y}
                  width={w * cellSpring}
                  height={h * cellSpring}
                  rx={3}
                  fill="none"
                  stroke={colors.surface1}
                  strokeWidth={0.5}
                  opacity={0.3 * cellSpring}
                />
              </g>
            );
          })
        )}

        {/* Row labels (project names) */}
        {PROJECTS.map((project, i) => {
          const labelOpacity = spring({
            frame: frame - i * 3,
            fps,
            config: { damping: 50, stiffness: 60, mass: 0.5 },
          });

          return (
            <text
              key={`row-${i}`}
              x={gridLeft - 12}
              y={gridTop + i * cellHeight + cellHeight / 2 + 4}
              textAnchor="end"
              fill={colors.textDim}
              fontSize={11}
              fontFamily="'JetBrains Mono', monospace"
              opacity={labelOpacity * 0.7}
            >
              {project}
            </text>
          );
        })}

        {/* Column labels (hours) */}
        {Array.from({ length: HOURS }, (_, i) => {
          if (i % 3 !== 0) return null;
          const labelOpacity = spring({
            frame: frame - 10 - i,
            fps,
            config: { damping: 40, stiffness: 80, mass: 0.3 },
          });

          return (
            <text
              key={`col-${i}`}
              x={gridLeft + i * cellWidth + cellWidth / 2}
              y={gridBottom + 20}
              textAnchor="middle"
              fill={colors.textMuted}
              fontSize={10}
              fontFamily="'JetBrains Mono', monospace"
              opacity={labelOpacity * 0.6}
            >
              {`${i.toString().padStart(2, '0')}:00`}
            </text>
          );
        })}
      </svg>

      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          left: 40,
          opacity: interpolate(frame, [0, 20], [0, 0.8], { extrapolateRight: 'clamp' }),
        }}
      >
        <span
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 13,
            fontWeight: 600,
            color: colors.amber,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}
        >
          PROJECT ACTIVITY HEATMAP
        </span>
      </div>

      {/* Color scale legend */}
      <div
        style={{
          position: 'absolute',
          top: 18,
          right: 60,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          opacity: interpolate(frame, [15, 35], [0, 0.7], { extrapolateRight: 'clamp' }),
        }}
      >
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            color: colors.textMuted,
          }}
        >
          LOW
        </span>
        <div
          style={{
            width: 120,
            height: 10,
            borderRadius: 5,
            background: `linear-gradient(90deg, ${colors.cyanMuted}, ${colors.cyan}, ${colors.amber}, ${colors.rose})`,
          }}
        />
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9,
            color: colors.textMuted,
          }}
        >
          HIGH
        </span>
      </div>
    </AbsoluteFill>
  );
};
