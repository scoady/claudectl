import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from 'remotion';
import { colors, hexToRgb } from '../lib/theme';
import { getMockTimeSeries } from '../lib/api';

interface Series {
  name: string;
  color: string;
  data: number[];
  unit?: string;
}

export const MetricsTimeline: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const rawData = useMemo(() => getMockTimeSeries(60), []);

  const series: Series[] = useMemo(
    () => [
      {
        name: 'Active Agents',
        color: colors.amber,
        data: rawData.map((d) => d.active),
        unit: '',
      },
      {
        name: 'Cost ($/hr)',
        color: colors.rose,
        data: rawData.map((d) => d.cost),
        unit: '$',
      },
      {
        name: 'Tasks/min',
        color: colors.cyan,
        data: rawData.map((d) => d.tasks),
        unit: '',
      },
    ],
    [rawData]
  );

  // Chart dimensions
  const chartLeft = 80;
  const chartRight = 1880;
  const chartTop = 60;
  const chartBottom = 340;
  const chartWidth = chartRight - chartLeft;
  const chartHeight = chartBottom - chartTop;

  // Normalize each series to [0, 1]
  const normalizedSeries = useMemo(
    () =>
      series.map((s) => {
        const max = Math.max(...s.data) * 1.2;
        return {
          ...s,
          max,
          normalized: s.data.map((v) => v / max),
        };
      }),
    [series]
  );

  // Animation: line draws left-to-right
  const drawProgress = spring({
    frame,
    fps,
    config: { damping: 100, stiffness: 20, mass: 1.5 },
  });

  // Generate SVG path for a series
  function generatePath(data: number[]): string {
    const points = data.map((val, i) => {
      const x = chartLeft + (i / (data.length - 1)) * chartWidth;
      const y = chartBottom - val * chartHeight;
      return { x, y };
    });

    // Smooth cubic bezier curve through points
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx = (prev.x + curr.x) / 2;
      path += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
    }
    return path;
  }

  // Generate area path (path + close along bottom)
  function generateArea(data: number[]): string {
    const linePath = generatePath(data);
    const lastX = chartLeft + chartWidth;
    return `${linePath} L ${lastX} ${chartBottom} L ${chartLeft} ${chartBottom} Z`;
  }

  // Grid animation
  const gridOpacity = interpolate(frame, [0, 20], [0, 0.08], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a1a' }}>
      {/* Subtle gradient bg */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(26, 10, 46, 0.3) 0%, rgba(10, 10, 26, 1) 100%)',
        }}
      />

      <svg width="1920" height="400" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          {/* Gradient fills for areas */}
          {normalizedSeries.map((s, i) => (
            <linearGradient key={`area-${i}`} id={`area-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}

          {/* Glow filter */}
          <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {/* Clip for draw animation */}
          <clipPath id="drawClip">
            <rect
              x={chartLeft}
              y={0}
              width={chartWidth * drawProgress}
              height={400}
            />
          </clipPath>
        </defs>

        {/* Grid lines */}
        {Array.from({ length: 6 }, (_, i) => {
          const y = chartTop + (i / 5) * chartHeight;
          return (
            <line
              key={`hgrid-${i}`}
              x1={chartLeft}
              y1={y}
              x2={chartRight}
              y2={y}
              stroke={colors.cyan}
              strokeWidth={0.5}
              opacity={gridOpacity}
            />
          );
        })}
        {Array.from({ length: 13 }, (_, i) => {
          const x = chartLeft + (i / 12) * chartWidth;
          return (
            <line
              key={`vgrid-${i}`}
              x1={x}
              y1={chartTop}
              x2={x}
              y2={chartBottom}
              stroke={colors.cyan}
              strokeWidth={0.5}
              opacity={gridOpacity}
            />
          );
        })}

        {/* Area fills */}
        <g clipPath="url(#drawClip)">
          {normalizedSeries.map((s, i) => (
            <path
              key={`area-${i}`}
              d={generateArea(s.normalized)}
              fill={`url(#area-grad-${i})`}
              opacity={0.6}
            />
          ))}
        </g>

        {/* Lines with glow */}
        <g clipPath="url(#drawClip)" filter="url(#lineGlow)">
          {normalizedSeries.map((s, i) => (
            <path
              key={`line-${i}`}
              d={generatePath(s.normalized)}
              fill="none"
              stroke={s.color}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </g>

        {/* Data points at the draw head */}
        {normalizedSeries.map((s, i) => {
          const pointIndex = Math.min(
            Math.floor(drawProgress * (s.normalized.length - 1)),
            s.normalized.length - 1
          );
          const x = chartLeft + (pointIndex / (s.normalized.length - 1)) * chartWidth;
          const y = chartBottom - s.normalized[pointIndex] * chartHeight;
          const pulse = Math.sin(frame * 0.1 + i * 2) * 0.3 + 0.7;

          if (drawProgress < 0.05) return null;

          return (
            <g key={`point-${i}`}>
              <circle
                cx={x}
                cy={y}
                r={12}
                fill={s.color}
                opacity={0.15 * pulse}
              />
              <circle
                cx={x}
                cy={y}
                r={4}
                fill={s.color}
                stroke="#ffffff"
                strokeWidth={1.5}
              />
            </g>
          );
        })}

        {/* Axis labels */}
        {Array.from({ length: 7 }, (_, i) => {
          const x = chartLeft + (i / 6) * chartWidth;
          const labelOpacity = interpolate(
            frame,
            [10 + i * 3, 25 + i * 3],
            [0, 0.5],
            { extrapolateRight: 'clamp' }
          );
          return (
            <text
              key={`xlabel-${i}`}
              x={x}
              y={chartBottom + 25}
              textAnchor="middle"
              fill={colors.textMuted}
              fontSize={10}
              fontFamily="'JetBrains Mono', monospace"
              opacity={labelOpacity}
            >
              {`${i * 10}m`}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div
        style={{
          position: 'absolute',
          top: 15,
          right: 60,
          display: 'flex',
          gap: 24,
          opacity: interpolate(frame, [10, 30], [0, 0.9], { extrapolateRight: 'clamp' }),
        }}
      >
        {series.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 20,
                height: 3,
                borderRadius: 2,
                backgroundColor: s.color,
                boxShadow: `0 0 8px ${s.color}`,
              }}
            />
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                color: colors.textDim,
              }}
            >
              {s.name}
            </span>
          </div>
        ))}
      </div>

      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: 15,
          left: 40,
          opacity: interpolate(frame, [0, 20], [0, 0.8], { extrapolateRight: 'clamp' }),
        }}
      >
        <span
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 13,
            fontWeight: 600,
            color: colors.cyan,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}
        >
          ACTIVITY TIMELINE
        </span>
      </div>
    </AbsoluteFill>
  );
};
