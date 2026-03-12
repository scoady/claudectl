import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from 'remotion';
import { colors, hexToRgb } from './theme';

// ── Deterministic random ─────────────────────────────────────────────────────

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── Types ────────────────────────────────────────────────────────────────────

interface OrbitalBody {
  id: string;
  label: string;
  sublabel: string;
  color: string;
  icon: string;
  orbitRadius: number;
  angularSpeed: number;
  startAngle: number;
  size: number;
  enterDelay: number;
  type: 'sun' | 'planet' | 'moon' | 'telescope' | 'gasGiant';
  ringColor?: string;
  parentId?: string;
}

interface StarDef {
  x: number;
  y: number;
  size: number;
  opacity: number;
  color: string;
  twinkleSpeed: number;
}

interface AsteroidDef {
  angle: number;
  radius: number;
  size: number;
  speed: number;
  opacity: number;
}

// ── Solar System Composition ─────────────────────────────────────────────────

export const SolarSystem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const cx = width / 2;
  const cy = height / 2;

  // ── Starfield background ─────────────────────────────────────────────────

  const stars: StarDef[] = useMemo(() => {
    const rng = seededRandom(777);
    return Array.from({ length: 300 }, () => ({
      x: rng() * width,
      y: rng() * height,
      size: rng() * 1.8 + 0.2,
      opacity: rng() * 0.6 + 0.1,
      color: [
        '#ffffff', '#ffffff', '#ffffff', '#ffeedd', '#ddeeff',
        colors.cyan, colors.purple, '#aaccff',
      ][Math.floor(rng() * 8)],
      twinkleSpeed: rng() * 0.08 + 0.02,
    }));
  }, [width, height]);

  // ── Milky Way band ───────────────────────────────────────────────────────

  const milkyWayStars: StarDef[] = useMemo(() => {
    const rng = seededRandom(1337);
    return Array.from({ length: 200 }, () => {
      const bandY = height * 0.3 + (rng() - 0.5) * height * 0.25;
      const bandX = rng() * width;
      return {
        x: bandX,
        y: bandY + Math.sin(bandX * 0.003) * 40,
        size: rng() * 1.0 + 0.2,
        opacity: rng() * 0.25 + 0.05,
        color: ['#ddeeff', '#cce0ff', '#bbccee', '#aabbdd'][Math.floor(rng() * 4)],
        twinkleSpeed: rng() * 0.04 + 0.01,
      };
    });
  }, [width, height]);

  // ── Asteroid belt ────────────────────────────────────────────────────────

  const asteroids: AsteroidDef[] = useMemo(() => {
    const rng = seededRandom(9999);
    return Array.from({ length: 80 }, () => ({
      angle: rng() * Math.PI * 2,
      radius: 175 + rng() * 40 - 20,
      size: rng() * 1.5 + 0.5,
      speed: (rng() * 0.004 + 0.002) * (rng() > 0.5 ? 1 : -1),
      opacity: rng() * 0.4 + 0.1,
    }));
  }, []);

  // ── Orbital bodies ───────────────────────────────────────────────────────

  const bodies: OrbitalBody[] = useMemo(() => [
    // SUN: c9-operator
    {
      id: 'operator', label: 'c9-operator', sublabel: 'Central Coordinator',
      color: colors.cyan, icon: '\u2609', orbitRadius: 0, angularSpeed: 0,
      startAngle: 0, size: 70, enterDelay: 0, type: 'sun' as const,
    },
    // ORBIT 1: Broker (fast inner orbit)
    {
      id: 'broker', label: 'Broker', sublabel: 'Session Lifecycle',
      color: colors.purple, icon: '\u2B21', orbitRadius: 95, angularSpeed: 0.025,
      startAngle: 0, size: 36, enterDelay: 10, type: 'planet' as const,
    },
    // ORBIT 1: Hub (binary companion to Broker, offset by PI)
    {
      id: 'hub', label: 'Hub', sublabel: 'WS Broadcast',
      color: colors.green, icon: '\u25CE', orbitRadius: 95, angularSpeed: 0.025,
      startAngle: Math.PI, size: 32, enterDelay: 10, type: 'planet' as const,
    },
    // ORBIT 2: API Gateway
    {
      id: 'api', label: 'API Gateway', sublabel: 'Entry Point',
      color: colors.blue, icon: '\u26A1', orbitRadius: 155, angularSpeed: 0.015,
      startAngle: Math.PI * 0.7, size: 34, enterDelay: 15, type: 'planet' as const,
    },
    // ORBIT 3: Agent Pool (gas giant)
    {
      id: 'agentPool', label: 'Agent Pool', sublabel: 'Worker Processes',
      color: colors.amber, icon: '\u2B22', orbitRadius: 235, angularSpeed: 0.009,
      startAngle: Math.PI * 1.3, size: 46, enterDelay: 20, type: 'gasGiant' as const,
      ringColor: colors.amberDim,
    },
    // Agent moons (orbit the gas giant)
    {
      id: 'agent1', label: 'Agent \u03B1', sublabel: 'subprocess',
      color: colors.amber, icon: '\u2605', orbitRadius: 34, angularSpeed: 0.06,
      startAngle: 0, size: 16, enterDelay: 25, type: 'moon' as const, parentId: 'agentPool',
    },
    {
      id: 'agent2', label: 'Agent \u03B2', sublabel: 'subprocess',
      color: colors.amber, icon: '\u2605', orbitRadius: 34, angularSpeed: 0.06,
      startAngle: Math.PI * 0.5, size: 14, enterDelay: 28, type: 'moon' as const, parentId: 'agentPool',
    },
    {
      id: 'agent3', label: 'Agent \u03B3', sublabel: 'subprocess',
      color: colors.amber, icon: '\u2605', orbitRadius: 34, angularSpeed: 0.06,
      startAngle: Math.PI, size: 14, enterDelay: 31, type: 'moon' as const, parentId: 'agentPool',
    },
    {
      id: 'agent4', label: 'Agent \u03B4', sublabel: 'spawned by \u03B1',
      color: colors.rose, icon: '\u2726', orbitRadius: 34, angularSpeed: 0.06,
      startAngle: Math.PI * 1.5, size: 12, enterDelay: 50, type: 'moon' as const, parentId: 'agentPool',
    },
    // ORBIT 4: Projects (distant ice giant)
    {
      id: 'projects', label: 'Projects', sublabel: 'Managed Repos',
      color: colors.textDim, icon: '\u25A3', orbitRadius: 310, angularSpeed: 0.005,
      startAngle: Math.PI * 0.2, size: 30, enterDelay: 18, type: 'planet' as const,
      ringColor: colors.textMuted,
    },
    // ORBIT 5: Dashboard (space telescope at Lagrange point)
    {
      id: 'dashboard', label: 'Dashboard', sublabel: 'JWST Observer',
      color: colors.textDim, icon: '\u25E7', orbitRadius: 340, angularSpeed: 0.005,
      startAngle: Math.PI * 1.2, size: 24, enterDelay: 18, type: 'telescope' as const,
    },
  ], []);

  // ── Position calculator ──────────────────────────────────────────────────

  const getBodyPosition = (body: OrbitalBody): { x: number; y: number } => {
    if (body.type === 'sun') return { x: cx, y: cy };

    const angle = body.startAngle + frame * body.angularSpeed;

    if (body.parentId) {
      const parent = bodies.find((b) => b.id === body.parentId);
      if (parent) {
        const parentPos = getBodyPosition(parent);
        return {
          x: parentPos.x + Math.cos(angle) * body.orbitRadius,
          y: parentPos.y + Math.sin(angle) * body.orbitRadius * 0.85,
        };
      }
    }

    // Slight eccentricity for non-circular orbits
    const eccentricity = body.id === 'projects' ? 0.15 : 0.08;
    const r = body.orbitRadius * (1 - eccentricity * Math.cos(angle));
    return {
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r * 0.75, // Flatten for perspective
    };
  };

  // ── Comet animation ──────────────────────────────────────────────────────

  const cometCycle = 300;
  const cometFrame = frame % cometCycle;
  const cometVisible = cometFrame < 80;
  const cometT = cometFrame / 80;
  const cometX = interpolate(cometT, [0, 1], [width + 50, -100], { extrapolateRight: 'clamp' });
  const cometY = interpolate(cometT, [0, 1], [-30, height * 0.7], { extrapolateRight: 'clamp' });

  // ── Corona flame generation ──────────────────────────────────────────────

  const coronaFlames = useMemo(() => {
    const rng = seededRandom(555);
    return Array.from({ length: 24 }, (_, i) => ({
      angle: (i / 24) * Math.PI * 2,
      length: rng() * 20 + 15,
      width: rng() * 4 + 2,
      speed: rng() * 0.1 + 0.05,
      phase: rng() * Math.PI * 2,
    }));
  }, []);

  // ── Orrery armature lines ────────────────────────────────────────────────

  const armatureBodies = bodies.filter(
    (b) => b.type !== 'sun' && b.type !== 'moon'
  );

  // ── Global entry animation ───────────────────────────────────────────────

  const globalOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  // ── Title ────────────────────────────────────────────────────────────────

  const titleOpacity = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [0, 25], [-10, 0], { extrapolateRight: 'clamp' });

  // ── Legend ────────────────────────────────────────────────────────────────

  const legendOpacity = interpolate(frame, [40, 60], [0, 1], { extrapolateRight: 'clamp' });

  const legendItems = [
    { color: colors.cyan, label: 'c9-operator (Sun)' },
    { color: colors.purple, label: 'Broker (Inner Planet)' },
    { color: colors.green, label: 'Hub (Binary Companion)' },
    { color: colors.blue, label: 'API Gateway (Rocky Planet)' },
    { color: colors.amber, label: 'Agent Pool (Gas Giant + Moons)' },
    { color: colors.rose, label: 'Agent \u03B4 (Spawned Moon)' },
  ];

  // ── Lens flare ───────────────────────────────────────────────────────────

  const flarePulse = 0.6 + Math.sin(frame * 0.03) * 0.15;

  return (
    <AbsoluteFill style={{ backgroundColor: '#020108' }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          {/* Sun radial gradient */}
          <radialGradient id="sunGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="15%" stopColor={colors.cyan} stopOpacity="0.9" />
            <stop offset="40%" stopColor={colors.cyanDim} stopOpacity="0.5" />
            <stop offset="70%" stopColor={colors.cyanMuted} stopOpacity="0.2" />
            <stop offset="100%" stopColor="#020108" stopOpacity="0" />
          </radialGradient>
          {/* Corona glow */}
          <radialGradient id="coronaGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={colors.cyan} stopOpacity="0.15" />
            <stop offset="50%" stopColor={colors.purple} stopOpacity="0.05" />
            <stop offset="100%" stopColor="#020108" stopOpacity="0" />
          </radialGradient>
          {/* Lens flare gradient */}
          <radialGradient id="lensFlare" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
            <stop offset="30%" stopColor={colors.cyan} stopOpacity="0.1" />
            <stop offset="100%" stopColor="#020108" stopOpacity="0" />
          </radialGradient>
          {/* Gas giant bands */}
          <linearGradient id="gasGiantBands" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.amber} stopOpacity="0.9" />
            <stop offset="20%" stopColor={colors.amberDim} stopOpacity="0.7" />
            <stop offset="40%" stopColor={colors.amber} stopOpacity="0.8" />
            <stop offset="55%" stopColor={colors.amberMuted} stopOpacity="0.9" />
            <stop offset="70%" stopColor={colors.amber} stopOpacity="0.7" />
            <stop offset="85%" stopColor={colors.amberDim} stopOpacity="0.8" />
            <stop offset="100%" stopColor={colors.amber} stopOpacity="0.9" />
          </linearGradient>
          {/* Glow filters */}
          <filter id="sunGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="12" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="planetGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="5" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
          <filter id="textGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Comet gradient */}
          <linearGradient id="cometTail" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={colors.cyan} stopOpacity="0" />
            <stop offset="70%" stopColor={colors.cyan} stopOpacity="0.4" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.9" />
          </linearGradient>
        </defs>

        {/* ── Starfield ─────────────────────────────────────────────────── */}
        <g opacity={globalOpacity}>
          {stars.map((s, i) => {
            const twinkle = 0.5 + Math.sin(frame * s.twinkleSpeed + i * 2.3) * 0.5;
            return (
              <circle
                key={`s${i}`}
                cx={s.x} cy={s.y} r={s.size}
                fill={s.color} opacity={s.opacity * twinkle}
              />
            );
          })}
        </g>

        {/* ── Milky Way band ────────────────────────────────────────────── */}
        <g opacity={globalOpacity * 0.6}>
          {milkyWayStars.map((s, i) => {
            const twinkle = 0.5 + Math.sin(frame * s.twinkleSpeed + i * 1.1) * 0.5;
            return (
              <circle
                key={`mw${i}`}
                cx={s.x} cy={s.y} r={s.size}
                fill={s.color} opacity={s.opacity * twinkle}
              />
            );
          })}
        </g>

        {/* ── Corona ambient glow ───────────────────────────────────────── */}
        <circle cx={cx} cy={cy} r={250} fill="url(#coronaGlow)" opacity={globalOpacity} />

        {/* ── Orbital paths (ellipses) ──────────────────────────────────── */}
        {[95, 155, 235, 310, 340].map((r, i) => {
          const pathOpacity = interpolate(frame, [5 + i * 4, 15 + i * 4], [0, 1], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          });
          const eccentricity = i === 3 ? 0.15 : 0.08;
          const rx = r;
          const ry = r * 0.75;
          return (
            <g key={`orbit${i}`} opacity={pathOpacity * 0.2}>
              <ellipse
                cx={cx} cy={cy} rx={rx * (1 + eccentricity * 0.5)} ry={ry}
                fill="none" stroke={colors.textMuted}
                strokeWidth={0.5} strokeDasharray="4 8"
              />
            </g>
          );
        })}

        {/* ── Orrery armature lines ─────────────────────────────────────── */}
        {armatureBodies.map((body) => {
          const pos = getBodyPosition(body);
          const armOpacity = interpolate(frame, [body.enterDelay, body.enterDelay + 15], [0, 0.12], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          });
          return (
            <line
              key={`arm-${body.id}`}
              x1={cx} y1={cy} x2={pos.x} y2={pos.y}
              stroke={colors.amber} strokeWidth={0.5}
              opacity={armOpacity} strokeDasharray="2 6"
            />
          );
        })}

        {/* ── Asteroid belt ─────────────────────────────────────────────── */}
        <g opacity={interpolate(frame, [15, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}>
          {asteroids.map((a, i) => {
            const angle = a.angle + frame * a.speed;
            const ax = cx + Math.cos(angle) * a.radius;
            const ay = cy + Math.sin(angle) * a.radius * 0.75;
            const twinkle = 0.5 + Math.sin(frame * 0.03 + i) * 0.5;
            return (
              <circle
                key={`ast${i}`}
                cx={ax} cy={ay} r={a.size}
                fill={colors.textMuted} opacity={a.opacity * twinkle}
              />
            );
          })}
        </g>

        {/* ── SUN: c9-operator ──────────────────────────────────────────── */}
        {(() => {
          const sunScale = spring({ frame, fps, config: { damping: 10, stiffness: 60 } });
          const coronaPulse = 1 + Math.sin(frame * 0.06) * 0.08;
          return (
            <g transform={`translate(${cx}, ${cy}) scale(${sunScale})`}>
              {/* Corona flames */}
              {coronaFlames.map((fl, i) => {
                const flicker = Math.sin(frame * fl.speed + fl.phase) * 0.5 + 0.5;
                const len = fl.length * coronaPulse * (0.7 + flicker * 0.6);
                const flAngle = fl.angle + Math.sin(frame * 0.02 + i) * 0.1;
                const x1 = Math.cos(flAngle) * 32;
                const y1 = Math.sin(flAngle) * 32;
                const x2 = Math.cos(flAngle) * (32 + len);
                const y2 = Math.sin(flAngle) * (32 + len);
                return (
                  <line
                    key={`fl${i}`}
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={colors.cyan} strokeWidth={fl.width * flicker}
                    opacity={0.3 * flicker} strokeLinecap="round"
                    filter="url(#softGlow)"
                  />
                );
              })}
              {/* Sun body glow */}
              <circle r={50} fill="url(#sunGrad)" filter="url(#sunGlow)" />
              {/* Sun core */}
              <circle r={28} fill={`rgba(${hexToRgb(colors.cyan)}, 0.3)`} />
              <circle r={20} fill={`rgba(255, 255, 255, 0.15)`} />
              {/* Sun icon + label */}
              <text
                textAnchor="middle" dominantBaseline="central"
                fontSize={22} fill="#ffffff"
                style={{ filter: `drop-shadow(0 0 8px ${colors.cyan})` }}
              >
                {'\u25C8'}
              </text>
              <text
                y={42} textAnchor="middle" fill={colors.text}
                fontSize={12} fontFamily="'Outfit', 'DM Sans', sans-serif"
                fontWeight={700} letterSpacing={1.5}
              >
                c9-operator
              </text>
              <text
                y={56} textAnchor="middle" fill={colors.textMuted}
                fontSize={8} fontFamily="'IBM Plex Mono', monospace"
              >
                Central Coordinator
              </text>
            </g>
          );
        })()}

        {/* ── Lens flare ────────────────────────────────────────────────── */}
        <circle cx={cx} cy={cy} r={80} fill="url(#lensFlare)" opacity={flarePulse * globalOpacity} />
        {/* Secondary flare streaks */}
        <ellipse
          cx={cx + 60} cy={cy - 30} rx={15} ry={3}
          fill={colors.cyan} opacity={flarePulse * 0.15}
          transform={`rotate(-25, ${cx + 60}, ${cy - 30})`}
        />
        <ellipse
          cx={cx - 45} cy={cy + 25} rx={10} ry={2}
          fill={colors.purple} opacity={flarePulse * 0.1}
          transform={`rotate(30, ${cx - 45}, ${cy + 25})`}
        />

        {/* ── Planets and moons ─────────────────────────────────────────── */}
        {bodies.filter((b) => b.type !== 'sun').map((body) => {
          const s = spring({
            frame: frame - body.enterDelay,
            fps,
            config: { damping: 14, stiffness: 70 },
          });
          if (s <= 0.01) return null;

          const pos = getBodyPosition(body);

          if (body.type === 'gasGiant') {
            // Gas giant with atmospheric bands
            return (
              <g key={body.id} transform={`translate(${pos.x}, ${pos.y}) scale(${s})`}>
                {/* Ring system */}
                <ellipse
                  rx={body.size * 0.9} ry={body.size * 0.2}
                  fill="none" stroke={body.ringColor || colors.amber}
                  strokeWidth={2} opacity={0.3}
                  transform="rotate(-15)"
                />
                <ellipse
                  rx={body.size * 0.75} ry={body.size * 0.15}
                  fill="none" stroke={body.ringColor || colors.amber}
                  strokeWidth={1.5} opacity={0.2}
                  transform="rotate(-15)"
                />
                {/* Planet body */}
                <circle r={body.size / 2} fill="url(#gasGiantBands)" />
                <circle r={body.size / 2} fill="none" stroke={body.color} strokeWidth={1} opacity={0.6} />
                {/* Atmospheric glow */}
                <circle
                  r={body.size / 2 + 4} fill="none"
                  stroke={body.color} strokeWidth={1}
                  opacity={0.15} filter="url(#planetGlow)"
                />
                {/* Label */}
                <text
                  y={body.size / 2 + 18} textAnchor="middle" fill={body.color}
                  fontSize={10} fontFamily="'Outfit', 'DM Sans', sans-serif"
                  fontWeight={600}
                >
                  {body.label}
                </text>
                <text
                  y={body.size / 2 + 30} textAnchor="middle" fill={colors.textMuted}
                  fontSize={7} fontFamily="'IBM Plex Mono', monospace"
                >
                  {body.sublabel}
                </text>
              </g>
            );
          }

          if (body.type === 'telescope') {
            // JWST-style space telescope
            const rotAngle = Math.sin(frame * 0.008) * 15; // Slowly tracks
            return (
              <g key={body.id} transform={`translate(${pos.x}, ${pos.y}) scale(${s})`}>
                {/* Sunshield (diamond shape) */}
                <polygon
                  points={`0,${-body.size * 0.6} ${body.size * 0.5},0 0,${body.size * 0.6} ${-body.size * 0.5},0`}
                  fill={`rgba(${hexToRgb(colors.textDim)}, 0.15)`}
                  stroke={colors.textDim} strokeWidth={0.8}
                  transform={`rotate(${rotAngle})`}
                />
                {/* Hexagonal mirror segments */}
                {[0, 60, 120, 180, 240, 300].map((a) => {
                  const mr = 6;
                  const mx = Math.cos((a * Math.PI) / 180) * 5;
                  const my = Math.sin((a * Math.PI) / 180) * 5;
                  return (
                    <circle
                      key={`mirror${a}`}
                      cx={mx} cy={my} r={mr / 2}
                      fill={`rgba(${hexToRgb(colors.cyan)}, 0.2)`}
                      stroke={colors.textDim} strokeWidth={0.5}
                    />
                  );
                })}
                {/* Detection beam */}
                <line
                  x1={0} y1={0}
                  x2={Math.cos((rotAngle * Math.PI) / 180) * 50}
                  y2={Math.sin((rotAngle * Math.PI) / 180) * 50}
                  stroke={colors.green} strokeWidth={0.5}
                  opacity={0.2} strokeDasharray="3 5"
                />
                <text
                  y={body.size * 0.6 + 16} textAnchor="middle" fill={colors.textDim}
                  fontSize={9} fontFamily="'Outfit', 'DM Sans', sans-serif"
                  fontWeight={600}
                >
                  {body.label}
                </text>
                <text
                  y={body.size * 0.6 + 27} textAnchor="middle" fill={colors.textMuted}
                  fontSize={7} fontFamily="'IBM Plex Mono', monospace"
                >
                  {body.sublabel}
                </text>
              </g>
            );
          }

          if (body.type === 'moon') {
            // Small agent moons
            return (
              <g key={body.id} transform={`translate(${pos.x}, ${pos.y}) scale(${s})`}>
                <circle
                  r={body.size / 2 + 3} fill="none"
                  stroke={body.color} strokeWidth={0.5}
                  opacity={0.2} filter="url(#planetGlow)"
                />
                <circle r={body.size / 2} fill={colors.bgDeep} stroke={body.color} strokeWidth={1} opacity={0.9} />
                <text
                  textAnchor="middle" dominantBaseline="central"
                  fontSize={body.size * 0.55} fill={body.color}
                >
                  {body.icon}
                </text>
                <text
                  y={body.size / 2 + 10} textAnchor="middle" fill={body.color}
                  fontSize={7} fontFamily="'IBM Plex Mono', monospace"
                  fontWeight={500} opacity={0.8}
                >
                  {body.label}
                </text>
              </g>
            );
          }

          // Regular planets (Broker, Hub, API, Projects)
          const planetPulse = body.id === 'broker' || body.id === 'hub'
            ? 1 + Math.sin(frame * 0.04 + (body.id === 'hub' ? Math.PI : 0)) * 0.03
            : 1;

          return (
            <g key={body.id} transform={`translate(${pos.x}, ${pos.y}) scale(${s * planetPulse})`}>
              {/* Atmosphere */}
              <circle
                r={body.size / 2 + 6} fill="none"
                stroke={body.color} strokeWidth={1}
                opacity={0.1} filter="url(#planetGlow)"
              />
              {/* Planet rings for Projects (ice giant) */}
              {body.ringColor && (
                <ellipse
                  rx={body.size * 0.7} ry={body.size * 0.15}
                  fill="none" stroke={body.ringColor}
                  strokeWidth={1.5} opacity={0.25}
                  transform="rotate(-20)"
                />
              )}
              {/* Planet body */}
              <circle
                r={body.size / 2} fill={colors.bgDeep}
                stroke={body.color} strokeWidth={1.2} opacity={0.95}
              />
              <circle
                r={body.size / 2 - 2} fill={`rgba(${hexToRgb(body.color)}, 0.1)`}
              />
              {/* Icon */}
              <text
                textAnchor="middle" dominantBaseline="central"
                fontSize={body.size * 0.45} fill={body.color}
                style={{ filter: `drop-shadow(0 0 4px rgba(${hexToRgb(body.color)}, 0.4))` }}
              >
                {body.icon}
              </text>
              {/* Label */}
              <text
                y={body.size / 2 + 15} textAnchor="middle" fill={colors.text}
                fontSize={10} fontFamily="'Outfit', 'DM Sans', sans-serif"
                fontWeight={600}
              >
                {body.label}
              </text>
              <text
                y={body.size / 2 + 27} textAnchor="middle" fill={colors.textMuted}
                fontSize={7} fontFamily="'IBM Plex Mono', monospace"
              >
                {body.sublabel}
              </text>
            </g>
          );
        })}

        {/* ── Connection lines (data flow) ──────────────────────────────── */}
        {(() => {
          const apiPos = getBodyPosition(bodies.find((b) => b.id === 'api')!);
          const brokerPos = getBodyPosition(bodies.find((b) => b.id === 'broker')!);
          const hubPos = getBodyPosition(bodies.find((b) => b.id === 'hub')!);
          const dashboardPos = getBodyPosition(bodies.find((b) => b.id === 'dashboard')!);
          const agent1Pos = getBodyPosition(bodies.find((b) => b.id === 'agent1')!);

          const connections = [
            { from: apiPos, to: { x: cx, y: cy }, color: colors.blue, delay: 20, label: 'dispatch' },
            { from: { x: cx, y: cy }, to: brokerPos, color: colors.purple, delay: 15, label: 'spawn' },
            { from: { x: cx, y: cy }, to: hubPos, color: colors.green, delay: 15, label: 'events' },
            { from: hubPos, to: dashboardPos, color: colors.green, delay: 22, label: 'stream' },
            { from: agent1Pos, to: { x: cx, y: cy }, color: colors.rose, delay: 52, label: 'spawn_req' },
          ];

          return connections.map((conn, i) => {
            const progress = interpolate(frame, [conn.delay, conn.delay + 20], [0, 1], {
              extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
            });
            if (progress <= 0) return null;

            const dx = conn.to.x - conn.from.x;
            const dy = conn.to.y - conn.from.y;
            const endX = conn.from.x + dx * progress;
            const endY = conn.from.y + dy * progress;

            // Animated particle
            const particleT = progress >= 1 ? ((frame - conn.delay) % 50) / 50 : 0;
            const px = conn.from.x + dx * particleT;
            const py = conn.from.y + dy * particleT;

            return (
              <g key={`conn${i}`} opacity={progress * 0.6}>
                <line
                  x1={conn.from.x} y1={conn.from.y} x2={endX} y2={endY}
                  stroke={conn.color} strokeWidth={1} strokeDasharray="4 6"
                  opacity={0.5}
                />
                {progress >= 1 && (
                  <circle cx={px} cy={py} r={2.5} fill={conn.color} opacity={0.8} />
                )}
                {progress > 0.8 && (
                  <text
                    x={(conn.from.x + conn.to.x) / 2}
                    y={(conn.from.y + conn.to.y) / 2 - 6}
                    textAnchor="middle" fill={conn.color}
                    fontSize={7} fontFamily="'IBM Plex Mono', monospace"
                    fontWeight={500} opacity={0.5}
                  >
                    {conn.label}
                  </text>
                )}
              </g>
            );
          });
        })()}

        {/* ── Comet (spawn request from Agent alpha) ────────────────────── */}
        {cometVisible && (
          <g opacity={interpolate(cometT, [0, 0.1, 0.8, 1], [0, 0.9, 0.9, 0], { extrapolateRight: 'clamp' })}>
            {/* Tail */}
            <line
              x1={cometX + 80} y1={cometY - 40}
              x2={cometX} y2={cometY}
              stroke="url(#cometTail)" strokeWidth={2} strokeLinecap="round"
            />
            <line
              x1={cometX + 60} y1={cometY - 35}
              x2={cometX} y2={cometY}
              stroke={colors.cyan} strokeWidth={1} opacity={0.3}
            />
            {/* Head */}
            <circle cx={cometX} cy={cometY} r={3} fill="#ffffff" filter="url(#planetGlow)" />
            <circle cx={cometX} cy={cometY} r={1.5} fill="#ffffff" />
          </g>
        )}

        {/* ── Orbit labels (distance markers) ───────────────────────────── */}
        {[
          { r: 95, label: 'Orbit I' },
          { r: 155, label: 'Orbit II' },
          { r: 235, label: 'Orbit III' },
          { r: 310, label: 'Orbit IV' },
        ].map((orb, i) => {
          const labelOpacity = interpolate(frame, [30 + i * 5, 45 + i * 5], [0, 0.35], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          });
          return (
            <text
              key={`olbl${i}`}
              x={cx + orb.r * 0.72} y={cy - orb.r * 0.52}
              fill={colors.textMuted} fontSize={7}
              fontFamily="'IBM Plex Mono', monospace"
              opacity={labelOpacity}
              transform={`rotate(-35, ${cx + orb.r * 0.72}, ${cy - orb.r * 0.52})`}
            >
              {orb.label}
            </text>
          );
        })}

        {/* ── Title ─────────────────────────────────────────────────────── */}
        <g opacity={titleOpacity} transform={`translate(0, ${titleY})`}>
          <text
            x={cx} y={height - 50}
            textAnchor="middle" fill={colors.cyan}
            fontSize={20} fontFamily="'Outfit', 'DM Sans', sans-serif"
            fontWeight={800} letterSpacing={4}
            filter="url(#textGlow)"
          >
            c9-operator ORRERY
          </text>
          <text
            x={cx} y={height - 30}
            textAnchor="middle" fill={colors.textMuted}
            fontSize={10} fontFamily="'IBM Plex Mono', monospace"
            letterSpacing={2}
          >
            GRAVITATIONAL AGENT ORCHESTRATION
          </text>
        </g>

        {/* ── Legend ─────────────────────────────────────────────────────── */}
        <g opacity={legendOpacity} transform="translate(16, 16)">
          <rect
            x={0} y={0} width={180} height={legendItems.length * 17 + 12}
            rx={4} fill={`rgba(${hexToRgb(colors.bgDeep)}, 0.7)`}
            stroke={colors.textMuted} strokeWidth={0.3}
          />
          {legendItems.map((item, i) => (
            <g key={`leg${i}`} transform={`translate(10, ${i * 17 + 14})`}>
              <circle cx={5} cy={0} r={3.5} fill={item.color} opacity={0.8} />
              <text
                x={15} y={3.5} fill={colors.textDim}
                fontSize={8} fontFamily="'IBM Plex Mono', monospace"
              >
                {item.label}
              </text>
            </g>
          ))}
        </g>

        {/* ── Scale / info box ──────────────────────────────────────────── */}
        <g opacity={legendOpacity} transform={`translate(${width - 140}, 16)`}>
          <rect
            x={0} y={0} width={125} height={42}
            rx={4} fill={`rgba(${hexToRgb(colors.bgDeep)}, 0.7)`}
            stroke={colors.textMuted} strokeWidth={0.3}
          />
          <text
            x={10} y={16} fill={colors.textDim}
            fontSize={7} fontFamily="'IBM Plex Mono', monospace"
          >
            Inner orbits: ~25ms RTT
          </text>
          <text
            x={10} y={30} fill={colors.textDim}
            fontSize={7} fontFamily="'IBM Plex Mono', monospace"
          >
            Outer orbits: ~200ms RTT
          </text>
        </g>
      </svg>
    </AbsoluteFill>
  );
};

export default SolarSystem;
