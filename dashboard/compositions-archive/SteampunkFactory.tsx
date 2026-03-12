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

// ── Steampunk palette ────────────────────────────────────────────────────────

const sp = {
  brass: '#c8a84e',
  copper: '#b87333',
  iron: '#2a2a2a',
  steam: '#e8e0d0',
  patina: '#4a7c59',
  burgundy: '#722F37',
  amber: '#d4a574',
  darkBrick: '#1a1210',
  rivets: '#8b7d3c',
  pipeStroke: '#9a8234',
  gaugeRed: '#c0392b',
  gaugeFace: '#f5f0e0',
};

// ── Types ────────────────────────────────────────────────────────────────────

interface SteamNode {
  id: string;
  label: string;
  sublabel: string;
  x: number;
  y: number;
  color: string;
  icon: string;
  size: number;
  enterDelay: number;
  shape: 'boiler' | 'machine' | 'telegraph' | 'automaton' | 'gate' | 'cabinet' | 'panel';
}

interface SteamPipe {
  from: string;
  to: string;
  label?: string;
  color: string;
  enterDelay: number;
  conveyor?: boolean;
}

// ── Component ────────────────────────────────────────────────────────────────

export const SteampunkFactory: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const cx = width / 2;
  const cy = height / 2;

  // ── Soot / ember particles ───────────────────────────────────────────────

  const sootParticles = useMemo(() => {
    const rng = seededRandom(99);
    return Array.from({ length: 80 }, () => ({
      x: rng() * width,
      baseY: rng() * height,
      size: rng() * 2 + 0.5,
      speed: rng() * 0.6 + 0.2,
      drift: (rng() - 0.5) * 0.3,
      opacity: rng() * 0.5 + 0.1,
      isEmber: rng() > 0.85,
    }));
  }, [width, height]);

  // ── Background gears ─────────────────────────────────────────────────────

  const bgGears = useMemo(() => {
    const rng = seededRandom(77);
    return Array.from({ length: 12 }, () => ({
      x: rng() * width,
      y: rng() * height,
      r: rng() * 60 + 30,
      teeth: Math.floor(rng() * 8) + 8,
      speed: (rng() - 0.5) * 0.008,
      opacity: rng() * 0.06 + 0.02,
    }));
  }, [width, height]);

  // ── Steam wisps ──────────────────────────────────────────────────────────

  const steamWisps = useMemo(() => {
    const rng = seededRandom(55);
    return Array.from({ length: 14 }, () => ({
      x: rng() * width,
      baseY: rng() * height * 0.6 + height * 0.2,
      width: rng() * 30 + 10,
      height: rng() * 40 + 20,
      speed: rng() * 0.8 + 0.3,
      phase: rng() * Math.PI * 2,
      opacity: rng() * 0.12 + 0.04,
    }));
  }, [width, height]);

  // ── Node definitions ─────────────────────────────────────────────────────

  const nodes: SteamNode[] = [
    {
      id: 'operator', label: 'c9-operator', sublabel: 'Central Boiler',
      x: cx, y: cy - 10, color: sp.brass, icon: '\u2699', size: 90, enterDelay: 0, shape: 'boiler',
    },
    {
      id: 'broker', label: 'Broker', sublabel: 'Sorting Machine',
      x: cx - 280, y: cy - 10, color: sp.copper, icon: '\u2692', size: 58, enterDelay: 10, shape: 'machine',
    },
    {
      id: 'hub', label: 'Hub', sublabel: 'Telegraph Station',
      x: cx + 280, y: cy - 10, color: sp.patina, icon: '\u26A1', size: 58, enterDelay: 10, shape: 'telegraph',
    },
    {
      id: 'agent1', label: 'Agent \u03B1', sublabel: 'Automaton',
      x: cx - 260, y: cy + 195, color: sp.amber, icon: '\u2606', size: 46, enterDelay: 20, shape: 'automaton',
    },
    {
      id: 'agent2', label: 'Agent \u03B2', sublabel: 'Automaton',
      x: cx - 80, y: cy + 215, color: sp.amber, icon: '\u2606', size: 46, enterDelay: 25, shape: 'automaton',
    },
    {
      id: 'agent3', label: 'Agent \u03B3', sublabel: 'Automaton',
      x: cx + 100, y: cy + 195, color: sp.amber, icon: '\u2606', size: 46, enterDelay: 30, shape: 'automaton',
    },
    {
      id: 'agent4', label: 'Agent \u03B4', sublabel: 'Sub-automaton',
      x: cx + 280, y: cy + 215, color: sp.burgundy, icon: '\u2726', size: 42, enterDelay: 50, shape: 'automaton',
    },
    {
      id: 'api', label: 'API Gateway', sublabel: 'Grand Entrance',
      x: cx, y: 90, color: sp.brass, icon: '\u2756', size: 56, enterDelay: 5, shape: 'gate',
    },
    {
      id: 'projects', label: 'Projects', sublabel: 'Filing Cabinets',
      x: cx - 320, y: 100, color: sp.copper, icon: '\u2750', size: 46, enterDelay: 15, shape: 'cabinet',
    },
    {
      id: 'dashboard', label: 'Dashboard', sublabel: 'Control Panel',
      x: cx + 320, y: 100, color: sp.patina, icon: '\u25E7', size: 46, enterDelay: 15, shape: 'panel',
    },
  ];

  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));

  // ── Pipe definitions ─────────────────────────────────────────────────────

  const pipes: SteamPipe[] = [
    { from: 'api', to: 'operator', label: 'dispatch', color: sp.brass, enterDelay: 8 },
    { from: 'operator', to: 'broker', label: 'spawn', color: sp.copper, enterDelay: 12 },
    { from: 'operator', to: 'hub', label: 'events', color: sp.patina, enterDelay: 12 },
    { from: 'broker', to: 'agent1', color: sp.amber, enterDelay: 22, conveyor: true },
    { from: 'broker', to: 'agent2', color: sp.amber, enterDelay: 27, conveyor: true },
    { from: 'broker', to: 'agent3', color: sp.amber, enterDelay: 32, conveyor: true },
    { from: 'agent1', to: 'operator', label: 'spawn_req', color: sp.burgundy, enterDelay: 45 },
    { from: 'broker', to: 'agent4', color: sp.burgundy, enterDelay: 52, conveyor: true },
    { from: 'hub', to: 'dashboard', label: 'stream', color: sp.patina, enterDelay: 16 },
    { from: 'projects', to: 'api', label: 'CRUD', color: sp.copper, enterDelay: 18 },
    { from: 'agent2', to: 'hub', color: sp.amber, enterDelay: 35 },
  ];

  // ── Title animation ──────────────────────────────────────────────────────

  const titleOpacity = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [0, 25], [-12, 0], { extrapolateRight: 'clamp' });

  // ── Brick pattern ────────────────────────────────────────────────────────

  const brickOpacity = interpolate(frame, [0, 20], [0, 0.15], { extrapolateRight: 'clamp' });

  // ── Render: gear SVG path ────────────────────────────────────────────────

  const gearPath = (teeth: number, outerR: number, innerR: number): string => {
    const segments: string[] = [];
    const toothWidth = Math.PI / teeth;
    for (let i = 0; i < teeth; i++) {
      const a1 = (i / teeth) * Math.PI * 2;
      const a2 = a1 + toothWidth * 0.3;
      const a3 = a1 + toothWidth * 0.7;
      const a4 = a1 + toothWidth;
      segments.push(
        `${i === 0 ? 'M' : 'L'} ${Math.cos(a1) * innerR} ${Math.sin(a1) * innerR}`,
        `L ${Math.cos(a2) * outerR} ${Math.sin(a2) * outerR}`,
        `L ${Math.cos(a3) * outerR} ${Math.sin(a3) * outerR}`,
        `L ${Math.cos(a4) * innerR} ${Math.sin(a4) * innerR}`,
      );
    }
    segments.push('Z');
    return segments.join(' ');
  };

  // ── Render: rivets along a line ──────────────────────────────────────────

  const renderRivets = (
    x1: number, y1: number, x2: number, y2: number, count: number, key: string,
  ) => {
    const rivets: React.ReactElement[] = [];
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      rivets.push(
        <circle
          key={`${key}-r${i}`}
          cx={x1 + (x2 - x1) * t}
          cy={y1 + (y2 - y1) * t}
          r={2}
          fill={sp.rivets}
          opacity={0.6}
        />,
      );
    }
    return rivets;
  };

  // ── Render: pressure gauge ───────────────────────────────────────────────

  const renderGauge = (gx: number, gy: number, r: number, key: string) => {
    const needleAngle = -60 + Math.sin(frame * 0.06 + gx * 0.01) * 50;
    return (
      <g key={key}>
        <circle cx={gx} cy={gy} r={r} fill={sp.gaugeFace} stroke={sp.copper} strokeWidth={2} />
        <circle cx={gx} cy={gy} r={r - 2} fill="none" stroke={sp.iron} strokeWidth={0.5} />
        {/* Gauge ticks */}
        {Array.from({ length: 7 }, (_, i) => {
          const a = (-120 + i * 40) * (Math.PI / 180);
          return (
            <line
              key={`${key}-t${i}`}
              x1={gx + Math.cos(a) * (r - 4)}
              y1={gy + Math.sin(a) * (r - 4)}
              x2={gx + Math.cos(a) * (r - 7)}
              y2={gy + Math.sin(a) * (r - 7)}
              stroke={sp.iron}
              strokeWidth={1}
            />
          );
        })}
        {/* Needle */}
        <line
          x1={gx}
          y1={gy}
          x2={gx + Math.cos(needleAngle * Math.PI / 180) * (r - 5)}
          y2={gy + Math.sin(needleAngle * Math.PI / 180) * (r - 5)}
          stroke={sp.gaugeRed}
          strokeWidth={1.5}
        />
        <circle cx={gx} cy={gy} r={2} fill={sp.iron} />
      </g>
    );
  };

  // ── Render: pipe with rivets and steam ───────────────────────────────────

  const renderPipe = (pipe: SteamPipe, i: number) => {
    const fromNode = nodeMap[pipe.from];
    const toNode = nodeMap[pipe.to];
    if (!fromNode || !toNode) return null;

    const progress = interpolate(frame, [pipe.enterDelay, pipe.enterDelay + 25], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    if (progress <= 0) return null;

    const dx = toNode.x - fromNode.x;
    const dy = toNode.y - fromNode.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const nx = dx / dist;
    const ny = dy / dist;

    const fromR = fromNode.size / 2 + 10;
    const toR = toNode.size / 2 + 10;
    const x1 = fromNode.x + nx * fromR;
    const y1 = fromNode.y + ny * fromR;
    const x2 = fromNode.x + dx - nx * toR;
    const y2 = fromNode.y + dy - ny * toR;

    const ex = x1 + (x2 - x1) * progress;
    const ey = y1 + (y2 - y1) * progress;

    const pipeWidth = pipe.conveyor ? 6 : 8;
    const dashOffset = pipe.conveyor ? -frame * 2 : 0;

    // Joint position (midpoint)
    const jx = (x1 + ex) / 2;
    const jy = (y1 + ey) / 2;

    return (
      <g key={`pipe-${i}`} opacity={progress}>
        {/* Pipe shadow */}
        <line
          x1={x1} y1={y1} x2={ex} y2={ey}
          stroke={sp.iron}
          strokeWidth={pipeWidth + 4}
          strokeLinecap="round"
          opacity={0.4}
        />
        {/* Main pipe */}
        <line
          x1={x1} y1={y1} x2={ex} y2={ey}
          stroke={pipe.color}
          strokeWidth={pipeWidth}
          strokeLinecap="round"
          strokeDasharray={pipe.conveyor ? '8 6' : 'none'}
          strokeDashoffset={dashOffset}
        />
        {/* Pipe highlight (top edge) */}
        <line
          x1={x1} y1={y1} x2={ex} y2={ey}
          stroke="#fff"
          strokeWidth={1}
          opacity={0.12}
          strokeLinecap="round"
        />
        {/* Rivets along pipe */}
        {!pipe.conveyor && progress > 0.5 && renderRivets(x1, y1, ex, ey, Math.floor(dist / 40), `pr-${i}`)}

        {/* Joint ring at midpoint */}
        {progress > 0.5 && (
          <circle
            cx={jx} cy={jy} r={pipeWidth / 2 + 3}
            fill="none"
            stroke={sp.brass}
            strokeWidth={2}
            opacity={0.5}
          />
        )}

        {/* Steam puff at joint */}
        {progress >= 1 && (
          <>
            {[0, 1, 2].map((si) => {
              const steamY = -((frame * 0.5 + si * 20) % 30);
              const steamOp = interpolate(steamY, [-30, 0], [0, 0.3], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
              return (
                <ellipse
                  key={`steam-${i}-${si}`}
                  cx={jx + Math.sin(frame * 0.03 + si) * 4}
                  cy={jy + steamY}
                  rx={4 + si * 2}
                  ry={3 + si}
                  fill={sp.steam}
                  opacity={steamOp}
                />
              );
            })}
          </>
        )}

        {/* Pipe label */}
        {pipe.label && progress > 0.8 && (
          <g>
            <rect
              x={jx - 30} y={jy - 18}
              width={60} height={14}
              rx={3}
              fill={sp.darkBrick}
              stroke={pipe.color}
              strokeWidth={0.8}
              opacity={0.9}
            />
            <text
              x={jx} y={jy - 9}
              textAnchor="middle"
              fill={sp.steam}
              fontSize={8}
              fontFamily="'Courier New', monospace"
              fontWeight={600}
            >
              {pipe.label}
            </text>
          </g>
        )}
      </g>
    );
  };

  // ── Render: node ─────────────────────────────────────────────────────────

  const renderNode = (node: SteamNode) => {
    const s = spring({ frame: frame - node.enterDelay, fps, config: { damping: 14, stiffness: 60 } });
    if (s <= 0.01) return null;

    const isBoiler = node.shape === 'boiler';
    const half = node.size / 2;
    const pulse = isBoiler ? 1 + Math.sin(frame * 0.06) * 0.02 : 1;

    // Cog rotation for automatons
    const cogAngle = node.shape === 'automaton' ? frame * 0.8 : 0;

    return (
      <g key={node.id} transform={`translate(${node.x}, ${node.y}) scale(${s * pulse})`}>

        {/* Boiler: extra decorations */}
        {isBoiler && (
          <>
            {/* Steam chimney */}
            <rect x={-8} y={-half - 30} width={16} height={30} fill={sp.iron} rx={2} opacity={0.7} />
            <rect x={-12} y={-half - 34} width={24} height={6} fill={sp.copper} rx={2} opacity={0.6} />
            {/* Rising steam from chimney */}
            {[0, 1, 2, 3].map((si) => {
              const sY = -((frame * 0.7 + si * 15) % 50) - half - 34;
              const sOp = interpolate(sY + half + 34, [-50, 0], [0, 0.25], {
                extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
              });
              return (
                <ellipse
                  key={`boiler-steam-${si}`}
                  cx={Math.sin(frame * 0.02 + si * 2) * 8}
                  cy={sY}
                  rx={6 + si * 3}
                  ry={4 + si * 2}
                  fill={sp.steam}
                  opacity={sOp * s}
                />
              );
            })}
            {/* Pressure gauges */}
            {renderGauge(-half + 8, -14, 12, `gauge-L-${node.id}`)}
            {renderGauge(half - 8, -14, 12, `gauge-R-${node.id}`)}
            {/* Boiler bands */}
            <ellipse cx={0} cy={-half + 10} rx={half} ry={4} fill="none" stroke={sp.brass} strokeWidth={1.5} opacity={0.4} />
            <ellipse cx={0} cy={half - 10} rx={half} ry={4} fill="none" stroke={sp.brass} strokeWidth={1.5} opacity={0.4} />
          </>
        )}

        {/* Automaton: spinning cog behind */}
        {node.shape === 'automaton' && (
          <g transform={`rotate(${cogAngle})`} opacity={0.3}>
            <path
              d={gearPath(8, half + 10, half + 2)}
              fill="none"
              stroke={sp.copper}
              strokeWidth={1.5}
            />
          </g>
        )}

        {/* Gate: ornate arch */}
        {node.shape === 'gate' && (
          <>
            <rect x={-half - 6} y={-half + 4} width={4} height={node.size - 8} fill={sp.iron} rx={1} opacity={0.5} />
            <rect x={half + 2} y={-half + 4} width={4} height={node.size - 8} fill={sp.iron} rx={1} opacity={0.5} />
            <path
              d={`M ${-half - 6} ${-half + 4} Q 0 ${-half - 16} ${half + 6} ${-half + 4}`}
              fill="none"
              stroke={sp.brass}
              strokeWidth={2}
              opacity={0.5}
            />
          </>
        )}

        {/* Cabinet: drawer lines */}
        {node.shape === 'cabinet' && (
          <>
            {[-8, 0, 8].map((dy) => (
              <g key={`cab-${dy}`}>
                <line x1={-half + 6} y1={dy} x2={half - 6} y2={dy} stroke={sp.brass} strokeWidth={0.5} opacity={0.4} />
                <circle cx={0} cy={dy - 3} r={1.5} fill={sp.brass} opacity={0.5} />
              </g>
            ))}
          </>
        )}

        {/* Panel: dials */}
        {node.shape === 'panel' && (
          <>
            {[-12, 0, 12].map((dx) => (
              <circle key={`dial-${dx}`} cx={dx} cy={-6} r={4} fill={sp.gaugeFace} stroke={sp.copper} strokeWidth={1} opacity={0.5} />
            ))}
            {[-8, 8].map((dx) => (
              <rect key={`sw-${dx}`} x={dx - 2} y={6} width={4} height={8} rx={1} fill={sp.patina} opacity={0.5} />
            ))}
          </>
        )}

        {/* Telegraph: signal lines */}
        {node.shape === 'telegraph' && (
          <>
            <line x1={0} y1={-half - 14} x2={0} y2={-half} stroke={sp.iron} strokeWidth={2} opacity={0.5} />
            <circle cx={0} cy={-half - 16} r={3} fill={sp.patina} opacity={0.6 + Math.sin(frame * 0.1) * 0.3} />
            {[-10, 10].map((dx) => (
              <line
                key={`tel-${dx}`}
                x1={0} y1={-half - 14}
                x2={dx} y2={-half - 22}
                stroke={sp.iron} strokeWidth={1} opacity={0.4}
              />
            ))}
          </>
        )}

        {/* Node body — rounded rect for industrial look */}
        <rect
          x={-half} y={-half}
          width={node.size} height={node.size}
          rx={isBoiler ? half : 8}
          ry={isBoiler ? half : 8}
          fill={sp.darkBrick}
          stroke={node.color}
          strokeWidth={isBoiler ? 3 : 2}
        />

        {/* Inner border (double-line industrial) */}
        <rect
          x={-half + 4} y={-half + 4}
          width={node.size - 8} height={node.size - 8}
          rx={isBoiler ? half - 4 : 5}
          ry={isBoiler ? half - 4 : 5}
          fill="none"
          stroke={`rgba(${hexToRgb(node.color)}, 0.2)`}
          strokeWidth={1}
        />

        {/* Corner rivets (non-boiler) */}
        {!isBoiler && (
          <>
            {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([rx, ry]) => (
              <circle
                key={`rv-${rx}-${ry}`}
                cx={rx * (half - 6)}
                cy={ry * (half - 6)}
                r={2.5}
                fill={sp.rivets}
                opacity={0.5}
              />
            ))}
          </>
        )}

        {/* Boiler rivets ring */}
        {isBoiler && Array.from({ length: 12 }, (_, ri) => {
          const a = (ri / 12) * Math.PI * 2;
          return (
            <circle
              key={`brv-${ri}`}
              cx={Math.cos(a) * (half - 5)}
              cy={Math.sin(a) * (half - 5)}
              r={2}
              fill={sp.rivets}
              opacity={0.45}
            />
          );
        })}

        {/* Icon */}
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={isBoiler ? 30 : 18}
          fill={node.color}
          style={{ filter: `drop-shadow(0 0 4px rgba(${hexToRgb(node.color)}, 0.4))` }}
        >
          {node.icon}
        </text>

        {/* Label */}
        <text
          y={half + 18}
          textAnchor="middle"
          fill={sp.steam}
          fontSize={isBoiler ? 14 : 11}
          fontFamily="'Courier New', 'IBM Plex Mono', monospace"
          fontWeight={isBoiler ? 700 : 600}
          letterSpacing={isBoiler ? 2 : 0.5}
        >
          {node.label}
        </text>
        {/* Sublabel */}
        <text
          y={half + 31}
          textAnchor="middle"
          fill={sp.amber}
          fontSize={8}
          fontFamily="'Courier New', monospace"
          opacity={0.6}
        >
          {node.sublabel}
        </text>
      </g>
    );
  };

  // ── Legend ────────────────────────────────────────────────────────────────

  const legendOpacity = interpolate(frame, [45, 60], [0, 1], { extrapolateRight: 'clamp' });

  const legendItems = [
    { color: sp.brass, label: 'Central Boiler (operator)' },
    { color: sp.copper, label: 'Sorting Machine (broker)' },
    { color: sp.patina, label: 'Telegraph Station (hub)' },
    { color: sp.amber, label: 'Worker Automaton (agent)' },
    { color: sp.burgundy, label: 'Sub-automaton (spawned)' },
    { color: colors.textDim, label: 'Brass Pipes = data flow' },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: sp.darkBrick }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          {/* Glow filters */}
          <filter id="spGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="spSteam" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" />
          </filter>

          {/* Brick pattern */}
          <pattern id="brickPattern" x="0" y="0" width="40" height="20" patternUnits="userSpaceOnUse">
            <rect width="40" height="20" fill="none" />
            <rect x="0" y="0" width="38" height="8" rx="1" fill="#3a2518" opacity="0.3" />
            <rect x="20" y="10" width="38" height="8" rx="1" fill="#3a2518" opacity="0.25" />
            <line x1="0" y1="9" x2="40" y2="9" stroke="#1a1210" strokeWidth="1" opacity="0.5" />
            <line x1="0" y1="19" x2="40" y2="19" stroke="#1a1210" strokeWidth="1" opacity="0.5" />
          </pattern>

          {/* Radial warmth from boiler */}
          <radialGradient id="boilerWarmth" cx="50%" cy="45%" r="45%">
            <stop offset="0%" stopColor={sp.brass} stopOpacity="0.06" />
            <stop offset="50%" stopColor={sp.copper} stopOpacity="0.02" />
            <stop offset="100%" stopColor={sp.darkBrick} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Brick wall background */}
        <rect width={width} height={height} fill="url(#brickPattern)" opacity={brickOpacity} />

        {/* Warm center glow */}
        <circle cx={cx} cy={cy - 10} r={350} fill="url(#boilerWarmth)" />

        {/* Background gears */}
        {bgGears.map((g, i) => {
          const rot = frame * g.speed * 100;
          return (
            <g key={`bg-gear-${i}`} transform={`translate(${g.x}, ${g.y}) rotate(${rot})`} opacity={g.opacity}>
              <path
                d={gearPath(g.teeth, g.r, g.r * 0.78)}
                fill="none"
                stroke={sp.copper}
                strokeWidth={2}
              />
              <circle r={g.r * 0.3} fill="none" stroke={sp.copper} strokeWidth={1.5} />
            </g>
          );
        })}

        {/* Soot & ember particles */}
        {sootParticles.map((p, i) => {
          const py = ((p.baseY - p.speed * frame * 2) % (height + 40));
          const correctedY = py < -20 ? py + height + 40 : py;
          const px = p.x + Math.sin(frame * 0.02 + i) * p.drift * 30;
          const flicker = p.isEmber ? 0.5 + Math.sin(frame * 0.15 + i * 3) * 0.5 : 1;
          return (
            <circle
              key={`soot-${i}`}
              cx={px}
              cy={correctedY}
              r={p.size}
              fill={p.isEmber ? '#e8651a' : '#888'}
              opacity={p.opacity * flicker * brickOpacity * 4}
            />
          );
        })}

        {/* Steam wisps */}
        {steamWisps.map((w, i) => {
          const wy = w.baseY - ((frame * w.speed * 0.5 + w.phase * 30) % 80);
          const wop = interpolate(
            (frame * w.speed * 0.5 + w.phase * 30) % 80,
            [0, 40, 80], [0, w.opacity, 0],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );
          const wx = w.x + Math.sin(frame * 0.015 + w.phase) * 15;
          return (
            <ellipse
              key={`wisp-${i}`}
              cx={wx}
              cy={wy}
              rx={w.width}
              ry={w.height}
              fill={sp.steam}
              opacity={wop}
              filter="url(#spSteam)"
            />
          );
        })}

        {/* Pipes (behind nodes) */}
        {pipes.map(renderPipe)}

        {/* Nodes */}
        {nodes.map(renderNode)}

        {/* Title bar at bottom */}
        <g opacity={titleOpacity} transform={`translate(0, ${titleY})`}>
          {/* Decorative line */}
          <line
            x1={cx - 180} y1={height - 72}
            x2={cx + 180} y2={height - 72}
            stroke={sp.brass}
            strokeWidth={1}
            opacity={0.4}
          />
          {/* Rivets on title line */}
          {[-180, -120, -60, 0, 60, 120, 180].map((dx) => (
            <circle
              key={`tr-${dx}`}
              cx={cx + dx}
              cy={height - 72}
              r={2}
              fill={sp.rivets}
              opacity={0.5}
            />
          ))}
          <text
            x={cx} y={height - 50}
            textAnchor="middle"
            fill={sp.brass}
            fontSize={24}
            fontFamily="'Courier New', 'IBM Plex Mono', monospace"
            fontWeight={800}
            letterSpacing={6}
            filter="url(#spGlow)"
          >
            c9-operator
          </text>
          <text
            x={cx} y={height - 30}
            textAnchor="middle"
            fill={sp.amber}
            fontSize={11}
            fontFamily="'Courier New', monospace"
            letterSpacing={3}
            opacity={0.7}
          >
            MECHANICAL AGENT ORCHESTRATION
          </text>
          <line
            x1={cx - 180} y1={height - 22}
            x2={cx + 180} y2={height - 22}
            stroke={sp.brass}
            strokeWidth={1}
            opacity={0.4}
          />
        </g>

        {/* Legend */}
        <g opacity={legendOpacity} transform={`translate(16, ${height - 150})`}>
          <rect x={-4} y={-10} width={180} height={legendItems.length * 18 + 12} rx={4}
            fill={sp.darkBrick} stroke={sp.brass} strokeWidth={0.8} opacity={0.8} />
          {legendItems.map((item, i) => (
            <g key={`leg-${i}`} transform={`translate(0, ${i * 18})`}>
              <rect x={2} y={-4} width={8} height={8} rx={1} fill={item.color} opacity={0.8} />
              <text x={16} y={4} fill={sp.steam} fontSize={8.5} fontFamily="'Courier New', monospace" opacity={0.8}>
                {item.label}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </AbsoluteFill>
  );
};

export default SteampunkFactory;
