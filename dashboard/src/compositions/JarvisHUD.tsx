import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
  Easing,
} from 'remotion';
import { colors, hexToRgb } from './theme';

// ── Deterministic RNG ───────────────────────────────────────────────────────

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── Palette (JARVIS holographic) ────────────────────────────────────────────

const J = {
  bg: '#050a12',
  bgPanel: '#0a2a3a',
  holo: '#00d4ff',
  holoDim: '#006688',
  holoGhost: '#003344',
  arcWhite: '#b4f0ff',
  orange: '#ff8c00',
  orangeDim: '#995300',
  text: '#c0e8ff',
  textDim: '#5599aa',
};

// bridge theme imports for consistency
void colors;
void hexToRgb;

// ── Agent status data ───────────────────────────────────────────────────────

const AGENTS = [
  { id: '\u03b1', name: 'Agent-\u03b1', status: 'ACTIVE', cpu: 42, task: 'Build API routes' },
  { id: '\u03b2', name: 'Agent-\u03b2', status: 'ACTIVE', cpu: 67, task: 'Write test suite' },
  { id: '\u03b3', name: 'Agent-\u03b3', status: 'IDLE', cpu: 8, task: 'Awaiting dispatch' },
  { id: '\u03b4', name: 'Agent-\u03b4', status: 'ACTIVE', cpu: 55, task: 'Deploy staging' },
];

// ── System metrics ──────────────────────────────────────────────────────────

const METRICS = [
  { label: 'THROUGHPUT', value: 284, max: 400, unit: 'req/s' },
  { label: 'LATENCY', value: 38, max: 200, unit: 'ms' },
  { label: 'SESSIONS', value: 4, max: 10, unit: '' },
  { label: 'MEMORY', value: 67, max: 100, unit: '%' },
  { label: 'TOKENS', value: 182, max: 300, unit: 'K/min' },
];

// ── Event stream entries ────────────────────────────────────────────────────

const EVENTS = [
  'TaskDispatched: stellar-api/build',
  'AgentSpawned: session s-7a2f',
  'Milestone: Read PROJECT.md',
  'WebSocket: 23 clients connected',
  'Reconcile: loop #1447 nominal',
  'Milestone: Bash git status',
  'AgentDone: session s-3e1c',
  'SpawnRequest: sub-agent for tests',
  'Milestone: Write index.ts',
  'HealthCheck: all agents nominal',
];

// ── Component ───────────────────────────────────────────────────────────────

