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

interface DominoDef {
  id: string;
  label: string;
  sublabel: string;
  x: number;
  y: number;
  color: string;
  pipTop: number;
  pipBottom: number;
  fallDelay: number;
  fallAngle: number; // target rotation in degrees (0=standing, 90=fallen right, -90=fallen left)
  width: number;
  height: number;
  isKeystone?: boolean;
}

interface ChainPath {
  fromId: string;
  toId: string;
  color: string;
}

// ── Pip layout helper ────────────────────────────────────────────────────────

function getPipPositions(count: number, halfH: number, offsetY: number): Array<{ cx: number; cy: number }> {
  const positions: Array<{ cx: number; cy: number }> = [];
  const baseY = offsetY;
  const spacing = halfH * 0.6;

  if (count >= 1) positions.push({ cx: 0, cy: baseY });
  if (count >= 2) positions.push({ cx: -6, cy: baseY - spacing * 0.5 });
  if (count >= 3) positions.push({ cx: 6, cy: baseY - spacing * 0.5 });
  if (count >= 4) positions.push({ cx: -6, cy: baseY + spacing * 0.5 });
  if (count >= 5) positions.push({ cx: 6, cy: baseY + spacing * 0.5 });
  if (count >= 6) {
    positions.push({ cx: -6, cy: baseY });
    positions.push({ cx: 6, cy: baseY });
  }
  return positions.slice(0, count);
}

// ── Component ────────────────────────────────────────────────────────────────

