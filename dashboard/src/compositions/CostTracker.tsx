import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { colors } from './theme';

export interface CostSegment {
  model: string;
  cost: number;
  color: string;
}

export interface CostTrackerProps {
  segments?: CostSegment[];
  title?: string;
}

export const CostTracker: React.FC<CostTrackerProps> = ({ segments: inputSegments, title = 'COST BREAKDOWN' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const data = inputSegments || [
    { model: 'Sonnet 4', cost: 12.45, color: colors.cyan },
    { model: 'Opus 4', cost: 34.20, color: colors.purple },
    { model: 'Haiku 3.5', cost: 3.80, color: colors.green },
    { model: 'Sonnet 3.5', cost: 6.15, color: colors.amber },
  ];

  const totalCost = useMemo(() => data.reduce((sum, d) => sum + d.cost, 0), [data]);
  const cx = 400, cy = 380, outerRadius = 200, innerRadius = 140;

  const segments = useMemo(() => {
    let startAngle = -Math.PI / 2;
    return data.map((d) => {
      const angle = (d.cost / totalCost) * Math.PI * 2;
      const seg = { ...d, startAngle, endAngle: startAngle + angle, midAngle: startAngle + angle / 2, percentage: (d.cost / totalCost) * 100 };
      startAngle += angle;
      return seg;
    });
  }, [data, totalCost]);

  const ringProgress = spring({ frame, fps, config: { damping: 60, stiffness: 25, mass: 1.5 } });
  const labelProgress = spring({ frame: frame - 20, fps, config: { damping: 50, stiffness: 40, mass: 1 } });
  const countProgress = interpolate(frame, [15, 60], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const displayTotal = (totalCost * countProgress).toFixed(2);
  const activeIndex = Math.floor((frame * 0.01) % segments.length);

  function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  }

  function describeArc(centerX: number, centerY: number, outerR: number, innerR: number, startAngle: number, endAngle: number): string {
    const os = polarToCartesian(centerX, centerY, outerR, startAngle);
    const oe = polarToCartesian(centerX, centerY, outerR, endAngle);
    const is_ = polarToCartesian(centerX, centerY, innerR, startAngle);
    const ie = polarToCartesian(centerX, centerY, innerR, endAngle);
    const la = endAngle - startAngle > Math.PI ? 1 : 0;
    return `M ${os.x} ${os.y} A ${outerR} ${outerR} 0 ${la} 1 ${oe.x} ${oe.y} L ${ie.x} ${ie.y} A ${innerR} ${innerR} 0 ${la} 0 ${is_.x} ${is_.y} Z`;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: 'transparent' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 45%, rgba(192, 132, 252, 0.06) 0%, transparent 60%)' }} />
      <svg width="800" height="800" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          {segments.map((_, i) => (
            <filter key={`gf-${i}`} id={`ct-segGlow-${i}`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur in="SourceGraphic" stdDeviation={i === activeIndex ? 8 : 3} result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          ))}
          <radialGradient id="ct-centerGlow">
            <stop offset="0%" stopColor={colors.purple} stopOpacity={0.15} />
            <stop offset="100%" stopColor={colors.purple} stopOpacity={0} />
          </radialGradient>
        </defs>
        {[160, 180, 220, 240].map((r, i) => (
          <circle key={`guide-${i}`} cx={cx} cy={cy} r={r} fill="none" stroke={colors.muted} strokeWidth={0.3} opacity={0.2 * interpolate(frame, [5, 25], [0, 1], { extrapolateRight: 'clamp' })} />
        ))}
        <circle cx={cx} cy={cy} r={innerRadius} fill="url(#ct-centerGlow)" />
        {segments.map((seg, i) => {
          const segSpring = spring({ frame: frame - i * 8, fps, config: { damping: 50, stiffness: 60, mass: 0.8 } });
          const animatedEnd = seg.startAngle + (seg.endAngle - seg.startAngle) * segSpring * ringProgress;
          const isActive = i === activeIndex;
          const activeScale = isActive ? 1 + Math.sin(frame * 0.06) * 0.02 : 1;
          const gapAngle = 0.02;
          const adjStart = seg.startAngle + gapAngle;
          const adjEnd = animatedEnd - gapAngle;
          if (adjEnd <= adjStart) return null;
          const path = describeArc(cx, cy, outerRadius * activeScale, innerRadius * activeScale, adjStart, adjEnd);
          return (
            <g key={`seg-${i}`} filter={`url(#ct-segGlow-${i})`}>
              <path d={path} fill={seg.color} opacity={isActive ? 0.95 : 0.75} />
              <path d={path} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
            </g>
          );
        })}
        {(() => {
          const seg = segments[activeIndex];
          if (!seg) return null;
          const pulseR = outerRadius + 10 + Math.sin(frame * 0.08) * 5;
          const gapAngle = 0.02;
          const path = describeArc(cx, cy, pulseR, outerRadius + 2, seg.startAngle + gapAngle, seg.endAngle - gapAngle);
          return <path d={path} fill={seg.color} opacity={0.15 + Math.sin(frame * 0.08) * 0.1} />;
        })()}
        <text x={cx} y={cy - 15} textAnchor="middle" fill={colors.text} fontSize={36} fontFamily="'JetBrains Mono', monospace" fontWeight={700} opacity={labelProgress}>${displayTotal}</text>
        <text x={cx} y={cy + 15} textAnchor="middle" fill={colors.textMuted} fontSize={12} fontFamily="'Inter', sans-serif" letterSpacing="0.15em" opacity={labelProgress * 0.7}>TOTAL COST</text>
        {segments.map((seg, i) => {
          const labelDelay = spring({ frame: frame - 30 - i * 6, fps, config: { damping: 40, stiffness: 50, mass: 0.5 } });
          const labelRadius = outerRadius + 50;
          const pos = polarToCartesian(cx, cy, labelRadius, seg.midAngle);
          const outerPos = polarToCartesian(cx, cy, outerRadius + 8, seg.midAngle);
          const isRight = pos.x > cx;
          return (
            <g key={`label-${i}`} opacity={labelDelay}>
              <line x1={outerPos.x} y1={outerPos.y} x2={pos.x} y2={pos.y} stroke={seg.color} strokeWidth={1} opacity={0.4} />
              <rect x={isRight ? pos.x + 5 : pos.x - 115} y={pos.y - 20} width={110} height={40} rx={6} fill="rgba(30, 30, 46, 0.8)" stroke={seg.color} strokeWidth={0.5} opacity={0.6} />
              <text x={isRight ? pos.x + 15 : pos.x - 105} y={pos.y - 4} fill={seg.color} fontSize={11} fontFamily="'Inter', sans-serif" fontWeight={600}>{seg.model}</text>
              <text x={isRight ? pos.x + 15 : pos.x - 105} y={pos.y + 13} fill={colors.textMuted} fontSize={10} fontFamily="'JetBrains Mono', monospace">${seg.cost.toFixed(2)} ({seg.percentage.toFixed(1)}%)</text>
            </g>
          );
        })}
      </svg>
      <div style={{ position: 'absolute', top: 25, left: 0, width: '100%', textAlign: 'center', opacity: interpolate(frame, [0, 20], [0, 0.8], { extrapolateRight: 'clamp' }) }}>
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 600, color: colors.purple, letterSpacing: '0.2em', textTransform: 'uppercase' as const }}>{title}</span>
      </div>
    </AbsoluteFill>
  );
};