export const JarvisHUD: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const cx = width / 2;
  const cy = height / 2;

  // ── Master entrance ─────────────────────────────────────────────────────────
  const masterFade = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  // ── Arc reactor ring data ───────────────────────────────────────────────────
  const arcRings = useMemo(() => [
    { r: 60, width: 2, speed: 0.02, segments: 12, gap: 8 },
    { r: 85, width: 1.5, speed: -0.015, segments: 18, gap: 5 },
    { r: 110, width: 1, speed: 0.01, segments: 24, gap: 4 },
    { r: 135, width: 0.8, speed: -0.008, segments: 30, gap: 6 },
    { r: 160, width: 0.5, speed: 0.006, segments: 36, gap: 3 },
  ], []);

  // ── Particle dust (bokeh) ───────────────────────────────────────────────────
  const particles = useMemo(() => {
    const rng = seededRandom(42);
    return Array.from({ length: 80 }, () => ({
      x: rng() * width,
      y: rng() * height,
      size: rng() * 3 + 1,
      speed: rng() * 0.3 + 0.05,
      angle: rng() * Math.PI * 2,
      opacity: rng() * 0.15 + 0.03,
    }));
  }, [width, height]);

  // ── Data rain columns ───────────────────────────────────────────────────────
  const dataRainCols = useMemo(() => {
    const rng = seededRandom(101);
    return Array.from({ length: 15 }, () => ({
      x: rng() * width,
      speed: rng() * 2 + 1,
      chars: Array.from({ length: 12 }, () =>
        String.fromCharCode(48 + Math.floor(rng() * 42))
      ),
      phase: rng() * height,
    }));
  }, [width, height]);

  // ── Wire-frame sphere vertices ──────────────────────────────────────────────
  const sphereLines = useMemo(() => {
    const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    const res = 8;
    for (let i = 0; i <= res; i++) {
      const lat = (i / res) * Math.PI;
      for (let j = 0; j < res; j++) {
        const lon1 = (j / res) * Math.PI * 2;
        const lon2 = ((j + 1) / res) * Math.PI * 2;
        lines.push({
          x1: Math.sin(lat) * Math.cos(lon1),
          y1: Math.cos(lat),
          x2: Math.sin(lat) * Math.cos(lon2),
          y2: Math.cos(lat),
        });
      }
    }
    for (let j = 0; j < res; j++) {
      const lon = (j / res) * Math.PI * 2;
      for (let i = 0; i < res; i++) {
        const lat1 = (i / res) * Math.PI;
        const lat2 = ((i + 1) / res) * Math.PI;
        lines.push({
          x1: Math.sin(lat1) * Math.cos(lon),
          y1: Math.cos(lat1),
          x2: Math.sin(lat2) * Math.cos(lon),
          y2: Math.cos(lat2),
        });
      }
    }
    return lines;
  }, []);

  // ── Percentage ring values ──────────────────────────────────────────────────
  const ringPercentages = useMemo(() => [
    { label: 'CPU', pct: 0.42, cx: cx - 320, cy: cy - 200 },
    { label: 'MEM', pct: 0.67, cx: cx + 340, cy: cy + 220 },
  ], [cx, cy]);

  // ── Network topology nodes ──────────────────────────────────────────────────
  const topoNodes = useMemo(() => {
    const rng = seededRandom(777);
    return Array.from({ length: 8 }, () => ({
      x: rng() * 200,
      y: rng() * 140,
    }));
  }, []);

  const topoEdges = useMemo(() => [
    [0, 1], [1, 2], [2, 3], [0, 4], [4, 5], [5, 6], [6, 7], [3, 7], [1, 5], [2, 6],
  ], []);

  // ── Scanning beam angle ─────────────────────────────────────────────────────
  const scanAngle = (frame / 300) * Math.PI * 2;

  // ── Panel entrance springs ──────────────────────────────────────────────────
  const panelTL = spring({ frame: frame - 15, fps, config: { damping: 14, stiffness: 70 } });
  const panelTR = spring({ frame: frame - 25, fps, config: { damping: 14, stiffness: 70 } });
  const panelBL = spring({ frame: frame - 35, fps, config: { damping: 14, stiffness: 70 } });
  const panelBR = spring({ frame: frame - 45, fps, config: { damping: 14, stiffness: 70 } });

  // ── Holographic flicker helper ──────────────────────────────────────────────
  const holoFlicker = (seed: number) => {
    const v = Math.sin(frame * 0.8 + seed * 7) * Math.sin(frame * 2.1 + seed * 3);
    return v > 0.7 ? 0.5 : 1.0;
  };

  // ── Holographic panel helper ────────────────────────────────────────────────
  const holoPanel = (
    x: number, y: number, w: number, h: number,
    title: string, enterVal: number, skewDeg: number
  ) => {
    const scanY = ((frame * 1.5) % h);
    return (
      <g transform={`translate(${x}, ${y}) skewY(${skewDeg})`} opacity={enterVal}>
        {/* Panel background */}
        <rect x={0} y={0} width={w} height={h} fill={J.bgPanel} opacity={0.35}
          stroke={J.holo} strokeWidth={0.8} rx={2} />
        {/* Top accent line */}
        <line x1={0} y1={0} x2={w} y2={0} stroke={J.holo} strokeWidth={1.5} opacity={0.8} />
        {/* Title */}
        <text x={8} y={16} fill={J.holo} fontSize={10}
          fontFamily="'IBM Plex Mono', monospace" letterSpacing={2} fontWeight={700}>
          {title}
        </text>
        {/* Scan line */}
        <line x1={0} y1={scanY} x2={w} y2={scanY}
          stroke={J.holo} strokeWidth={0.5} opacity={0.15} />
        {/* Corner brackets */}
        <path d="M 0,8 L 0,0 L 8,0" fill="none" stroke={J.orange} strokeWidth={1} opacity={0.6} />
        <path d={`M ${w},8 L ${w},0 L ${w - 8},0`} fill="none" stroke={J.orange} strokeWidth={1} opacity={0.6} />
        <path d={`M 0,${h - 8} L 0,${h} L 8,${h}`} fill="none" stroke={J.orange} strokeWidth={1} opacity={0.4} />
        <path d={`M ${w},${h - 8} L ${w},${h} L ${w - 8},${h}`} fill="none" stroke={J.orange} strokeWidth={1} opacity={0.4} />
      </g>
    );
  };

  // ── Core pulse ──────────────────────────────────────────────────────────────
  const corePulse = 0.7 + Math.sin(frame * 0.12) * 0.3;
  const coreScale = 1 + Math.sin(frame * 0.08) * 0.05;

  // ── Sphere rotation ─────────────────────────────────────────────────────────
  const sphereRot = frame * 0.01;

  return (
    <AbsoluteFill style={{ backgroundColor: J.bg }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <filter id="jarvisGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="glow" />
            <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="jarvisBloom" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
          <filter id="jarvisLensFlare" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="15" />
          </filter>
          <radialGradient id="arcCoreGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={J.arcWhite} stopOpacity="0.9" />
            <stop offset="40%" stopColor={J.holo} stopOpacity="0.4" />
            <stop offset="100%" stopColor={J.holo} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="holoBgGrad" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor={J.holo} stopOpacity="0.04" />
            <stop offset="100%" stopColor={J.bg} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="chromAberr" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ff0040" stopOpacity="0.06" />
            <stop offset="50%" stopColor="#000000" stopOpacity="0" />
            <stop offset="100%" stopColor="#0040ff" stopOpacity="0.06" />
          </linearGradient>
        </defs>

        <g opacity={masterFade}>

          {/* ── Background glow ─────────────────────────────────────────────────── */}
          <rect x={0} y={0} width={width} height={height} fill={J.bg} />
          <circle cx={cx} cy={cy} r={400} fill="url(#holoBgGrad)" />

          {/* ── Particle dust (bokeh) ───────────────────────────────────────────── */}
          {particles.map((p, i) => {
            const px = (p.x + Math.cos(p.angle) * p.speed * frame) % width;
            const py = (p.y + Math.sin(p.angle) * p.speed * frame * 0.7) % height;
            return (
              <circle key={`dust${i}`}
                cx={px < 0 ? px + width : px}
                cy={py < 0 ? py + height : py}
                r={p.size} fill={J.holo} opacity={p.opacity * (0.5 + Math.sin(frame * 0.03 + i) * 0.5)}
                filter="url(#jarvisBloom)" />
            );
          })}

          {/* ══════════════════════════════════════════════════════════════════════
              CENTER — Arc Reactor
              ══════════════════════════════════════════════════════════════════════ */}

          <g transform={`translate(${cx}, ${cy})`}>
            {/* Lens flare */}
            <circle r={30} fill={J.arcWhite} opacity={corePulse * 0.15}
              filter="url(#jarvisLensFlare)" />

            {/* Concentric rotating rings */}
            {arcRings.map((ring, ri) => {
              const rotation = frame * ring.speed * 360;
              const segAngle = 360 / ring.segments;
              const gapAngle = ring.gap;
              const arcAngle = segAngle - gapAngle;
              const enterR = spring({ frame: frame - ri * 5, fps, config: { damping: 16, stiffness: 80 } });
              return (
                <g key={`ring${ri}`} transform={`rotate(${rotation})`} opacity={enterR * 0.8}>
                  {Array.from({ length: ring.segments }, (_, si) => {
                    const startA = si * segAngle;
                    const endA = startA + arcAngle;
                    const startRad = (startA * Math.PI) / 180;
                    const endRad = (endA * Math.PI) / 180;
                    const x1 = Math.cos(startRad) * ring.r;
                    const y1 = Math.sin(startRad) * ring.r;
                    const x2 = Math.cos(endRad) * ring.r;
                    const y2 = Math.sin(endRad) * ring.r;
                    const largeArc = arcAngle > 180 ? 1 : 0;
                    return (
                      <path key={`seg${ri}${si}`}
                        d={`M ${x1},${y1} A ${ring.r},${ring.r} 0 ${largeArc} 1 ${x2},${y2}`}
                        fill="none" stroke={J.holo} strokeWidth={ring.width} opacity={0.6} />
                    );
                  })}
                </g>
              );
            })}

            {/* Energy core */}
            <g transform={`scale(${coreScale})`}>
              <circle r={35} fill="url(#arcCoreGrad)" opacity={corePulse} />
              <circle r={20} fill={J.arcWhite} opacity={corePulse * 0.5} />
              <circle r={8} fill="#ffffff" opacity={corePulse * 0.7} />
              {/* Inner triangular pattern */}
              <polygon points="0,-16 14,8 -14,8" fill="none"
                stroke={J.arcWhite} strokeWidth={0.8} opacity={0.6}
                transform={`rotate(${frame * 0.5})`} />
              <polygon points="0,16 -14,-8 14,-8" fill="none"
                stroke={J.arcWhite} strokeWidth={0.8} opacity={0.4}
                transform={`rotate(${-frame * 0.3})`} />
            </g>

            {/* Outward particle streams */}
            {Array.from({ length: 6 }, (_, i) => {
              const angle = (i / 6) * Math.PI * 2 + frame * 0.01;
              const dist = 40 + ((frame * 2 + i * 30) % 120);
              const px = Math.cos(angle) * dist;
              const py = Math.sin(angle) * dist;
              const op = interpolate(dist, [40, 160], [0.6, 0], { extrapolateRight: 'clamp' });
              return (
                <circle key={`stream${i}`} cx={px} cy={py} r={1.5}
                  fill={J.holo} opacity={op} />
              );
            })}

            {/* Scanning beam */}
            <line x1={0} y1={0}
              x2={Math.cos(scanAngle) * 300} y2={Math.sin(scanAngle) * 300}
              stroke={J.holo} strokeWidth={0.5} opacity={0.15} />
            <circle
              cx={Math.cos(scanAngle) * 180}
              cy={Math.sin(scanAngle) * 180}
              r={4} fill={J.holo} opacity={0.3} />
          </g>

          {/* ══════════════════════════════════════════════════════════════════════
              TOP-LEFT PANEL — Agent Status Cards
              ══════════════════════════════════════════════════════════════════════ */}
          {holoPanel(40, 60, 380, 260, 'AGENT STATUS', panelTL, -1.5)}
          <g transform="translate(40, 60) skewY(-1.5)" opacity={panelTL}>
            {AGENTS.map((agent, i) => {
              const ay = 30 + i * 55;
              const flick = holoFlicker(i);
              const barFill = interpolate(frame, [30 + i * 10, 80 + i * 10], [0, agent.cpu / 100], {
                extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
                easing: Easing.out(Easing.cubic),
              });
              return (
                <g key={`agent${i}`} opacity={flick}>
                  <rect x={8} y={ay} width={364} height={46} fill={J.bgPanel}
                    opacity={0.3} rx={2} stroke={J.holoDim} strokeWidth={0.5} />
                  {/* Status indicator */}
                  <circle cx={22} cy={ay + 14} r={4}
                    fill={agent.status === 'ACTIVE' ? J.holo : J.orangeDim}
                    opacity={agent.status === 'ACTIVE' ? 0.8 : 0.4} />
                  <text x={34} y={ay + 17} fill={J.text} fontSize={11}
                    fontFamily="'IBM Plex Mono', monospace" fontWeight={700}>
                    {agent.name}
                  </text>
                  <text x={120} y={ay + 17} fill={J.textDim} fontSize={9}
                    fontFamily="'IBM Plex Mono', monospace">
                    {agent.status}
                  </text>
                  <text x={34} y={ay + 32} fill={J.textDim} fontSize={8}
                    fontFamily="'IBM Plex Mono', monospace">
                    {agent.task}
                  </text>
                  {/* CPU bar */}
                  <rect x={220} y={ay + 8} width={140} height={6} fill={J.holoGhost}
                    opacity={0.5} rx={3} />
                  <rect x={220} y={ay + 8} width={140 * barFill} height={6} fill={J.holo}
                    opacity={0.6} rx={3} />
                  <text x={220} y={ay + 30} fill={J.textDim} fontSize={7}
                    fontFamily="'IBM Plex Mono', monospace">
                    CPU {agent.cpu}%
                  </text>
                </g>
              );
            })}
          </g>

          {/* ══════════════════════════════════════════════════════════════════════
              TOP-RIGHT PANEL — System Metrics
              ══════════════════════════════════════════════════════════════════════ */}
          {holoPanel(width - 420, 60, 380, 260, 'SYSTEM METRICS', panelTR, 1.5)}
          <g transform={`translate(${width - 420}, 60) skewY(1.5)`} opacity={panelTR}>
            {METRICS.map((metric, i) => {
              const my = 32 + i * 44;
              const barFill = interpolate(frame, [30 + i * 8, 90 + i * 8],
                [0, metric.value / metric.max], {
                  extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
                  easing: Easing.out(Easing.cubic),
                });
              return (
                <g key={`metric${i}`}>
                  <text x={12} y={my} fill={J.holo} fontSize={9}
                    fontFamily="'IBM Plex Mono', monospace" letterSpacing={1}>
                    {metric.label}
                  </text>
                  <text x={360} y={my} textAnchor="end" fill={J.text} fontSize={12}
                    fontFamily="'IBM Plex Mono', monospace" fontWeight={700}>
                    {metric.value}{metric.unit}
                  </text>
                  {/* Holographic bar */}
                  <rect x={12} y={my + 5} width={348} height={10} fill={J.holoGhost}
                    opacity={0.3} rx={1} />
                  <rect x={12} y={my + 5} width={348 * barFill} height={10} fill={J.holo}
                    opacity={0.35} rx={1} />
                  <rect x={12} y={my + 5} width={348 * barFill} height={10} fill="none"
                    stroke={J.holo} strokeWidth={0.5} opacity={0.6} rx={1} />
                  {/* Glow on bar tip */}
                  <circle cx={12 + 348 * barFill} cy={my + 10} r={3}
                    fill={J.holo} opacity={barFill > 0 ? 0.4 : 0} filter="url(#jarvisBloom)" />
                </g>
              );
            })}
          </g>

          {/* ══════════════════════════════════════════════════════════════════════
              BOTTOM-LEFT PANEL — Event Stream
              ══════════════════════════════════════════════════════════════════════ */}
          {holoPanel(40, height - 320, 380, 260, 'EVENT STREAM', panelBL, 1)}
          <g transform={`translate(40, ${height - 320}) skewY(1)`} opacity={panelBL}>
            <clipPath id="eventClip">
              <rect x={0} y={24} width={380} height={230} />
            </clipPath>
            <g clipPath="url(#eventClip)">
              {EVENTS.map((evt, i) => {
                const scrollY = ((frame * 0.6) % (EVENTS.length * 22));
                const rawY = 38 + i * 22 - scrollY;
                const yPos = rawY < 24 ? rawY + EVENTS.length * 22 : rawY;
                const isHighlight = evt.includes('Milestone');
                return (
                  <g key={`evt${i}`}>
                    <circle cx={16} cy={yPos - 3} r={2}
                      fill={isHighlight ? J.orange : J.holo} opacity={0.6} />
                    <text x={26} y={yPos}
                      fill={isHighlight ? J.orange : J.text} fontSize={9}
                      fontFamily="'IBM Plex Mono', monospace"
                      opacity={holoFlicker(i + 10) * 0.85}>
                      {evt}
                    </text>
                  </g>
                );
              })}
            </g>
          </g>

          {/* ══════════════════════════════════════════════════════════════════════
              BOTTOM-RIGHT PANEL — Network Topology
              ══════════════════════════════════════════════════════════════════════ */}
          {holoPanel(width - 420, height - 320, 380, 260, 'NETWORK TOPOLOGY', panelBR, -1)}
          <g transform={`translate(${width - 420}, ${height - 320}) skewY(-1)`} opacity={panelBR}>
            {/* Topology edges */}
            {topoEdges.map((edge, i) => {
              const from = topoNodes[edge[0]];
              const to = topoNodes[edge[1]];
              const pulsePos = ((frame * 0.5 + i * 15) % 50) / 50;
              const px = (from.x + 90) + ((to.x + 90) - (from.x + 90)) * pulsePos;
              const py = (from.y + 60) + ((to.y + 60) - (from.y + 60)) * pulsePos;
              return (
                <g key={`tedge${i}`}>
                  <line x1={from.x + 90} y1={from.y + 60} x2={to.x + 90} y2={to.y + 60}
                    stroke={J.holo} strokeWidth={0.5} opacity={0.25} />
                  <circle cx={px} cy={py} r={1.5} fill={J.holo} opacity={0.5} />
                </g>
              );
            })}
            {/* Topology nodes */}
            {topoNodes.map((node, i) => (
              <g key={`tnode${i}`}>
                <circle cx={node.x + 90} cy={node.y + 60} r={6}
                  fill={J.bgPanel} stroke={J.holo} strokeWidth={0.8} opacity={0.7} />
                <circle cx={node.x + 90} cy={node.y + 60} r={2.5}
                  fill={J.holo} opacity={0.5 + Math.sin(frame * 0.1 + i) * 0.3} />
              </g>
            ))}
          </g>

          {/* ══════════════════════════════════════════════════════════════════════
              WIRE-FRAME SPHERE
              ══════════════════════════════════════════════════════════════════════ */}
          <g transform={`translate(${cx + 350}, ${cy - 60})`} opacity={0.3}>
            {sphereLines.map((line, i) => {
              const cosR = Math.cos(sphereRot);
              const sinR = Math.sin(sphereRot);
              const x1r = line.x1 * cosR - 0 * sinR;
              const x2r = line.x2 * cosR - 0 * sinR;
              return (
                <line key={`sph${i}`}
                  x1={x1r * 60} y1={line.y1 * 60}
                  x2={x2r * 60} y2={line.y2 * 60}
                  stroke={J.holo} strokeWidth={0.3} opacity={0.5} />
              );
            })}
          </g>

          {/* ══════════════════════════════════════════════════════════════════════
              PERCENTAGE RINGS (donut charts)
              ══════════════════════════════════════════════════════════════════════ */}
          {ringPercentages.map((ring, i) => {
            const fillPct = interpolate(frame, [40 + i * 20, 100 + i * 20], [0, ring.pct], {
              extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
              easing: Easing.out(Easing.cubic),
            });
            const r = 32;
            const circumference = 2 * Math.PI * r;
            const dashLen = circumference * fillPct;
            const dashGap = circumference - dashLen;
            return (
              <g key={`pring${i}`} transform={`translate(${ring.cx}, ${ring.cy})`}>
                <circle r={r} fill="none" stroke={J.holoGhost} strokeWidth={3} opacity={0.3} />
                <circle r={r} fill="none" stroke={J.holo} strokeWidth={3} opacity={0.6}
                  strokeDasharray={`${dashLen} ${dashGap}`}
                  transform="rotate(-90)" />
                <text x={0} y={4} textAnchor="middle" fill={J.text} fontSize={14}
                  fontFamily="'IBM Plex Mono', monospace" fontWeight={700}>
                  {Math.round(fillPct * 100)}%
                </text>
                <text x={0} y={18} textAnchor="middle" fill={J.textDim} fontSize={8}
                  fontFamily="'IBM Plex Mono', monospace" letterSpacing={1}>
                  {ring.label}
                </text>
              </g>
            );
          })}

          {/* ══════════════════════════════════════════════════════════════════════
              DATA RAIN
              ══════════════════════════════════════════════════════════════════════ */}
          {dataRainCols.map((col, ci) => (
            <g key={`rain${ci}`} opacity={0.15}>
              {col.chars.map((ch, chi) => {
                const y = (col.phase + chi * 18 + frame * col.speed) % height;
                return (
                  <text key={`rch${ci}${chi}`} x={col.x} y={y}
                    fill={J.holo} fontSize={10}
                    fontFamily="'IBM Plex Mono', monospace"
                    opacity={chi === 0 ? 0.8 : 0.4}>
                    {ch}
                  </text>
                );
              })}
            </g>
          ))}

          {/* ══════════════════════════════════════════════════════════════════════
              CORNER TARGETING RETICLES
              ══════════════════════════════════════════════════════════════════════ */}
          <g transform="translate(30, 30)" opacity={0.4}>
            <line x1={0} y1={0} x2={20} y2={0} stroke={J.orange} strokeWidth={1} />
            <line x1={0} y1={0} x2={0} y2={20} stroke={J.orange} strokeWidth={1} />
            <text x={24} y={8} fill={J.orange} fontSize={7}
              fontFamily="'IBM Plex Mono', monospace">
              X:0000 Y:0000
            </text>
          </g>
          <g transform={`translate(${width - 30}, ${height - 30})`} opacity={0.4}>
            <line x1={0} y1={0} x2={-20} y2={0} stroke={J.orange} strokeWidth={1} />
            <line x1={0} y1={0} x2={0} y2={-20} stroke={J.orange} strokeWidth={1} />
            <text x={-100} y={-8} fill={J.orange} fontSize={7}
              fontFamily="'IBM Plex Mono', monospace">
              X:1920 Y:1080
            </text>
          </g>

          {/* ── J.A.R.V.I.S. label ─────────────────────────────────────────────── */}
          {(() => {
            const labelChars = Math.min(12,
              Math.floor(interpolate(frame, [5, 35], [0, 12], {
                extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
              }))
            );
            const labelText = 'J.A.R.V.I.S.'.slice(0, labelChars);
            return (
              <text x={width - 30} y={30} textAnchor="end" fill={J.holo}
                fontSize={14} fontFamily="'IBM Plex Mono', monospace"
                fontWeight={700} letterSpacing={3} opacity={0.6} filter="url(#jarvisGlow)">
                {labelText}
              </text>
            );
          })()}

          {/* ── c9-operator label ───────────────────────────────────────────────── */}
          <text x={cx} y={height - 30} textAnchor="middle" fill={J.textDim}
            fontSize={10} fontFamily="'IBM Plex Mono', monospace" letterSpacing={3}
            opacity={interpolate(frame, [60, 80], [0, 0.5], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}>
            c9-operator HOLOGRAPHIC INTERFACE v2.1
          </text>

          {/* ══════════════════════════════════════════════════════════════════════
              CINEMATIC OVERLAYS
              ══════════════════════════════════════════════════════════════════════ */}

          {/* Holographic scan lines */}
          {Array.from({ length: Math.min(Math.ceil(height / 4), 270) }, (_, i) => (
            <line key={`hsl${i}`} x1={0} y1={i * 4} x2={width} y2={i * 4}
              stroke={J.holo} strokeWidth={0.3} opacity={0.02} />
          ))}

          {/* Chromatic aberration overlay */}
          <rect x={0} y={0} width={width} height={height} fill="url(#chromAberr)" />

          {/* Vignette */}
          <radialGradient id="jarvisVignette" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor={J.bg} stopOpacity="0" />
            <stop offset="85%" stopColor={J.bg} stopOpacity="0.3" />
            <stop offset="100%" stopColor={J.bg} stopOpacity="0.7" />
          </radialGradient>
          <rect x={0} y={0} width={width} height={height} fill="url(#jarvisVignette)" />

        </g>
      </svg>
    </AbsoluteFill>
  );
};

export default JarvisHUD;
