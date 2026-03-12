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

interface BuildingDef {
  id: string;
  label: string;
  sublabel: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  icon: string;
  enterDelay: number;
  floors?: number;
  hasCourtyard?: boolean;
  hasTower?: boolean;
}

interface RoadDef {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  enterDelay: number;
  isHighway?: boolean;
}

interface UndergroundPipeDef {
  points: Array<{ x: number; y: number }>;
  color: string;
  enterDelay: number;
  label: string;
  dashPattern: string;
}

interface TrafficDef {
  roadIndex: number;
  speed: number;
  offset: number;
  color: string;
}

// ── Blueprint Colors ─────────────────────────────────────────────────────────

const bp = {
  bg: '#003153',
  line: '#4a9fd4',
  lineDim: '#2a6f9f',
  lineBright: '#7ac4f0',
  accent: '#ffffff',
  dimension: '#6ab4dc',
  underground: '#d4a04a',
  text: '#8ec8e8',
  textDim: '#5a99b8',
  grid: '#0a4a73',
  revision: '#c07040',
};

// ── City Blueprint Composition ───────────────────────────────────────────────

export const CityBlueprint: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const cx = width / 2;
  const cy = height / 2;

  // ── Grid reference system ────────────────────────────────────────────────

  const gridCols = 8;
  const gridRows = 6;
  const cellW = width / gridCols;
  const cellH = height / gridRows;

  // ── Contour lines (topographic background) ──────────────────────────────

  const contourLines = useMemo(() => {
    const rng = seededRandom(2222);
    return Array.from({ length: 12 }, (_, i) => {
      const centerX = cx + (rng() - 0.5) * 200;
      const centerY = cy + (rng() - 0.5) * 150;
      const baseR = 60 + i * 25;
      return { cx: centerX, cy: centerY, r: baseR, wobble: rng() * 0.3 };
    });
  }, [cx, cy]);

  // ── Building definitions ─────────────────────────────────────────────────

  const buildings: BuildingDef[] = useMemo(() => [
    // CENTER: c9-operator — main high-rise
    {
      id: 'operator', label: 'c9-operator', sublabel: 'CENTRAL HQ',
      x: cx - 55, y: cy - 50, width: 110, height: 100,
      color: bp.lineBright, icon: '\u25C8', enterDelay: 5, floors: 4,
    },
    // NORTH: API Gateway — highway on-ramp
    {
      id: 'api', label: 'API Gateway', sublabel: 'ENTRY POINT',
      x: cx - 45, y: 55, width: 90, height: 50,
      color: colors.blue, icon: '\u26A1', enterDelay: 10,
    },
    // WEST: Broker — industrial warehouse
    {
      id: 'broker', label: 'Broker', sublabel: 'DISTRIBUTION CTR',
      x: cx - 280, y: cy - 35, width: 100, height: 70,
      color: colors.purple, icon: '\u2B21', enterDelay: 12, floors: 2,
    },
    // EAST: Hub — broadcast tower
    {
      id: 'hub', label: 'Hub', sublabel: 'BROADCAST TOWER',
      x: cx + 180, y: cy - 40, width: 70, height: 80,
      color: colors.green, icon: '\u25CE', enterDelay: 12, hasTower: true,
    },
    // SOUTH ROW: Agents — worker housing
    {
      id: 'agent1', label: 'Agent \u03B1', sublabel: 'UNIT A',
      x: cx - 220, y: cy + 140, width: 55, height: 45,
      color: colors.amber, icon: '\u2605', enterDelay: 20,
    },
    {
      id: 'agent2', label: 'Agent \u03B2', sublabel: 'UNIT B',
      x: cx - 100, y: cy + 140, width: 55, height: 45,
      color: colors.amber, icon: '\u2605', enterDelay: 23,
    },
    {
      id: 'agent3', label: 'Agent \u03B3', sublabel: 'UNIT C',
      x: cx + 20, y: cy + 140, width: 55, height: 45,
      color: colors.amber, icon: '\u2605', enterDelay: 26,
    },
    {
      id: 'agent4', label: 'Agent \u03B4', sublabel: 'UNIT D',
      x: cx + 140, y: cy + 140, width: 55, height: 45,
      color: colors.rose, icon: '\u2726', enterDelay: 45,
    },
    // NORTHWEST: Projects — library/archive
    {
      id: 'projects', label: 'Projects', sublabel: 'ARCHIVE',
      x: cx - 310, y: 60, width: 80, height: 65,
      color: bp.textDim, icon: '\u25A3', enterDelay: 15, hasCourtyard: true,
    },
    // NORTHEAST: Dashboard — observation tower
    {
      id: 'dashboard', label: 'Dashboard', sublabel: 'OBS TOWER',
      x: cx + 230, y: 55, width: 70, height: 60,
      color: bp.textDim, icon: '\u25E7', enterDelay: 15, hasTower: true,
    },
  ], [cx, cy]);

  // ── Road definitions ─────────────────────────────────────────────────────

  const roads: RoadDef[] = useMemo(() => [
    // Main north-south highway
    { x1: cx, y1: 0, x2: cx, y2: height, width: 18, enterDelay: 0, isHighway: true },
    // East-west main road
    { x1: 0, y1: cy, x2: width, y2: cy, width: 14, enterDelay: 2, isHighway: true },
    // Road to broker (west)
    { x1: cx - 55, y1: cy, x2: cx - 180, y2: cy, width: 8, enterDelay: 8 },
    // Road to hub (east)
    { x1: cx + 55, y1: cy, x2: cx + 180, y2: cy, width: 8, enterDelay: 8 },
    // Road to agents (south)
    { x1: cx, y1: cy + 50, x2: cx, y2: cy + 140, width: 10, enterDelay: 12 },
    // Agent row road (horizontal)
    { x1: cx - 230, y1: cy + 130, x2: cx + 200, y2: cy + 130, width: 8, enterDelay: 15 },
    // Road to API (north)
    { x1: cx, y1: 105, x2: cx, y2: cy - 50, width: 10, enterDelay: 6 },
    // Road to projects (northwest diagonal simplified as L-shape)
    { x1: cx - 180, y1: cy, x2: cx - 180, y2: 92, width: 6, enterDelay: 10 },
    { x1: cx - 180, y1: 92, x2: cx - 230, y2: 92, width: 6, enterDelay: 11 },
    // Road to dashboard (northeast)
    { x1: cx + 180, y1: cy - 40, x2: cx + 180, y2: 85, width: 6, enterDelay: 10 },
    { x1: cx + 180, y1: 85, x2: cx + 230, y2: 85, width: 6, enterDelay: 11 },
  ], [cx, cy, width, height]);

  // ── Underground pipes ────────────────────────────────────────────────────

  const pipes: UndergroundPipeDef[] = useMemo(() => [
    // Operator → Broker data pipe
    {
      points: [
        { x: cx - 55, y: cy + 15 },
        { x: cx - 120, y: cy + 15 },
        { x: cx - 120, y: cy - 5 },
        { x: cx - 180, y: cy - 5 },
      ],
      color: colors.purple, enterDelay: 18,
      label: 'spawn', dashPattern: '8 4',
    },
    // Operator → Hub event pipe
    {
      points: [
        { x: cx + 55, y: cy - 10 },
        { x: cx + 130, y: cy - 10 },
        { x: cx + 130, y: cy - 20 },
        { x: cx + 180, y: cy - 20 },
      ],
      color: colors.green, enterDelay: 18,
      label: 'events', dashPattern: '6 6',
    },
    // Hub → Dashboard stream
    {
      points: [
        { x: cx + 215, y: cy - 40 },
        { x: cx + 215, y: 115 },
        { x: cx + 250, y: 115 },
      ],
      color: colors.green, enterDelay: 22,
      label: 'stream', dashPattern: '4 8',
    },
    // Broker → Agents pipe
    {
      points: [
        { x: cx - 230, y: cy + 35 },
        { x: cx - 230, y: cy + 100 },
        { x: cx + 170, y: cy + 100 },
      ],
      color: colors.amber, enterDelay: 25,
      label: 'sessions', dashPattern: '10 4 2 4',
    },
    // Agent alpha → Operator spawn request
    {
      points: [
        { x: cx - 193, y: cy + 140 },
        { x: cx - 193, y: cy + 70 },
        { x: cx - 30, y: cy + 70 },
        { x: cx - 30, y: cy + 50 },
      ],
      color: colors.rose, enterDelay: 48,
      label: 'spawn_req', dashPattern: '3 5',
    },
  ], [cx, cy]);

  // ── Traffic vehicles ─────────────────────────────────────────────────────

  const traffic: TrafficDef[] = useMemo(() => {
    const rng = seededRandom(4444);
    return Array.from({ length: 15 }, () => ({
      roadIndex: Math.floor(rng() * 2), // Only on highways
      speed: rng() * 1.5 + 0.5,
      offset: rng(),
      color: rng() > 0.5 ? bp.lineBright : bp.accent,
    }));
  }, []);

  // ── Draw progress (blueprint unfold) ─────────────────────────────────────

  const drawProgress = interpolate(frame, [0, 60], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // ── Construction sequence ────────────────────────────────────────────────

  const craneRotation = frame * 0.5;

  // ── Render helpers ───────────────────────────────────────────────────────

  const renderBuilding = (b: BuildingDef) => {
    const s = spring({
      frame: frame - b.enterDelay,
      fps,
      config: { damping: 14, stiffness: 80 },
    });
    if (s <= 0.01) return null;

    const bCx = b.x + b.width / 2;
    const bCy = b.y + b.height / 2;
    const isOperator = b.id === 'operator';
    const pulse = isOperator ? 1 + Math.sin(frame * 0.06) * 0.02 : 1;

    return (
      <g key={b.id} opacity={s} transform={`translate(${bCx}, ${bCy}) scale(${s * pulse}) translate(${-bCx}, ${-bCy})`}>
        {/* Building footprint */}
        <rect
          x={b.x} y={b.y} width={b.width} height={b.height}
          fill={`rgba(${hexToRgb(b.color)}, 0.06)`}
          stroke={b.color} strokeWidth={isOperator ? 1.5 : 0.8}
        />
        {/* Internal room divisions */}
        {b.floors && b.floors > 1 && Array.from({ length: b.floors - 1 }, (_, i) => {
          const fy = b.y + (b.height / b.floors!) * (i + 1);
          return (
            <line
              key={`floor-${b.id}-${i}`}
              x1={b.x + 2} y1={fy} x2={b.x + b.width - 2} y2={fy}
              stroke={b.color} strokeWidth={0.3} opacity={0.4}
            />
          );
        })}
        {/* Vertical room divisions */}
        <line
          x1={bCx} y1={b.y + 2} x2={bCx} y2={b.y + b.height - 2}
          stroke={b.color} strokeWidth={0.3} opacity={0.3}
        />
        {/* Cross-bracing for operator */}
        {isOperator && (
          <>
            <line
              x1={b.x} y1={b.y} x2={b.x + b.width} y2={b.y + b.height}
              stroke={b.color} strokeWidth={0.3} opacity={0.2}
            />
            <line
              x1={b.x + b.width} y1={b.y} x2={b.x} y2={b.y + b.height}
              stroke={b.color} strokeWidth={0.3} opacity={0.2}
            />
            {/* Operator inner sanctum */}
            <rect
              x={b.x + b.width * 0.25} y={b.y + b.height * 0.25}
              width={b.width * 0.5} height={b.height * 0.5}
              fill="none" stroke={b.color} strokeWidth={0.5} opacity={0.4}
            />
          </>
        )}
        {/* Door swing arcs */}
        <path
          d={`M ${b.x + b.width - 12} ${b.y + b.height} A 10 10 0 0 1 ${b.x + b.width - 2} ${b.y + b.height - 10}`}
          fill="none" stroke={b.color} strokeWidth={0.4} opacity={0.5}
        />
        {/* Stair symbol */}
        {(b.floors || 0) > 1 && (
          <g transform={`translate(${b.x + 4}, ${b.y + 4})`}>
            {Array.from({ length: 4 }, (_, i) => (
              <line
                key={`stair-${b.id}-${i}`}
                x1={i * 3} y1={12 - i * 3} x2={i * 3 + 3} y2={12 - i * 3}
                stroke={b.color} strokeWidth={0.4} opacity={0.5}
              />
            ))}
          </g>
        )}
        {/* Courtyard */}
        {b.hasCourtyard && (
          <rect
            x={b.x + b.width * 0.2} y={b.y + b.height * 0.2}
            width={b.width * 0.6} height={b.height * 0.6}
            fill="none" stroke={b.color} strokeWidth={0.4}
            strokeDasharray="2 2" opacity={0.4}
          />
        )}
        {/* Broadcast tower (concentric signal rings) */}
        {b.hasTower && (
          <>
            {[12, 22, 32].map((r, i) => {
              const ringPulse = (Math.sin(frame * 0.05 - i * 0.8) + 1) * 0.5;
              return (
                <circle
                  key={`sig-${b.id}-${i}`}
                  cx={bCx} cy={bCy}
                  r={r} fill="none"
                  stroke={b.color} strokeWidth={0.4}
                  opacity={0.15 + ringPulse * 0.15}
                  strokeDasharray="3 5"
                />
              );
            })}
          </>
        )}
        {/* Icon */}
        <text
          x={bCx} y={bCy + 2}
          textAnchor="middle" dominantBaseline="central"
          fontSize={isOperator ? 20 : 14} fill={b.color}
          opacity={0.7}
        >
          {b.icon}
        </text>
        {/* Label */}
        <text
          x={bCx} y={b.y - 10}
          textAnchor="middle" fill={b.color}
          fontSize={isOperator ? 11 : 9}
          fontFamily="'IBM Plex Mono', monospace"
          fontWeight={isOperator ? 700 : 500}
          letterSpacing={isOperator ? 1.5 : 0.5}
        >
          {b.label}
        </text>
        <text
          x={bCx} y={b.y - 1}
          textAnchor="middle" fill={bp.textDim}
          fontSize={6} fontFamily="'IBM Plex Mono', monospace"
          letterSpacing={1}
        >
          {b.sublabel}
        </text>
      </g>
    );
  };

  const renderRoad = (road: RoadDef, i: number) => {
    const progress = interpolate(frame, [road.enterDelay, road.enterDelay + 25], [0, 1], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });
    if (progress <= 0) return null;

    const dx = road.x2 - road.x1;
    const dy = road.y2 - road.y1;
    const endX = road.x1 + dx * progress;
    const endY = road.y1 + dy * progress;
    const isVert = Math.abs(dy) > Math.abs(dx);

    return (
      <g key={`road${i}`} opacity={progress * 0.7}>
        {/* Road edge lines */}
        {isVert ? (
          <>
            <line
              x1={road.x1 - road.width / 2} y1={road.y1}
              x2={endX - road.width / 2} y2={endY}
              stroke={bp.line} strokeWidth={0.6}
            />
            <line
              x1={road.x1 + road.width / 2} y1={road.y1}
              x2={endX + road.width / 2} y2={endY}
              stroke={bp.line} strokeWidth={0.6}
            />
            {/* Center dashed line */}
            <line
              x1={road.x1} y1={road.y1} x2={endX} y2={endY}
              stroke={bp.lineDim} strokeWidth={0.4}
              strokeDasharray="4 6"
            />
          </>
        ) : (
          <>
            <line
              x1={road.x1} y1={road.y1 - road.width / 2}
              x2={endX} y2={endY - road.width / 2}
              stroke={bp.line} strokeWidth={0.6}
            />
            <line
              x1={road.x1} y1={road.y1 + road.width / 2}
              x2={endX} y2={endY + road.width / 2}
              stroke={bp.line} strokeWidth={0.6}
            />
            <line
              x1={road.x1} y1={road.y1} x2={endX} y2={endY}
              stroke={bp.lineDim} strokeWidth={0.4}
              strokeDasharray="4 6"
            />
          </>
        )}
        {/* Crosswalks at intersections */}
        {road.isHighway && progress > 0.5 && (
          <g opacity={0.3}>
            {Array.from({ length: 4 }, (_, j) => {
              const t = 0.3 + j * 0.15;
              const cwX = road.x1 + dx * t;
              const cwY = road.y1 + dy * t;
              return isVert ? (
                <line
                  key={`cw${i}-${j}`}
                  x1={cwX - road.width / 2 + 1} y1={cwY}
                  x2={cwX + road.width / 2 - 1} y2={cwY}
                  stroke={bp.line} strokeWidth={0.4}
                />
              ) : (
                <line
                  key={`cw${i}-${j}`}
                  x1={cwX} y1={cwY - road.width / 2 + 1}
                  x2={cwX} y2={cwY + road.width / 2 - 1}
                  stroke={bp.line} strokeWidth={0.4}
                />
              );
            })}
          </g>
        )}
      </g>
    );
  };

  const renderPipe = (pipe: UndergroundPipeDef, i: number) => {
    const progress = interpolate(frame, [pipe.enterDelay, pipe.enterDelay + 30], [0, 1], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });
    if (progress <= 0) return null;

    // Build path string
    const pathParts = pipe.points.map((p, j) => `${j === 0 ? 'M' : 'L'} ${p.x} ${p.y}`);
    const pathD = pathParts.join(' ');

    // Animated dash offset for flow direction
    const dashOffset = -frame * 0.8;

    return (
      <g key={`pipe${i}`} opacity={progress * 0.6}>
        <path
          d={pathD} fill="none"
          stroke={pipe.color} strokeWidth={1.5}
          strokeDasharray={pipe.dashPattern}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Pipe label */}
        {progress > 0.7 && (
          <text
            x={pipe.points[1].x} y={pipe.points[1].y - 6}
            fill={pipe.color} fontSize={6}
            fontFamily="'IBM Plex Mono', monospace"
            fontWeight={500} opacity={0.6}
            textAnchor="middle"
          >
            [{pipe.label}]
          </text>
        )}
      </g>
    );
  };

  // ── Dimension lines ──────────────────────────────────────────────────────

  const dimensionLines = useMemo(() => {
    const op = buildings.find((b) => b.id === 'operator')!;
    const br = buildings.find((b) => b.id === 'broker')!;
    const hub = buildings.find((b) => b.id === 'hub')!;
    return [
      // Operator to Broker distance
      {
        x1: br.x + br.width, y1: br.y - 20,
        x2: op.x, y2: op.y - 20,
        label: '120 units', enterDelay: 30,
      },
      // Operator to Hub distance
      {
        x1: op.x + op.width, y1: op.y - 20,
        x2: hub.x, y2: hub.y - 20,
        label: '125 units', enterDelay: 32,
      },
      // Operator height
      {
        x1: op.x + op.width + 15, y1: op.y,
        x2: op.x + op.width + 15, y2: op.y + op.height,
        label: `${op.height}`, enterDelay: 34,
      },
    ];
  }, [buildings]);

  // ── Revision cloud ───────────────────────────────────────────────────────

  const revisionPulse = 0.5 + Math.sin(frame * 0.04) * 0.3;

  // ── Survey markers ───────────────────────────────────────────────────────

  const surveyBlink = Math.sin(frame * 0.15) > 0 ? 0.8 : 0.2;

  // ── Section cut markers ──────────────────────────────────────────────────

  const sectionMarkers = [
    { x: cx - 350, y: cy, label: 'A', angle: 0 },
    { x: cx, y: 30, label: 'B', angle: 90 },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: bp.bg }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <filter id="bpGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="bpSoftGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>

        {/* ── Contour lines (topographic) ───────────────────────────────── */}
        <g opacity={drawProgress * 0.08}>
          {contourLines.map((c, i) => (
            <ellipse
              key={`contour${i}`}
              cx={c.cx} cy={c.cy}
              rx={c.r * (1 + c.wobble * Math.sin(i * 1.5))}
              ry={c.r * 0.8 * (1 + c.wobble * Math.cos(i * 1.2))}
              fill="none" stroke={bp.lineDim} strokeWidth={0.3}
            />
          ))}
        </g>

        {/* ── Background grid ───────────────────────────────────────────── */}
        <g opacity={drawProgress * 0.15}>
          {Array.from({ length: gridCols + 1 }, (_, i) => (
            <line
              key={`gv${i}`}
              x1={i * cellW} y1={0} x2={i * cellW} y2={height}
              stroke={bp.grid} strokeWidth={0.3}
            />
          ))}
          {Array.from({ length: gridRows + 1 }, (_, i) => (
            <line
              key={`gh${i}`}
              x1={0} y1={i * cellH} x2={width} y2={i * cellH}
              stroke={bp.grid} strokeWidth={0.3}
            />
          ))}
        </g>

        {/* ── Grid reference labels ─────────────────────────────────────── */}
        <g opacity={drawProgress * 0.4}>
          {Array.from({ length: gridCols }, (_, i) => (
            <text
              key={`gcol${i}`}
              x={i * cellW + cellW / 2} y={height - 4}
              textAnchor="middle" fill={bp.textDim}
              fontSize={7} fontFamily="'IBM Plex Mono', monospace"
            >
              {String.fromCharCode(65 + i)}
            </text>
          ))}
          {Array.from({ length: gridRows }, (_, i) => (
            <text
              key={`grow${i}`}
              x={6} y={i * cellH + cellH / 2 + 3}
              textAnchor="middle" fill={bp.textDim}
              fontSize={7} fontFamily="'IBM Plex Mono', monospace"
            >
              {i + 1}
            </text>
          ))}
        </g>

        {/* ── Roads ─────────────────────────────────────────────────────── */}
        {roads.map(renderRoad)}

        {/* ── Traffic ───────────────────────────────────────────────────── */}
        <g opacity={interpolate(frame, [30, 50], [0, 0.6], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}>
          {traffic.map((t, i) => {
            const road = roads[t.roadIndex];
            if (!road) return null;
            const dx = road.x2 - road.x1;
            const dy = road.y2 - road.y1;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const pos = ((t.offset * dist + frame * t.speed) % dist) / dist;
            const tx = road.x1 + dx * pos;
            const ty = road.y1 + dy * pos;
            const isVert = Math.abs(dy) > Math.abs(dx);
            return (
              <rect
                key={`traf${i}`}
                x={tx - (isVert ? 1.5 : 4)} y={ty - (isVert ? 4 : 1.5)}
                width={isVert ? 3 : 8} height={isVert ? 8 : 3}
                fill={t.color} opacity={0.5} rx={1}
              />
            );
          })}
        </g>

        {/* ── Underground pipes ──────────────────────────────────────────── */}
        {pipes.map(renderPipe)}

        {/* ── Buildings ─────────────────────────────────────────────────── */}
        {buildings.map(renderBuilding)}

        {/* ── Dimension lines ───────────────────────────────────────────── */}
        {dimensionLines.map((dl, i) => {
          const dlProgress = interpolate(frame, [dl.enterDelay, dl.enterDelay + 15], [0, 1], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          });
          if (dlProgress <= 0) return null;

          const isVert = Math.abs(dl.y2 - dl.y1) > Math.abs(dl.x2 - dl.x1);
          const midX = (dl.x1 + dl.x2) / 2;
          const midY = (dl.y1 + dl.y2) / 2;

          return (
            <g key={`dim${i}`} opacity={dlProgress * 0.5}>
              <line
                x1={dl.x1} y1={dl.y1} x2={dl.x2} y2={dl.y2}
                stroke={bp.dimension} strokeWidth={0.4}
              />
              {/* Tick marks */}
              {isVert ? (
                <>
                  <line x1={dl.x1 - 4} y1={dl.y1} x2={dl.x1 + 4} y2={dl.y1} stroke={bp.dimension} strokeWidth={0.4} />
                  <line x1={dl.x1 - 4} y1={dl.y2} x2={dl.x1 + 4} y2={dl.y2} stroke={bp.dimension} strokeWidth={0.4} />
                </>
              ) : (
                <>
                  <line x1={dl.x1} y1={dl.y1 - 4} x2={dl.x1} y2={dl.y1 + 4} stroke={bp.dimension} strokeWidth={0.4} />
                  <line x1={dl.x2} y1={dl.y2 - 4} x2={dl.x2} y2={dl.y2 + 4} stroke={bp.dimension} strokeWidth={0.4} />
                </>
              )}
              {/* Measurement label */}
              <text
                x={isVert ? dl.x1 + 8 : midX} y={isVert ? midY : midY - 4}
                textAnchor="middle" fill={bp.dimension}
                fontSize={6} fontFamily="'IBM Plex Mono', monospace"
              >
                {dl.label}
              </text>
            </g>
          );
        })}

        {/* ── Section cut markers ───────────────────────────────────────── */}
        {sectionMarkers.map((sm, i) => {
          const smOpacity = interpolate(frame, [35, 50], [0, 0.5], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          });
          return (
            <g key={`sec${i}`} opacity={smOpacity}>
              <circle
                cx={sm.x} cy={sm.y} r={10}
                fill={`rgba(${hexToRgb(bp.line)}, 0.1)`}
                stroke={bp.line} strokeWidth={0.6}
              />
              <text
                x={sm.x} y={sm.y + 3}
                textAnchor="middle" fill={bp.line}
                fontSize={8} fontFamily="'IBM Plex Mono', monospace"
                fontWeight={700}
              >
                {sm.label}
              </text>
              {/* Arrow */}
              <line
                x1={sm.x + 10} y1={sm.y}
                x2={sm.x + 22} y2={sm.y}
                stroke={bp.line} strokeWidth={0.6}
                markerEnd="url(#secArrow)"
              />
            </g>
          );
        })}

        {/* ── Revision cloud around Agent delta ─────────────────────────── */}
        {(() => {
          const agentD = buildings.find((b) => b.id === 'agent4')!;
          const cloudOpacity = interpolate(frame, [48, 60], [0, 1], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          });
          if (cloudOpacity <= 0) return null;
          const rcX = agentD.x - 8;
          const rcY = agentD.y - 18;
          const rcW = agentD.width + 16;
          const rcH = agentD.height + 30;
          // Generate bumpy cloud path
          const bumps = 20;
          const bumpR = 6;
          const path: string[] = [];
          for (let i = 0; i <= bumps; i++) {
            const t = i / bumps;
            let px: number, py: number;
            if (t < 0.25) {
              px = rcX + (t / 0.25) * rcW;
              py = rcY;
            } else if (t < 0.5) {
              px = rcX + rcW;
              py = rcY + ((t - 0.25) / 0.25) * rcH;
            } else if (t < 0.75) {
              px = rcX + rcW - ((t - 0.5) / 0.25) * rcW;
              py = rcY + rcH;
            } else {
              px = rcX;
              py = rcY + rcH - ((t - 0.75) / 0.25) * rcH;
            }
            const bumpOffset = Math.sin(t * Math.PI * 8 + frame * 0.02) * bumpR;
            const nx = t < 0.25 || (t >= 0.5 && t < 0.75) ? 0 : (t < 0.5 ? 1 : -1);
            const ny = t < 0.25 ? -1 : (t >= 0.5 && t < 0.75 ? 1 : 0);
            px += nx * bumpOffset;
            py += ny * bumpOffset;
            path.push(`${i === 0 ? 'M' : 'L'} ${px} ${py}`);
          }
          path.push('Z');
          return (
            <g opacity={cloudOpacity * revisionPulse}>
              <path
                d={path.join(' ')}
                fill="none" stroke={bp.revision}
                strokeWidth={1} opacity={0.6}
              />
              <text
                x={rcX + rcW / 2} y={rcY - 4}
                textAnchor="middle" fill={bp.revision}
                fontSize={6} fontFamily="'IBM Plex Mono', monospace"
                fontWeight={600}
              >
                REV. CLOUD - NEW SPAWN
              </text>
            </g>
          );
        })()}

        {/* ── Construction crane near operator ──────────────────────────── */}
        {(() => {
          const craneOpacity = interpolate(frame, [20, 35], [0, 0.5], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          });
          const crX = cx + 80;
          const crY = cy - 70;
          return (
            <g opacity={craneOpacity}>
              {/* Crane base */}
              <rect x={crX - 3} y={crY} width={6} height={30} fill="none" stroke={bp.line} strokeWidth={0.6} />
              {/* Crane arm (rotates) */}
              <line
                x1={crX} y1={crY}
                x2={crX + Math.cos((craneRotation * Math.PI) / 180) * 25}
                y2={crY + Math.sin((craneRotation * Math.PI) / 180) * 25 - 15}
                stroke={bp.lineBright} strokeWidth={0.6}
              />
              {/* Cable */}
              <line
                x1={crX + Math.cos((craneRotation * Math.PI) / 180) * 20}
                y1={crY + Math.sin((craneRotation * Math.PI) / 180) * 20 - 15}
                x2={crX + Math.cos((craneRotation * Math.PI) / 180) * 20}
                y2={crY + Math.sin((craneRotation * Math.PI) / 180) * 20}
                stroke={bp.lineDim} strokeWidth={0.3}
                strokeDasharray="1 2"
              />
              {/* Label */}
              <text
                x={crX} y={crY + 40}
                textAnchor="middle" fill={bp.textDim}
                fontSize={5} fontFamily="'IBM Plex Mono', monospace"
              >
                CRANE
              </text>
            </g>
          );
        })()}

        {/* ── Construction truck ─────────────────────────────────────────── */}
        {(() => {
          const truckOpacity = interpolate(frame, [25, 40], [0, 0.4], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          });
          const truckX = cx - 120 + Math.sin(frame * 0.02) * 15;
          const truckY = cy + 115;
          return (
            <g opacity={truckOpacity}>
              <rect x={truckX} y={truckY} width={12} height={6} fill="none" stroke={bp.line} strokeWidth={0.5} rx={1} />
              <rect x={truckX + 12} y={truckY + 1} width={5} height={5} fill="none" stroke={bp.line} strokeWidth={0.5} rx={0.5} />
              {/* Wheels */}
              <circle cx={truckX + 3} cy={truckY + 7} r={1.5} fill="none" stroke={bp.line} strokeWidth={0.4} />
              <circle cx={truckX + 9} cy={truckY + 7} r={1.5} fill="none" stroke={bp.line} strokeWidth={0.4} />
            </g>
          );
        })()}

        {/* ── Survey markers ────────────────────────────────────────────── */}
        {[
          { x: cx - 150, y: cy + 80 },
          { x: cx + 120, y: cy - 90 },
          { x: cx - 50, y: cy + 200 },
          { x: cx + 250, y: cy + 100 },
        ].map((sm, i) => {
          const smDelay = 25 + i * 5;
          const smOpacity = interpolate(frame, [smDelay, smDelay + 10], [0, 1], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          });
          return (
            <g key={`survey${i}`} opacity={smOpacity * surveyBlink}>
              <line x1={sm.x - 4} y1={sm.y} x2={sm.x + 4} y2={sm.y} stroke={bp.lineBright} strokeWidth={0.5} />
              <line x1={sm.x} y1={sm.y - 4} x2={sm.x} y2={sm.y + 4} stroke={bp.lineBright} strokeWidth={0.5} />
              <circle cx={sm.x} cy={sm.y} r={3} fill="none" stroke={bp.lineBright} strokeWidth={0.4} />
            </g>
          );
        })}

        {/* ── North arrow ───────────────────────────────────────────────── */}
        <g opacity={drawProgress * 0.6} transform={`translate(${width - 50}, 50)`}>
          <line x1={0} y1={20} x2={0} y2={-10} stroke={bp.lineBright} strokeWidth={0.8} />
          <polygon points="0,-14 -4,-6 4,-6" fill={bp.lineBright} opacity={0.8} />
          <text
            x={0} y={-18} textAnchor="middle" fill={bp.lineBright}
            fontSize={9} fontFamily="'IBM Plex Mono', monospace" fontWeight={700}
          >
            N
          </text>
        </g>

        {/* ── Scale bar ─────────────────────────────────────────────────── */}
        <g opacity={drawProgress * 0.5} transform={`translate(${width - 130}, ${height - 70})`}>
          <line x1={0} y1={0} x2={60} y2={0} stroke={bp.line} strokeWidth={0.6} />
          <line x1={0} y1={-3} x2={0} y2={3} stroke={bp.line} strokeWidth={0.6} />
          <line x1={30} y1={-2} x2={30} y2={2} stroke={bp.line} strokeWidth={0.4} />
          <line x1={60} y1={-3} x2={60} y2={3} stroke={bp.line} strokeWidth={0.6} />
          <text x={0} y={10} fill={bp.textDim} fontSize={6} fontFamily="'IBM Plex Mono', monospace">0</text>
          <text x={27} y={10} fill={bp.textDim} fontSize={6} fontFamily="'IBM Plex Mono', monospace">50</text>
          <text x={53} y={10} fill={bp.textDim} fontSize={6} fontFamily="'IBM Plex Mono', monospace">100m</text>
        </g>

        {/* ── Title block (bottom-right) ────────────────────────────────── */}
        {(() => {
          const tbOpacity = interpolate(frame, [40, 55], [0, 1], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          });
          const tbX = width - 200;
          const tbY = height - 52;
          return (
            <g opacity={tbOpacity * 0.7}>
              <rect
                x={tbX} y={tbY} width={190} height={46}
                fill={`rgba(${hexToRgb(bp.bg)}, 0.8)`}
                stroke={bp.line} strokeWidth={0.6}
              />
              {/* Dividers */}
              <line x1={tbX} y1={tbY + 16} x2={tbX + 190} y2={tbY + 16} stroke={bp.line} strokeWidth={0.3} />
              <line x1={tbX + 120} y1={tbY + 16} x2={tbX + 120} y2={tbY + 46} stroke={bp.line} strokeWidth={0.3} />
              <text
                x={tbX + 95} y={tbY + 11}
                textAnchor="middle" fill={bp.lineBright}
                fontSize={8} fontFamily="'IBM Plex Mono', monospace"
                fontWeight={700} letterSpacing={1}
              >
                c9-operator DISTRICT PLAN
              </text>
              <text x={tbX + 6} y={tbY + 28} fill={bp.textDim} fontSize={6} fontFamily="'IBM Plex Mono', monospace">
                SCALE: 1:200
              </text>
              <text x={tbX + 6} y={tbY + 38} fill={bp.textDim} fontSize={6} fontFamily="'IBM Plex Mono', monospace">
                DWG: ARCH-001-R3
              </text>
              <text x={tbX + 126} y={tbY + 28} fill={bp.textDim} fontSize={6} fontFamily="'IBM Plex Mono', monospace">
                DATE: 2026-03-06
              </text>
              <text x={tbX + 126} y={tbY + 38} fill={bp.textDim} fontSize={6} fontFamily="'IBM Plex Mono', monospace">
                CHECKED: c9
              </text>
            </g>
          );
        })()}

        {/* ── "BLUEPRINT" watermark ─────────────────────────────────────── */}
        <text
          x={cx} y={cy}
          textAnchor="middle" dominantBaseline="central"
          fill={bp.grid} fontSize={90}
          fontFamily="'Outfit', 'DM Sans', sans-serif"
          fontWeight={900} letterSpacing={20}
          opacity={drawProgress * 0.04}
          transform={`rotate(-30, ${cx}, ${cy})`}
        >
          BLUEPRINT
        </text>
      </svg>
    </AbsoluteFill>
  );
};

export default CityBlueprint;
