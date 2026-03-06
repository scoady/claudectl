import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from 'remotion';
import { colors } from './theme';

export interface TimelineSeriesInput {
  name: string;
  color: string;
  data: number[];
  unit?: string;
}

export interface MetricsTimelineProps {
  series?: TimelineSeriesInput[];
  title?: string;
}

export const MetricsTimeline: React.FC<MetricsTimelineProps> = ({
  series: inputSeries,
  title = 'ACTIVITY TIMELINE',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const series = inputSeries || generateMockSeries();

  const chartLeft = 80;
  const chartRight = 1880;
  const chartTop = 60;
  const chartBottom = 340;
  const chartWidth = chartRight - chartLeft;
  const chartHeight = chartBottom - chartTop;

  const normalizedSeries = useMemo(
    () =>
      series.map((s) => {
        const max = Math.max(...s.data, 1) * 1.2;
        return { ...s, max, normalized: s.data.map((v) => v / max) };
      }),
    [series]
  );

  const drawProgress = spring({
    frame,
    fps,
    config: { damping: 100, stiffness: 20, mass: 1.5 },
  });

  function generatePath(data: number[]): string {
    const points = data.map((val, i) => ({
      x: chartLeft + (i / Math.max(data.length - 1, 1)) * chartWidth,
      y: chartBottom - val * chartHeight,
    }));
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx = (prev.x + curr.x) / 2;
      path += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
    }
    return path;
  }

  function generateArea(data: number[]): string {
    const linePath = generatePath(data);
    const lastX = chartLeft + chartWidth;
    return `${linePath} L ${lastX} ${chartBottom} L ${chartLeft} ${chartBottom} Z`;
  }

  const gridOpacity = interpolate(frame, [0, 20], [0, 0.08], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(26, 10, 46, 0.3) 0%, rgba(10, 10, 26, 0.8) 100%)' }} />
      <svg width="1920" height="400" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          {normalizedSeries.map((s, i) => (
            <linearGradient key={`area-${i}`} id={`mt-area-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
          <filter id="mtLineGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <clipPath id="mtDrawClip">
            <rect x={chartLeft} y={0} width={chartWidth * drawProgress} height={400} />
          </clipPath>
        </defs>

        {Array.from({ length: 6 }, (_, i) => {
          const y = chartTop + (i / 5) * chartHeight;
          return <line key={`hg-${i}`} x1={chartLeft} y1={y} x2={chartRight} y2={y} stroke={colors.cyan} strokeWidth={0.5} opacity={gridOpacity} />;
        })}
        {Array.from({ length: 13 }, (_, i) => {
          const x = chartLeft + (i / 12) * chartWidth;
          return <line key={`vg-${i}`} x1={x} y1={chartTop} x2={x} y2={chartBottom} stroke={colors.cyan} strokeWidth={0.5} opacity={gridOpacity} />;
        })}

        <g clipPath="url(#mtDrawClip)">
          {normalizedSeries.map((s, i) => (
            <path key={`area-${i}`} d={generateArea(s.normalized)} fill={`url(#mt-area-grad-${i})`} opacity={0.6} />
          ))}
        </g>

        <g clipPath="url(#mtDrawClip)" filter="url(#mtLineGlow)">
          {normalizedSeries.map((s, i) => (
            <path key={`line-${i}`} d={generatePath(s.normalized)} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </g>

        {normalizedSeries.map((s, i) => {
          const pointIndex = Math.min(Math.floor(drawProgress * (s.normalized.length - 1)), s.normalized.length - 1);
          const x = chartLeft + (pointIndex / Math.max(s.normalized.length - 1, 1)) * chartWidth;
          const y = chartBottom - s.normalized[pointIndex] * chartHeight;
          const pulse = Math.sin(frame * 0.1 + i * 2) * 0.3 + 0.7;
          if (drawProgress < 0.05) return null;
          return (
            <g key={`point-${i}`}>
              <circle cx={x} cy={y} r={12} fill={s.color} opacity={0.15 * pulse} />
              <circle cx={x} cy={y} r={4} fill={s.color} stroke="#ffffff" strokeWidth={1.5} />
            </g>
          );
        })}

        {Array.from({ length: 7 }, (_, i) => {
          const x = chartLeft + (i / 6) * chartWidth;
          const labelOpacity = interpolate(frame, [10 + i * 3, 25 + i * 3], [0, 0.5], { extrapolateRight: 'clamp' });
          return (
            <text key={`xl-${i}`} x={x} y={chartBottom + 25} textAnchor="middle" fill={colors.textMuted} fontSize={10} fontFamily="'JetBrains Mono', monospace" opacity={labelOpacity}>
              {`${i * 10}m`}
            </text>
          );
        })}
      </svg>

      <div style={{ position: 'absolute', top: 15, right: 60, display: 'flex', gap: 24, opacity: interpolate(frame, [10, 30], [0, 0.9], { extrapolateRight: 'clamp' }) }}>
        {series.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 20, height: 3, borderRadius: 2, backgroundColor: s.color, boxShadow: `0 0 8px ${s.color}` }} />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: colors.textDim }}>{s.name}</span>
          </div>
        ))}
      </div>

      <div style={{ position: 'absolute', top: 15, left: 40, opacity: interpolate(frame, [0, 20], [0, 0.8], { extrapolateRight: 'clamp' }) }}>
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 600, color: colors.cyan, letterSpacing: '0.15em', textTransform: 'uppercase' as const }}>{title}</span>
      </div>
    </AbsoluteFill>
  );
};

function generateMockSeries(): TimelineSeriesInput[] {
  const points = 60;
  const gen = (base: number, freq: number, amp: number) =>
    Array.from({ length: points }, (_, i) => Math.max(0, base + Math.sin(i * freq) * amp + (Math.random() - 0.5) * amp * 0.3));
  return [
    { name: 'Active Agents', color: colors.amber, data: gen(3, 0.2, 2) },
    { name: 'Cost ($/hr)', color: colors.rose, data: gen(0.5, 0.15, 0.3) },
    { name: 'Tasks/min', color: colors.cyan, data: gen(2, 0.1, 1.5) },
  ];
}
