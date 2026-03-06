import React from 'react';
import { AbsoluteFill, useCurrentFrame, spring, useVideoConfig } from 'remotion';

export interface MiniSparklineProps {
  data: number[];
  color: string;
  fillOpacity?: number;
}

export const MiniSparkline: React.FC<MiniSparklineProps> = ({ data, color, fillOpacity = 0.15 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const drawProgress = spring({ frame, fps, config: { damping: 80, stiffness: 30, mass: 1 } });
  const chartData = data.length > 0 ? data : Array.from({ length: 20 }, (_, i) => Math.max(0, 3 + Math.sin(i * 0.5) * 2 + Math.random()));
  const max = Math.max(...chartData, 1) * 1.1;
  const w = 200, h = 60, padding = 2;

  const points = chartData.map((v, i) => ({
    x: padding + (i / Math.max(chartData.length - 1, 1)) * (w - padding * 2),
    y: h - padding - (v / max) * (h - padding * 2),
  }));

  let linePath = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1], curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    linePath += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${h} L ${points[0].x} ${h} Z`;
  const lastPoint = points[points.length - 1];
  const pulse = Math.sin(frame * 0.1) * 0.3 + 0.7;

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: '100%' }}>
        <defs>
          <linearGradient id={`spark-grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
          <clipPath id="sparkClip"><rect x={0} y={0} width={w * drawProgress} height={h} /></clipPath>
          <filter id="sparkGlow"><feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" /><feComposite in="SourceGraphic" in2="blur" operator="over" /></filter>
        </defs>
        <g clipPath="url(#sparkClip)">
          <path d={areaPath} fill={`url(#spark-grad-${color.replace('#', '')})`} />
          <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" filter="url(#sparkGlow)" />
        </g>
        {drawProgress > 0.9 && (
          <>
            <circle cx={lastPoint.x} cy={lastPoint.y} r={6} fill={color} opacity={0.2 * pulse} />
            <circle cx={lastPoint.x} cy={lastPoint.y} r={2.5} fill={color} />
            <circle cx={lastPoint.x} cy={lastPoint.y} r={1.5} fill="#ffffff" opacity={0.6} />
          </>
        )}
      </svg>
    </AbsoluteFill>
  );
};
