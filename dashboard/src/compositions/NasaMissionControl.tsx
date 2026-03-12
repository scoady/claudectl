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

// ── Palette (NASA CRT phosphor) ─────────────────────────────────────────────

const P = {
  bg: '#0a0f0a',
  bgDeep: '#060a06',
  green: '#33ff66',
  greenDim: '#1a7a33',
  greenGhost: '#0d3d1a',
  amber: '#ffaa33',
  red: '#ff3333',
  panelBorder: '#1a3d1a',
  panelFill: '#0d1a0d',
};

// suppress unused-import lint — colors/hexToRgb used for theme bridge
void colors;
void hexToRgb;

// ── CAPCOM log entries ──────────────────────────────────────────────────────

const CAPCOM_ENTRIES = [
  { t: '003:14:27:01', src: 'BROKER  ', msg: 'Session s-7a2f spawned for AGENT-\u03b1' },
  { t: '003:14:27:03', src: 'AGENT-\u03b1', msg: 'Milestone: Read PROJECT.md' },
  { t: '003:14:27:08', src: 'HUB     ', msg: 'Broadcasting agent_milestone to 23 clients' },
  { t: '003:14:27:12', src: 'AGENT-\u03b2', msg: 'Milestone: Bash git status' },
  { t: '003:14:27:15', src: 'GATEWAY ', msg: 'POST /api/projects/stellar 200 14ms' },
  { t: '003:14:27:19', src: 'AGENT-\u03b3', msg: 'WARNING: token budget 82% consumed' },
  { t: '003:14:27:22', src: 'OPERATOR', msg: 'Reconcile loop #1447 complete' },
  { t: '003:14:27:28', src: 'BROKER  ', msg: 'Session s-9d1c spawned for AGENT-\u03b4' },
  { t: '003:14:27:31', src: 'AGENT-\u03b1', msg: 'Milestone: Write src/index.ts' },
  { t: '003:14:27:35', src: 'HUB     ', msg: 'WS connections: 23 active, 2 idle' },
  { t: '003:14:27:38', src: 'AGENT-\u03b3', msg: 'CAUTION: response latency 4200ms' },
  { t: '003:14:27:42', src: 'OPERATOR', msg: 'Agent-\u03b3 health check: degraded' },
  { t: '003:14:27:45', src: 'FLIGHT  ', msg: 'GO/NO-GO poll requested for AGENT-\u03b3' },
  { t: '003:14:27:48', src: 'AGENT-\u03b2', msg: 'Milestone: Grep test coverage' },
  { t: '003:14:27:52', src: 'BROKER  ', msg: 'AGENT-\u03b3 session s-3e7b: timeout warning' },
];

// ── GO/NO-GO board rows ─────────────────────────────────────────────────────

const GO_NOGO_ROWS = [
  'BOOSTER', 'RETRO', 'FIDO', 'GUIDANCE', 'SURGEON',
  'EECOM', 'GNC', 'TELMU', 'CONTROL', 'NETWORK',
];

// ── Readout fields ──────────────────────────────────────────────────────────

const READOUT_FIELDS = [
  { label: 'MSG/SEC', value: '47.3' },
  { label: 'SESSIONS', value: '4' },
  { label: 'QUEUE', value: '12' },
  { label: 'TOKENS/M', value: '284K' },
  { label: 'LATENCY', value: '38ms' },
  { label: 'UPTIME', value: '72:14:03' },
  { label: 'MEM %', value: '67.2' },
  { label: 'CPU %', value: '42.8' },
];

// ── Flight Director banner text ─────────────────────────────────────────────

const FLIGHT_BANNER = 'FLIGHT DIRECTOR: ALL STATIONS NOMINAL \u2014 ORCHESTRATION IS GO';

// ── Component ───────────────────────────────────────────────────────────────

