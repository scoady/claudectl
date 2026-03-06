import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from 'remotion';
import { colors } from './theme';

// Deterministic pseudo-random from seed
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export interface ConstellationAgent {
  id: string;
  project: string;
  status: 'working' | 'idle' | 'done' | 'error' | string;
  model?: string;
  isController?: boolean;
  label?: string;
}

interface Star {
  id: string;
  x: number;
  y: number;
  baseRadius: number;
  color: string;
  status: string;
  project: string;
  label: string;
  model: string;
  phaseOffset: number;
}

interface BackgroundStar {
  x: number;
  y: number;
  size: number;
  opacity: number;
  twinkleSpeed: number;
  color: string;
}

interface ShootingStar {
  startX: number;
  startY: number;
  angle: number;
  speed: number;
  length: number;
  delay: number;
  duration: number;
}

const STATUS_COLORS: Record<string, string> = {
  working: colors.amber,
  running: colors.amber,
  active: colors.amber,
  idle: colors.cyan,
  done: colors.green,
  error: colors.rose,
  pending: colors.textMuted,
};

const STAR_NAMES = [
  'Sirius', 'Vega', 'Arcturus', 'Rigel', 'Procyon', 'Betelgeuse',
  'Aldebaran', 'Antares', 'Spica', 'Pollux', 'Deneb', 'Regulus',
  'Castor', 'Altair', 'Fomalhaut', 'Canopus', 'Achernar', 'Bellatrix',
  'Capella', 'Mira', 'Polaris', 'Shaula', 'Mintaka', 'Alnilam',
];

function getStatusColor(status: string): string {
  return STATUS_COLORS[status] || colors.cyan;
}

export interface AgentConstellationProps {
  agents?: ConstellationAgent[];
  showLabels?: boolean;
  showTitle?: boolean;
}

