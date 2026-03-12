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

interface Bumper {
  id: string;
  label: string;
  sublabel: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  type: 'bumper' | 'target' | 'scoop' | 'saucer' | 'plunger';
  enterDelay: number;
  sides?: number;
}

interface BallKeyframe {
  t: number;
  x: number;
  y: number;
  hit?: string;
}

interface PlayfieldInsert {
  x: number;
  y: number;
  r: number;
  color: string;
}

// ── Pinball Machine Composition ──────────────────────────────────────────────

export const PinballMachine: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // ── Playfield geometry ───────────────────────────────────────────────────
  // The playfield is a vertical rectangle centered in the 1920x1080 frame

  const pfLeft = width / 2 - 340;
  const pfRight = width / 2 + 340;
  const pfTop = 60;
  const pfBottom = height - 60;
  const pfCx = width / 2;
  const pfWidth = pfRight - pfLeft;
  const pfHeight = pfBottom - pfTop;

  // ── Bumper / element definitions ─────────────────────────────────────────

  const bumpers: Bumper[] = useMemo(() => [
    // API Gateway — plunger lane (right side, upper)
    {
      id: 'api', label: 'API Gateway', sublabel: 'PLUNGER',
      x: pfRight - 50, y: pfTop + 140, radius: 30,
      color: colors.blue, type: 'plunger', enterDelay: 0,
    },
    // c9-operator — massive center bumper (hexagonal)
    {
      id: 'operator', label: 'c9-operator', sublabel: 'MEGA BUMPER',
      x: pfCx, y: pfTop + 280, radius: 55,
      color: colors.cyan, type: 'bumper', enterDelay: 5, sides: 6,
    },
    // Broker — left orbit ramp
    {
      id: 'broker', label: 'Broker', sublabel: 'LEFT ORBIT',
      x: pfLeft + 90, y: pfTop + 320, radius: 35,
      color: colors.purple, type: 'bumper', enterDelay: 10,
    },
    // Hub — right orbit ramp
    {
      id: 'hub', label: 'Hub', sublabel: 'RIGHT ORBIT',
      x: pfRight - 90, y: pfTop + 320, radius: 35,
      color: colors.green, type: 'bumper', enterDelay: 10,
    },
    // Drop targets: Agents alpha, beta, gamma, delta
    {
      id: 'agent1', label: 'Agent \u03b1', sublabel: 'A',
      x: pfCx - 105, y: pfTop + 480, radius: 22,
      color: colors.amber, type: 'target', enterDelay: 18,
    },
    {
      id: 'agent2', label: 'Agent \u03b2', sublabel: 'G',
      x: pfCx - 35, y: pfTop + 480, radius: 22,
      color: colors.amber, type: 'target', enterDelay: 20,
    },
    {
      id: 'agent3', label: 'Agent \u03b3', sublabel: 'E',
      x: pfCx + 35, y: pfTop + 480, radius: 22,
      color: colors.amber, type: 'target', enterDelay: 22,
    },
    {
      id: 'agent4', label: 'Agent \u03b4', sublabel: 'N',
      x: pfCx + 105, y: pfTop + 480, radius: 22,
      color: colors.rose, type: 'target', enterDelay: 24,
    },
    // Projects — scoop (ball trap) lower left
    {
      id: 'projects', label: 'Projects', sublabel: 'SCOOP',
      x: pfLeft + 80, y: pfTop + 620, radius: 28,
      color: colors.textDim, type: 'scoop', enterDelay: 15,
    },
    // Dashboard — saucer (kickout) lower right
    {
      id: 'dashboard', label: 'Dashboard', sublabel: 'SAUCER',
      x: pfRight - 80, y: pfTop + 620, radius: 28,
      color: colors.textDim, type: 'saucer', enterDelay: 15,
    },
  ], [pfLeft, pfRight, pfTop, pfCx]);

  const bumperMap = useMemo(() => Object.fromEntries(bumpers.map((b) => [b.id, b])), [bumpers]);

  // ── Ball path keyframes ──────────────────────────────────────────────────
  // Ball follows a predetermined path, bouncing between elements

  const ballPath: BallKeyframe[] = useMemo(() => {
    const op = bumperMap['operator'];
    const brk = bumperMap['broker'];
    const hub = bumperMap['hub'];
    const api = bumperMap['api'];
    const a1 = bumperMap['agent1'];
    const a2 = bumperMap['agent2'];
    const a3 = bumperMap['agent3'];
    const a4 = bumperMap['agent4'];
    const proj = bumperMap['projects'];
    const dash = bumperMap['dashboard'];

    return [
      // Plunger launch
      { t: 0, x: api.x, y: pfBottom - 100 },
      { t: 20, x: api.x, y: api.y, hit: 'api' },
      // Curve to operator
      { t: 35, x: pfCx + 80, y: pfTop + 180 },
      { t: 50, x: op.x, y: op.y, hit: 'operator' },
      // Bounce to left orbit (broker)
      { t: 65, x: pfCx - 60, y: op.y - 30 },
      { t: 80, x: brk.x, y: brk.y, hit: 'broker' },
      // Down to agent alpha
      { t: 95, x: brk.x + 40, y: brk.y + 80 },
      { t: 110, x: a1.x, y: a1.y, hit: 'agent1' },
      // Bounce to agent beta
      { t: 120, x: a2.x, y: a2.y - 20 },
      { t: 130, x: a2.x, y: a2.y, hit: 'agent2' },
      // Bounce to agent gamma
      { t: 140, x: a3.x, y: a3.y - 15 },
      { t: 150, x: a3.x, y: a3.y, hit: 'agent3' },
      // Ricochet to agent delta
      { t: 160, x: a4.x - 20, y: a4.y - 25 },
      { t: 170, x: a4.x, y: a4.y, hit: 'agent4' },
      // Drop to projects scoop
      { t: 185, x: pfCx - 40, y: proj.y - 40 },
      { t: 200, x: proj.x, y: proj.y, hit: 'projects' },
      // Kickout to right — hub
      { t: 220, x: pfCx + 60, y: hub.y + 40 },
      { t: 235, x: hub.x, y: hub.y, hit: 'hub' },
      // Over to dashboard saucer
      { t: 250, x: dash.x - 20, y: dash.y - 30 },
      { t: 260, x: dash.x, y: dash.y, hit: 'dashboard' },
      // Back up to operator (loop)
      { t: 280, x: pfCx + 50, y: op.y + 60 },
      { t: 300, x: op.x, y: op.y, hit: 'operator' },
    ];
  }, [bumperMap, pfBottom, pfCx, pfTop]);

  // ── Get current ball position ────────────────────────────────────────────

  const ballCycleLength = 300;
  const ballFrame = frame % ballCycleLength;

  const getBallPos = (f: number): { x: number; y: number } => {
    for (let i = 1; i < ballPath.length; i++) {
      if (f <= ballPath[i].t) {
        const prev = ballPath[i - 1];
        const curr = ballPath[i];
        const localT = (f - prev.t) / (curr.t - prev.t);
        // Add a slight arc using sine for bounce feel
        const arcHeight = Math.sin(localT * Math.PI) * 30;
        return {
          x: prev.x + (curr.x - prev.x) * localT,
          y: prev.y + (curr.y - prev.y) * localT - arcHeight,
        };
      }
    }
    return ballPath[ballPath.length - 1];
  };

  const ballPos = getBallPos(ballFrame);

  // ── Detect hits for flash effects ────────────────────────────────────────

  const hitBumpers = useMemo(() => {
    const hits: Record<string, number> = {};
    for (const kf of ballPath) {
      if (kf.hit) hits[kf.hit] = kf.t;
    }
    return hits;
  }, [ballPath]);

  const isBumperHit = (id: string): number => {
    const hitT = hitBumpers[id];
    if (hitT === undefined) return 0;
    const delta = ballFrame - hitT;
    if (delta < 0 || delta > 15) return 0;
    return 1 - delta / 15;
  };

  // ── Multiball (appears after frame 200) ──────────────────────────────────

  const multiballActive = frame > 200;
  const multiBallFrame2 = (frame + 150) % ballCycleLength;
  const multiBallFrame3 = (frame + 250) % ballCycleLength;
  const ballPos2 = multiballActive ? getBallPos(multiBallFrame2) : null;
  const ballPos3 = multiballActive ? getBallPos(multiBallFrame3) : null;

  // ── Score ────────────────────────────────────────────────────────────────

  const score = useMemo(() => {
    const base = 1000000;
    return base + Math.floor(frame * 2237);
  }, [frame]);

  const scoreStr = score.toLocaleString();

  // ── Playfield inserts (decorative lights) ────────────────────────────────

  const inserts: PlayfieldInsert[] = useMemo(() => {
    const rng = seededRandom(99);
    return Array.from({ length: 24 }, () => ({
      x: pfLeft + 40 + rng() * (pfWidth - 80),
      y: pfTop + 100 + rng() * (pfHeight - 200),
      r: rng() * 6 + 4,
      color: [colors.cyan, colors.purple, colors.amber, colors.green, colors.rose, colors.blue][Math.floor(rng() * 6)],
    }));
  }, [pfLeft, pfWidth, pfTop, pfHeight]);

  // ── Flipper animation ────────────────────────────────────────────────────

  const flipperAngle = Math.sin(frame * 0.08) * 25;
  const flipperY = pfBottom - 90;

  // ── Plunger animation ────────────────────────────────────────────────────

  const plungerPull = interpolate(ballFrame, [0, 10, 18, 20], [0, 15, 15, -5], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ── Drop target state ────────────────────────────────────────────────────

  const isTargetDown = (hitT: number): boolean => {
    return ballFrame > hitT && ballFrame < hitT + 80;
  };

  // ── Dot matrix display messages ──────────────────────────────────────────

  const dmdMessages = ['DISPATCH MULTIBALL', 'SPAWN AGENT BONUS', 'BROKER COMBO x3', 'OPERATOR JACKPOT', 'HUB STREAM FRENZY'];
  const currentDmd = Math.floor((frame / 90) % dmdMessages.length);
  const dmdScroll = (frame % 90) / 90;

  // ── Entrance animation ───────────────────────────────────────────────────

  const cabinetEnter = spring({ frame, fps, config: { damping: 20, stiffness: 50 } });

  // ── Render helpers ───────────────────────────────────────────────────────

  const hexPoints = (cx: number, cy: number, r: number): string => {
    return Array.from({ length: 6 }, (_, i) => {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
    }).join(' ');
  };

  const renderBumper = (b: Bumper) => {
    const s = spring({ frame: frame - b.enterDelay, fps, config: { damping: 12, stiffness: 80 } });
    if (s <= 0.01) return null;

    const hitIntensity = isBumperHit(b.id);
    const isOperator = b.id === 'operator';
    const flash = hitIntensity > 0 ? 0.4 + hitIntensity * 0.6 : 0.15;
    const chromeGlow = hitIntensity > 0 ? 1 : 0.4;

    if (b.type === 'target') {
      // Drop target — rectangular
      const hitT = hitBumpers[b.id] || 999;
      const down = isTargetDown(hitT);
      const targetY = down ? b.y + 8 : b.y;
      const targetOpacity = down ? 0.4 : 0.9;

      return (
        <g key={b.id} transform={`scale(${s})`} style={{ transformOrigin: `${b.x}px ${b.y}px` }}>
          {/* Target backing */}
          <rect
            x={b.x - 18} y={targetY - 24}
            width={36} height={48}
            rx={4}
            fill={colors.bgDeep}
            stroke={b.color}
            strokeWidth={2}
            opacity={targetOpacity}
          />
          {/* Target face */}
          <rect
            x={b.x - 14} y={targetY - 20}
            width={28} height={40}
            rx={2}
            fill={`rgba(${hexToRgb(b.color)}, ${flash})`}
            stroke={b.color}
            strokeWidth={1}
            opacity={targetOpacity}
          />
          {/* Letter */}
          <text
            x={b.x} y={targetY + 6}
            textAnchor="middle"
            fill={hitIntensity > 0 ? 'white' : b.color}
            fontSize={20}
            fontFamily="'Outfit', 'DM Sans', sans-serif"
            fontWeight={800}
            opacity={targetOpacity}
          >
            {b.sublabel}
          </text>
          {/* Hit flash */}
          {hitIntensity > 0 && (
            <rect
              x={b.x - 18} y={targetY - 24}
              width={36} height={48}
              rx={4}
              fill="white"
              opacity={hitIntensity * 0.5}
            />
          )}
          {/* Label below */}
          <text
            x={b.x} y={b.y + 38}
            textAnchor="middle"
            fill={colors.textMuted}
            fontSize={7}
            fontFamily="'IBM Plex Mono', monospace"
          >
            {b.label}
          </text>
        </g>
      );
    }

    if (b.type === 'scoop') {
      return (
        <g key={b.id} transform={`scale(${s})`} style={{ transformOrigin: `${b.x}px ${b.y}px` }}>
          {/* Scoop hole */}
          <ellipse cx={b.x} cy={b.y} rx={b.radius} ry={b.radius * 0.7} fill="#0a0a1a" stroke={b.color} strokeWidth={2} opacity={0.8} />
          <ellipse cx={b.x} cy={b.y - 4} rx={b.radius - 4} ry={(b.radius - 4) * 0.7} fill="none" stroke={b.color} strokeWidth={0.5} opacity={0.4} />
          {hitIntensity > 0 && (
            <ellipse cx={b.x} cy={b.y} rx={b.radius + 8} ry={b.radius * 0.7 + 8} fill={b.color} opacity={hitIntensity * 0.3} />
          )}
          <text x={b.x} y={b.y + 4} textAnchor="middle" fill={colors.text} fontSize={9} fontFamily="'IBM Plex Mono', monospace" fontWeight={600}>
            {b.label}
          </text>
          <text x={b.x} y={b.y + 16} textAnchor="middle" fill={colors.textMuted} fontSize={7} fontFamily="'IBM Plex Mono', monospace">
            {b.sublabel}
          </text>
        </g>
      );
    }

    if (b.type === 'saucer') {
      return (
        <g key={b.id} transform={`scale(${s})`} style={{ transformOrigin: `${b.x}px ${b.y}px` }}>
          {/* Saucer dish */}
          <circle cx={b.x} cy={b.y} r={b.radius} fill="#0d0d20" stroke={b.color} strokeWidth={2} opacity={0.8} />
          <circle cx={b.x} cy={b.y} r={b.radius - 6} fill="none" stroke={b.color} strokeWidth={0.5} opacity={0.4} strokeDasharray="3 3" />
          <circle cx={b.x} cy={b.y} r={b.radius - 12} fill={`rgba(${hexToRgb(b.color)}, 0.1)`} />
          {hitIntensity > 0 && (
            <circle cx={b.x} cy={b.y} r={b.radius + 10} fill={b.color} opacity={hitIntensity * 0.3} />
          )}
          <text x={b.x} y={b.y + 4} textAnchor="middle" fill={colors.text} fontSize={9} fontFamily="'IBM Plex Mono', monospace" fontWeight={600}>
            {b.label}
          </text>
          <text x={b.x} y={b.y + 16} textAnchor="middle" fill={colors.textMuted} fontSize={7} fontFamily="'IBM Plex Mono', monospace">
            {b.sublabel}
          </text>
        </g>
      );
    }

    if (b.type === 'plunger') {
      return (
        <g key={b.id} transform={`scale(${s})`} style={{ transformOrigin: `${b.x}px ${b.y}px` }}>
          {/* Plunger lane */}
          <rect x={b.x - 16} y={b.y - 40} width={32} height={pfBottom - b.y - 60 + plungerPull} rx={4} fill="#1a1a2e" stroke={colors.blue} strokeWidth={1} opacity={0.5} />
          {/* Plunger head */}
          <rect x={b.x - 12} y={pfBottom - 100 + plungerPull} width={24} height={16} rx={4} fill={b.color} opacity={0.9} />
          <rect x={b.x - 8} y={pfBottom - 96 + plungerPull} width={16} height={8} rx={2} fill="white" opacity={0.3} />
          {/* Arrow indicator */}
          <polygon points={`${b.x},${b.y - 50} ${b.x - 8},${b.y - 38} ${b.x + 8},${b.y - 38}`} fill={b.color} opacity={0.6} />
          <text x={b.x} y={b.y - 56} textAnchor="middle" fill={b.color} fontSize={9} fontFamily="'IBM Plex Mono', monospace" fontWeight={700}>
            {b.label}
          </text>
        </g>
      );
    }

    // Default: round or hex bumper
    return (
      <g key={b.id} transform={`scale(${s})`} style={{ transformOrigin: `${b.x}px ${b.y}px` }}>
        {/* Rubber ring */}
        {isOperator ? (
          <polygon
            points={hexPoints(b.x, b.y, b.radius + 10)}
            fill="none"
            stroke={colors.rose}
            strokeWidth={3}
            opacity={0.5}
          />
        ) : (
          <circle cx={b.x} cy={b.y} r={b.radius + 8} fill="none" stroke={colors.rose} strokeWidth={3} opacity={0.4} />
        )}

        {/* Chrome ring */}
        {isOperator ? (
          <polygon
            points={hexPoints(b.x, b.y, b.radius)}
            fill={colors.bgDeep}
            stroke={`rgba(255,255,255,${chromeGlow * 0.6})`}
            strokeWidth={2.5}
          />
        ) : (
          <circle cx={b.x} cy={b.y} r={b.radius} fill={colors.bgDeep} stroke={`rgba(255,255,255,${chromeGlow * 0.6})`} strokeWidth={2.5} />
        )}

        {/* Inner light */}
        {isOperator ? (
          <polygon
            points={hexPoints(b.x, b.y, b.radius - 6)}
            fill={`rgba(${hexToRgb(b.color)}, ${flash})`}
            stroke={b.color}
            strokeWidth={1}
          />
        ) : (
          <circle cx={b.x} cy={b.y} r={b.radius - 4} fill={`rgba(${hexToRgb(b.color)}, ${flash})`} stroke={b.color} strokeWidth={1} />
        )}

        {/* Hit flash burst */}
        {hitIntensity > 0 && (
          <>
            <circle cx={b.x} cy={b.y} r={b.radius + 20 + hitIntensity * 15} fill="none" stroke="white" strokeWidth={2} opacity={hitIntensity * 0.6} />
            <circle cx={b.x} cy={b.y} r={b.radius + 5} fill="white" opacity={hitIntensity * 0.4} />
          </>
        )}

        {/* Icon/label */}
        <text
          x={b.x} y={b.y + (isOperator ? -4 : 3)}
          textAnchor="middle"
          fill={hitIntensity > 0 ? 'white' : b.color}
          fontSize={isOperator ? 14 : 10}
          fontFamily="'Outfit', 'DM Sans', sans-serif"
          fontWeight={700}
          letterSpacing={isOperator ? 1 : 0}
        >
          {b.label}
        </text>
        {isOperator && (
          <text
            x={b.x} y={b.y + 12}
            textAnchor="middle"
            fill={colors.textMuted}
            fontSize={7}
            fontFamily="'IBM Plex Mono', monospace"
          >
            {b.sublabel}
          </text>
        )}
        {!isOperator && b.type === 'bumper' && (
          <text
            x={b.x} y={b.y + b.radius + 18}
            textAnchor="middle"
            fill={colors.textMuted}
            fontSize={7}
            fontFamily="'IBM Plex Mono', monospace"
          >
            {b.sublabel}
          </text>
        )}
      </g>
    );
  };

  const renderBall = (bx: number, by: number, key: string, trailOpacity: number) => {
    return (
      <g key={key}>
        {/* Motion blur trail */}
        <circle cx={bx - 4} cy={by + 3} r={9} fill="white" opacity={trailOpacity * 0.15} />
        <circle cx={bx - 2} cy={by + 1} r={10} fill="white" opacity={trailOpacity * 0.1} />
        {/* Ball shadow */}
        <circle cx={bx + 3} cy={by + 3} r={10} fill="black" opacity={0.3} />
        {/* Ball body */}
        <circle cx={bx} cy={by} r={10} fill="#e8e8e8" />
        {/* Chrome highlight */}
        <circle cx={bx - 3} cy={by - 3} r={5} fill="white" opacity={0.7} />
        <circle cx={bx - 1} cy={by - 1} r={2} fill="white" opacity={0.9} />
        {/* Glow */}
        <circle cx={bx} cy={by} r={14} fill="white" opacity={0.1} />
      </g>
    );
  };

  // ── Orbit ramp paths (curved wireframe) ──────────────────────────────────

  const leftOrbitPath = `M ${pfLeft + 50} ${pfTop + 450} Q ${pfLeft + 30} ${pfTop + 200} ${pfCx - 60} ${pfTop + 140}`;
  const rightOrbitPath = `M ${pfRight - 50} ${pfTop + 450} Q ${pfRight - 30} ${pfTop + 200} ${pfCx + 60} ${pfTop + 140}`;

  // ── Cabinet art border pattern ───────────────────────────────────────────

  const cabinetOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: '#0c0620' }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ transform: `scale(${0.85 + cabinetEnter * 0.15})`, transformOrigin: 'center' }}
      >
        <defs>
          <filter id="pbGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="pbBlur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
          <linearGradient id="woodGrain" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3d2817" />
            <stop offset="30%" stopColor="#4a3020" />
            <stop offset="60%" stopColor="#3a2515" />
            <stop offset="100%" stopColor="#2e1c10" />
          </linearGradient>
          <radialGradient id="playfieldBg" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#1a1040" />
            <stop offset="60%" stopColor="#0e0828" />
            <stop offset="100%" stopColor="#080418" />
          </radialGradient>
          <linearGradient id="chromeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#888888" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {/* Cabinet frame (wood grain border) */}
        <g opacity={cabinetOpacity}>
          <rect x={pfLeft - 30} y={pfTop - 30} width={pfWidth + 60} height={pfHeight + 60} rx={12} fill="url(#woodGrain)" />
          <rect x={pfLeft - 28} y={pfTop - 28} width={pfWidth + 56} height={pfHeight + 56} rx={10} fill="none" stroke="#5a3a20" strokeWidth={2} />
        </g>

        {/* Playfield surface */}
        <rect x={pfLeft} y={pfTop} width={pfWidth} height={pfHeight} rx={6} fill="url(#playfieldBg)" opacity={cabinetOpacity} />

        {/* Playfield inserts (decorative translucent circles) */}
        {inserts.map((ins, i) => {
          const blink = 0.15 + Math.sin(frame * 0.05 + i * 2.3) * 0.1;
          return (
            <circle key={`ins${i}`} cx={ins.x} cy={ins.y} r={ins.r} fill={ins.color} opacity={blink * cabinetOpacity} />
          );
        })}

        {/* Orbit ramp rails */}
        <g opacity={cabinetOpacity * 0.6}>
          <path d={leftOrbitPath} fill="none" stroke={colors.purple} strokeWidth={3} opacity={0.5} />
          <path d={leftOrbitPath} fill="none" stroke="white" strokeWidth={1} opacity={0.15} />
          <path d={rightOrbitPath} fill="none" stroke={colors.green} strokeWidth={3} opacity={0.5} />
          <path d={rightOrbitPath} fill="none" stroke="white" strokeWidth={1} opacity={0.15} />

          {/* Ramp labels */}
          <text x={pfLeft + 40} y={pfTop + 260} fill={colors.purple} fontSize={8} fontFamily="'IBM Plex Mono', monospace" opacity={0.6} transform={`rotate(-75, ${pfLeft + 40}, ${pfTop + 260})`}>
            LEFT ORBIT
          </text>
          <text x={pfRight - 40} y={pfTop + 260} fill={colors.green} fontSize={8} fontFamily="'IBM Plex Mono', monospace" opacity={0.6} transform={`rotate(75, ${pfRight - 40}, ${pfTop + 260})`}>
            RIGHT ORBIT
          </text>
        </g>

        {/* Drop target label "A G E N T" */}
        <text
          x={pfCx} y={pfTop + 450}
          textAnchor="middle"
          fill={colors.amber}
          fontSize={11}
          fontFamily="'IBM Plex Mono', monospace"
          fontWeight={700}
          letterSpacing={24}
          opacity={cabinetOpacity * 0.5}
        >
          A G E N T
        </text>

        {/* Bumpers, targets, scoops */}
        {bumpers.map(renderBumper)}

        {/* Flippers */}
        <g opacity={cabinetOpacity}>
          {/* Left flipper */}
          <g transform={`rotate(${-25 + flipperAngle}, ${pfCx - 70}, ${flipperY})`}>
            <rect x={pfCx - 70} y={flipperY - 8} width={80} height={16} rx={8} fill="#c0c0c0" stroke="white" strokeWidth={1} opacity={0.8} />
            <rect x={pfCx - 70} y={flipperY - 5} width={75} height={10} rx={5} fill="url(#chromeGrad)" />
            <circle cx={pfCx - 70} cy={flipperY} r={8} fill="#d0d0d0" stroke="white" strokeWidth={1} />
          </g>
          {/* Right flipper */}
          <g transform={`rotate(${25 - flipperAngle}, ${pfCx + 70}, ${flipperY})`}>
            <rect x={pfCx - 10} y={flipperY - 8} width={80} height={16} rx={8} fill="#c0c0c0" stroke="white" strokeWidth={1} opacity={0.8} />
            <rect x={pfCx - 5} y={flipperY - 5} width={75} height={10} rx={5} fill="url(#chromeGrad)" />
            <circle cx={pfCx + 70} cy={flipperY} r={8} fill="#d0d0d0" stroke="white" strokeWidth={1} />
          </g>
          {/* Ball drain */}
          <rect x={pfCx - 30} y={pfBottom - 50} width={60} height={20} rx={4} fill="#000" stroke="#333" strokeWidth={1} opacity={0.8} />
          <text x={pfCx} y={pfBottom - 36} textAnchor="middle" fill="#555" fontSize={7} fontFamily="'IBM Plex Mono', monospace">
            DRAIN
          </text>
        </g>

        {/* ── Score display (top of cabinet) ──────────────────────────── */}
        <g opacity={cabinetOpacity}>
          {/* Score panel background */}
          <rect x={pfLeft} y={pfTop - 28} width={pfWidth} height={24} rx={4} fill="#0a0a14" stroke="#333" strokeWidth={1} />
          {/* Score text (seven-segment style) */}
          <text
            x={pfLeft + 16} y={pfTop - 10}
            fill={colors.amber}
            fontSize={16}
            fontFamily="'IBM Plex Mono', monospace"
            fontWeight={700}
            letterSpacing={2}
          >
            SCORE: {scoreStr}
          </text>
          {/* Ball indicator */}
          <text x={pfRight - 16} y={pfTop - 10} textAnchor="end" fill={colors.textDim} fontSize={10} fontFamily="'IBM Plex Mono', monospace">
            BALL {multiballActive ? '3' : '1'}
          </text>
        </g>

        {/* ── Dot matrix display (left panel) ─────────────────────────── */}
        <g transform={`translate(${pfLeft - 340}, ${pfTop + 40})`} opacity={cabinetOpacity}>
          <rect x={0} y={0} width={280} height={60} rx={6} fill="#0a0a0a" stroke="#2a2a2a" strokeWidth={2} />
          {/* DMD header */}
          <text x={140} y={18} textAnchor="middle" fill="#ff6600" fontSize={9} fontFamily="'IBM Plex Mono', monospace" fontWeight={600} letterSpacing={3}>
            DOT MATRIX DISPLAY
          </text>
          {/* Scrolling message */}
          <text
            x={interpolate(dmdScroll, [0, 1], [280, -200])}
            y={42}
            fill={colors.amber}
            fontSize={18}
            fontFamily="'IBM Plex Mono', monospace"
            fontWeight={700}
            letterSpacing={3}
          >
            {dmdMessages[currentDmd]}
          </text>
          {/* Scan line */}
          <rect x={1} y={(frame * 0.8) % 60} width={278} height={1} fill="#ff6600" opacity={0.08} />
        </g>

        {/* ── Cabinet art (right side) ────────────────────────────────── */}
        <g transform={`translate(${pfRight + 60}, ${pfTop + 40})`} opacity={cabinetOpacity}>
          {/* Retro title panel */}
          <rect x={0} y={0} width={280} height={180} rx={8} fill="#0e0828" stroke={colors.cyan} strokeWidth={1} opacity={0.8} />

          {/* Title */}
          <text x={140} y={50} textAnchor="middle" fill={colors.cyan} fontSize={28} fontFamily="'Outfit', 'DM Sans', sans-serif" fontWeight={900} letterSpacing={3}
            style={{ filter: `drop-shadow(0 0 8px rgba(${hexToRgb(colors.cyan)}, 0.6))` }}>
            c9-OPERATOR
          </text>
          <text x={140} y={72} textAnchor="middle" fill={colors.purple} fontSize={11} fontFamily="'IBM Plex Mono', monospace" fontWeight={600} letterSpacing={4}>
            PINBALL WIZARD
          </text>

          {/* Decorative stars */}
          {[0, 1, 2, 3, 4].map((i) => {
            const starX = 40 + i * 50;
            const starPulse = 0.5 + Math.sin(frame * 0.08 + i * 1.2) * 0.5;
            return (
              <text key={`star${i}`} x={starX} y={100} textAnchor="middle" fill={colors.amber} fontSize={16} opacity={starPulse}>
                &#x2605;
              </text>
            );
          })}

          {/* Connection legend */}
          <g transform="translate(20, 120)">
            <circle cx={8} cy={0} r={5} fill={colors.cyan} opacity={0.8} />
            <text x={20} y={4} fill={colors.textDim} fontSize={8} fontFamily="'IBM Plex Mono', monospace">Operator Bumper</text>
            <circle cx={148} cy={0} r={5} fill={colors.amber} opacity={0.8} />
            <text x={160} y={4} fill={colors.textDim} fontSize={8} fontFamily="'IBM Plex Mono', monospace">Agent Targets</text>
          </g>
          <g transform="translate(20, 140)">
            <circle cx={8} cy={0} r={5} fill={colors.purple} opacity={0.8} />
            <text x={20} y={4} fill={colors.textDim} fontSize={8} fontFamily="'IBM Plex Mono', monospace">Broker Orbit</text>
            <circle cx={148} cy={0} r={5} fill={colors.green} opacity={0.8} />
            <text x={160} y={4} fill={colors.textDim} fontSize={8} fontFamily="'IBM Plex Mono', monospace">Hub Orbit</text>
          </g>
          <g transform="translate(20, 160)">
            <circle cx={8} cy={0} r={5} fill={colors.rose} opacity={0.8} />
            <text x={20} y={4} fill={colors.textDim} fontSize={8} fontFamily="'IBM Plex Mono', monospace">Spawn Path</text>
            <circle cx={148} cy={0} r={5} fill={colors.blue} opacity={0.8} />
            <text x={160} y={4} fill={colors.textDim} fontSize={8} fontFamily="'IBM Plex Mono', monospace">API Plunger</text>
          </g>
        </g>

        {/* ── Multiball indicator ─────────────────────────────────────── */}
        {multiballActive && (
          <g transform={`translate(${pfRight + 60}, ${pfTop + 260})`}>
            <rect x={0} y={0} width={280} height={40} rx={6} fill="#0a0a0a" stroke={colors.rose} strokeWidth={1} opacity={0.8 + Math.sin(frame * 0.1) * 0.2} />
            <text x={140} y={26} textAnchor="middle" fill={colors.rose} fontSize={16} fontFamily="'IBM Plex Mono', monospace" fontWeight={700} letterSpacing={4}
              style={{ filter: `drop-shadow(0 0 6px rgba(${hexToRgb(colors.rose)}, 0.8))` }}>
              MULTIBALL!
            </text>
          </g>
        )}

        {/* ── Connection paths (faint lines showing data flow) ────────── */}
        <g opacity={0.15}>
          {/* API → Operator */}
          <line x1={bumperMap['api'].x} y1={bumperMap['api'].y + 30} x2={bumperMap['operator'].x + 40} y2={bumperMap['operator'].y - 40} stroke={colors.blue} strokeWidth={1} strokeDasharray="4 4" />
          {/* Operator → Broker */}
          <line x1={bumperMap['operator'].x - 50} y1={bumperMap['operator'].y} x2={bumperMap['broker'].x + 35} y2={bumperMap['broker'].y} stroke={colors.purple} strokeWidth={1} strokeDasharray="4 4" />
          {/* Operator → Hub */}
          <line x1={bumperMap['operator'].x + 50} y1={bumperMap['operator'].y} x2={bumperMap['hub'].x - 35} y2={bumperMap['hub'].y} stroke={colors.green} strokeWidth={1} strokeDasharray="4 4" />
          {/* Hub → Dashboard */}
          <line x1={bumperMap['hub'].x} y1={bumperMap['hub'].y + 35} x2={bumperMap['dashboard'].x} y2={bumperMap['dashboard'].y - 28} stroke={colors.green} strokeWidth={1} strokeDasharray="4 4" />
          {/* Agent alpha → Operator (spawn request) */}
          <line x1={bumperMap['agent1'].x} y1={bumperMap['agent1'].y - 22} x2={bumperMap['operator'].x - 30} y2={bumperMap['operator'].y + 40} stroke={colors.rose} strokeWidth={1} strokeDasharray="3 3" />
        </g>

        {/* ── Balls ───────────────────────────────────────────────────── */}
        {frame > 15 && renderBall(ballPos.x, ballPos.y, 'ball1', 1)}
        {ballPos2 && renderBall(ballPos2.x, ballPos2.y, 'ball2', 0.7)}
        {ballPos3 && renderBall(ballPos3.x, ballPos3.y, 'ball3', 0.7)}

        {/* ── Glass reflection overlay ────────────────────────────────── */}
        <rect x={pfLeft} y={pfTop} width={pfWidth} height={pfHeight} rx={6} fill="white" opacity={0.02} />
        <line x1={pfLeft + 40} y1={pfTop} x2={pfLeft} y2={pfTop + 100} stroke="white" strokeWidth={30} opacity={0.015} />
      </svg>
    </AbsoluteFill>
  );
};

export default PinballMachine;
