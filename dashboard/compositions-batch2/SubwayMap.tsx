import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from 'remotion';
import { colors } from './theme';

// ── Deterministic random ─────────────────────────────────────────────────────

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── Types ────────────────────────────────────────────────────────────────────

interface Station {
  id: string;
  label: string;
  sublabel: string;
  x: number;
  y: number;
  lines: string[];
  enterDelay: number;
  zone: number;
}

interface LineSegment {
  lineId: string;
  color: string;
  points: Array<{ x: number; y: number }>;
  enterDelay: number;
  label: string;
  trainSpeed: number;
}

interface ArrivalMessage {
  text: string;
  line: string;
  color: string;
}

// ── Subway Map Composition ───────────────────────────────────────────────────

export const SubwayMap: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const cx = width / 2;
  const cy = height / 2;

  // ── Zone backgrounds ─────────────────────────────────────────────────────

  const zoneOpacity = interpolate(frame, [0, 40], [0, 1], { extrapolateRight: 'clamp' });

  // ── Station definitions ──────────────────────────────────────────────────

  const stations: Station[] = useMemo(() => [
    // RED LINE (horizontal, top third): Projects → API Gateway → c9-operator → Hub → Dashboard
    { id: 'projects', label: 'Projects', sublabel: 'Managed Repos', x: cx - 520, y: cy - 220, lines: ['green'], enterDelay: 12, zone: 3 },
    { id: 'api', label: 'API Gateway', sublabel: 'HTTP + WebSocket', x: cx - 260, y: cy - 160, lines: ['red', 'green'], enterDelay: 5, zone: 2 },
    { id: 'operator', label: 'c9-operator', sublabel: 'Event Bus + Reconciler', x: cx, y: cy - 160, lines: ['red', 'blue', 'purple'], enterDelay: 0, zone: 1 },
    { id: 'hub', label: 'Hub', sublabel: 'WS Broadcast', x: cx + 300, y: cy - 160, lines: ['red'], enterDelay: 8, zone: 2 },
    { id: 'dashboard', label: 'Dashboard', sublabel: 'React + Remotion', x: cx + 560, y: cy - 160, lines: ['red'], enterDelay: 10, zone: 3 },

    // BLUE LINE (vertical from operator down to broker)
    { id: 'broker', label: 'Broker', sublabel: 'Session Lifecycle', x: cx, y: cy + 60, lines: ['blue', 'yellow'], enterDelay: 14, zone: 1 },

    // YELLOW LINE (horizontal, bottom): agents spread out
    { id: 'agent1', label: 'Agent \u03b1', sublabel: 'claude subprocess', x: cx - 360, y: cy + 220, lines: ['yellow', 'purple'], enterDelay: 20, zone: 2 },
    { id: 'agent2', label: 'Agent \u03b2', sublabel: 'claude subprocess', x: cx - 120, y: cy + 220, lines: ['yellow'], enterDelay: 24, zone: 2 },
    { id: 'agent3', label: 'Agent \u03b3', sublabel: 'claude subprocess', x: cx + 120, y: cy + 220, lines: ['yellow'], enterDelay: 28, zone: 2 },
    { id: 'agent4', label: 'Agent \u03b4', sublabel: 'spawned by \u03b1', x: cx + 360, y: cy + 220, lines: ['yellow'], enterDelay: 40, zone: 3 },
  ], [cx, cy]);

  const stationMap = useMemo(() => Object.fromEntries(stations.map((s) => [s.id, s])), [stations]);

  // ── Line definitions (polylines) ─────────────────────────────────────────

  const lineColors: Record<string, string> = {
    red: '#e53935',
    blue: '#1e88e5',
    yellow: '#fdd835',
    green: '#43a047',
    purple: '#8e24aa',
  };

  const lines: LineSegment[] = useMemo(() => {
    const op = stationMap['operator'];
    const api = stationMap['api'];
    const hub = stationMap['hub'];
    const dash = stationMap['dashboard'];
    const brk = stationMap['broker'];
    const a1 = stationMap['agent1'];
    const a2 = stationMap['agent2'];
    const a3 = stationMap['agent3'];
    const a4 = stationMap['agent4'];
    const proj = stationMap['projects'];

    return [
      // RED LINE: API → Operator → Hub → Dashboard (horizontal top)
      {
        lineId: 'red', color: lineColors.red, enterDelay: 3, label: 'Central Line', trainSpeed: 0.012,
        points: [
          { x: api.x, y: api.y },
          { x: op.x, y: op.y },
          { x: hub.x, y: hub.y },
          { x: dash.x, y: dash.y },
        ],
      },
      // BLUE LINE: Operator → Broker (vertical)
      {
        lineId: 'blue', color: lineColors.blue, enterDelay: 10, label: 'Broker Line', trainSpeed: 0.015,
        points: [
          { x: op.x, y: op.y },
          { x: brk.x, y: brk.y },
        ],
      },
      // YELLOW LINE: Broker → agents (horizontal bottom with vertical connector)
      {
        lineId: 'yellow', color: lineColors.yellow, enterDelay: 16, label: 'Agent Line', trainSpeed: 0.01,
        points: [
          { x: a1.x, y: a1.y },
          { x: a1.x, y: brk.y + 80 },
          { x: brk.x, y: brk.y + 80 },
          { x: brk.x, y: brk.y },
          { x: brk.x, y: brk.y + 80 },
          { x: a4.x, y: brk.y + 80 },
          { x: a4.x, y: a4.y },
        ],
      },
      // Branch segments for agents 2 and 3 off yellow line
      {
        lineId: 'yellow-b2', color: lineColors.yellow, enterDelay: 22, label: '', trainSpeed: 0.018,
        points: [
          { x: a2.x, y: brk.y + 80 },
          { x: a2.x, y: a2.y },
        ],
      },
      {
        lineId: 'yellow-b3', color: lineColors.yellow, enterDelay: 26, label: '', trainSpeed: 0.016,
        points: [
          { x: a3.x, y: brk.y + 80 },
          { x: a3.x, y: a3.y },
        ],
      },
      // GREEN LINE: Projects → API (diagonal 45 degrees)
      {
        lineId: 'green', color: lineColors.green, enterDelay: 8, label: 'Project Line', trainSpeed: 0.013,
        points: [
          { x: proj.x, y: proj.y },
          { x: proj.x + 60, y: proj.y },
          { x: api.x, y: api.y },
        ],
      },
      // PURPLE LINE: Agent alpha → Operator (diagonal spawn-request path)
      {
        lineId: 'purple', color: lineColors.purple, enterDelay: 35, label: 'Spawn Line', trainSpeed: 0.02,
        points: [
          { x: a1.x, y: a1.y },
          { x: a1.x, y: op.y + 80 },
          { x: op.x - 80, y: op.y + 80 },
          { x: op.x - 80, y: op.y },
          { x: op.x, y: op.y },
        ],
      },
    ];
  }, [stationMap, lineColors]);

  // ── Parchment texture dots ───────────────────────────────────────────────

  const textureDots = useMemo(() => {
    const rng = seededRandom(77);
    return Array.from({ length: 300 }, () => ({
      x: rng() * width,
      y: rng() * height,
      r: rng() * 1.2 + 0.2,
      opacity: rng() * 0.04 + 0.01,
    }));
  }, [width, height]);

  // ── Arrival board messages ───────────────────────────────────────────────

  const arrivalMessages: ArrivalMessage[] = useMemo(() => [
    { text: 'TaskDispatched', line: 'Central Line', color: lineColors.red },
    { text: 'AgentSpawned', line: 'Broker Line', color: lineColors.blue },
    { text: 'SpawnRequest', line: 'Spawn Line', color: lineColors.purple },
    { text: 'StreamEvent', line: 'Central Line', color: lineColors.red },
    { text: 'AgentDone', line: 'Agent Line', color: lineColors.yellow },
  ], [lineColors]);

  const currentMessage = Math.floor((frame / 80) % arrivalMessages.length);
  const msgProgress = interpolate((frame % 80), [0, 15, 65, 80], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // ── Map unfold animation ─────────────────────────────────────────────────

  const mapScale = spring({ frame, fps, config: { damping: 18, stiffness: 40 } });
  const mapOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  // ── Render helpers ───────────────────────────────────────────────────────

  const getPolylineLength = (pts: Array<{ x: number; y: number }>): number => {
    let len = 0;
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x;
      const dy = pts[i].y - pts[i - 1].y;
      len += Math.sqrt(dx * dx + dy * dy);
    }
    return len;
  };

  const getPointOnPolyline = (pts: Array<{ x: number; y: number }>, t: number): { x: number; y: number } => {
    const totalLen = getPolylineLength(pts);
    let target = t * totalLen;
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x;
      const dy = pts[i].y - pts[i - 1].y;
      const segLen = Math.sqrt(dx * dx + dy * dy);
      if (target <= segLen) {
        const frac = segLen > 0 ? target / segLen : 0;
        return { x: pts[i - 1].x + dx * frac, y: pts[i - 1].y + dy * frac };
      }
      target -= segLen;
    }
    return pts[pts.length - 1];
  };

  const polylineToPath = (pts: Array<{ x: number; y: number }>): string => {
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  };

  const renderLine = (line: LineSegment) => {
    const progress = interpolate(frame, [line.enterDelay, line.enterDelay + 30], [0, 1], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });
    if (progress <= 0) return null;

    const totalLen = getPolylineLength(line.points);
    const dashLen = totalLen * progress;
    const pathD = polylineToPath(line.points);

    // Train position (loops along the line)
    const trainT = ((frame - line.enterDelay) * line.trainSpeed) % 1;
    const trainPos = progress >= 1 ? getPointOnPolyline(line.points, trainT) : null;

    return (
      <g key={line.lineId}>
        {/* Line glow */}
        <path
          d={pathD}
          fill="none"
          stroke={line.color}
          strokeWidth={12}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.08}
          strokeDasharray={`${dashLen} ${totalLen}`}
          filter="url(#lineGlow)"
        />
        {/* Main line */}
        <path
          d={pathD}
          fill="none"
          stroke={line.color}
          strokeWidth={8}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.85}
          strokeDasharray={`${dashLen} ${totalLen}`}
        />
        {/* Inner highlight */}
        <path
          d={pathD}
          fill="none"
          stroke="white"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.15}
          strokeDasharray={`${dashLen} ${totalLen}`}
        />
        {/* Train rectangle */}
        {trainPos && (
          <g>
            <rect
              x={trainPos.x - 12}
              y={trainPos.y - 6}
              width={24}
              height={12}
              rx={3}
              fill={line.color}
              opacity={0.95}
              style={{ filter: `drop-shadow(0 0 6px ${line.color})` }}
            />
            <rect
              x={trainPos.x - 9}
              y={trainPos.y - 3}
              width={6}
              height={6}
              rx={1}
              fill="white"
              opacity={0.6}
            />
            <rect
              x={trainPos.x + 1}
              y={trainPos.y - 3}
              width={6}
              height={6}
              rx={1}
              fill="white"
              opacity={0.6}
            />
          </g>
        )}
      </g>
    );
  };

  const renderStation = (station: Station) => {
    const s = spring({ frame: frame - station.enterDelay, fps, config: { damping: 14, stiffness: 70 } });
    if (s <= 0.01) return null;

    const isInterchange = station.lines.length > 1;
    const isOperator = station.id === 'operator';
    const stationRadius = isOperator ? 22 : isInterchange ? 18 : 14;

    // "You Are Here" pulse for operator
    const pulseRadius = isOperator ? 22 + Math.sin(frame * 0.06) * 4 + 4 : 0;
    const pulseOpacity = isOperator ? 0.3 + Math.sin(frame * 0.06) * 0.15 : 0;

    // Station active pulse (cycles through stations)
    const activeStation = Math.floor((frame / 40) % stations.length);
    const isActive = stations[activeStation].id === station.id;
    const activeGlow = isActive ? 0.4 + Math.sin(frame * 0.15) * 0.2 : 0;

    // Colors for interchange rings
    const ringColors = station.lines.map((l) => lineColors[l] || colors.textDim);

    return (
      <g key={station.id} transform={`translate(${station.x}, ${station.y}) scale(${s})`}>
        {/* Active station glow */}
        {isActive && (
          <circle r={stationRadius + 12} fill="none" stroke={ringColors[0]} strokeWidth={2} opacity={activeGlow} />
        )}

        {/* "You Are Here" pulse */}
        {isOperator && (
          <>
            <circle r={pulseRadius + 10} fill="none" stroke={colors.cyan} strokeWidth={1.5} opacity={pulseOpacity * 0.4} />
            <circle r={pulseRadius} fill="none" stroke={colors.cyan} strokeWidth={2} opacity={pulseOpacity} />
          </>
        )}

        {/* Interchange rectangle connector */}
        {isInterchange && (
          <rect
            x={-stationRadius - 4}
            y={-stationRadius - 4}
            width={(stationRadius + 4) * 2}
            height={(stationRadius + 4) * 2}
            rx={6}
            fill="none"
            stroke="white"
            strokeWidth={1.5}
            opacity={0.3}
          />
        )}

        {/* Colored rings (one per line) */}
        {ringColors.map((rc, ri) => (
          <circle
            key={`ring-${ri}`}
            r={stationRadius + 2 - ri * 3}
            fill="none"
            stroke={rc}
            strokeWidth={3}
            opacity={0.9}
          />
        ))}

        {/* White station dot */}
        <circle r={stationRadius - 4} fill="white" opacity={0.95} />
        <circle r={stationRadius - 7} fill={colors.bgDeep} opacity={0.4} />

        {/* Label (rotated 45 degrees like real metro maps) */}
        <g transform="rotate(-45)">
          <text
            x={stationRadius + 10}
            y={-4}
            fill={colors.text}
            fontSize={isOperator ? 14 : 11}
            fontFamily="'Outfit', 'DM Sans', sans-serif"
            fontWeight={isOperator ? 700 : 600}
            letterSpacing={isOperator ? 1.5 : 0.5}
          >
            {station.label}
          </text>
          <text
            x={stationRadius + 10}
            y={10}
            fill={colors.textMuted}
            fontSize={8}
            fontFamily="'IBM Plex Mono', monospace"
          >
            {station.sublabel}
          </text>
        </g>

        {/* Zone indicator */}
        <text
          y={stationRadius + 20}
          textAnchor="middle"
          fill={colors.textMuted}
          fontSize={7}
          fontFamily="'IBM Plex Mono', monospace"
          opacity={0.5}
        >
          Z{station.zone}
        </text>
      </g>
    );
  };

  // ── Legend data ──────────────────────────────────────────────────────────

  const legendItems = useMemo(() => [
    { color: lineColors.red, label: 'Central Line' },
    { color: lineColors.blue, label: 'Broker Line' },
    { color: lineColors.yellow, label: 'Agent Line' },
    { color: lineColors.green, label: 'Project Line' },
    { color: lineColors.purple, label: 'Spawn Line' },
  ], [lineColors]);

  const legendOpacity = interpolate(frame, [50, 65], [0, 1], { extrapolateRight: 'clamp' });

  // ── Title ────────────────────────────────────────────────────────────────

  const titleOpacity = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: 'clamp' });

  // ── Zone ellipses ────────────────────────────────────────────────────────

  const zones = useMemo(() => [
    { cx: cx, cy: cy, rx: 160, ry: 180, label: '1', color: colors.cyan },
    { cx: cx, cy: cy, rx: 380, ry: 300, label: '2', color: colors.purple },
    { cx: cx, cy: cy, rx: 620, ry: 380, label: '3', color: colors.blue },
  ], [cx, cy]);

  return (
    <AbsoluteFill style={{ backgroundColor: '#faf8f0' }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ opacity: mapOpacity, transform: `scale(${0.9 + mapScale * 0.1})`, transformOrigin: 'center' }}
      >
        <defs>
          <filter id="lineGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <filter id="stationGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="1" dy="1" stdDeviation="2" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* Parchment background */}
        <rect width={width} height={height} fill="#faf8f0" />

        {/* Subtle paper texture */}
        {textureDots.map((d, i) => (
          <circle key={`tex${i}`} cx={d.x} cy={d.y} r={d.r} fill="#8b7355" opacity={d.opacity} />
        ))}

        {/* Zone backgrounds */}
        <g opacity={zoneOpacity * 0.12}>
          {zones.map((z, i) => (
            <g key={`zone${i}`}>
              <ellipse cx={z.cx} cy={z.cy} rx={z.rx} ry={z.ry} fill="none" stroke={z.color} strokeWidth={1} strokeDasharray="8 4" opacity={0.5} />
              <text
                x={z.cx + z.rx - 20}
                y={z.cy - z.ry + 18}
                fill={z.color}
                fontSize={14}
                fontFamily="'Outfit', 'DM Sans', sans-serif"
                fontWeight={600}
                opacity={0.6}
              >
                Zone {z.label}
              </text>
            </g>
          ))}
        </g>

        {/* Map border / frame */}
        <rect x={30} y={30} width={width - 60} height={height - 60} fill="none" stroke="#c4b69c" strokeWidth={2} rx={8} opacity={zoneOpacity * 0.4} />
        <rect x={34} y={34} width={width - 68} height={height - 68} fill="none" stroke="#c4b69c" strokeWidth={0.5} rx={6} opacity={zoneOpacity * 0.3} />

        {/* Transit lines */}
        {lines.map(renderLine)}

        {/* Station connection ticks at junctions on the yellow line */}
        {stations.filter((s) => s.id.startsWith('agent')).map((s) => {
          const enterProg = interpolate(frame, [s.enterDelay - 5, s.enterDelay + 5], [0, 1], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          });
          if (enterProg <= 0) return null;
          return (
            <line
              key={`tick-${s.id}`}
              x1={s.x}
              y1={stationMap['broker'].y + 80}
              x2={s.x}
              y2={s.y}
              stroke={lineColors.yellow}
              strokeWidth={8}
              strokeLinecap="round"
              opacity={0.15 * enterProg}
            />
          );
        })}

        {/* Stations */}
        {stations.map(renderStation)}

        {/* Arrival board (bottom-right corner) */}
        <g transform={`translate(${width - 280}, ${height - 130})`} opacity={legendOpacity}>
          {/* Board background */}
          <rect x={0} y={0} width={240} height={80} rx={6} fill="#1a1a2e" opacity={0.95} />
          <rect x={0} y={0} width={240} height={80} rx={6} fill="none" stroke="#444" strokeWidth={1} />

          {/* Header */}
          <rect x={0} y={0} width={240} height={20} rx={6} fill="#2a2a3e" />
          <rect x={0} y={10} width={240} height={10} fill="#2a2a3e" />
          <text x={120} y={14} textAnchor="middle" fill={colors.amber} fontSize={9} fontFamily="'IBM Plex Mono', monospace" fontWeight={700} letterSpacing={2}>
            ARRIVALS
          </text>

          {/* Current message */}
          <g opacity={msgProgress}>
            <text x={16} y={42} fill={arrivalMessages[currentMessage].color} fontSize={10} fontFamily="'IBM Plex Mono', monospace" fontWeight={600}>
              {arrivalMessages[currentMessage].line}
            </text>
            <text x={16} y={58} fill={colors.text} fontSize={12} fontFamily="'IBM Plex Mono', monospace" fontWeight={700}>
              {arrivalMessages[currentMessage].text}
            </text>
            <text x={224} y={58} textAnchor="end" fill={colors.green} fontSize={10} fontFamily="'IBM Plex Mono', monospace">
              {Math.floor((frame % 80) / 80 * 5)} min
            </text>
          </g>

          {/* Scan line effect */}
          <rect x={1} y={(frame * 0.5) % 80} width={238} height={2} fill="white" opacity={0.03} />
        </g>

        {/* Legend (top-left) */}
        <g opacity={legendOpacity} transform="translate(50, 50)">
          <rect x={-10} y={-16} width={160} height={legendItems.length * 22 + 30} rx={6} fill="#faf8f0" stroke="#c4b69c" strokeWidth={1} opacity={0.9} />
          <text x={0} y={0} fill="#3d3529" fontSize={11} fontFamily="'Outfit', 'DM Sans', sans-serif" fontWeight={700} letterSpacing={1}>
            TRANSIT MAP
          </text>
          {legendItems.map((item, i) => (
            <g key={`leg${i}`} transform={`translate(0, ${18 + i * 22})`}>
              <line x1={0} y1={0} x2={24} y2={0} stroke={item.color} strokeWidth={6} strokeLinecap="round" />
              <text x={32} y={4} fill="#3d3529" fontSize={9} fontFamily="'IBM Plex Mono', monospace" fontWeight={500}>
                {item.label}
              </text>
            </g>
          ))}
          {/* Interchange symbol */}
          <g transform={`translate(0, ${18 + legendItems.length * 22})`}>
            <circle cx={12} cy={0} r={6} fill="white" stroke="#333" strokeWidth={2} />
            <text x={32} y={4} fill="#3d3529" fontSize={9} fontFamily="'IBM Plex Mono', monospace" fontWeight={500}>
              Interchange
            </text>
          </g>
        </g>

        {/* Title bar */}
        <g opacity={titleOpacity}>
          <text
            x={cx}
            y={height - 50}
            textAnchor="middle"
            fill="#2a1f14"
            fontSize={24}
            fontFamily="'Outfit', 'DM Sans', sans-serif"
            fontWeight={800}
            letterSpacing={6}
          >
            c9-OPERATOR TRANSIT AUTHORITY
          </text>
          <text
            x={cx}
            y={height - 30}
            textAnchor="middle"
            fill="#7a6b57"
            fontSize={10}
            fontFamily="'IBM Plex Mono', monospace"
            letterSpacing={3}
          >
            AGENT ORCHESTRATION NETWORK
          </text>
        </g>

        {/* Connection labels on the map (edge annotations) */}
        {frame > 30 && (
          <g opacity={interpolate(frame, [30, 45], [0, 0.6], { extrapolateRight: 'clamp' })}>
            {/* API → Operator label */}
            <text
              x={(stationMap['api'].x + stationMap['operator'].x) / 2}
              y={stationMap['api'].y - 18}
              textAnchor="middle"
              fill={lineColors.red}
              fontSize={8}
              fontFamily="'IBM Plex Mono', monospace"
              fontWeight={600}
              opacity={0.7}
            >
              dispatch
            </text>
            {/* Operator → Broker label */}
            <text
              x={stationMap['operator'].x + 20}
              y={(stationMap['operator'].y + stationMap['broker'].y) / 2}
              fill={lineColors.blue}
              fontSize={8}
              fontFamily="'IBM Plex Mono', monospace"
              fontWeight={600}
              opacity={0.7}
            >
              spawn
            </text>
            {/* Hub → Dashboard label */}
            <text
              x={(stationMap['hub'].x + stationMap['dashboard'].x) / 2}
              y={stationMap['hub'].y - 18}
              textAnchor="middle"
              fill={lineColors.red}
              fontSize={8}
              fontFamily="'IBM Plex Mono', monospace"
              fontWeight={600}
              opacity={0.7}
            >
              stream
            </text>
            {/* Agent alpha spawn request label */}
            <text
              x={stationMap['agent1'].x - 50}
              y={(stationMap['agent1'].y + stationMap['operator'].y) / 2}
              fill={lineColors.purple}
              fontSize={8}
              fontFamily="'IBM Plex Mono', monospace"
              fontWeight={600}
              opacity={0.7}
              transform={`rotate(-90, ${stationMap['agent1'].x - 50}, ${(stationMap['agent1'].y + stationMap['operator'].y) / 2})`}
            >
              spawn_request
            </text>
          </g>
        )}

        {/* Decorative compass rose (top-right area) */}
        <g opacity={legendOpacity * 0.3} transform={`translate(${width - 100}, 80)`}>
          <line x1={0} y1={-20} x2={0} y2={20} stroke="#8b7355" strokeWidth={1} />
          <line x1={-20} y1={0} x2={20} y2={0} stroke="#8b7355" strokeWidth={1} />
          <polygon points="0,-22 -3,-16 3,-16" fill="#8b7355" />
          <text x={0} y={-26} textAnchor="middle" fill="#8b7355" fontSize={8} fontFamily="'Outfit', 'DM Sans', sans-serif" fontWeight={700}>
            N
          </text>
        </g>

        {/* Copyright / map number */}
        <text
          x={width - 50}
          y={height - 50}
          textAnchor="end"
          fill="#b8a88a"
          fontSize={7}
          fontFamily="'IBM Plex Mono', monospace"
          opacity={legendOpacity * 0.5}
        >
          Map No. C9-2026
        </text>
      </svg>
    </AbsoluteFill>
  );
};

export default SubwayMap;