export const AgentConstellation: React.FC<AgentConstellationProps> = ({
  agents,
  showLabels = true,
  showTitle = true,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const data = agents || generateMockAgents();

  const stars = useMemo<Star[]>(() => {
    const rand = seededRandom(42);
    const padding = 120;
    return data.map((agent, i) => ({
      id: agent.id,
      x: padding + rand() * (1920 - padding * 2),
      y: padding + rand() * (1080 - padding * 2),
      baseRadius: agent.isController ? 8 : 4 + rand() * 4,
      color: getStatusColor(agent.status),
      status: agent.status,
      project: agent.project,
      label: agent.label || STAR_NAMES[i % STAR_NAMES.length],
      model: agent.model || 'unknown',
      phaseOffset: rand() * Math.PI * 2,
    }));
  }, [data]);

  const bgStars = useMemo<BackgroundStar[]>(() => {
    const rand = seededRandom(7);
    const starColors = ['#ffffff', '#cce5ff', '#ffe4cc', '#e0ccff', '#ccffee'];
    return Array.from({ length: 250 }, () => ({
      x: rand() * 1920,
      y: rand() * 1080,
      size: 0.5 + rand() * 2,
      opacity: 0.15 + rand() * 0.6,
      twinkleSpeed: 0.02 + rand() * 0.06,
      color: starColors[Math.floor(rand() * starColors.length)],
    }));
  }, []);

  const shootingStars = useMemo<ShootingStar[]>(() => {
    const rand = seededRandom(99);
    return Array.from({ length: 5 }, () => ({
      startX: rand() * 1920,
      startY: rand() * 400,
      angle: Math.PI * 0.2 + rand() * Math.PI * 0.3,
      speed: 8 + rand() * 12,
      length: 80 + rand() * 120,
      delay: Math.floor(rand() * durationInFrames),
      duration: 30 + Math.floor(rand() * 20),
    }));
  }, [durationInFrames]);

  const projectGroups = useMemo(() => {
    const groups: Record<string, Star[]> = {};
    stars.forEach((s) => {
      if (!groups[s.project]) groups[s.project] = [];
      groups[s.project].push(s);
    });
    return groups;
  }, [stars]);

  const entranceProgress = spring({
    frame,
    fps,
    config: { damping: 80, stiffness: 40, mass: 1 },
  });

  return (
    <AbsoluteFill>
      {/* Deep space background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 40%, #0a1a2e 70%, #0a0a1a 100%)',
        }}
      />

      {/* Nebula overlays */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 25% 30%, rgba(192, 132, 252, 0.08) 0%, transparent 50%)',
          opacity: interpolate(Math.sin(frame * 0.01), [-1, 1], [0.5, 1]),
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 75% 70%, rgba(103, 232, 249, 0.06) 0%, transparent 50%)',
          opacity: interpolate(Math.sin(frame * 0.015 + 1), [-1, 1], [0.4, 1]),
        }}
      />

      {/* Subtle grid overlay */}
      <svg width="1920" height="1080" style={{ position: 'absolute', inset: 0, opacity: 0.03 }}>
        {Array.from({ length: 20 }, (_, i) => (
          <line key={`vg-${i}`} x1={i * 96} y1={0} x2={i * 96} y2={1080} stroke={colors.cyan} strokeWidth={0.5} />
        ))}
        {Array.from({ length: 12 }, (_, i) => (
          <line key={`hg-${i}`} x1={0} y1={i * 90} x2={1920} y2={i * 90} stroke={colors.cyan} strokeWidth={0.5} />
        ))}
      </svg>

      {/* Background stars */}
      <svg width="1920" height="1080" style={{ position: 'absolute', inset: 0 }}>
        {bgStars.map((star, i) => {
          const twinkle = Math.sin(frame * star.twinkleSpeed + i) * 0.3 + 0.7;
          return (
            <circle
              key={`bg-${i}`}
              cx={star.x}
              cy={star.y}
              r={star.size * entranceProgress}
              fill={star.color}
              opacity={star.opacity * twinkle * entranceProgress}
            />
          );
        })}
      </svg>

      {/* Shooting stars */}
      <svg width="1920" height="1080" style={{ position: 'absolute', inset: 0 }}>
        {shootingStars.map((ss, i) => {
          const loopFrame = frame % durationInFrames;
          const localFrame = loopFrame - ss.delay;
          if (localFrame < 0 || localFrame > ss.duration) return null;

          const progress = localFrame / ss.duration;
          const headX = ss.startX + Math.cos(ss.angle) * ss.speed * localFrame;
          const headY = ss.startY + Math.sin(ss.angle) * ss.speed * localFrame;
          const tailX = headX - Math.cos(ss.angle) * ss.length * Math.min(1, progress * 3);
          const tailY = headY - Math.sin(ss.angle) * ss.length * Math.min(1, progress * 3);
          const opacity = progress < 0.3 ? progress / 0.3 : 1 - (progress - 0.3) / 0.7;

          return (
            <g key={`ss-${i}`} opacity={opacity}>
              <line x1={tailX} y1={tailY} x2={headX} y2={headY} stroke="url(#shootingGrad)" strokeWidth={2} strokeLinecap="round" />
              <circle cx={headX} cy={headY} r={3} fill="#ffffff" opacity={0.9} />
            </g>
          );
        })}
        <defs>
          <linearGradient id="shootingGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0} />
            <stop offset="100%" stopColor="#ffffff" stopOpacity={0.8} />
          </linearGradient>
        </defs>
      </svg>

      {/* Constellation lines */}
      <svg width="1920" height="1080" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          {Object.keys(projectGroups).map((_project, gi) => (
            <linearGradient key={`lg-${gi}`} id={`line-grad-${gi}`}>
              <stop offset="0%" stopColor={colors.chart[gi % colors.chart.length]} stopOpacity={0.4} />
              <stop offset="50%" stopColor={colors.chart[gi % colors.chart.length]} stopOpacity={0.15} />
              <stop offset="100%" stopColor={colors.chart[gi % colors.chart.length]} stopOpacity={0.4} />
            </linearGradient>
          ))}
        </defs>
        {Object.values(projectGroups).map((group, gi) =>
          group.slice(1).map((star, si) => {
            const prev = group[si];
            const lineProgress = spring({
              frame: frame - (gi * 10 + si * 5),
              fps,
              config: { damping: 60, stiffness: 30, mass: 1 },
            });
            const shimmer = Math.sin(frame * 0.03 + gi + si) * 0.15 + 0.85;
            const endX = interpolate(lineProgress, [0, 1], [prev.x, star.x]);
            const endY = interpolate(lineProgress, [0, 1], [prev.y, star.y]);
            return (
              <line
                key={`line-${gi}-${si}`}
                x1={prev.x} y1={prev.y}
                x2={endX} y2={endY}
                stroke={`url(#line-grad-${gi})`}
                strokeWidth={1.5}
                opacity={shimmer * entranceProgress}
                strokeDasharray="4 6"
              />
            );
          })
        )}
      </svg>

      {/* Agent stars with glow effects */}
      <svg width="1920" height="1080" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          {stars.map((star) => (
            <radialGradient key={`glow-${star.id}`} id={`glow-${star.id}`}>
              <stop offset="0%" stopColor={star.color} stopOpacity={0.8} />
              <stop offset="40%" stopColor={star.color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={star.color} stopOpacity={0} />
            </radialGradient>
          ))}
        </defs>

        {stars.map((star, i) => {
          const starEntrance = spring({
            frame: frame - i * 3,
            fps,
            config: { damping: 40, stiffness: 80, mass: 0.5 },
          });

          const isWorking = star.status === 'working' || star.status === 'running' || star.status === 'active';
          const pulseRate = isWorking ? 0.08 : 0.03;
          const pulseAmp = isWorking ? 0.4 : 0.15;
          const pulse = Math.sin(frame * pulseRate + star.phaseOffset) * pulseAmp + 1;
          const glowMultiplier = isWorking ? 6 : star.status === 'idle' ? 4 : 3;
          const radius = star.baseRadius * pulse * starEntrance;
          const glowRadius = radius * glowMultiplier;
          const floatX = Math.sin(frame * 0.015 + star.phaseOffset) * 3;
          const floatY = Math.cos(frame * 0.012 + star.phaseOffset * 1.3) * 2;
          const baseOpacity = star.status === 'done' ? 0.6 : star.status === 'error' ? 0.8 : 1;

          return (
            <g key={star.id} transform={`translate(${floatX}, ${floatY})`} opacity={baseOpacity * starEntrance}>
              <circle cx={star.x} cy={star.y} r={glowRadius} fill={`url(#glow-${star.id})`} opacity={isWorking ? 0.6 * pulse : 0.3} />
              {isWorking && (
                <>
                  <circle
                    cx={star.x} cy={star.y}
                    r={radius * (2 + (frame * 0.03 + star.phaseOffset) % 3)}
                    fill="none" stroke={star.color} strokeWidth={0.8}
                    opacity={Math.max(0, 0.4 - ((frame * 0.03 + star.phaseOffset) % 3) * 0.13)}
                  />
                  <circle
                    cx={star.x} cy={star.y}
                    r={radius * (2 + ((frame * 0.03 + star.phaseOffset + 1.5) % 3))}
                    fill="none" stroke={star.color} strokeWidth={0.5}
                    opacity={Math.max(0, 0.3 - (((frame * 0.03 + star.phaseOffset + 1.5) % 3)) * 0.1)}
                  />
                </>
              )}
              <circle cx={star.x} cy={star.y} r={radius} fill={star.color} />
              <circle cx={star.x} cy={star.y} r={radius * 0.5} fill="#ffffff" opacity={0.7} />

              {showLabels && (
                <>
                  <text
                    x={star.x} y={star.y - radius - 10}
                    textAnchor="middle" fill={colors.textDim} fontSize={11}
                    fontFamily="'Inter', sans-serif" opacity={0.7 * starEntrance}
                  >
                    {star.label}
                  </text>
                  <text
                    x={star.x} y={star.y + radius + 16}
                    textAnchor="middle" fill={colors.textMuted} fontSize={9}
                    fontFamily="'JetBrains Mono', monospace" opacity={0.5 * starEntrance}
                  >
                    {star.project}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>

      {/* Title overlay */}
      {showTitle && (
        <div
          style={{
            position: 'absolute', top: 30, left: 40,
            opacity: interpolate(frame, [0, 30], [0, 0.8], { extrapolateRight: 'clamp' }),
          }}
        >
          <div style={{
            fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 600,
            color: colors.cyan, letterSpacing: '0.2em', textTransform: 'uppercase' as const,
          }}>
            STELLAR COMMAND
          </div>
          <div style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
            color: colors.textMuted, marginTop: 4,
          }}>
            {stars.length} agents across {Object.keys(projectGroups).length} projects
          </div>
        </div>
      )}

      {/* Legend */}
      <div
        style={{
          position: 'absolute', bottom: 30, right: 40,
          display: 'flex', gap: 20,
          opacity: interpolate(frame, [20, 50], [0, 0.7], { extrapolateRight: 'clamp' }),
        }}
      >
        {(['working', 'idle', 'done', 'error'] as const).map((status) => (
          <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              backgroundColor: STATUS_COLORS[status],
              boxShadow: `0 0 8px ${STATUS_COLORS[status]}`,
            }} />
            <span style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
              color: colors.textDim, textTransform: 'uppercase' as const, letterSpacing: '0.1em',
            }}>
              {status}
            </span>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

function generateMockAgents(): ConstellationAgent[] {
  const statuses: ConstellationAgent['status'][] = [
    'working', 'working', 'working', 'idle', 'idle', 'done',
    'done', 'error', 'idle', 'working', 'done', 'idle',
  ];
  const projects = [
    'claude-manager', 'claude-manager', 'kind-infra', 'kind-infra',
    'helm-platform', 'claudectl', 'claudectl', 'agent-reports',
    'agent-reports', 'web-scraper', 'ml-pipeline', 'api-gateway',
  ];
  const models = ['claude-opus-4-6', 'claude-sonnet-4-20250514', 'claude-haiku-3-5-20241022'];

  return statuses.map((status, i) => ({
    id: `mock-${i}`,
    project: projects[i],
    status,
    model: models[i % models.length],
    isController: i === 0,
  }));
}