export const NasaMissionControl: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // ── Layout constants ────────────────────────────────────────────────────────
  const LEFT_W = 460;
  const RIGHT_W = 676;
  const CENTER_W = width - LEFT_W - RIGHT_W;
  const TOP_BAR_H = 52;

  // ── Camera drift (perlin-like) ──────────────────────────────────────────────
  const driftX = Math.sin(frame * 0.013) * 1.2 + Math.sin(frame * 0.031) * 0.3;
  const driftY = Math.cos(frame * 0.017) * 1.0 + Math.cos(frame * 0.029) * 0.4;

  // ── Caution event (frames 120-180) ──────────────────────────────────────────
  const cautionActive = frame >= 120 && frame <= 180;
  const cautionFlash = cautionActive ? Math.sin(frame * 0.5) * 0.5 + 0.5 : 0;

  // ── Master fade-in ──────────────────────────────────────────────────────────
  const masterOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  // ── Film grain positions ────────────────────────────────────────────────────
  const grainDots = useMemo(() => {
    const rng = seededRandom(99);
    return Array.from({ length: 300 }, () => ({
      x: rng() * width,
      y: rng() * height,
      baseOpacity: rng() * 0.04 + 0.01,
    }));
  }, [width, height]);

  // ── Phosphor burnout sparks ─────────────────────────────────────────────────
  const burnoutSparks = useMemo(() => {
    const rng = seededRandom(777);
    return Array.from({ length: 20 }, () => ({
      x: rng() * width,
      y: rng() * height,
      frameOn: Math.floor(rng() * 300),
    }));
  }, [width, height]);

  // ── Orbital nodes ───────────────────────────────────────────────────────────
  const orbitalNodes = useMemo(() => [
    { label: 'Broker', ring: 1, baseAngle: 0 },
    { label: 'Hub', ring: 1, baseAngle: Math.PI * 0.67 },
    { label: 'Gateway', ring: 1, baseAngle: Math.PI * 1.33 },
    { label: 'Agent-\u03b1', ring: 2, baseAngle: 0.3 },
    { label: 'Agent-\u03b2', ring: 2, baseAngle: 1.2 },
    { label: 'Agent-\u03b3', ring: 2, baseAngle: 2.1 },
    { label: 'Agent-\u03b4', ring: 2, baseAngle: 3.0 },
    { label: 'Agent-\u03b5', ring: 2, baseAngle: 4.0 },
    { label: 'Agent-\u03b6', ring: 2, baseAngle: 5.1 },
  ], []);

  // ── Waveform data ───────────────────────────────────────────────────────────
  const waveformPoints = useMemo(() => {
    const rng = seededRandom(333);
    return Array.from({ length: 80 }, () => rng());
  }, []);

  // ── Strip chart seed data ───────────────────────────────────────────────────
  const stripData = useMemo(() => {
    const rng = seededRandom(555);
    return Array.from({ length: 60 }, () => rng());
  }, []);

  // ── Heartbeat LED phases ────────────────────────────────────────────────────
  const heartbeatLeds = useMemo(() => {
    const rng = seededRandom(888);
    return Array.from({ length: 8 }, () => ({
      rate: rng() * 0.15 + 0.05,
      phase: rng() * Math.PI * 2,
    }));
  }, []);

  // ── Burndown data ───────────────────────────────────────────────────────────
  const burndownData = useMemo(() => {
    const rng = seededRandom(444);
    const pts: number[] = [1.0];
    for (let i = 1; i < 20; i++) {
      pts.push(Math.max(0, pts[i - 1] - rng() * 0.08 - 0.01));
    }
    return pts;
  }, []);

  // ── Mission clock ───────────────────────────────────────────────────────────
  const missionSeconds = Math.floor(frame / fps);
  const metH = String(Math.floor(missionSeconds / 3600) + 3).padStart(3, '0');
  const metM = String(Math.floor((missionSeconds % 3600) / 60) + 14).padStart(2, '0');
  const metS = String((missionSeconds % 60) + 27).padStart(2, '0');
  const metStr = `${metH}:${metM}:${metS}`;

  // ── GMT clock ───────────────────────────────────────────────────────────────
  const gmtH = String(14 + Math.floor(missionSeconds / 3600)).padStart(2, '0');
  const gmtM = String(Math.floor((missionSeconds % 3600) / 60) + 27).padStart(2, '0');
  const gmtS = String((missionSeconds % 60) + 1).padStart(2, '0');
  const gmtStr = `${gmtH}:${gmtM}:${gmtS} GMT`;

  // ── Flight Director banner typewriter ───────────────────────────────────────
  const bannerChars = Math.min(
    FLIGHT_BANNER.length,
    Math.floor(interpolate(frame, [10, 90], [0, FLIGHT_BANNER.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }))
  );

  // ── Gauge needle angle ──────────────────────────────────────────────────────
  const gaugeBase = interpolate(frame, [0, 60], [0, 135], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const gaugeJitter = Math.sin(frame * 0.7) * 3 + Math.sin(frame * 1.3) * 1.5;
  const gaugeAngle = gaugeBase + gaugeJitter;

  // ── Session altitude meter ──────────────────────────────────────────────────
  const altitudeVal = spring({ frame, fps, config: { damping: 15, stiffness: 40 } });

  // ── Attitude indicator ──────────────────────────────────────────────────────
  const attRoll = Math.sin(frame * 0.02) * 8;
  const attPitch = Math.cos(frame * 0.015) * 15;

  // ── Scan lines ──────────────────────────────────────────────────────────────
  const scanLineCount = Math.ceil(height / 3);

  // ── Panel helper ────────────────────────────────────────────────────────────
  const panelRect = (x: number, y: number, w: number, h: number, title: string) => (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={P.panelFill} stroke={P.panelBorder}
        strokeWidth={1} rx={1} opacity={0.9} />
      <line x1={x} y1={y + 14} x2={x + w} y2={y + 14} stroke={P.panelBorder} strokeWidth={0.5} />
      <text x={x + 4} y={y + 10} fill={P.greenDim} fontSize={8}
        fontFamily="'IBM Plex Mono', monospace" letterSpacing={1.5}>
        {title}
      </text>
    </g>
  );

  return (
    <AbsoluteFill style={{ backgroundColor: P.bg }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <filter id="nasaGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="glow" />
            <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="nasaBloom" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
          <radialGradient id="vignetteGrad" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor={P.bg} stopOpacity="0" />
            <stop offset="80%" stopColor={P.bgDeep} stopOpacity="0.4" />
            <stop offset="100%" stopColor={P.bgDeep} stopOpacity="0.85" />
          </radialGradient>
          <linearGradient id="glassReflection" x1="0%" y1="0%" x2="60%" y2="60%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        <g transform={`translate(${driftX}, ${driftY})`} opacity={masterOpacity}>

          {/* ── Background ambient ─────────────────────────────────────────────── */}
          <rect x={0} y={0} width={width} height={height} fill={P.bg} />
          {cautionActive && (
            <rect x={0} y={0} width={width} height={height}
              fill={P.amber} opacity={cautionFlash * 0.04} />
          )}

          {/* ══════════════════════════════════════════════════════════════════════
              TOP BAR — Mission Clock + Phase + GMT
              ══════════════════════════════════════════════════════════════════════ */}
          <rect x={0} y={0} width={width} height={TOP_BAR_H}
            fill={P.panelFill} stroke={P.panelBorder} strokeWidth={1} />
          <line x1={0} y1={TOP_BAR_H} x2={width} y2={TOP_BAR_H}
            stroke={P.green} strokeWidth={0.5} opacity={0.3} />

          {/* MET Clock */}
          <text x={30} y={20} fill={P.greenDim} fontSize={9}
            fontFamily="'IBM Plex Mono', monospace" letterSpacing={1}>
            MISSION ELAPSED TIME
          </text>
          <text x={30} y={42} fill={P.green} fontSize={24}
            fontFamily="'IBM Plex Mono', monospace" fontWeight={700}
            letterSpacing={3} filter="url(#nasaGlow)">
            {metStr}
          </text>

          {/* Phase label */}
          <text x={width / 2} y={22} textAnchor="middle" fill={cautionActive ? P.amber : P.green}
            fontSize={12} fontFamily="'IBM Plex Mono', monospace" fontWeight={700}
            letterSpacing={3} filter="url(#nasaGlow)">
            {cautionActive ? '\u25a0 AGENT-\u03b3 CAUTION \u25a0' : 'ORCHESTRATION NOMINAL'}
          </text>
          <text x={width / 2} y={40} textAnchor="middle" fill={P.greenDim}
            fontSize={9} fontFamily="'IBM Plex Mono', monospace" letterSpacing={1}>
            c9-operator v2.1.0 | EVENT BUS ACTIVE
          </text>

          {/* GMT Clock */}
          <text x={width - 30} y={20} textAnchor="end" fill={P.greenDim} fontSize={9}
            fontFamily="'IBM Plex Mono', monospace" letterSpacing={1}>
            GMT
          </text>
          <text x={width - 30} y={42} textAnchor="end" fill={P.green} fontSize={18}
            fontFamily="'IBM Plex Mono', monospace" letterSpacing={2}>
            {gmtStr}
          </text>

          {/* ══════════════════════════════════════════════════════════════════════
              LEFT COLUMN — CAPCOM + Block Diagram + Waveform
              ══════════════════════════════════════════════════════════════════════ */}

          {/* CAPCOM event log */}
          {panelRect(8, TOP_BAR_H + 8, LEFT_W - 16, 280, 'CAPCOM EVENT LOG')}
          <clipPath id="capcomClip">
            <rect x={12} y={TOP_BAR_H + 24} width={LEFT_W - 24} height={260} />
          </clipPath>
          <g clipPath="url(#capcomClip)">
            {CAPCOM_ENTRIES.map((entry, i) => {
              const scrollOffset = (frame * 0.8) % (CAPCOM_ENTRIES.length * 16);
              const yPos = TOP_BAR_H + 36 + i * 16 - scrollOffset;
              const wrappedY = yPos < TOP_BAR_H + 20
                ? yPos + CAPCOM_ENTRIES.length * 16 : yPos;
              const isWarning = entry.msg.includes('WARNING') || entry.msg.includes('CAUTION');
              const entryColor = isWarning ? P.amber : P.green;
              return (
                <text key={`cap${i}`} x={16} y={wrappedY} fill={entryColor}
                  fontSize={8} fontFamily="'IBM Plex Mono', monospace" opacity={0.85}>
                  {`${entry.t} ${entry.src} ${entry.msg}`}
                </text>
              );
            })}
          </g>

          {/* System block diagram */}
          {panelRect(8, TOP_BAR_H + 296, LEFT_W - 16, 180, 'SYSTEM BLOCK DIAGRAM')}
          {(() => {
            const bx = 8;
            const by = TOP_BAR_H + 314;
            const blocks = [
              { x: bx + 20, y: by + 20, w: 80, h: 30, label: 'API GW' },
              { x: bx + 20, y: by + 70, w: 80, h: 30, label: 'OPERATOR' },
              { x: bx + 150, y: by + 40, w: 70, h: 30, label: 'BROKER' },
              { x: bx + 150, y: by + 90, w: 70, h: 30, label: 'HUB' },
              { x: bx + 270, y: by + 30, w: 70, h: 24, label: 'AGT-\u03b1' },
              { x: bx + 270, y: by + 60, w: 70, h: 24, label: 'AGT-\u03b2' },
              { x: bx + 270, y: by + 90, w: 70, h: 24, label: 'AGT-\u03b3' },
              { x: bx + 270, y: by + 120, w: 70, h: 24, label: 'AGT-\u03b4' },
            ];
            const arrows: Array<[number, number, number, number]> = [
              [bx + 100, by + 35, bx + 100, by + 70],
              [bx + 100, by + 85, bx + 150, by + 55],
              [bx + 100, by + 85, bx + 150, by + 105],
              [bx + 220, by + 55, bx + 270, by + 42],
              [bx + 220, by + 55, bx + 270, by + 72],
              [bx + 220, by + 55, bx + 270, by + 102],
              [bx + 220, by + 55, bx + 270, by + 132],
            ];
            const pulseT = (frame % 40) / 40;
            return (
              <g>
                {arrows.map((a, i) => {
                  const px = a[0] + (a[2] - a[0]) * pulseT;
                  const py = a[1] + (a[3] - a[1]) * pulseT;
                  return (
                    <g key={`arr${i}`}>
                      <line x1={a[0]} y1={a[1]} x2={a[2]} y2={a[3]}
                        stroke={P.greenDim} strokeWidth={0.8} opacity={0.5} />
                      <circle cx={px} cy={py} r={2} fill={P.green} opacity={0.7} />
                    </g>
                  );
                })}
                {blocks.map((b, i) => (
                  <g key={`blk${i}`}>
                    <rect x={b.x} y={b.y} width={b.w} height={b.h}
                      fill="none" stroke={P.green} strokeWidth={1} opacity={0.6} rx={2} />
                    <text x={b.x + b.w / 2} y={b.y + b.h / 2 + 3} textAnchor="middle"
                      fill={P.green} fontSize={8} fontFamily="'IBM Plex Mono', monospace">
                      {b.label}
                    </text>
                  </g>
                ))}
              </g>
            );
          })()}

          {/* WebSocket waveform oscilloscope */}
          {panelRect(8, TOP_BAR_H + 484, LEFT_W - 16, 130, 'WEBSOCKET WAVEFORM')}
          {(() => {
            const wx = 16;
            const wy = TOP_BAR_H + 502;
            const ww = LEFT_W - 32;
            const wh = 100;
            const midY = wy + wh / 2;
            const shift = frame * 2;
            const points = waveformPoints.map((v, i) => {
              const x = wx + ((i * (ww / waveformPoints.length)) - (shift % ww) + ww) % ww;
              const y = midY + (v - 0.5) * wh * 0.8 * Math.sin((i + frame * 0.1) * 0.3);
              return `${x},${y}`;
            }).join(' ');
            return (
              <g>
                <line x1={wx} y1={midY} x2={wx + ww} y2={midY}
                  stroke={P.greenDim} strokeWidth={0.3} opacity={0.3} />
                <polyline points={points} fill="none" stroke={P.green}
                  strokeWidth={1.2} opacity={0.7} />
                <polyline points={points} fill="none" stroke={P.green}
                  strokeWidth={3} opacity={0.1} filter="url(#nasaBloom)" />
              </g>
            );
          })()}

          {/* ══════════════════════════════════════════════════════════════════════
              CENTER — Orbital Plot + Readouts + Banner + Burndown
              ══════════════════════════════════════════════════════════════════════ */}

          {/* Orbital trajectory plot */}
          {panelRect(LEFT_W, TOP_BAR_H + 8, CENTER_W, 380, 'ORBITAL TRAJECTORY \u2014 AGENT CONSTELLATION')}
          {(() => {
            const ocx = LEFT_W + CENTER_W / 2;
            const ocy = TOP_BAR_H + 210;
            const ring1R = 80;
            const ring2R = 155;
            const orbitSpeed1 = frame * 0.008;
            const orbitSpeed2 = frame * 0.005;
            const enterScale = spring({ frame, fps, config: { damping: 14, stiffness: 60 } });
            return (
              <g opacity={enterScale}>
                {/* Orbit rings */}
                <circle cx={ocx} cy={ocy} r={ring1R} fill="none" stroke={P.greenDim}
                  strokeWidth={0.5} opacity={0.3} strokeDasharray="4 3" />
                <circle cx={ocx} cy={ocy} r={ring2R} fill="none" stroke={P.greenDim}
                  strokeWidth={0.5} opacity={0.2} strokeDasharray="4 3" />
                {/* Center node */}
                <circle cx={ocx} cy={ocy} r={18} fill={P.panelFill}
                  stroke={P.green} strokeWidth={1.5} />
                <circle cx={ocx} cy={ocy} r={22} fill="none" stroke={P.green}
                  strokeWidth={0.5} opacity={0.3 + Math.sin(frame * 0.1) * 0.15} />
                <text x={ocx} y={ocy + 4} textAnchor="middle" fill={P.green}
                  fontSize={7} fontFamily="'IBM Plex Mono', monospace" fontWeight={700}>
                  c9-OP
                </text>
                {/* Orbital nodes */}
                {orbitalNodes.map((node, i) => {
                  const r = node.ring === 1 ? ring1R : ring2R;
                  const speed = node.ring === 1 ? orbitSpeed1 : orbitSpeed2;
                  const angle = node.baseAngle + speed;
                  const nx = ocx + Math.cos(angle) * r;
                  const ny = ocy + Math.sin(angle) * r;
                  const isGamma = node.label === 'Agent-\u03b3';
                  const nodeColor = isGamma && cautionActive ? P.amber : P.green;
                  return (
                    <g key={`orb${i}`}>
                      <line x1={ocx} y1={ocy} x2={nx} y2={ny}
                        stroke={P.greenDim} strokeWidth={0.3} opacity={0.2} />
                      <circle cx={nx} cy={ny} r={node.ring === 1 ? 12 : 9}
                        fill={P.panelFill} stroke={nodeColor} strokeWidth={1} />
                      {isGamma && cautionActive && (
                        <circle cx={nx} cy={ny} r={14} fill="none"
                          stroke={P.amber} strokeWidth={1} opacity={cautionFlash * 0.6} />
                      )}
                      <text x={nx} y={ny + 3} textAnchor="middle" fill={nodeColor}
                        fontSize={6} fontFamily="'IBM Plex Mono', monospace">
                        {node.label.length > 7 ? node.label.slice(0, 7) : node.label}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })()}

          {/* 8-field readout grid */}
          {panelRect(LEFT_W, TOP_BAR_H + 396, CENTER_W, 80, 'TELEMETRY READOUTS')}
          {READOUT_FIELDS.map((field, i) => {
            const col = i % 4;
            const row = Math.floor(i / 4);
            const fx = LEFT_W + 12 + col * (CENTER_W - 20) / 4;
            const fy = TOP_BAR_H + 418 + row * 32;
            return (
              <g key={`rd${i}`}>
                <text x={fx} y={fy} fill={P.greenDim} fontSize={7}
                  fontFamily="'IBM Plex Mono', monospace" letterSpacing={1}>
                  {field.label}
                </text>
                <text x={fx} y={fy + 14} fill={P.green} fontSize={14}
                  fontFamily="'IBM Plex Mono', monospace" fontWeight={700}>
                  {field.value}
                </text>
              </g>
            );
          })}

          {/* Flight Director banner */}
          {panelRect(LEFT_W, TOP_BAR_H + 484, CENTER_W, 28, 'FLIGHT DIRECTOR')}
          <text x={LEFT_W + 12} y={TOP_BAR_H + 506}
            fill={cautionActive ? P.amber : P.green} fontSize={9}
            fontFamily="'IBM Plex Mono', monospace" letterSpacing={1}>
            {FLIGHT_BANNER.slice(0, bannerChars)}
            {bannerChars < FLIGHT_BANNER.length && frame % 6 < 3 ? '\u2588' : ''}
          </text>

          {/* Task burndown area chart */}
          {panelRect(LEFT_W, TOP_BAR_H + 520, CENTER_W, 98, 'TASK BURNDOWN')}
          {(() => {
            const bx = LEFT_W + 12;
            const by = TOP_BAR_H + 538;
            const bw = CENTER_W - 24;
            const bh = 70;
            const visiblePts = Math.min(burndownData.length,
              Math.floor(interpolate(frame, [30, 120], [2, burndownData.length], {
                extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
              }))
            );
            const pts = burndownData.slice(0, visiblePts);
            const areaPath = pts.map((v, i) => {
              const x = bx + (i / (burndownData.length - 1)) * bw;
              const y = by + bh - v * bh;
              return `${i === 0 ? 'M' : 'L'}${x},${y}`;
            }).join(' ') + ` L${bx + ((visiblePts - 1) / (burndownData.length - 1)) * bw},${by + bh} L${bx},${by + bh} Z`;
            const linePath = pts.map((v, i) => {
              const x = bx + (i / (burndownData.length - 1)) * bw;
              const y = by + bh - v * bh;
              return `${i === 0 ? 'M' : 'L'}${x},${y}`;
            }).join(' ');
            return (
              <g>
                <path d={areaPath} fill={P.green} opacity={0.08} />
                <path d={linePath} fill="none" stroke={P.green} strokeWidth={1.2} opacity={0.7} />
              </g>
            );
          })()}

          {/* ══════════════════════════════════════════════════════════════════════
              RIGHT COLUMN — GO/NO-GO + Gauge + Altitude + Attitude + Strips + HB
              ══════════════════════════════════════════════════════════════════════ */}
          {(() => {
            const rx = width - RIGHT_W + 8;
            const rw = RIGHT_W - 16;

            return (
              <g>
                {/* GO/NO-GO status board */}
                {panelRect(rx, TOP_BAR_H + 8, rw, 180, 'GO / NO-GO STATUS BOARD')}
                {GO_NOGO_ROWS.map((row, i) => {
                  const ry = TOP_BAR_H + 28 + i * 16;
                  const isAffected = i >= 6 && cautionActive;
                  const lampColor = isAffected ? P.amber : P.green;
                  const lampFlicker = isAffected ? cautionFlash : 1;
                  return (
                    <g key={`gng${i}`}>
                      <text x={rx + 8} y={ry + 10} fill={P.greenDim} fontSize={9}
                        fontFamily="'IBM Plex Mono', monospace" letterSpacing={1}>
                        {row}
                      </text>
                      <circle cx={rx + 100} cy={ry + 7} r={5} fill={lampColor}
                        opacity={0.3 + lampFlicker * 0.5} />
                      <circle cx={rx + 100} cy={ry + 7} r={5} fill="none"
                        stroke={lampColor} strokeWidth={0.5} opacity={0.8} />
                      <circle cx={rx + 100} cy={ry + 7} r={8} fill={lampColor}
                        opacity={0.06} filter="url(#nasaBloom)" />
                      <text x={rx + 115} y={ry + 10} fill={isAffected ? P.amber : P.green}
                        fontSize={9} fontFamily="'IBM Plex Mono', monospace" fontWeight={700}>
                        {isAffected ? 'CAUT' : 'GO'}
                      </text>
                    </g>
                  );
                })}

                {/* Dispatch velocity gauge */}
                {panelRect(rx, TOP_BAR_H + 196, rw / 2 - 4, 150, 'DISPATCH VEL')}
                {(() => {
                  const gcx = rx + rw / 4 - 2;
                  const gcy = TOP_BAR_H + 320;
                  const gr = 48;
                  const ticks = Array.from({ length: 11 }, (_, i) => i);
                  return (
                    <g>
                      <path d={`M ${gcx - gr} ${gcy} A ${gr} ${gr} 0 0 1 ${gcx + gr} ${gcy}`}
                        fill="none" stroke={P.greenDim} strokeWidth={1} opacity={0.3} />
                      {ticks.map((t) => {
                        const a = Math.PI + (t / 10) * Math.PI;
                        const ix = gcx + Math.cos(a) * (gr - 6);
                        const iy = gcy + Math.sin(a) * (gr - 6);
                        const ox = gcx + Math.cos(a) * gr;
                        const oy = gcy + Math.sin(a) * gr;
                        return (
                          <line key={`gtick${t}`} x1={ix} y1={iy} x2={ox} y2={oy}
                            stroke={P.green} strokeWidth={0.8} opacity={0.5} />
                        );
                      })}
                      {(() => {
                        const needleA = Math.PI + (gaugeAngle / 180) * Math.PI;
                        const nx = gcx + Math.cos(needleA) * (gr - 10);
                        const ny = gcy + Math.sin(needleA) * (gr - 10);
                        return (
                          <g>
                            <line x1={gcx} y1={gcy} x2={nx} y2={ny}
                              stroke={P.green} strokeWidth={1.5} />
                            <circle cx={gcx} cy={gcy} r={3} fill={P.green} opacity={0.8} />
                          </g>
                        );
                      })()}
                      <text x={gcx} y={gcy + 14} textAnchor="middle" fill={P.green}
                        fontSize={10} fontFamily="'IBM Plex Mono', monospace" fontWeight={700}>
                        {Math.round(gaugeAngle)}
                      </text>
                    </g>
                  );
                })()}

                {/* Session altitude bar meter */}
                {panelRect(rx + rw / 2 + 4, TOP_BAR_H + 196, rw / 2 - 4, 150, 'SESSION ALT')}
                {(() => {
                  const barX = rx + rw / 2 + 20;
                  const barY = TOP_BAR_H + 216;
                  const barW = 24;
                  const barH = 115;
                  const fillH = altitudeVal * barH * 0.78;
                  const segments = 10;
                  return (
                    <g>
                      <rect x={barX} y={barY} width={barW} height={barH}
                        fill="none" stroke={P.greenDim} strokeWidth={0.8} opacity={0.4} />
                      <rect x={barX + 1} y={barY + barH - fillH} width={barW - 2} height={fillH}
                        fill={P.green} opacity={0.25} />
                      {Array.from({ length: segments }, (_, i) => (
                        <line key={`seg${i}`}
                          x1={barX} y1={barY + (i / segments) * barH}
                          x2={barX + barW} y2={barY + (i / segments) * barH}
                          stroke={P.greenDim} strokeWidth={0.3} opacity={0.3} />
                      ))}
                      <text x={barX + barW + 8} y={barY + barH - fillH + 4}
                        fill={P.green} fontSize={10}
                        fontFamily="'IBM Plex Mono', monospace" fontWeight={700}>
                        {Math.round(altitudeVal * 100)}%
                      </text>
                      {[0, 25, 50, 75, 100].map((v) => (
                        <text key={`sc${v}`} x={barX - 4} y={barY + barH - (v / 100) * barH + 3}
                          textAnchor="end" fill={P.greenDim} fontSize={6}
                          fontFamily="'IBM Plex Mono', monospace">
                          {v}
                        </text>
                      ))}
                    </g>
                  );
                })()}

                {/* Attitude indicator */}
                {panelRect(rx, TOP_BAR_H + 354, rw / 2 - 4, 130, 'ATTITUDE')}
                {(() => {
                  const acx = rx + rw / 4 - 2;
                  const acy = TOP_BAR_H + 430;
                  const ar = 40;
                  return (
                    <g>
                      <clipPath id="attClip">
                        <circle cx={acx} cy={acy} r={ar} />
                      </clipPath>
                      <g clipPath="url(#attClip)">
                        <g transform={`rotate(${attRoll}, ${acx}, ${acy})`}>
                          <rect x={acx - ar - 5} y={acy - ar - 5 + attPitch}
                            width={ar * 2 + 10} height={ar} fill="#0a2a0a" />
                          <rect x={acx - ar - 5} y={acy + attPitch}
                            width={ar * 2 + 10} height={ar + 5} fill="#1a0a00" />
                          <line x1={acx - ar} y1={acy + attPitch} x2={acx + ar} y2={acy + attPitch}
                            stroke={P.green} strokeWidth={1} opacity={0.8} />
                          {[-20, -10, 10, 20].map((p) => (
                            <line key={`pl${p}`}
                              x1={acx - 15} y1={acy + attPitch + p}
                              x2={acx + 15} y2={acy + attPitch + p}
                              stroke={P.green} strokeWidth={0.5} opacity={0.4} />
                          ))}
                        </g>
                      </g>
                      <circle cx={acx} cy={acy} r={ar} fill="none"
                        stroke={P.green} strokeWidth={1} opacity={0.5} />
                      <line x1={acx - 12} y1={acy} x2={acx - 4} y2={acy}
                        stroke={P.amber} strokeWidth={1.5} />
                      <line x1={acx + 4} y1={acy} x2={acx + 12} y2={acy}
                        stroke={P.amber} strokeWidth={1.5} />
                      <circle cx={acx} cy={acy} r={2} fill={P.amber} />
                    </g>
                  );
                })()}

                {/* CPU + Memory strip charts */}
                {panelRect(rx + rw / 2 + 4, TOP_BAR_H + 354, rw / 2 - 4, 130, 'CPU / MEM STRIP')}
                {(() => {
                  const sx = rx + rw / 2 + 16;
                  const sy = TOP_BAR_H + 374;
                  const sw = rw / 2 - 28;
                  const sh = 45;
                  return (
                    <g>
                      <text x={sx} y={sy + 6} fill={P.greenDim} fontSize={6}
                        fontFamily="'IBM Plex Mono', monospace">CPU</text>
                      {stripData.map((_, i) => {
                        const idx = (i + Math.floor(frame * 0.3)) % stripData.length;
                        const val = stripData[idx];
                        const x = sx + (i / stripData.length) * sw;
                        const y = sy + 10 + sh - val * sh;
                        const prevIdx = ((i - 1 + Math.floor(frame * 0.3)) % stripData.length + stripData.length) % stripData.length;
                        const prevVal = stripData[prevIdx];
                        const prevX = sx + ((i - 1) / stripData.length) * sw;
                        const prevY = sy + 10 + sh - prevVal * sh;
                        return i > 0 ? (
                          <line key={`cpu${i}`} x1={prevX} y1={prevY} x2={x} y2={y}
                            stroke={P.green} strokeWidth={0.8} opacity={0.6} />
                        ) : null;
                      })}
                      <text x={sx} y={sy + sh + 20} fill={P.greenDim} fontSize={6}
                        fontFamily="'IBM Plex Mono', monospace">MEM</text>
                      {stripData.map((_, i) => {
                        const idx = ((i + Math.floor(frame * 0.2) + 20) % stripData.length + stripData.length) % stripData.length;
                        const val = stripData[idx] * 0.7 + 0.15;
                        const x = sx + (i / stripData.length) * sw;
                        const y = sy + sh + 24 + sh - val * sh;
                        const prevIdx = ((i - 1 + Math.floor(frame * 0.2) + 20) % stripData.length + stripData.length) % stripData.length;
                        const prevVal = stripData[prevIdx] * 0.7 + 0.15;
                        const prevX = sx + ((i - 1) / stripData.length) * sw;
                        const prevY = sy + sh + 24 + sh - prevVal * sh;
                        return i > 0 ? (
                          <line key={`mem${i}`} x1={prevX} y1={prevY} x2={x} y2={y}
                            stroke={P.amber} strokeWidth={0.8} opacity={0.5} />
                        ) : null;
                      })}
                    </g>
                  );
                })()}

                {/* Project inventory table */}
                {panelRect(rx, TOP_BAR_H + 492, rw, 80, 'PROJECT INVENTORY')}
                {(() => {
                  const rows = [
                    ['stellar-api', '4', 'ACTIVE', '72%'],
                    ['agent-reports', '2', 'ACTIVE', '91%'],
                    ['helm-platform', '1', 'IDLE', '100%'],
                    ['claude-manager', '3', 'ACTIVE', '58%'],
                  ];
                  const headers = ['PROJECT', 'AGENTS', 'STATUS', 'PROGRESS'];
                  const colW = [180, 80, 80, 80];
                  return (
                    <g>
                      {(() => {
                        let cx2 = rx + 8;
                        return headers.map((h, hi) => {
                          const x = cx2;
                          cx2 += colW[hi];
                          return (
                            <text key={`hdr${hi}`} x={x} y={TOP_BAR_H + 512}
                              fill={P.greenDim} fontSize={7}
                              fontFamily="'IBM Plex Mono', monospace" letterSpacing={1}>
                              {h}
                            </text>
                          );
                        });
                      })()}
                      {rows.map((row, ri) => {
                        let cx2 = rx + 8;
                        return row.map((cell, ci) => {
                          const x = cx2;
                          cx2 += colW[ci];
                          return (
                            <text key={`cell${ri}${ci}`} x={x} y={TOP_BAR_H + 526 + ri * 13}
                              fill={cell === 'IDLE' ? P.greenDim : P.green} fontSize={8}
                              fontFamily="'IBM Plex Mono', monospace">
                              {cell}
                            </text>
                          );
                        });
                      })}
                    </g>
                  );
                })()}

                {/* Heartbeat LED row */}
                {panelRect(rx, TOP_BAR_H + 580, rw, 30, 'HEARTBEAT')}
                {heartbeatLeds.map((led, i) => {
                  const on = Math.sin(frame * led.rate + led.phase) > 0;
                  const lx = rx + 16 + i * (rw - 32) / heartbeatLeds.length;
                  const ly = TOP_BAR_H + 600;
                  return (
                    <g key={`hb${i}`}>
                      <circle cx={lx} cy={ly} r={4}
                        fill={on ? P.green : P.greenGhost} opacity={on ? 0.9 : 0.3} />
                      {on && (
                        <circle cx={lx} cy={ly} r={7} fill={P.green}
                          opacity={0.15} filter="url(#nasaBloom)" />
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })()}

          {/* ══════════════════════════════════════════════════════════════════════
              CRT EFFECTS OVERLAY
              ══════════════════════════════════════════════════════════════════════ */}

          {/* Scan lines */}
          {Array.from({ length: Math.min(scanLineCount, 360) }, (_, i) => (
            <line key={`sl${i}`} x1={0} y1={i * 3} x2={width} y2={i * 3}
              stroke="#000000" strokeWidth={1} opacity={0.06} />
          ))}

          {/* Vignette */}
          <rect x={0} y={0} width={width} height={height} fill="url(#vignetteGrad)" />

          {/* Glass reflection */}
          <rect x={0} y={0} width={width} height={height} fill="url(#glassReflection)" />

          {/* Film grain (green-tinted) */}
          {grainDots.map((dot, i) => {
            const flicker = Math.sin(frame * 3.7 + i * 17) > 0.6 ? 1 : 0;
            return flicker ? (
              <circle key={`gr${i}`} cx={dot.x} cy={dot.y} r={0.5}
                fill={P.green} opacity={dot.baseOpacity} />
            ) : null;
          })}

          {/* Phosphor burnout sparks */}
          {burnoutSparks.map((spark, i) => {
            const visible = frame >= spark.frameOn && frame <= spark.frameOn + 2;
            return visible ? (
              <circle key={`sp${i}`} cx={spark.x} cy={spark.y} r={0.8}
                fill="#ffffff" opacity={0.6} />
            ) : null;
          })}

        </g>
      </svg>
    </AbsoluteFill>
  );
};

export default NasaMissionControl;