export const DominoChain: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const cx = width / 2;
  const cy = height / 2;

  // ── Table surface ──────────────────────────────────────────────────────────

  const tableGradient = useMemo(() => ({
    center: { x: cx, y: cy },
    radius: Math.max(width, height) * 0.7,
  }), [cx, cy, width, height]);

  // ── Domino definitions — S-curve chain ─────────────────────────────────────

  const CASCADE_INTERVAL = 10; // frames between each domino tip

  const dominos: DominoDef[] = useMemo(() => [
    // START: API Gateway — the finger push
    {
      id: 'api', label: 'API Gateway', sublabel: 'Entry Point',
      x: 120, y: 130, color: colors.blue,
      pipTop: 1, pipBottom: 0, fallDelay: 0, fallAngle: 75,
      width: 28, height: 70,
    },
    // KEYSTONE: c9-operator — double-width
    {
      id: 'operator', label: 'c9-operator', sublabel: 'Coordinator',
      x: 250, y: 160, color: colors.cyan,
      pipTop: 6, pipBottom: 6, fallDelay: CASCADE_INTERVAL, fallAngle: 70,
      width: 44, height: 90, isKeystone: true,
    },
    // PATH A: Hub → Dashboard (curving right-upward)
    {
      id: 'hub', label: 'Hub', sublabel: 'WS Broadcast',
      x: 420, y: 120, color: colors.green,
      pipTop: 3, pipBottom: 2, fallDelay: CASCADE_INTERVAL * 2, fallAngle: 80,
      width: 28, height: 70,
    },
    {
      id: 'dashboard', label: 'Dashboard', sublabel: 'React UI',
      x: 560, y: 90, color: colors.textDim,
      pipTop: 2, pipBottom: 1, fallDelay: CASCADE_INTERVAL * 3, fallAngle: 85,
      width: 28, height: 65,
    },
    // PATH B: Broker → Agents (curving left-downward)
    {
      id: 'broker', label: 'Broker', sublabel: 'Session Lifecycle',
      x: 220, y: 310, color: colors.purple,
      pipTop: 4, pipBottom: 3, fallDelay: CASCADE_INTERVAL * 2, fallAngle: -75,
      width: 32, height: 75,
    },
    // Parallel agents — fall simultaneously
    {
      id: 'agent1', label: 'Agent \u03b1', sublabel: 'subprocess',
      x: 340, y: 380, color: colors.amber,
      pipTop: 1, pipBottom: 1, fallDelay: CASCADE_INTERVAL * 3, fallAngle: 80,
      width: 24, height: 60,
    },
    {
      id: 'agent2', label: 'Agent \u03b2', sublabel: 'subprocess',
      x: 430, y: 400, color: colors.amber,
      pipTop: 1, pipBottom: 2, fallDelay: CASCADE_INTERVAL * 3, fallAngle: 80,
      width: 24, height: 60,
    },
    {
      id: 'agent3', label: 'Agent \u03b3', sublabel: 'subprocess',
      x: 520, y: 380, color: colors.amber,
      pipTop: 1, pipBottom: 3, fallDelay: CASCADE_INTERVAL * 3, fallAngle: 80,
      width: 24, height: 60,
    },
    {
      id: 'agent4', label: 'Agent \u03b4', sublabel: 'spawned by \u03b1',
      x: 620, y: 400, color: colors.rose,
      pipTop: 1, pipBottom: 4, fallDelay: CASCADE_INTERVAL * 3 + 5, fallAngle: 80,
      width: 24, height: 60,
    },
    // PATH C: Projects (curving down from operator)
    {
      id: 'projects', label: 'Projects', sublabel: 'Storage',
      x: 140, y: 420, color: colors.textDim,
      pipTop: 2, pipBottom: 2, fallDelay: CASCADE_INTERVAL * 2 + 5, fallAngle: -80,
      width: 26, height: 65,
    },
  ], []);

  // ── Chain path lines ──────────────────────────────────────────────────────

  const chainPaths: ChainPath[] = useMemo(() => [
    { fromId: 'api', toId: 'operator', color: colors.blue },
    { fromId: 'operator', toId: 'hub', color: colors.green },
    { fromId: 'hub', toId: 'dashboard', color: colors.green },
    { fromId: 'operator', toId: 'broker', color: colors.purple },
    { fromId: 'broker', toId: 'agent1', color: colors.amber },
    { fromId: 'broker', toId: 'agent2', color: colors.amber },
    { fromId: 'broker', toId: 'agent3', color: colors.amber },
    { fromId: 'agent1', toId: 'agent4', color: colors.rose },
    { fromId: 'operator', toId: 'projects', color: colors.textDim },
  ], []);

  const dominoMap = useMemo(
    () => Object.fromEntries(dominos.map((d) => [d.id, d])),
    [dominos],
  );

  // ── Spawn ball (Agent alpha → Operator) ────────────────────────────────────

  const spawnBallStartFrame = CASCADE_INTERVAL * 3 + 15;
  const spawnBallDuration = 40;
  const spawnBallProgress = interpolate(
    frame,
    [spawnBallStartFrame, spawnBallStartFrame + spawnBallDuration],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  const agent1 = dominoMap['agent1'];
  const operator = dominoMap['operator'];
  const spawnBallX = interpolate(spawnBallProgress, [0, 1], [agent1.x, operator.x]);
  const spawnBallY = interpolate(spawnBallProgress, [0, 0.5, 1], [agent1.y, Math.min(agent1.y, operator.y) - 100, operator.y]);

  // ── Toppled counter ────────────────────────────────────────────────────────

  const totalDominos = dominos.length;
  const toppledCount = dominos.filter((d) => {
    const fallProgress = interpolate(
      frame,
      [d.fallDelay, d.fallDelay + 20],
      [0, 1],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
    );
    return fallProgress > 0.8;
  }).length;

  // ── Background dust particles ──────────────────────────────────────────────

  const dustParticles = useMemo(() => {
    const rng = seededRandom(77);
    return Array.from({ length: 60 }, () => ({
      x: rng() * width,
      y: rng() * height,
      size: rng() * 1.2 + 0.3,
      speed: rng() * 0.15 + 0.03,
      angle: rng() * Math.PI * 2,
      opacity: rng() * 0.25 + 0.05,
    }));
  }, [width, height]);

  // ── Impact particles ───────────────────────────────────────────────────────

  const renderImpactParticles = (d: DominoDef) => {
    const impactFrame = d.fallDelay + 18;
    const impactAge = frame - impactFrame;
    if (impactAge < 0 || impactAge > 30) return null;

    const rng = seededRandom(d.x * 100 + d.y);
    return (
      <g key={`impact-${d.id}`}>
        {Array.from({ length: 6 }, (_, i) => {
          const angle = rng() * Math.PI * 2;
          const dist = rng() * 25 + 10;
          const px = d.x + Math.cos(angle) * dist * (impactAge / 30);
          const py = d.y + Math.sin(angle) * dist * (impactAge / 30);
          const pOpacity = interpolate(impactAge, [0, 30], [0.8, 0], { extrapolateRight: 'clamp' });
          return (
            <circle key={i} cx={px} cy={py} r={1.5} fill={d.color} opacity={pOpacity} />
          );
        })}
      </g>
    );
  };

  // ── Click text at impact ───────────────────────────────────────────────────

  const renderClickText = (d: DominoDef) => {
    const impactFrame = d.fallDelay + 16;
    const impactAge = frame - impactFrame;
    if (impactAge < 0 || impactAge > 25) return null;

    const opacity = interpolate(impactAge, [0, 5, 25], [0, 1, 0], { extrapolateRight: 'clamp' });
    const yOff = interpolate(impactAge, [0, 25], [0, -20], { extrapolateRight: 'clamp' });

    return (
      <text
        key={`click-${d.id}`}
        x={d.x + (d.fallAngle > 0 ? 30 : -30)}
        y={d.y - 10 + yOff}
        textAnchor="middle"
        fill={colors.amber}
        fontSize={10}
        fontFamily="'Outfit', 'DM Sans', sans-serif"
        fontWeight={800}
        opacity={opacity}
        letterSpacing={2}
      >
        CLICK
      </text>
    );
  };

  // ── Render a single domino ─────────────────────────────────────────────────

  const renderDomino = (d: DominoDef) => {
    // Spring entrance
    const entrance = spring({ frame: Math.max(0, frame - Math.max(0, d.fallDelay - 15)), fps, config: { damping: 14, stiffness: 100 } });
    if (entrance <= 0.01) return null;

    // Fall animation
    const fallProgress = interpolate(
      frame,
      [d.fallDelay, d.fallDelay + 20],
      [0, 1],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
    );

    // Pre-fall wobble (anticipation)
    const wobblePhase = interpolate(
      frame,
      [Math.max(0, d.fallDelay - 8), d.fallDelay],
      [0, 1],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
    );
    const wobble = wobblePhase > 0 && wobblePhase < 1
      ? Math.sin(wobblePhase * Math.PI * 4) * 2 * wobblePhase
      : 0;

    // Current rotation: standing is 0, fallen is fallAngle
    const rotation = interpolate(fallProgress, [0, 0.7, 1], [0, d.fallAngle * 0.95, d.fallAngle]) + wobble;

    // 3D depth offset (parallelogram effect)
    const depthX = 4;
    const depthY = 3;
    const halfW = d.width / 2;
    const halfH = d.height / 2;

    // Shadow
    const shadowStretch = interpolate(Math.abs(rotation), [0, 90], [1, 3], { extrapolateRight: 'clamp' });
    const shadowOpacity = interpolate(Math.abs(rotation), [0, 90], [0.15, 0.08], { extrapolateRight: 'clamp' });

    // Motion blur lines
    const fallSpeed = fallProgress > 0.1 && fallProgress < 0.8;

    // Pivot point at the bottom of the domino
    const pivotY = halfH;

    return (
      <g key={d.id} transform={`translate(${d.x}, ${d.y})`} opacity={entrance}>
        {/* Shadow on table */}
        <ellipse
          cx={rotation > 0 ? 15 * shadowStretch : -15 * shadowStretch}
          cy={halfH + 8}
          rx={halfW * shadowStretch}
          ry={4}
          fill="black"
          opacity={shadowOpacity}
        />

        {/* Rotating group — pivot at bottom */}
        <g transform={`rotate(${rotation}, 0, ${pivotY})`}>
          {/* 3D depth side (right face) */}
          <polygon
            points={`
              ${halfW},${-halfH}
              ${halfW + depthX},${-halfH - depthY}
              ${halfW + depthX},${halfH - depthY}
              ${halfW},${halfH}
            `}
            fill={`rgba(${hexToRgb(d.color)}, 0.15)`}
            stroke={`rgba(${hexToRgb(d.color)}, 0.2)`}
            strokeWidth={0.5}
          />
          {/* 3D depth side (top face) */}
          <polygon
            points={`
              ${-halfW},${-halfH}
              ${-halfW + depthX},${-halfH - depthY}
              ${halfW + depthX},${-halfH - depthY}
              ${halfW},${-halfH}
            `}
            fill={`rgba(${hexToRgb(d.color)}, 0.2)`}
            stroke={`rgba(${hexToRgb(d.color)}, 0.25)`}
            strokeWidth={0.5}
          />

          {/* Main domino face */}
          <rect
            x={-halfW} y={-halfH}
            width={d.width} height={d.height}
            rx={4} ry={4}
            fill={colors.bgDeep}
            stroke={d.color}
            strokeWidth={d.isKeystone ? 2.5 : 1.5}
          />

          {/* Divider line */}
          <line
            x1={-halfW + 3} y1={0}
            x2={halfW - 3} y2={0}
            stroke={`rgba(${hexToRgb(d.color)}, 0.4)`}
            strokeWidth={1}
          />

          {/* Top pips */}
          {getPipPositions(d.pipTop, halfH * 0.4, -halfH * 0.45).map((p, i) => (
            <circle key={`pt${i}`} cx={p.cx} cy={p.cy} r={2.2} fill={d.color} opacity={0.9} />
          ))}

          {/* Bottom pips */}
          {getPipPositions(d.pipBottom, halfH * 0.4, halfH * 0.45).map((p, i) => (
            <circle key={`pb${i}`} cx={p.cx} cy={p.cy} r={2.2} fill={d.color} opacity={0.9} />
          ))}

          {/* Glow on keystone */}
          {d.isKeystone && (
            <rect
              x={-halfW} y={-halfH}
              width={d.width} height={d.height}
              rx={4} ry={4}
              fill="none"
              stroke={d.color}
              strokeWidth={1}
              opacity={0.3 + Math.sin(frame * 0.1) * 0.1}
              filter="url(#dominoGlow)"
            />
          )}

          {/* Motion blur lines */}
          {fallSpeed && (
            <g opacity={0.3}>
              <line x1={-halfW - 5} y1={-halfH + 5} x2={-halfW - 15} y2={-halfH - 5} stroke={d.color} strokeWidth={0.8} />
              <line x1={-halfW - 5} y1={0} x2={-halfW - 12} y2={-8} stroke={d.color} strokeWidth={0.6} />
              <line x1={-halfW - 5} y1={halfH - 5} x2={-halfW - 10} y2={halfH - 12} stroke={d.color} strokeWidth={0.5} />
            </g>
          )}
        </g>

        {/* Label (always upright, below domino) */}
        <text
          y={halfH + 24}
          textAnchor="middle"
          fill={d.color}
          fontSize={d.isKeystone ? 11 : 9}
          fontFamily="'Outfit', 'DM Sans', sans-serif"
          fontWeight={d.isKeystone ? 700 : 600}
          letterSpacing={d.isKeystone ? 1 : 0.5}
          opacity={entrance}
        >
          {d.label}
        </text>
        <text
          y={halfH + 37}
          textAnchor="middle"
          fill={colors.textMuted}
          fontSize={7}
          fontFamily="'IBM Plex Mono', monospace"
          opacity={entrance * 0.7}
        >
          {d.sublabel}
        </text>
      </g>
    );
  };

  // ── Chain guide path lines ─────────────────────────────────────────────────

  const renderChainPath = (path: ChainPath, i: number) => {
    const from = dominoMap[path.fromId];
    const to = dominoMap[path.toId];
    if (!from || !to) return null;

    const pathDelay = Math.min(from.fallDelay, to.fallDelay);
    const pathOpacity = interpolate(frame, [pathDelay, pathDelay + 15], [0, 0.2], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

    // Curved path
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2 - 20;
    const pathD = `M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`;

    return (
      <g key={`path-${i}`} opacity={pathOpacity}>
        <path
          d={pathD}
          fill="none"
          stroke={path.color}
          strokeWidth={1}
          strokeDasharray="4 6"
          opacity={0.4}
        />
        {/* Animated dot along path */}
        {frame > pathDelay + 15 && (
          <circle r={2.5} fill={path.color} opacity={0.7}>
            <animateMotion dur="2s" repeatCount="indefinite" path={pathD} />
          </circle>
        )}
      </g>
    );
  };

  // ── Finger push indicator ──────────────────────────────────────────────────

  const fingerPhase = interpolate(frame, [0, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const fingerX = interpolate(fingerPhase, [0, 1], [50, 105]);
  const fingerOpacity = interpolate(frame, [0, 5, 15, 25], [0, 0.8, 0.8, 0], { extrapolateRight: 'clamp' });

  // ── Title animation ────────────────────────────────────────────────────────

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [0, 20], [-10, 0], { extrapolateRight: 'clamp' });

  // ── Counter animation ──────────────────────────────────────────────────────

  const counterOpacity = interpolate(frame, [10, 25], [0, 1], { extrapolateRight: 'clamp' });

  // ── Spotlight ──────────────────────────────────────────────────────────────

  const spotlightOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: '#0c0806' }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          {/* Table felt texture pattern */}
          <pattern id="feltPattern" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill="#1a1510" />
            <circle cx="2" cy="2" r="0.3" fill="#2a2018" opacity="0.5" />
            <circle cx="6" cy="6" r="0.3" fill="#2a2018" opacity="0.3" />
          </pattern>

          {/* Spotlight gradient */}
          <radialGradient id="spotlight" cx="50%" cy="40%" r="55%">
            <stop offset="0%" stopColor="#3d2b1a" stopOpacity="0.25" />
            <stop offset="50%" stopColor="#1a1208" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#0c0806" stopOpacity="0" />
          </radialGradient>

          {/* Glow filters */}
          <filter id="dominoGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
          <filter id="textGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Table surface */}
        <rect width={width} height={height} fill="url(#feltPattern)" />

        {/* Spotlight pool of light */}
        <ellipse
          cx={tableGradient.center.x}
          cy={tableGradient.center.y}
          rx={tableGradient.radius * 0.7}
          ry={tableGradient.radius * 0.5}
          fill="url(#spotlight)"
          opacity={spotlightOpacity}
        />

        {/* Table edge highlight */}
        <rect
          x={30} y={30}
          width={width - 60} height={height - 60}
          rx={16} ry={16}
          fill="none"
          stroke="#3d2b1a"
          strokeWidth={2}
          opacity={0.15}
        />

        {/* Floating dust particles */}
        {dustParticles.map((p, i) => {
          const px = (p.x + Math.cos(p.angle) * p.speed * frame) % width;
          const py = (p.y + Math.sin(p.angle) * p.speed * frame) % height;
          const twinkle = 0.5 + Math.sin(frame * 0.04 + i * 0.7) * 0.5;
          return (
            <circle
              key={`dust${i}`}
              cx={px < 0 ? px + width : px}
              cy={py < 0 ? py + height : py}
              r={p.size}
              fill="#fbbf24"
              opacity={p.opacity * twinkle * spotlightOpacity}
            />
          );
        })}

        {/* Chain guide paths */}
        {chainPaths.map(renderChainPath)}

        {/* Impact particles */}
        {dominos.map(renderImpactParticles)}

        {/* Click text */}
        {dominos.map(renderClickText)}

        {/* Dominos */}
        {dominos.map(renderDomino)}

        {/* Finger push indicator */}
        <g opacity={fingerOpacity}>
          <text
            x={fingerX}
            y={130}
            textAnchor="middle"
            fontSize={28}
            fill={colors.amber}
          >
            {'\\u261B'}
          </text>
          <text
            x={fingerX - 15}
            y={108}
            textAnchor="middle"
            fill={colors.amber}
            fontSize={8}
            fontFamily="'Outfit', 'DM Sans', sans-serif"
            fontWeight={700}
            letterSpacing={1}
            opacity={0.8}
          >
            PUSH
          </text>
        </g>

        {/* Spawn ball (Agent alpha → Operator) */}
        {spawnBallProgress > 0 && spawnBallProgress < 1 && (
          <g>
            {/* Ball trail */}
            {Array.from({ length: 8 }, (_, i) => {
              const trailP = Math.max(0, spawnBallProgress - i * 0.03);
              const tx = interpolate(trailP, [0, 1], [agent1.x, operator.x]);
              const ty = interpolate(trailP, [0, 0.5, 1], [agent1.y, Math.min(agent1.y, operator.y) - 100, operator.y]);
              return (
                <circle
                  key={`trail${i}`}
                  cx={tx} cy={ty}
                  r={4 - i * 0.4}
                  fill={colors.rose}
                  opacity={(0.6 - i * 0.07)}
                />
              );
            })}
            {/* Main ball */}
            <circle cx={spawnBallX} cy={spawnBallY} r={5} fill={colors.rose} opacity={0.9} />
            <circle cx={spawnBallX} cy={spawnBallY} r={8} fill={colors.rose} opacity={0.15} filter="url(#softGlow)" />
            {/* Label */}
            <text
              x={spawnBallX + 12} y={spawnBallY - 8}
              fill={colors.rose}
              fontSize={7}
              fontFamily="'IBM Plex Mono', monospace"
              fontWeight={600}
              opacity={0.8}
            >
              spawn_request
            </text>
          </g>
        )}

        {/* Ramp visual (Agent alpha to Operator arc) */}
        {spawnBallProgress > 0 && (
          <path
            d={`M ${agent1.x} ${agent1.y} Q ${(agent1.x + operator.x) / 2} ${Math.min(agent1.y, operator.y) - 120} ${operator.x} ${operator.y}`}
            fill="none"
            stroke={colors.rose}
            strokeWidth={1}
            strokeDasharray="3 5"
            opacity={0.2}
          />
        )}

        {/* Counter */}
        <g opacity={counterOpacity} transform={`translate(${width - 180}, 40)`}>
          <rect
            x={0} y={0}
            width={155} height={36}
            rx={8}
            fill={colors.bgDeep}
            stroke={colors.amber}
            strokeWidth={1}
            opacity={0.85}
          />
          <text
            x={78} y={22}
            textAnchor="middle"
            fill={colors.amber}
            fontSize={13}
            fontFamily="'IBM Plex Mono', monospace"
            fontWeight={700}
            letterSpacing={1}
          >
            {toppledCount}/{totalDominos} TOPPLED
          </text>
        </g>

        {/* Title */}
        <g opacity={titleOpacity} transform={`translate(0, ${titleY})`}>
          <text
            x={cx} y={height - 50}
            textAnchor="middle"
            fill={colors.amber}
            fontSize={22}
            fontFamily="'Outfit', 'DM Sans', sans-serif"
            fontWeight={800}
            letterSpacing={4}
            filter="url(#textGlow)"
          >
            DOMINO CASCADE
          </text>
          <text
            x={cx} y={height - 30}
            textAnchor="middle"
            fill={colors.textMuted}
            fontSize={10}
            fontFamily="'IBM Plex Mono', monospace"
            letterSpacing={2}
          >
            SEQUENTIAL EVENT PROPAGATION
          </text>
        </g>

        {/* Path labels */}
        {frame > CASCADE_INTERVAL * 2 && (
          <g opacity={0.5}>
            <text x={440} y={75} fill={colors.green} fontSize={8} fontFamily="'IBM Plex Mono', monospace" fontWeight={600} letterSpacing={1}>
              PATH A: BROADCAST
            </text>
            <text x={160} y={280} fill={colors.purple} fontSize={8} fontFamily="'IBM Plex Mono', monospace" fontWeight={600} letterSpacing={1}>
              PATH B: AGENTS
            </text>
            <text x={80} y={400} fill={colors.textMuted} fontSize={8} fontFamily="'IBM Plex Mono', monospace" fontWeight={600} letterSpacing={1}>
              PATH C: STORAGE
            </text>
          </g>
        )}

        {/* Legend */}
        {frame > 30 && (
          <g opacity={interpolate(frame, [30, 45], [0, 0.7], { extrapolateRight: 'clamp' })} transform="translate(20, 30)">
            {[
              { color: colors.cyan, label: 'Operator (keystone)' },
              { color: colors.amber, label: 'Agent subprocess' },
              { color: colors.rose, label: 'Spawned agent' },
              { color: colors.purple, label: 'Broker (lifecycle)' },
              { color: colors.green, label: 'Hub (broadcast)' },
            ].map((item, i) => (
              <g key={`leg${i}`} transform={`translate(0, ${i * 16})`}>
                <rect x={0} y={-5} width={10} height={10} rx={2} fill={colors.bgDeep} stroke={item.color} strokeWidth={1} />
                <text x={16} y={4} fill={colors.textDim} fontSize={8} fontFamily="'IBM Plex Mono', monospace">
                  {item.label}
                </text>
              </g>
            ))}
          </g>
        )}
      </svg>
    </AbsoluteFill>
  );
};

export default DominoChain;
