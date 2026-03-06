import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from 'remotion';
import { colors, hexToRgb } from '../lib/theme';
import { getMockCostBreakdown } from '../lib/api';

export const CostTracker: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const data = useMemo(() => getMockCostBreakdown(), []);
  const totalCost = useMemo(() => data.reduce((sum, d) => sum + d.cost, 0), [data]);

  // Ring geometry
  const cx = 400;
  const cy = 380;
  const outerRadius = 200;
  const innerRadius = 140;
  const ringWidth = outerRadius - innerRadius;

  // Calculate angles for each segment
  const segments = useMemo(() => {
    let startAngle = -Math.PI / 2; // Start from top
    return data.map((d) => {
      const angle = (d.cost / totalCost) * Math.PI * 2;
      const seg = {
        ...d,
        startAngle,
        endAngle: startAngle + angle,
        midAngle: startAngle + angle / 2,
        percentage: (d.cost / totalCost) * 100,
      };
      startAngle += angle;
      return seg;
    });
  }, [data, totalCost]);

  // Animation springs
  const ringProgress = spring({
    frame,
    fps,
    config: { damping: 60, stiffness: 25, mass: 1.5 },
  });

  const labelProgress = spring({
    frame: frame - 20,
    fps,
    config: { damping: 50, stiffness: 40, mass: 1 },
  });

  // Counting animation for center total
  const countProgress = interpolate(frame, [15, 60], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const displayTotal = (totalCost * countProgress).toFixed(2);

  // Active segment (rotates slowly)
  const activeIndex = Math.floor((frame * 0.01) % segments.length);

  // Arc path generator
  function describeArc(
    centerX: number,
    centerY: number,
    outerR: number,
    innerR: number,
    startAngle: number,
    endAngle: number
  ): string {
    const outerStart = polarToCartesian(centerX, centerY, outerR, startAngle);
    const outerEnd = polarToCartesian(centerX, centerY, outerR, endAngle);
    const innerStart = polarToCartesian(centerX, centerY, innerR, startAngle);
    const innerEnd = polarToCartesian(centerX, centerY, innerR, endAngle);

    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

    return [
      `M ${outerStart.x} ${outerStart.y}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
      `L ${innerEnd.x} ${innerEnd.y}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
      'Z',
    ].join(' ');
  }

  function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  }

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a1a' }}>
      {/* Background gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 50% 45%, rgba(192, 132, 252, 0.06) 0%, transparent 60%)',
        }}
      />

      <svg width="800" height="800" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          {/* Glow filters per segment */}
          {segments.map((seg, i) => (
            <filter key={`gf-${i}`} id={`segGlow-${i}`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur in="SourceGraphic" stdDeviation={i === activeIndex ? 8 : 3} result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          ))}

          {/* Radial gradient for inner glow */}
          <radialGradient id="centerGlow">
            <stop offset="0%" stopColor={colors.purple} stopOpacity={0.15} />
            <stop offset="100%" stopColor={colors.purple} stopOpacity={0} />
          </radialGradient>
        </defs>

        {/* Subtle concentric guide rings */}
        {[160, 180, 220, 240].map((r, i) => (
          <circle
            key={`guide-${i}`}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={colors.muted}
            strokeWidth={0.3}
            opacity={0.2 * interpolate(frame, [5, 25], [0, 1], { extrapolateRight: 'clamp' })}
          />
        ))}

        {/* Center glow */}
        <circle cx={cx} cy={cy} r={innerRadius} fill="url(#centerGlow)" />

        {/* Donut segments */}
        {segments.map((seg, i) => {
          // Animate each segment with staggered spring
          const segSpring = spring({
            frame: frame - i * 8,
            fps,
            config: { damping: 50, stiffness: 60, mass: 0.8 },
          });

          const animatedEnd =
            seg.startAngle + (seg.endAngle - seg.startAngle) * segSpring * ringProgress;

          // Active segment gets slight scale
          const isActive = i === activeIndex;
          const activeScale = isActive
            ? 1 + Math.sin(frame * 0.06) * 0.02
            : 1;
          const activeOuterR = outerRadius * activeScale;
          const activeInnerR = innerRadius * activeScale;

          // Gap between segments
          const gapAngle = 0.02;
          const adjStart = seg.startAngle + gapAngle;
          const adjEnd = animatedEnd - gapAngle;

          if (adjEnd <= adjStart) return null;

          const path = describeArc(cx, cy, activeOuterR, activeInnerR, adjStart, adjEnd);

          return (
            <g key={`seg-${i}`} filter={`url(#segGlow-${i})`}>
              <path
                d={path}
                fill={seg.color}
                opacity={isActive ? 0.95 : 0.75}
                style={{
                  transition: 'opacity 0.3s',
                }}
              />
              {/* Inner highlight */}
              <path
                d={path}
                fill="none"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth={1}
              />
            </g>
          );
        })}

        {/* Pulsing glow ring on active segment */}
        {(() => {
          const seg = segments[activeIndex];
          const pulseR = outerRadius + 10 + Math.sin(frame * 0.08) * 5;
          const gapAngle = 0.02;
          const path = describeArc(
            cx, cy,
            pulseR, outerRadius + 2,
            seg.startAngle + gapAngle,
            seg.endAngle - gapAngle
          );
          return (
            <path
              d={path}
              fill={seg.color}
              opacity={0.15 + Math.sin(frame * 0.08) * 0.1}
            />
          );
        })()}

        {/* Center text */}
        <text
          x={cx}
          y={cy - 15}
          textAnchor="middle"
          fill={colors.text}
          fontSize={36}
          fontFamily="'JetBrains Mono', monospace"
          fontWeight={700}
          opacity={labelProgress}
        >
          ${displayTotal}
        </text>
        <text
          x={cx}
          y={cy + 15}
          textAnchor="middle"
          fill={colors.textMuted}
          fontSize={12}
          fontFamily="'Inter', sans-serif"
          letterSpacing="0.15em"
          opacity={labelProgress * 0.7}
        >
          TOTAL COST
        </text>

        {/* Segment labels with connecting lines */}
        {segments.map((seg, i) => {
          const labelDelay = spring({
            frame: frame - 30 - i * 6,
            fps,
            config: { damping: 40, stiffness: 50, mass: 0.5 },
          });

          const labelRadius = outerRadius + 50;
          const pos = polarToCartesian(cx, cy, labelRadius, seg.midAngle);
          const outerPos = polarToCartesian(cx, cy, outerRadius + 8, seg.midAngle);
          const isRight = pos.x > cx;

          return (
            <g key={`label-${i}`} opacity={labelDelay}>
              {/* Connector line */}
              <line
                x1={outerPos.x}
                y1={outerPos.y}
                x2={pos.x}
                y2={pos.y}
                stroke={seg.color}
                strokeWidth={1}
                opacity={0.4}
              />

              {/* Label background */}
              <rect
                x={isRight ? pos.x + 5 : pos.x - 115}
                y={pos.y - 20}
                width={110}
                height={40}
                rx={6}
                fill="rgba(30, 30, 46, 0.8)"
                stroke={seg.color}
                strokeWidth={0.5}
                opacity={0.6}
              />

              {/* Model name */}
              <text
                x={isRight ? pos.x + 15 : pos.x - 105}
                y={pos.y - 4}
                fill={seg.color}
                fontSize={11}
                fontFamily="'Inter', sans-serif"
                fontWeight={600}
              >
                {seg.model}
              </text>

              {/* Cost + percentage */}
              <text
                x={isRight ? pos.x + 15 : pos.x - 105}
                y={pos.y + 13}
                fill={colors.textMuted}
                fontSize={10}
                fontFamily="'JetBrains Mono', monospace"
              >
                ${seg.cost.toFixed(2)} ({seg.percentage.toFixed(1)}%)
              </text>
            </g>
          );
        })}
      </svg>

      {/* Title */}
      <div
        style={{
          position: 'absolute',
          top: 25,
          left: 0,
          width: '100%',
          textAlign: 'center',
          opacity: interpolate(frame, [0, 20], [0, 0.8], { extrapolateRight: 'clamp' }),
        }}
      >
        <span
          style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 14,
            fontWeight: 600,
            color: colors.purple,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
          }}
        >
          COST BREAKDOWN
        </span>
      </div>
    </AbsoluteFill>
  );
};
