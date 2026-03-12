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

interface StructureNode {
  id: string;
  label: string;
  sublabel: string;
  x: number;
  y: number;
  color: string;
  icon: string;
  size: number;
  enterDelay: number;
  isWheel?: boolean;
  wheelRadius?: number;
}

interface WaterParticle {
  offset: number; // 0-1 position along path
  speed: number;
  size: number;
  brightness: number;
}

interface Bird {
  cx: number;
  cy: number;
  radius: number;
  speed: number;
  phase: number;
  size: number;
}

// ── Penrose triangle path computation ────────────────────────────────────────

function getPenroseVertices(cx: number, cy: number, size: number): [
  { x: number; y: number },
  { x: number; y: number },
  { x: number; y: number },
] {
  // Equilateral triangle vertices — top, bottom-left, bottom-right
  const topY = cy - size * 0.55;
  const bottomY = cy + size * 0.45;
  const halfBase = size * 0.55;

  return [
    { x: cx, y: topY },                    // TOP vertex (API Gateway)
    { x: cx - halfBase, y: bottomY },       // LEFT vertex (Broker)
    { x: cx + halfBase, y: bottomY },       // RIGHT vertex (Hub)
  ];
}

// ── Lerp along edge with impossible offset ───────────────────────────────────

function lerpPoint(
  a: { x: number; y: number },
  b: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

// ── Component ────────────────────────────────────────────────────────────────

export const Waterfall: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const cx = width / 2;
  const cy = height / 2 + 10;
  const structureSize = Math.min(width, height) * 0.42;

  const [vTop, vLeft, vRight] = useMemo(
    () => getPenroseVertices(cx, cy, structureSize),
    [cx, cy, structureSize],
  );

  // ── Channel thickness for the impossible aqueduct ──────────────────────────

  const channelW = 32;
  const innerOffset = 18;

  // ── Stone block pattern ────────────────────────────────────────────────────

  const stoneBlockRows = useMemo(() => {
    const rng = seededRandom(99);
    return Array.from({ length: 12 }, () => ({
      widthFactor: rng() * 0.3 + 0.7,
      shade: rng() * 15 + 20,
    }));
  }, []);

  // ── Nodes positioned along the structure ───────────────────────────────────

  const topMid = lerpPoint(vTop, vRight, 0.5); // midpoint of top edge
  const leftMid = lerpPoint(vTop, vLeft, 0.55); // along left edge
  const bottomMid1 = lerpPoint(vLeft, vRight, 0.2);
  const bottomMid2 = lerpPoint(vLeft, vRight, 0.4);
  const bottomMid3 = lerpPoint(vLeft, vRight, 0.6);
  const bottomMid4 = lerpPoint(vLeft, vRight, 0.8);

  const nodes: StructureNode[] = useMemo(() => [
    // TOP VERTEX: API Gateway — where water enters
    {
      id: 'api', label: 'API Gateway', sublabel: 'Entry Point',
      x: vTop.x, y: vTop.y - 8, color: colors.blue, icon: '\u26A1', size: 42,
      enterDelay: 5,
    },
    // TOP EDGE MIDDLE: c9-operator — main aqueduct
    {
      id: 'operator', label: 'c9-operator', sublabel: 'Coordinator',
      x: topMid.x, y: topMid.y - 12, color: colors.cyan, icon: '\u25C8', size: 54,
      enterDelay: 0,
    },
    // LEFT VERTEX: Broker — waterfall drop
    {
      id: 'broker', label: 'Broker', sublabel: 'Session Lifecycle',
      x: vLeft.x - 10, y: vLeft.y, color: colors.purple, icon: '\u2B21', size: 42,
      enterDelay: 10,
    },
    // RIGHT VERTEX: Hub — impossible rise
    {
      id: 'hub', label: 'Hub', sublabel: 'WS Broadcast',
      x: vRight.x + 10, y: vRight.y, color: colors.green, icon: '\u25CE', size: 42,
      enterDelay: 10,
    },
    // LEFT EDGE: Projects as water wheel
    {
      id: 'projects', label: 'Projects', sublabel: 'Storage',
      x: leftMid.x - 20, y: leftMid.y, color: colors.textDim, icon: '\u25A3', size: 36,
      enterDelay: 18, isWheel: true, wheelRadius: 22,
    },
    // BOTTOM EDGE: Agents as waterwheels in series
    {
      id: 'agent1', label: 'Agent \u03b1', sublabel: 'subprocess',
      x: bottomMid1.x, y: bottomMid1.y + 12, color: colors.amber, icon: '\u2605', size: 32,
      enterDelay: 20, isWheel: true, wheelRadius: 18,
    },
    {
      id: 'agent2', label: 'Agent \u03b2', sublabel: 'subprocess',
      x: bottomMid2.x, y: bottomMid2.y + 16, color: colors.amber, icon: '\u2605', size: 32,
      enterDelay: 24, isWheel: true, wheelRadius: 18,
    },
    {
      id: 'agent3', label: 'Agent \u03b3', sublabel: 'subprocess',
      x: bottomMid3.x, y: bottomMid3.y + 16, color: colors.amber, icon: '\u2605', size: 32,
      enterDelay: 28, isWheel: true, wheelRadius: 18,
    },
    {
      id: 'agent4', label: 'Agent \u03b4', sublabel: 'spawned by \u03b1',
      x: bottomMid4.x, y: bottomMid4.y + 12, color: colors.rose, icon: '\u2726', size: 30,
      enterDelay: 32, isWheel: true, wheelRadius: 16,
    },
    // FLOATING: Dashboard as observatory platform
    {
      id: 'dashboard', label: 'Dashboard', sublabel: 'React + Remotion',
      x: cx + 40, y: vTop.y - 70, color: colors.textDim, icon: '\u25E7', size: 36,
      enterDelay: 15,
    },
  ], [vTop, vLeft, vRight, topMid, leftMid, bottomMid1, bottomMid2, bottomMid3, bottomMid4, cx]);

  // ── Water particles flowing along the triangle ─────────────────────────────

  const waterParticles: WaterParticle[] = useMemo(() => {
    const rng = seededRandom(42);
    return Array.from({ length: 80 }, () => ({
      offset: rng(),
      speed: rng() * 0.003 + 0.002,
      size: rng() * 2.5 + 1,
      brightness: rng() * 0.4 + 0.4,
    }));
  }, []);

  // Get position along the full triangle perimeter (0-1)
  const getWaterPosition = (t: number): { x: number; y: number } => {
    const normalizedT = ((t % 1) + 1) % 1; // ensure 0-1

    if (normalizedT < 1 / 3) {
      // Top edge: vTop → vRight (through operator)
      return lerpPoint(vTop, vRight, normalizedT * 3);
    } else if (normalizedT < 2 / 3) {
      // Right edge going down: vRight → vLeft (impossible rise, but visually bottom)
      return lerpPoint(vRight, vLeft, (normalizedT - 1 / 3) * 3);
    } else {
      // Left edge going up: vLeft → vTop (the waterfall drop)
      return lerpPoint(vLeft, vTop, (normalizedT - 2 / 3) * 3);
    }
  };

  // ── Waterfall splash particles ─────────────────────────────────────────────

  const splashParticles = useMemo(() => {
    const rng = seededRandom(123);
    return Array.from({ length: 25 }, () => ({
      angle: rng() * Math.PI - Math.PI / 2,
      dist: rng() * 20 + 5,
      size: rng() * 2 + 0.5,
      speed: rng() * 0.5 + 0.3,
      phase: rng() * Math.PI * 2,
    }));
  }, []);

  // ── Circling birds ─────────────────────────────────────────────────────────

  const birds: Bird[] = useMemo(() => {
    const rng = seededRandom(333);
    return Array.from({ length: 5 }, () => ({
      cx: cx + (rng() - 0.5) * 100,
      cy: cy - 80 + (rng() - 0.5) * 60,
      radius: rng() * 60 + 40,
      speed: rng() * 0.015 + 0.008,
      phase: rng() * Math.PI * 2,
      size: rng() * 3 + 2,
    }));
  }, [cx, cy]);

  // ── Moss spots ─────────────────────────────────────────────────────────────

  const mossSpots = useMemo(() => {
    const rng = seededRandom(555);
    return Array.from({ length: 30 }, () => ({
      edgeT: rng(),
      offsetX: (rng() - 0.5) * channelW * 0.8,
      offsetY: (rng() - 0.5) * 10,
      size: rng() * 5 + 2,
      opacity: rng() * 0.3 + 0.1,
    }));
  }, [channelW]);

  // ── Background tessellation ────────────────────────────────────────────────

  const tessellationOpacity = interpolate(frame, [0, 30], [0, 0.04], { extrapolateRight: 'clamp' });

  // ── Structure assembly animation ───────────────────────────────────────────

  const assemblyProgress = interpolate(frame, [0, 40], [0, 1], { extrapolateRight: 'clamp' });

  // ── Perpetual flow indicator ───────────────────────────────────────────────

  const flowIndicatorOpacity = interpolate(frame, [40, 55], [0, 1], { extrapolateRight: 'clamp' });
  const flowPulse = 0.7 + Math.sin(frame * 0.06) * 0.3;

  // ── Title animation ────────────────────────────────────────────────────────

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [0, 20], [-10, 0], { extrapolateRight: 'clamp' });

  // ── Render a waterwheel ────────────────────────────────────────────────────

  const renderWheel = (node: StructureNode) => {
    const r = node.wheelRadius || 18;
    const spokeCount = 6;
    const rotation = frame * 2; // degrees per frame

    return (
      <g>
        {/* Wheel rim */}
        <circle cx={0} cy={0} r={r} fill="none" stroke={`rgba(${hexToRgb(node.color)}, 0.5)`} strokeWidth={2} />
        {/* Spokes */}
        {Array.from({ length: spokeCount }, (_, i) => {
          const angle = (i / spokeCount) * 360 + rotation;
          const rad = (angle * Math.PI) / 180;
          return (
            <line
              key={`spoke${i}`}
              x1={0} y1={0}
              x2={Math.cos(rad) * r} y2={Math.sin(rad) * r}
              stroke={`rgba(${hexToRgb(node.color)}, 0.35)`}
              strokeWidth={1.5}
            />
          );
        })}
        {/* Paddles on rim */}
        {Array.from({ length: spokeCount }, (_, i) => {
          const angle = (i / spokeCount) * 360 + rotation;
          const rad = (angle * Math.PI) / 180;
          const px = Math.cos(rad) * r;
          const py = Math.sin(rad) * r;
          return (
            <rect
              key={`paddle${i}`}
              x={px - 3} y={py - 5}
              width={6} height={10}
              rx={1}
              fill={`rgba(${hexToRgb(node.color)}, 0.25)`}
              stroke={`rgba(${hexToRgb(node.color)}, 0.4)`}
              strokeWidth={0.5}
              transform={`rotate(${angle}, ${px}, ${py})`}
            />
          );
        })}
        {/* Center hub */}
        <circle cx={0} cy={0} r={4} fill={colors.bgDeep} stroke={node.color} strokeWidth={1.5} />
      </g>
    );
  };

  // ── Render a structure node ────────────────────────────────────────────────

  const renderNode = (node: StructureNode) => {
    const s = spring({ frame: frame - node.enterDelay, fps, config: { damping: 12, stiffness: 80 } });
    if (s <= 0.01) return null;

    const isOperator = node.id === 'operator';
    const pulse = isOperator ? 1 + Math.sin(frame * 0.08) * 0.04 : 1;

    return (
      <g key={node.id} transform={`translate(${node.x}, ${node.y}) scale(${s * pulse})`}>
        {/* Glow */}
        <circle
          r={node.size / 2 + 10}
          fill={`rgba(${hexToRgb(node.color)}, 0.06)`}
          stroke="none"
        />

        {/* Water wheel if applicable */}
        {node.isWheel && renderWheel(node)}

        {/* Stone pedestal */}
        <rect
          x={-node.size / 2 - 4} y={-node.size / 2 - 4}
          width={node.size + 8} height={node.size + 8}
          rx={4}
          fill={`rgba(40, 38, 35, 0.8)`}
          stroke={`rgba(${hexToRgb(node.color)}, 0.3)`}
          strokeWidth={1}
        />
        {/* Stone texture lines */}
        <line
          x1={-node.size / 2 - 2} y1={0}
          x2={node.size / 2 + 2} y2={0}
          stroke="rgba(80,75,70,0.3)"
          strokeWidth={0.5}
        />
        <line
          x1={0} y1={-node.size / 2 - 2}
          x2={0} y2={node.size / 2 + 2}
          stroke="rgba(80,75,70,0.2)"
          strokeWidth={0.5}
        />

        {/* Inner face */}
        <rect
          x={-node.size / 2} y={-node.size / 2}
          width={node.size} height={node.size}
          rx={3}
          fill={colors.bgDeep}
          stroke={node.color}
          strokeWidth={isOperator ? 2 : 1.2}
        />

        {/* Icon */}
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={isOperator ? 22 : 15}
          fill={node.color}
          style={{ filter: `drop-shadow(0 0 4px rgba(${hexToRgb(node.color)}, 0.4))` }}
        >
          {node.icon}
        </text>

        {/* Label */}
        <text
          y={node.size / 2 + 16}
          textAnchor="middle"
          fill={colors.text}
          fontSize={isOperator ? 12 : 9}
          fontFamily="'Outfit', 'DM Sans', sans-serif"
          fontWeight={isOperator ? 700 : 600}
          letterSpacing={isOperator ? 1.5 : 0.5}
        >
          {node.label}
        </text>
        {node.sublabel && (
          <text
            y={node.size / 2 + 28}
            textAnchor="middle"
            fill={colors.textMuted}
            fontSize={7}
            fontFamily="'IBM Plex Mono', monospace"
          >
            {node.sublabel}
          </text>
        )}
      </g>
    );
  };

  // ── Column rendering (Doric style) ─────────────────────────────────────────

  const renderColumn = (bx: number, by: number, colHeight: number, delay: number) => {
    const s = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 90 } });
    if (s <= 0.01) return null;

    const colW = 10;
    return (
      <g opacity={s} transform={`translate(${bx}, ${by})`}>
        {/* Capital (top) */}
        <rect x={-colW - 2} y={0} width={colW * 2 + 4} height={5} rx={1} fill="#4a453f" stroke="#5a5550" strokeWidth={0.5} />
        {/* Shaft with fluting */}
        <rect x={-colW / 2} y={5} width={colW} height={colHeight - 10} fill="#3a3530" stroke="#4a4540" strokeWidth={0.5} />
        {/* Fluting lines */}
        {Array.from({ length: 3 }, (_, i) => (
          <line
            key={`flute${i}`}
            x1={-colW / 2 + 2 + i * 3} y1={6}
            x2={-colW / 2 + 2 + i * 3} y2={colHeight - 6}
            stroke="rgba(60,55,50,0.5)"
            strokeWidth={0.5}
          />
        ))}
        {/* Base */}
        <rect x={-colW - 2} y={colHeight - 5} width={colW * 2 + 4} height={5} rx={1} fill="#4a453f" stroke="#5a5550" strokeWidth={0.5} />
      </g>
    );
  };

  // ── Build the impossible triangle structure ────────────────────────────────

  const renderAqueductEdge = (
    a: { x: number; y: number },
    b: { x: number; y: number },
    edgeColor: string,
    delay: number,
  ) => {
    const s = spring({ frame: frame - delay, fps, config: { damping: 15, stiffness: 70 } });
    if (s <= 0.01) return null;

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx = -dy / len; // normal
    const ny = dx / len;

    // Outer walls of the channel
    const outerX = nx * channelW / 2;
    const outerY = ny * channelW / 2;
    const innerX = nx * innerOffset / 2;
    const innerY = ny * innerOffset / 2;

    // Stone block segments along this edge
    const blockCount = Math.floor(len / 18);

    return (
      <g opacity={s}>
        {/* Channel outer wall */}
        <line
          x1={a.x + outerX} y1={a.y + outerY}
          x2={a.x + dx * s + outerX} y2={a.y + dy * s + outerY}
          stroke="#5a5550"
          strokeWidth={2}
        />
        <line
          x1={a.x - outerX} y1={a.y - outerY}
          x2={a.x + dx * s - outerX} y2={a.y + dy * s - outerY}
          stroke="#5a5550"
          strokeWidth={2}
        />

        {/* Channel fill (water trough) */}
        <line
          x1={a.x} y1={a.y}
          x2={a.x + dx * s} y2={a.y + dy * s}
          stroke={`rgba(${hexToRgb(edgeColor)}, 0.08)`}
          strokeWidth={channelW - 4}
        />

        {/* Stone block mortar lines */}
        {Array.from({ length: blockCount }, (_, i) => {
          const t = (i + 0.5) / blockCount;
          if (t > s) return null;
          const mx = a.x + dx * t;
          const my = a.y + dy * t;
          const shade = stoneBlockRows[i % stoneBlockRows.length].shade;
          return (
            <line
              key={`block${i}`}
              x1={mx + innerX} y1={my + innerY}
              x2={mx - innerX} y2={my - innerY}
              stroke={`rgba(${shade + 30}, ${shade + 25}, ${shade + 20}, 0.3)`}
              strokeWidth={0.5}
            />
          );
        })}
      </g>
    );
  };

  // ── Hub→Dashboard connection (telescope platform strut) ────────────────────

  const dashNode = nodes.find((n) => n.id === 'dashboard');
  const hubNode = nodes.find((n) => n.id === 'hub');
  const opNode = nodes.find((n) => n.id === 'operator');

  const strutOpacity = interpolate(frame, [15, 30], [0, 0.5], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: '#08090e' }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          {/* Glow filters */}
          <filter id="waterGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="nodeGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="textGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Escher tessellation pattern */}
          <pattern id="tessellation" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
            <rect width="40" height="40" fill="none" />
            <path d="M 0 20 L 10 0 L 30 0 L 40 20 L 30 40 L 10 40 Z" fill="none" stroke="rgba(100,116,139,0.08)" strokeWidth="0.5" />
            <path d="M 20 0 L 40 10 L 40 30 L 20 40 L 0 30 L 0 10 Z" fill="none" stroke="rgba(103,232,249,0.04)" strokeWidth="0.3" />
          </pattern>

          {/* Water gradient */}
          <linearGradient id="waterGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={colors.blue} stopOpacity="0.6" />
            <stop offset="50%" stopColor={colors.cyan} stopOpacity="0.8" />
            <stop offset="100%" stopColor={colors.blue} stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {/* Tessellated background */}
        <rect width={width} height={height} fill="url(#tessellation)" opacity={tessellationOpacity} />

        {/* Ambient radial glow */}
        <circle cx={cx} cy={cy} r={structureSize * 0.8} fill={`rgba(${hexToRgb(colors.cyan)}, 0.03)`} />
        <circle cx={cx} cy={cy} r={structureSize * 0.5} fill={`rgba(${hexToRgb(colors.purple)}, 0.02)`} />

        {/* ── The impossible aqueduct structure ─────────────────────────────── */}

        {/* Edge: Top → Right (API → Hub via Operator) */}
        {renderAqueductEdge(vTop, vRight, colors.cyan, 3)}
        {/* Edge: Top → Left (API → Broker, the falling edge) */}
        {renderAqueductEdge(vTop, vLeft, colors.purple, 6)}
        {/* Edge: Left → Right (Broker → Hub, the impossible rising edge) */}
        {renderAqueductEdge(vLeft, vRight, colors.amber, 9)}

        {/* Columns supporting the structure */}
        {renderColumn(vTop.x - 30, vTop.y + 15, 50, 5)}
        {renderColumn(vTop.x + 30, vTop.y + 15, 55, 7)}
        {renderColumn(vLeft.x + 20, vLeft.y - 60, 55, 10)}
        {renderColumn(vRight.x - 20, vRight.y - 60, 55, 12)}
        {renderColumn(cx - 60, cy + 40, 70, 8)}
        {renderColumn(cx + 60, cy + 40, 65, 9)}

        {/* Vertex waterfall splashes */}
        {[vTop, vLeft, vRight].map((v, vi) => (
          <g key={`splash${vi}`}>
            {splashParticles.map((sp, si) => {
              const t = ((frame * sp.speed + sp.phase) % (Math.PI * 2));
              const splashDist = Math.abs(Math.sin(t)) * sp.dist;
              const sx = v.x + Math.cos(sp.angle) * splashDist;
              const sy = v.y + Math.sin(sp.angle) * splashDist - Math.abs(Math.sin(t)) * 8;
              const sOpacity = (1 - splashDist / sp.dist) * 0.4 * assemblyProgress;
              return (
                <circle
                  key={`sp${vi}-${si}`}
                  cx={sx} cy={sy}
                  r={sp.size}
                  fill={colors.cyan}
                  opacity={sOpacity}
                />
              );
            })}
          </g>
        ))}

        {/* ── Water particles flowing along the triangle ──────────────────── */}
        {assemblyProgress > 0.5 && waterParticles.map((wp, i) => {
          const t = ((wp.offset + frame * wp.speed) % 1 + 1) % 1;
          const pos = getWaterPosition(t);
          return (
            <circle
              key={`water${i}`}
              cx={pos.x}
              cy={pos.y}
              r={wp.size}
              fill={colors.cyan}
              opacity={wp.brightness * interpolate(assemblyProgress, [0.5, 1], [0, 1], { extrapolateRight: 'clamp' })}
            />
          );
        })}

        {/* Fish (event particles) swimming in the water */}
        {frame > 35 && Array.from({ length: 6 }, (_, i) => {
          const fishT = ((i * 0.15 + frame * 0.004) % 1 + 1) % 1;
          const fishPos = getWaterPosition(fishT);
          const fishOpacity = interpolate(frame, [35, 50], [0, 0.6], { extrapolateRight: 'clamp' });
          const wiggle = Math.sin(frame * 0.15 + i * 2) * 3;
          return (
            <g key={`fish${i}`} transform={`translate(${fishPos.x + wiggle}, ${fishPos.y})`} opacity={fishOpacity}>
              {/* Fish body */}
              <ellipse cx={0} cy={0} rx={4} ry={2} fill={colors.amber} opacity={0.7} />
              {/* Tail */}
              <polygon points="-5,-2 -5,2 -8,0" fill={colors.amber} opacity={0.5} />
            </g>
          );
        })}

        {/* Moss growing on stone */}
        {mossSpots.map((moss, i) => {
          const mossPos = getWaterPosition(moss.edgeT);
          const growthDelay = 30 + i * 0.5;
          const mossGrowth = interpolate(frame, [growthDelay, growthDelay + 40], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          if (mossGrowth <= 0) return null;
          return (
            <circle
              key={`moss${i}`}
              cx={mossPos.x + moss.offsetX}
              cy={mossPos.y + moss.offsetY}
              r={moss.size * mossGrowth}
              fill={colors.green}
              opacity={moss.opacity * mossGrowth}
            />
          );
        })}

        {/* Circling birds */}
        {birds.map((bird, i) => {
          const bAngle = frame * bird.speed + bird.phase;
          const bx = bird.cx + Math.cos(bAngle) * bird.radius;
          const by = bird.cy + Math.sin(bAngle) * bird.radius * 0.4; // flattened orbit
          const birdOpacity = interpolate(frame, [20, 35], [0, 0.5], { extrapolateRight: 'clamp' });
          const wingFlap = Math.sin(frame * 0.3 + i * 2) * 4;
          return (
            <g key={`bird${i}`} transform={`translate(${bx}, ${by})`} opacity={birdOpacity}>
              {/* Wing left */}
              <line x1={0} y1={0} x2={-bird.size} y2={wingFlap} stroke={colors.textDim} strokeWidth={1} />
              {/* Wing right */}
              <line x1={0} y1={0} x2={bird.size} y2={wingFlap} stroke={colors.textDim} strokeWidth={1} />
              {/* Body */}
              <circle cx={0} cy={0} r={1} fill={colors.textDim} />
            </g>
          );
        })}

        {/* Dashboard strut (from structure to floating platform) */}
        {dashNode && hubNode && (
          <g opacity={strutOpacity}>
            <line
              x1={hubNode.x} y1={hubNode.y - 20}
              x2={dashNode.x} y2={dashNode.y + 20}
              stroke={colors.textMuted}
              strokeWidth={1}
              strokeDasharray="4 3"
            />
            {/* Telescope/observatory dome */}
            <path
              d={`M ${dashNode.x - 18} ${dashNode.y - 24} Q ${dashNode.x} ${dashNode.y - 40} ${dashNode.x + 18} ${dashNode.y - 24}`}
              fill="none"
              stroke={colors.textDim}
              strokeWidth={1}
              opacity={0.4}
            />
          </g>
        )}

        {/* Spawn request arc: Agent alpha → Operator (via structure) */}
        {opNode && (
          <g opacity={interpolate(frame, [45, 55], [0, 0.4], { extrapolateRight: 'clamp' })}>
            <path
              d={`M ${nodes[5].x} ${nodes[5].y - 20} Q ${cx - 80} ${cy - 60} ${opNode.x} ${opNode.y + 30}`}
              fill="none"
              stroke={colors.rose}
              strokeWidth={1}
              strokeDasharray="3 4"
            />
            {frame > 50 && (
              <circle r={3} fill={colors.rose} opacity={0.7}>
                <animateMotion
                  dur="3s"
                  repeatCount="indefinite"
                  path={`M ${nodes[5].x} ${nodes[5].y - 20} Q ${cx - 80} ${cy - 60} ${opNode.x} ${opNode.y + 30}`}
                />
              </circle>
            )}
            <text
              x={cx - 90} y={cy - 65}
              fill={colors.rose}
              fontSize={7}
              fontFamily="'IBM Plex Mono', monospace"
              fontWeight={600}
              opacity={0.6}
            >
              spawn_request
            </text>
          </g>
        )}

        {/* ── Nodes ────────────────────────────────────────────────────────── */}
        {nodes.map(renderNode)}

        {/* PERPETUAL FLOW indicator */}
        <g opacity={flowIndicatorOpacity} transform={`translate(${width - 170}, 35)`}>
          <rect
            x={0} y={0} width={148} height={32}
            rx={6}
            fill="rgba(5,5,16,0.85)"
            stroke={colors.cyan}
            strokeWidth={1}
          />
          {/* Pulsing dot */}
          <circle cx={16} cy={16} r={4} fill={colors.cyan} opacity={flowPulse} />
          <circle cx={16} cy={16} r={6} fill="none" stroke={colors.cyan} strokeWidth={0.5} opacity={flowPulse * 0.4} />
          <text
            x={28} y={20}
            fill={colors.cyan}
            fontSize={10}
            fontFamily="'IBM Plex Mono', monospace"
            fontWeight={700}
            letterSpacing={1}
          >
            PERPETUAL FLOW
          </text>
        </g>

        {/* Title */}
        <g opacity={titleOpacity} transform={`translate(0, ${titleY})`}>
          <text
            x={cx} y={height - 45}
            textAnchor="middle"
            fill={colors.cyan}
            fontSize={22}
            fontFamily="'Outfit', 'DM Sans', sans-serif"
            fontWeight={800}
            letterSpacing={4}
            filter="url(#textGlow)"
          >
            IMPOSSIBLE WATERFALL
          </text>
          <text
            x={cx} y={height - 25}
            textAnchor="middle"
            fill={colors.textMuted}
            fontSize={10}
            fontFamily="'IBM Plex Mono', monospace"
            letterSpacing={2}
          >
            ESCHER-STYLE PERPETUAL DATA FLOW
          </text>
        </g>

        {/* Legend */}
        {frame > 30 && (
          <g opacity={interpolate(frame, [30, 45], [0, 0.7], { extrapolateRight: 'clamp' })} transform="translate(20, 30)">
            {[
              { color: colors.cyan, label: 'Operator (aqueduct)' },
              { color: colors.amber, label: 'Agent waterwheels' },
              { color: colors.rose, label: 'Spawned agent' },
              { color: colors.purple, label: 'Broker (waterfall)' },
              { color: colors.green, label: 'Hub (impossible rise)' },
            ].map((item, i) => (
              <g key={`leg${i}`} transform={`translate(0, ${i * 16})`}>
                <circle cx={5} cy={0} r={4} fill={item.color} opacity={0.8} />
                <text x={15} y={4} fill={colors.textDim} fontSize={8} fontFamily="'IBM Plex Mono', monospace">
                  {item.label}
                </text>
              </g>
            ))}
          </g>
        )}

        {/* Impossible shadow play — offset shadow of the triangle */}
        <g opacity={0.04 * assemblyProgress}>
          <polygon
            points={`${vTop.x + 15},${vTop.y + 20} ${vLeft.x + 15},${vLeft.y + 20} ${vRight.x + 15},${vRight.y + 20}`}
            fill="none"
            stroke={colors.purple}
            strokeWidth={channelW}
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </AbsoluteFill>
  );
};

export default Waterfall;
