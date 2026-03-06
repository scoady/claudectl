import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from 'remotion';
import { colors, hexToRgb } from '../lib/theme';
import { AgentConstellation } from './AgentConstellation';
import { MetricsTimeline } from './MetricsTimeline';
import { CostTracker } from './CostTracker';

// Frosted glass panel component
const GlassPanel: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
  borderColor?: string;
}> = ({ children, style, borderColor = colors.cyan }) => (
  <div
    style={{
      background: 'rgba(10, 10, 26, 0.75)',
      backdropFilter: 'blur(12px)',
      border: `1px solid rgba(${hexToRgb(borderColor)}, 0.15)`,
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: `0 4px 30px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.03)`,
      ...style,
    }}
  >
    {children}
  </div>
);

// Stats card component
const StatCard: React.FC<{
  label: string;
  value: string | number;
  color: string;
  delay: number;
}> = ({ label, value, color, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const cardSpring = spring({
    frame: frame - delay,
    fps,
    config: { damping: 50, stiffness: 60, mass: 0.5 },
  });

  const pulse = Math.sin(frame * 0.04 + delay) * 0.1 + 0.9;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        opacity: cardSpring,
        transform: `translateY(${(1 - cardSpring) * 20}px)`,
      }}
    >
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 28,
          fontWeight: 700,
          color,
          textShadow: `0 0 20px rgba(${hexToRgb(color)}, ${0.4 * pulse})`,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 10,
          fontWeight: 500,
          color: colors.textMuted,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
    </div>
  );
};

export const LiveDashboard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Staggered panel entrances
  const panelEntrance = (delay: number) =>
    spring({
      frame: frame - delay,
      fps,
      config: { damping: 60, stiffness: 40, mass: 1 },
    });

  // Stats bar entrance
  const statsEntrance = panelEntrance(5);

  // Uptime counter
  const uptimeSeconds = Math.floor(frame / 30);
  const uptimeHrs = Math.floor(uptimeSeconds / 3600);
  const uptimeMins = Math.floor((uptimeSeconds % 3600) / 60);
  const uptimeSecs = uptimeSeconds % 60;
  const uptimeStr = `${uptimeHrs.toString().padStart(2, '0')}:${uptimeMins
    .toString()
    .padStart(2, '0')}:${uptimeSecs.toString().padStart(2, '0')}`;

  // Scan line animation
  const scanY = (frame * 2) % 1080;

  return (
    <AbsoluteFill>
      {/* Constellation as full background */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.7 }}>
        <AgentConstellation />
      </div>

      {/* Subtle vignette overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at center, transparent 40%, rgba(0, 0, 0, 0.6) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Scan line effect */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: scanY,
          height: 2,
          background: `linear-gradient(90deg, transparent 0%, rgba(${hexToRgb(colors.cyan)}, 0.06) 20%, rgba(${hexToRgb(colors.cyan)}, 0.06) 80%, transparent 100%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Top stats bar */}
      <GlassPanel
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          right: 20,
          height: 80,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 40px',
          opacity: statsEntrance,
          transform: `translateY(${(1 - statsEntrance) * -30}px)`,
        }}
        borderColor={colors.cyan}
      >
        {/* Left: c9s branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 22,
              fontWeight: 800,
              color: colors.cyan,
              letterSpacing: '0.1em',
              textShadow: `0 0 15px rgba(${hexToRgb(colors.cyan)}, 0.5)`,
            }}
          >
            c9s
          </div>
          <div
            style={{
              width: 1,
              height: 30,
              background: colors.muted,
              opacity: 0.3,
            }}
          />
          <div
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 11,
              color: colors.textMuted,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
            }}
          >
            STELLAR COMMAND
          </div>
        </div>

        {/* Center: stats */}
        <div style={{ display: 'flex', gap: 48 }}>
          <StatCard label="Projects" value="8" color={colors.cyan} delay={10} />
          <StatCard label="Active" value="4" color={colors.amber} delay={15} />
          <StatCard label="Idle" value="5" color={colors.textDim} delay={20} />
          <StatCard label="Done" value="3" color={colors.green} delay={25} />
        </div>

        {/* Right: uptime */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: colors.green,
              boxShadow: `0 0 8px ${colors.green}`,
              opacity: Math.sin(frame * 0.05) * 0.3 + 0.7,
            }}
          />
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 14,
              color: colors.textDim,
              letterSpacing: '0.05em',
            }}
          >
            {uptimeStr}
          </div>
        </div>
      </GlassPanel>

      {/* Cost tracker panel (top-right) */}
      <GlassPanel
        style={{
          position: 'absolute',
          top: 120,
          right: 20,
          width: 380,
          height: 380,
          opacity: panelEntrance(15),
          transform: `translateX(${(1 - panelEntrance(15)) * 40}px)`,
        }}
        borderColor={colors.purple}
      >
        <div style={{ transform: 'scale(0.475)', transformOrigin: 'top left', width: 800, height: 800 }}>
          <CostTracker />
        </div>
      </GlassPanel>

      {/* Metrics timeline (bottom) */}
      <GlassPanel
        style={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          right: 20,
          height: 220,
          opacity: panelEntrance(20),
          transform: `translateY(${(1 - panelEntrance(20)) * 40}px)`,
        }}
        borderColor={colors.amber}
      >
        <div
          style={{
            transform: 'scale(1) translateY(-10px)',
            transformOrigin: 'top left',
            width: 1920,
            height: 400,
            clipPath: 'inset(0 0 45% 0)',
          }}
        >
          <MetricsTimeline />
        </div>
      </GlassPanel>

      {/* System info overlay (bottom-left corner of constellation area) */}
      <div
        style={{
          position: 'absolute',
          left: 40,
          bottom: 260,
          opacity: interpolate(frame, [40, 60], [0, 0.6], { extrapolateRight: 'clamp' }),
        }}
      >
        {[
          { label: 'CLUSTER', value: 'scoady', color: colors.green },
          { label: 'BACKEND', value: 'localhost:4040', color: colors.cyan },
          { label: 'AGENTS', value: '12 spawned', color: colors.amber },
        ].map((item, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 8,
              marginBottom: 6,
              alignItems: 'center',
            }}
          >
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9,
                color: colors.textMuted,
                letterSpacing: '0.1em',
                width: 60,
              }}
            >
              {item.label}
            </span>
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10,
                color: item.color,
              }}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>

      {/* Corner decorations */}
      {[
        { top: 15, left: 15 },
        { top: 15, right: 15 },
        { bottom: 15, left: 15 },
        { bottom: 15, right: 15 },
      ].map((pos, i) => (
        <div
          key={`corner-${i}`}
          style={{
            position: 'absolute',
            ...pos,
            width: 20,
            height: 20,
            borderColor: `rgba(${hexToRgb(colors.cyan)}, 0.15)`,
            borderStyle: 'solid',
            borderWidth: 0,
            ...(i === 0
              ? { borderTopWidth: 1, borderLeftWidth: 1 }
              : i === 1
              ? { borderTopWidth: 1, borderRightWidth: 1 }
              : i === 2
              ? { borderBottomWidth: 1, borderLeftWidth: 1 }
              : { borderBottomWidth: 1, borderRightWidth: 1 }),
            opacity: interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' }),
          }}
        />
      ))}
    </AbsoluteFill>
  );
};
