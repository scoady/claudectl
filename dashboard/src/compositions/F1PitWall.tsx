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

// ── Deterministic random ─────────────────────────────────────────────────────

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── Color constants (F1 broadcast palette) ───────────────────────────────────

const C = {
  bg: '#0A0A0E',
  bgDeep: '#050508',
  panelBg: '#12131D',
  panelBorder: '#1E2035',
  gridLine: '#1A1C30',
  red: '#E10600',
  teal: '#00D2BE',
  orange: '#FF8700',
  blue: '#0090FF',
  purple: '#A020F0',
  greenSector: '#00FF66',
  yellowSector: '#FFD700',
  textPrimary: '#FFFFFF',
  textSecondary: '#8B8FA3',
  textMuted: '#4A4E6A',
  drsGreen: '#00FF88',
  criticalRed: '#FF2D55',
  tireHard: '#FFFFFF',
  tireMedium: '#FFD700',
  tireSoft: '#FF3333',
  flagGreen: '#00CC44',
  flagYellow: '#FFCC00',
  flagRed: '#FF3300',
  carbonFiber: '#0E0E14',
};

const FONT = "'Fira Code', 'IBM Plex Mono', monospace";
const TOTAL_LAPS = 56;

// ── Agent / driver data ──────────────────────────────────────────────────────

const AGENTS = [
  { id: 'alpha', label: 'ALF', num: 1, teamColor: C.red },
  { id: 'beta', label: 'BET', num: 2, teamColor: C.teal },
  { id: 'gamma', label: 'GAM', num: 3, teamColor: C.orange },
  { id: 'delta', label: 'DEL', num: 4, teamColor: C.blue },
];

const GAP_ROWS = [
  { pos: 1, agent: 'ALF', interval: 'LEADER', lastLap: '1:21.437', bestLap: '1:20.892', compound: 'S', compoundColor: C.tireSoft, stops: 1, teamColor: C.red },
  { pos: 2, agent: 'BET', interval: '+1.234', lastLap: '1:21.671', bestLap: '1:21.103', compound: 'M', compoundColor: C.tireMedium, stops: 1, teamColor: C.teal },
  { pos: 3, agent: 'GAM', interval: '+2.891', lastLap: '1:22.014', bestLap: '1:21.556', compound: 'H', compoundColor: C.tireHard, stops: 0, teamColor: C.orange },
  { pos: 4, agent: 'DEL', interval: '+0.443', lastLap: '1:21.998', bestLap: '1:21.772', compound: 'M', compoundColor: C.tireMedium, stops: 2, teamColor: C.blue },
];

const SECTOR_DATA = [
  { agent: 'ALF', s1: { time: '28.441', tier: 'purple' }, s2: { time: '24.102', tier: 'green' }, s3: { time: '28.349', tier: 'yellow' } },
  { agent: 'BET', s1: { time: '28.672', tier: 'green' }, s2: { time: '24.331', tier: 'yellow' }, s3: { time: '28.100', tier: 'purple' } },
  { agent: 'GAM', s1: { time: '28.901', tier: 'yellow' }, s2: { time: '24.055', tier: 'purple' }, s3: { time: '28.600', tier: 'yellow' } },
  { agent: 'DEL', s1: { time: '28.780', tier: 'yellow' }, s2: { time: '24.218', tier: 'green' }, s3: { time: '28.000', tier: 'green' } },
];

const PIT_STINTS = [
  { agent: 'ALF', stints: [{ s: 1, e: 18, c: C.tireSoft }, { s: 19, e: 42, c: C.tireMedium }, { s: 43, e: 56, c: C.tireHard, projected: true }] },
  { agent: 'BET', stints: [{ s: 1, e: 22, c: C.tireMedium }, { s: 23, e: 42, c: C.tireHard }, { s: 43, e: 56, c: C.tireSoft, projected: true }] },
  { agent: 'GAM', stints: [{ s: 1, e: 30, c: C.tireHard }, { s: 31, e: 56, c: C.tireMedium }] },
  { agent: 'DEL', stints: [{ s: 1, e: 15, c: C.tireSoft }, { s: 16, e: 35, c: C.tireMedium }, { s: 36, e: 56, c: C.tireHard }] },
];

const RADIO_MSGS = [
  { time: '14:31:42', from: 'ALF', text: 'Read completed on main.py, moving to tests', fromColor: C.red },
  { time: '14:31:58', from: 'PIT', text: 'Copy Alpha, session confirmed, good pace', fromColor: C.textSecondary },
  { time: '14:32:05', from: 'GAM', text: 'Bash executed -- build passing, push ready', fromColor: C.orange },
  { time: '14:32:12', from: 'BET', text: 'BOX BOX BOX -- context window low, respawn', fromColor: C.teal },
  { time: '14:32:20', from: 'PIT', text: 'Copy Beta, new session s-9f41 ready', fromColor: C.textSecondary },
  { time: '14:32:28', from: 'DEL', text: 'Milestone: Edit completed on api.ts', fromColor: C.blue },
];

function sectorColor(tier: string): string {
  if (tier === 'purple') return C.purple;
  if (tier === 'green') return C.greenSector;
  return C.yellowSector;
}

// ── Track path (Monza-inspired) ──────────────────────────────────────────────

function getTrackPoints(): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  const cx = 240, cy = 145;
  const steps = 200;
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const rx = 170, ry = 110;
    let x = cx + rx * Math.cos(t) + 30 * Math.cos(3 * t);
    let y = cy + ry * Math.sin(t) + 20 * Math.sin(2 * t);
    if (i > 40 && i < 60) { x += Math.sin((i - 40) * 0.3) * 15; y += Math.cos((i - 40) * 0.5) * 10; }
    if (i > 130 && i < 150) { x -= Math.sin((i - 130) * 0.4) * 12; }
    pts.push([x, y]);
  }
  return pts;
}

// ── Telemetry data generator ─────────────────────────────────────────────────

function generateTelemetry(seed: number, numPoints: number): {
  speed: number[]; throttle: number[]; brake: number[];
} {
  const rng = seededRandom(seed);
  const speed: number[] = [];
  const throttle: number[] = [];
  const brake: number[] = [];
  let spd = 280;
  for (let i = 0; i < numPoints; i++) {
    const phase = Math.sin(i * 0.08) * 0.5 + 0.5;
    spd = spd + (rng() - 0.5) * 20;
    spd = Math.max(80, Math.min(340, spd));
    if (phase < 0.3) spd = Math.max(80, spd - 15);
    speed.push(spd);
    throttle.push(phase > 0.4 ? 0.7 + rng() * 0.3 : rng() * 0.3);
    brake.push(phase < 0.3 ? 0.5 + rng() * 0.5 : rng() * 0.1);
  }
  return { speed, throttle, brake };
}

// ── Main composition ─────────────────────────────────────────────────────────

export const F1PitWall: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const W = 1920;
  const H = 1080;

  // ── Intro wipe ──────────────────────────────────────────────────────────────
  const wipeProgress = interpolate(frame, [0, 45], [0, 1], { extrapolateRight: 'clamp' });

  // ── Layout constants ────────────────────────────────────────────────────────
  const topRowH = 380;
  const midRowH = 320;
  const bottomBarH = H - topRowH - midRowH;
  const topPanelW = W / 3;
  const midPanel1W = W * 0.55;
  const midPanel2W = W - midPanel1W;
  const pad = 4;

  // ── Current lap (animated) ──────────────────────────────────────────────────
  const currentLap = Math.min(TOTAL_LAPS, 30 + Math.floor(frame / 10));

  // ── Flag status: green -> yellow (frame 90) -> green (frame 140) ───────────
  const isYellow = frame >= 90 && frame < 140;
  const flagColor = isYellow ? C.flagYellow : C.flagGreen;
  const flagLabel = isYellow ? 'YELLOW FLAG' : 'GREEN FLAG';

  // ── Pit stop at frame 120 for BET ───────────────────────────────────────────
  const pitActive = frame >= 120 && frame <= 160;

  // ── Telemetry data ──────────────────────────────────────────────────────────
  const telemetryRef = useMemo(() => generateTelemetry(1111, 120), []);
  const telemetryCur = useMemo(() => generateTelemetry(2222, 120), []);

  // ── Track points ────────────────────────────────────────────────────────────
  const trackPts = useMemo(() => getTrackPoints(), []);
  const trackPath = useMemo(() => {
    return trackPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + ' Z';
  }, [trackPts]);

  // ── Intro spring ────────────────────────────────────────────────────────────
  const introSpring = spring({ frame, fps, config: { damping: 60, stiffness: 30, mass: 0.6 }, from: 0.95, to: 1 });

  // ── Radio message visibility ────────────────────────────────────────────────
  const visibleRadioCount = Math.min(RADIO_MSGS.length, Math.floor(frame / 30) + 1);

  // ── Carbon fiber pattern rects ──────────────────────────────────────────────
  const carbonRects = useMemo(() => {
    const rng = seededRandom(5050);
    return Array.from({ length: 200 }, () => ({
      x: rng() * W, y: rng() * H,
      w: rng() * 4 + 1, h: rng() * 4 + 1,
      op: rng() * 0.03,
    }));
  }, []);

  // ── Scan lines per panel ────────────────────────────────────────────────────
  const panelScanOffset = (frame * 2) % topRowH;

  // ── Gap bar widths ──────────────────────────────────────────────────────────
  const gapValues = useMemo(() => {
    return [0, 1.234, 4.125, 4.568];
  }, []);
  const maxGap = 5;

  // ── Fastest sector flash (purple flash at frame 70-85) ──────────────────────
  const fastestFlash = frame >= 70 && frame <= 85;

  return (
    <AbsoluteFill style={{
      background: C.bg, fontFamily: FONT, overflow: 'hidden',
      transform: `scale(${introSpring})`,
    }}>
      <div style={{ position: 'absolute', inset: 0, width: W, height: H }}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}
          style={{ position: 'absolute', top: 0, left: 0 }}>
          <defs>
            <filter id="f1-glow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="f1-glow-strong">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <linearGradient id="f1-panel-grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={C.panelBg} />
              <stop offset="100%" stopColor={C.bgDeep} />
            </linearGradient>
            <clipPath id="telemetry-clip">
              <rect x={topPanelW + pad} y={pad + 28} width={topPanelW - pad * 2} height={topRowH - 32} />
            </clipPath>
          </defs>

          {/* ── Background with carbon fiber texture ──────────────────────── */}
          <rect width={W} height={H} fill={C.bg} />
          {carbonRects.map((r, i) => (
            <rect key={`cf-${i}`} x={r.x} y={r.y} width={r.w} height={r.h}
              fill={C.textPrimary} opacity={r.op} />
          ))}

          {/* ═══════════ TOP ROW (3 panels) ═══════════════════════════════ */}

          {/* ── Panel 1: TIMING TOWER ─────────────────────────────────────── */}
          <g>
            <rect x={pad} y={pad} width={topPanelW - pad * 2} height={topRowH - pad}
              fill="url(#f1-panel-grad)" stroke={C.panelBorder} strokeWidth={1} rx={4} />

            {/* Panel header */}
            <rect x={pad} y={pad} width={topPanelW - pad * 2} height={26}
              fill="rgba(255,255,255,0.04)" rx={4} />
            <text x={pad + 12} y={pad + 18} fill={C.textPrimary} fontSize={11}
              fontFamily={FONT} fontWeight="bold">TIMING TOWER</text>
            <text x={topPanelW - pad - 12} y={pad + 18} fill={C.textMuted} fontSize={9}
              fontFamily={FONT} textAnchor="end">INTERVAL</text>

            {/* Column headers */}
            <text x={pad + 14} y={pad + 44} fill={C.textMuted} fontSize={8} fontFamily={FONT}>P</text>
            <text x={pad + 50} y={pad + 44} fill={C.textMuted} fontSize={8} fontFamily={FONT}>DRIVER</text>
            <text x={pad + 150} y={pad + 44} fill={C.textMuted} fontSize={8} fontFamily={FONT}>INT</text>
            <text x={pad + 260} y={pad + 44} fill={C.textMuted} fontSize={8} fontFamily={FONT}>LAST</text>
            <text x={pad + 380} y={pad + 44} fill={C.textMuted} fontSize={8} fontFamily={FONT}>BEST</text>
            <text x={pad + 490} y={pad + 44} fill={C.textMuted} fontSize={8} fontFamily={FONT}>TIRE</text>
            <text x={pad + 540} y={pad + 44} fill={C.textMuted} fontSize={8} fontFamily={FONT}>PIT</text>

            {/* Timing rows */}
            {GAP_ROWS.map((row, i) => {
              const rowY = pad + 54 + i * 68;
              const isPitRow = pitActive && row.agent === 'BET';
              const rowBg = i === 0 ? 'rgba(160,32,240,0.08)' : 'rgba(255,255,255,0.02)';

              return (
                <g key={`timing-${i}`}>
                  <rect x={pad + 8} y={rowY} width={topPanelW - pad * 2 - 16} height={58}
                    fill={rowBg} stroke={C.panelBorder} strokeWidth={0.5} rx={3} />

                  {/* Team color bar */}
                  <rect x={pad + 8} y={rowY} width={4} height={58}
                    fill={row.teamColor} rx={2} />

                  {/* Position */}
                  <text x={pad + 22} y={rowY + 24} fill={C.textPrimary} fontSize={18}
                    fontFamily={FONT} fontWeight="bold">{row.pos}</text>

                  {/* Driver name */}
                  <text x={pad + 50} y={rowY + 20} fill={C.textPrimary} fontSize={14}
                    fontFamily={FONT} fontWeight="bold">{row.agent}</text>

                  {/* Sector times underneath */}
                  {SECTOR_DATA[i] && (
                    <g>
                      <text x={pad + 50} y={rowY + 38} fill={sectorColor(SECTOR_DATA[i].s1.tier)}
                        fontSize={8} fontFamily={FONT}>S1 {SECTOR_DATA[i].s1.time}</text>
                      <text x={pad + 140} y={rowY + 38} fill={sectorColor(SECTOR_DATA[i].s2.tier)}
                        fontSize={8} fontFamily={FONT}>S2 {SECTOR_DATA[i].s2.time}</text>
                      <text x={pad + 230} y={rowY + 38} fill={sectorColor(SECTOR_DATA[i].s3.tier)}
                        fontSize={8} fontFamily={FONT}>S3 {SECTOR_DATA[i].s3.time}</text>
                    </g>
                  )}

                  {/* Fastest sector flash */}
                  {fastestFlash && i === 0 && (
                    <rect x={pad + 8} y={rowY} width={topPanelW - pad * 2 - 16} height={58}
                      fill="rgba(160,32,240,0.15)" rx={3}
                      opacity={Math.sin(frame * 0.8) * 0.5 + 0.5} />
                  )}

                  {/* Interval */}
                  <text x={pad + 150} y={rowY + 20}
                    fill={row.interval === 'LEADER' ? C.textPrimary : C.textSecondary}
                    fontSize={11} fontFamily={FONT}>{row.interval}</text>

                  {/* Last lap */}
                  <text x={pad + 260} y={rowY + 20} fill={C.textSecondary} fontSize={10}
                    fontFamily={FONT}>{row.lastLap}</text>

                  {/* Best lap */}
                  <text x={pad + 380} y={rowY + 20}
                    fill={i === 0 ? C.purple : C.textSecondary}
                    fontSize={10} fontFamily={FONT}
                    filter={i === 0 ? 'url(#f1-glow)' : undefined}>{row.bestLap}</text>

                  {/* Tire compound dot */}
                  <circle cx={pad + 498} cy={rowY + 16} r={8}
                    fill={row.compoundColor} opacity={0.9} />
                  <text x={pad + 498} y={rowY + 20} fill={C.bg} fontSize={8}
                    fontFamily={FONT} textAnchor="middle" fontWeight="bold">{row.compound}</text>

                  {/* Pit stops */}
                  <text x={pad + 540} y={rowY + 20} fill={C.textSecondary} fontSize={11}
                    fontFamily={FONT}>{row.stops}</text>

                  {/* PIT indicator */}
                  {isPitRow && (
                    <g>
                      <rect x={pad + 480} y={rowY + 32} width={60} height={18}
                        fill={C.criticalRed} rx={3}
                        opacity={0.7 + Math.sin(frame * 0.4) * 0.3} />
                      <text x={pad + 510} y={rowY + 44} fill={C.textPrimary} fontSize={9}
                        fontFamily={FONT} textAnchor="middle" fontWeight="bold">IN PIT</text>
                    </g>
                  )}

                  {/* Status: DRS detection */}
                  {i === 1 && !isPitRow && (
                    <g>
                      <rect x={pad + 480} y={rowY + 32} width={60} height={18}
                        fill="rgba(0,255,136,0.15)" stroke={C.drsGreen} strokeWidth={0.5} rx={3} />
                      <text x={pad + 510} y={rowY + 44} fill={C.drsGreen} fontSize={8}
                        fontFamily={FONT} textAnchor="middle">DRS</text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* LED dot-matrix scan line */}
            <rect x={pad} y={pad + panelScanOffset} width={topPanelW - pad * 2} height={1}
              fill={C.textPrimary} opacity={0.03} />
          </g>

          {/* ── Panel 2: TELEMETRY TRACES ─────────────────────────────────── */}
          <g>
            <rect x={topPanelW + pad} y={pad} width={topPanelW - pad * 2} height={topRowH - pad}
              fill="url(#f1-panel-grad)" stroke={C.panelBorder} strokeWidth={1} rx={4} />

            <rect x={topPanelW + pad} y={pad} width={topPanelW - pad * 2} height={26}
              fill="rgba(255,255,255,0.04)" rx={4} />
            <text x={topPanelW + pad + 12} y={pad + 18} fill={C.textPrimary} fontSize={11}
              fontFamily={FONT} fontWeight="bold">TELEMETRY</text>

            {/* Gear indicator bar */}
            {(() => {
              const gears = [3, 4, 5, 6, 7, 7, 6, 5, 3, 4, 6, 7];
              const gearW = (topPanelW - pad * 2 - 20) / gears.length;
              return gears.map((g, gi) => (
                <text key={`gear-${gi}`}
                  x={topPanelW + pad + 10 + gi * gearW + gearW / 2}
                  y={pad + 42} fill={C.textMuted} fontSize={8}
                  fontFamily={FONT} textAnchor="middle">{g}</text>
              ));
            })()}

            <g clipPath="url(#telemetry-clip)">
              {/* Speed trace (top third) */}
              {(() => {
                const baseY = pad + 50;
                const traceH = 90;
                const traceW = topPanelW - pad * 2 - 20;
                const scrollOffset = frame * 2;
                const visiblePts = 60;

                const refPath = telemetryRef.speed.slice(0, visiblePts).map((v, i) => {
                  const x = topPanelW + pad + 10 + (i / visiblePts) * traceW - scrollOffset % (traceW / 4);
                  const y = baseY + traceH - ((v - 80) / 260) * traceH;
                  return `${i === 0 ? 'M' : 'L'}${x},${y}`;
                }).join(' ');

                const curPath = telemetryCur.speed.slice(0, visiblePts).map((v, i) => {
                  const x = topPanelW + pad + 10 + (i / visiblePts) * traceW - scrollOffset % (traceW / 4);
                  const y = baseY + traceH - ((v - 80) / 260) * traceH;
                  return `${i === 0 ? 'M' : 'L'}${x},${y}`;
                }).join(' ');

                return (
                  <g>
                    <text x={topPanelW + pad + 12} y={baseY + 10} fill={C.textMuted}
                      fontSize={8} fontFamily={FONT}>SPEED km/h</text>
                    {/* Grid */}
                    {[0, 0.25, 0.5, 0.75, 1].map((p) => (
                      <line key={`sg-${p}`}
                        x1={topPanelW + pad + 10} y1={baseY + p * traceH}
                        x2={topPanelW + pad + 10 + traceW} y2={baseY + p * traceH}
                        stroke={C.gridLine} strokeWidth={0.5} />
                    ))}
                    <path d={refPath} fill="none" stroke={C.textMuted} strokeWidth={1} opacity={0.3} />
                    <path d={curPath} fill="none" stroke={C.teal} strokeWidth={1.5} filter="url(#f1-glow)" />
                  </g>
                );
              })()}

              {/* Throttle trace (mid third) */}
              {(() => {
                const baseY = pad + 155;
                const traceH = 70;
                const traceW = topPanelW - pad * 2 - 20;
                const visiblePts = 60;

                const curPath = telemetryCur.throttle.slice(0, visiblePts).map((v, i) => {
                  const x = topPanelW + pad + 10 + (i / visiblePts) * traceW;
                  const y = baseY + traceH - v * traceH;
                  return `${i === 0 ? 'M' : 'L'}${x},${y}`;
                }).join(' ');

                return (
                  <g>
                    <text x={topPanelW + pad + 12} y={baseY + 10} fill={C.textMuted}
                      fontSize={8} fontFamily={FONT}>THROTTLE %</text>
                    <path d={curPath} fill="none" stroke={C.greenSector} strokeWidth={1.2} />
                  </g>
                );
              })()}

              {/* Brake trace (bottom third) */}
              {(() => {
                const baseY = pad + 240;
                const traceH = 70;
                const traceW = topPanelW - pad * 2 - 20;
                const visiblePts = 60;

                const curPath = telemetryCur.brake.slice(0, visiblePts).map((v, i) => {
                  const x = topPanelW + pad + 10 + (i / visiblePts) * traceW;
                  const y = baseY + traceH - v * traceH;
                  return `${i === 0 ? 'M' : 'L'}${x},${y}`;
                }).join(' ');

                return (
                  <g>
                    <text x={topPanelW + pad + 12} y={baseY + 10} fill={C.textMuted}
                      fontSize={8} fontFamily={FONT}>BRAKE %</text>
                    <path d={curPath} fill="none" stroke={C.criticalRed} strokeWidth={1.2} />
                  </g>
                );
              })()}
            </g>

            {/* Trace scan line */}
            <rect x={topPanelW + pad} y={pad + panelScanOffset}
              width={topPanelW - pad * 2} height={1}
              fill={C.textPrimary} opacity={0.02} />
          </g>

          {/* ── Panel 3: TIRE STRATEGY ────────────────────────────────────── */}
          <g>
            <rect x={topPanelW * 2 + pad} y={pad} width={topPanelW - pad * 2} height={topRowH - pad}
              fill="url(#f1-panel-grad)" stroke={C.panelBorder} strokeWidth={1} rx={4} />

            <rect x={topPanelW * 2 + pad} y={pad} width={topPanelW - pad * 2} height={26}
              fill="rgba(255,255,255,0.04)" rx={4} />
            <text x={topPanelW * 2 + pad + 12} y={pad + 18} fill={C.textPrimary} fontSize={11}
              fontFamily={FONT} fontWeight="bold">TIRE STRATEGY</text>

            {/* Legend */}
            <circle cx={topPanelW * 2 + pad + 400} cy={pad + 14} r={5} fill={C.tireSoft} />
            <text x={topPanelW * 2 + pad + 410} y={pad + 18} fill={C.textMuted} fontSize={8} fontFamily={FONT}>S</text>
            <circle cx={topPanelW * 2 + pad + 430} cy={pad + 14} r={5} fill={C.tireMedium} />
            <text x={topPanelW * 2 + pad + 440} y={pad + 18} fill={C.textMuted} fontSize={8} fontFamily={FONT}>M</text>
            <circle cx={topPanelW * 2 + pad + 460} cy={pad + 14} r={5} fill={C.tireHard} />
            <text x={topPanelW * 2 + pad + 470} y={pad + 18} fill={C.textMuted} fontSize={8} fontFamily={FONT}>H</text>

            {/* Strategy bars */}
            {PIT_STINTS.map((driver, di) => {
              const barY = pad + 50 + di * 80;
              const barX = topPanelW * 2 + pad + 50;
              const barW = topPanelW - pad * 2 - 70;
              const lapScale = barW / TOTAL_LAPS;

              return (
                <g key={`strat-${di}`}>
                  {/* Agent label */}
                  <text x={topPanelW * 2 + pad + 12} y={barY + 16} fill={AGENTS[di].teamColor}
                    fontSize={12} fontFamily={FONT} fontWeight="bold">{driver.agent}</text>

                  {/* Stint bars */}
                  {driver.stints.map((stint, si) => {
                    const sx = barX + (stint.s - 1) * lapScale;
                    const sw = (stint.e - stint.s + 1) * lapScale;
                    const isProjected = 'projected' in stint && stint.projected;
                    return (
                      <g key={`stint-${di}-${si}`}>
                        <rect x={sx} y={barY + 4} width={sw} height={22}
                          fill={stint.c} opacity={isProjected ? 0.3 : 0.8}
                          rx={2} stroke={isProjected ? stint.c : 'none'} strokeWidth={1}
                          strokeDasharray={isProjected ? '4,3' : 'none'} />
                        {!isProjected && sw > 30 && (
                          <text x={sx + sw / 2} y={barY + 19} fill={C.bg} fontSize={8}
                            fontFamily={FONT} textAnchor="middle" fontWeight="bold">
                            L{stint.s}-{stint.e}
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Current lap marker */}
                  <line x1={barX + currentLap * lapScale} y1={barY}
                    x2={barX + currentLap * lapScale} y2={barY + 30}
                    stroke={C.textPrimary} strokeWidth={1.5} opacity={0.8} />

                  {/* Predicted pace bar underneath */}
                  <rect x={barX} y={barY + 32} width={barW} height={6}
                    fill="rgba(255,255,255,0.04)" rx={2} />
                  <rect x={barX} y={barY + 32}
                    width={barW * (0.7 + di * 0.08 + Math.sin(frame * 0.03 + di) * 0.05)}
                    height={6} fill={AGENTS[di].teamColor} opacity={0.3} rx={2} />
                </g>
              );
            })}

            {/* Lap scale labels */}
            {[1, 10, 20, 30, 40, 50, TOTAL_LAPS].map((lap) => (
              <text key={`ls-${lap}`}
                x={topPanelW * 2 + pad + 50 + (lap - 1) * ((topPanelW - pad * 2 - 70) / TOTAL_LAPS)}
                y={pad + 50 + 4 * 80 - 4}
                fill={C.textMuted} fontSize={7} fontFamily={FONT} textAnchor="middle">{lap}</text>
            ))}
          </g>

          {/* ═══════════ MIDDLE ROW (2 panels) ════════════════════════════ */}

          {/* ── Panel 4: GAP ANALYSIS ─────────────────────────────────────── */}
          <g>
            <rect x={pad} y={topRowH + pad} width={midPanel1W - pad * 2} height={midRowH - pad * 2}
              fill="url(#f1-panel-grad)" stroke={C.panelBorder} strokeWidth={1} rx={4} />

            <rect x={pad} y={topRowH + pad} width={midPanel1W - pad * 2} height={26}
              fill="rgba(255,255,255,0.04)" rx={4} />
            <text x={pad + 12} y={topRowH + pad + 18} fill={C.textPrimary} fontSize={11}
              fontFamily={FONT} fontWeight="bold">GAP ANALYSIS</text>
            <text x={midPanel1W - pad - 12} y={topRowH + pad + 18} fill={C.textMuted}
              fontSize={9} fontFamily={FONT} textAnchor="end">UNDERCUT WINDOW</text>

            {/* Gap bars */}
            {GAP_ROWS.map((row, i) => {
              const barY = topRowH + pad + 44 + i * 62;
              const barX = pad + 60;
              const barMaxW = midPanel1W - pad * 2 - 100;
              const gapVal = gapValues[i];
              const barW = (gapVal / maxGap) * barMaxW;
              const animatedBarW = interpolate(frame, [10, 40], [0, barW], {
                extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
                easing: Easing.out(Easing.cubic),
              });

              return (
                <g key={`gap-${i}`}>
                  <text x={pad + 12} y={barY + 18} fill={row.teamColor} fontSize={12}
                    fontFamily={FONT} fontWeight="bold">{row.agent}</text>

                  {/* Bar background */}
                  <rect x={barX} y={barY + 4} width={barMaxW} height={24}
                    fill="rgba(255,255,255,0.03)" rx={3} />

                  {/* Gap bar */}
                  <rect x={barX} y={barY + 4} width={Math.max(2, animatedBarW)} height={24}
                    fill={row.teamColor} opacity={0.6} rx={3} />

                  {/* Gap value */}
                  <text x={barX + animatedBarW + 8} y={barY + 20} fill={C.textSecondary}
                    fontSize={10} fontFamily={FONT}>
                    {i === 0 ? 'LEADER' : `+${gapVal.toFixed(3)}s`}
                  </text>

                  {/* Undercut window indicator */}
                  {i > 0 && gapVal < 2.5 && (
                    <g>
                      <rect x={barX + (1.5 / maxGap) * barMaxW} y={barY + 2}
                        width={(1.0 / maxGap) * barMaxW} height={28}
                        fill="rgba(0,255,136,0.06)" stroke={C.drsGreen}
                        strokeWidth={0.5} strokeDasharray="3,3" rx={2} />
                      <text x={barX + (2.0 / maxGap) * barMaxW} y={barY + 44}
                        fill={C.drsGreen} fontSize={7} fontFamily={FONT} textAnchor="middle">
                        UNDERCUT
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* DRS detection zone */}
            <rect x={pad + 60} y={topRowH + pad + 44 + 4 * 62}
              width={midPanel1W - pad * 2 - 100} height={20}
              fill="rgba(0,255,136,0.04)" stroke={C.drsGreen} strokeWidth={0.5} rx={3} />
            <text x={pad + 70} y={topRowH + pad + 44 + 4 * 62 + 14}
              fill={C.drsGreen} fontSize={9} fontFamily={FONT}>
              DRS DETECTION: {isYellow ? 'DISABLED (YELLOW)' : 'ACTIVE'} -- ZONE 1 &amp; 2
            </text>
          </g>

          {/* ── Panel 5: TRACK MAP ────────────────────────────────────────── */}
          <g>
            <rect x={midPanel1W + pad} y={topRowH + pad}
              width={midPanel2W - pad * 2} height={midRowH - pad * 2}
              fill="url(#f1-panel-grad)" stroke={C.panelBorder} strokeWidth={1} rx={4} />

            <rect x={midPanel1W + pad} y={topRowH + pad}
              width={midPanel2W - pad * 2} height={26}
              fill="rgba(255,255,255,0.04)" rx={4} />
            <text x={midPanel1W + pad + 12} y={topRowH + pad + 18} fill={C.textPrimary}
              fontSize={11} fontFamily={FONT} fontWeight="bold">TRACK MAP</text>

            {/* Track outline */}
            <g transform={`translate(${midPanel1W + pad + 20}, ${topRowH + pad + 30})`}>
              {/* Track surface */}
              <path d={trackPath} fill="none" stroke={C.textMuted} strokeWidth={12}
                opacity={0.15} strokeLinecap="round" strokeLinejoin="round" />
              <path d={trackPath} fill="none" stroke={C.textMuted} strokeWidth={2}
                opacity={0.4} strokeLinecap="round" strokeLinejoin="round" />

              {/* Speed heatmap overlay on track */}
              {trackPts.filter((_, i) => i % 4 === 0).map((pt, i) => {
                const speedNorm = Math.sin(i * 0.15) * 0.5 + 0.5;
                const heatColor = speedNorm > 0.7 ? C.criticalRed
                  : speedNorm > 0.4 ? C.yellowSector : C.greenSector;
                return (
                  <circle key={`heat-${i}`} cx={pt[0]} cy={pt[1]} r={3}
                    fill={heatColor} opacity={0.2} />
                );
              })}

              {/* Sector markers */}
              {[
                { idx: 0, label: 'S1' },
                { idx: Math.floor(trackPts.length / 3), label: 'S2' },
                { idx: Math.floor(trackPts.length * 2 / 3), label: 'S3' },
              ].map((sec) => {
                const pt = trackPts[sec.idx];
                return (
                  <g key={sec.label}>
                    <line x1={pt[0] - 10} y1={pt[1]} x2={pt[0] + 10} y2={pt[1]}
                      stroke={C.textSecondary} strokeWidth={2} />
                    <text x={pt[0]} y={pt[1] - 8} fill={C.textSecondary} fontSize={9}
                      fontFamily={FONT} textAnchor="middle">{sec.label}</text>
                  </g>
                );
              })}

              {/* Agent dots moving around track */}
              {AGENTS.map((agent, ai) => {
                const basePos = (frame * (1.8 + ai * 0.3) + ai * 50) % trackPts.length;
                const ptIdx = Math.floor(basePos);
                const pt = trackPts[ptIdx];
                return (
                  <g key={`agent-dot-${ai}`} filter="url(#f1-glow)">
                    <circle cx={pt[0]} cy={pt[1]} r={6}
                      fill={agent.teamColor} opacity={0.9} />
                    <circle cx={pt[0]} cy={pt[1]} r={10}
                      fill="none" stroke={agent.teamColor} strokeWidth={1} opacity={0.4} />
                    <text x={pt[0]} y={pt[1] - 12} fill={agent.teamColor} fontSize={8}
                      fontFamily={FONT} textAnchor="middle" fontWeight="bold">{agent.label}</text>
                  </g>
                );
              })}
            </g>

            {/* Sector times table */}
            <g>
              {SECTOR_DATA.map((sd, si) => {
                const stY = topRowH + pad + midRowH - pad * 2 - 70 + si * 15;
                return (
                  <g key={`st-${si}`}>
                    <text x={midPanel1W + midPanel2W - 200} y={stY}
                      fill={AGENTS[si].teamColor} fontSize={8} fontFamily={FONT}>{sd.agent}</text>
                    <text x={midPanel1W + midPanel2W - 155} y={stY}
                      fill={sectorColor(sd.s1.tier)} fontSize={8} fontFamily={FONT}>{sd.s1.time}</text>
                    <text x={midPanel1W + midPanel2W - 105} y={stY}
                      fill={sectorColor(sd.s2.tier)} fontSize={8} fontFamily={FONT}>{sd.s2.time}</text>
                    <text x={midPanel1W + midPanel2W - 55} y={stY}
                      fill={sectorColor(sd.s3.tier)} fontSize={8} fontFamily={FONT}>{sd.s3.time}</text>
                  </g>
                );
              })}
            </g>
          </g>

          {/* ═══════════ BOTTOM BAR ═══════════════════════════════════════ */}
          <g>
            <rect x={0} y={topRowH + midRowH} width={W} height={bottomBarH}
              fill={C.bgDeep} stroke={C.panelBorder} strokeWidth={1} />

            {/* Flag status */}
            <rect x={12} y={topRowH + midRowH + 8} width={140} height={bottomBarH - 16}
              fill="rgba(255,255,255,0.03)" stroke={flagColor} strokeWidth={1.5} rx={4} />
            {/* Animated flag wave */}
            {Array.from({ length: 5 }, (_, i) => {
              const waveX = 20 + i * 25;
              const waveH = 20 + Math.sin(frame * 0.15 + i * 1.2) * 8;
              return (
                <rect key={`flag-${i}`} x={waveX} y={topRowH + midRowH + 16}
                  width={18} height={waveH} fill={flagColor}
                  opacity={0.3 + i * 0.1} rx={2} />
              );
            })}
            <text x={82} y={topRowH + midRowH + bottomBarH - 12} fill={flagColor}
              fontSize={9} fontFamily={FONT} textAnchor="middle" fontWeight="bold"
              filter="url(#f1-glow)">{flagLabel}</text>

            {/* Lap counter */}
            <rect x={164} y={topRowH + midRowH + 8} width={160} height={bottomBarH - 16}
              fill="rgba(255,255,255,0.03)" stroke={C.panelBorder} strokeWidth={1} rx={4} />
            <text x={244} y={topRowH + midRowH + 24} fill={C.textMuted} fontSize={8}
              fontFamily={FONT} textAnchor="middle">LAP</text>
            <text x={244} y={topRowH + midRowH + bottomBarH - 14} fill={C.textPrimary}
              fontSize={22} fontFamily={FONT} textAnchor="middle" fontWeight="bold"
              filter="url(#f1-glow-strong)">
              {currentLap}/{TOTAL_LAPS}
            </text>

            {/* Air/Track temp */}
            <rect x={336} y={topRowH + midRowH + 8} width={180} height={bottomBarH - 16}
              fill="rgba(255,255,255,0.03)" stroke={C.panelBorder} strokeWidth={1} rx={4} />
            <text x={370} y={topRowH + midRowH + 26} fill={C.textMuted} fontSize={8}
              fontFamily={FONT}>AIR</text>
            <text x={410} y={topRowH + midRowH + 26} fill={C.textSecondary} fontSize={11}
              fontFamily={FONT}>24.3C</text>
            <text x={370} y={topRowH + midRowH + bottomBarH - 14} fill={C.textMuted}
              fontSize={8} fontFamily={FONT}>TRK</text>
            <text x={410} y={topRowH + midRowH + bottomBarH - 14} fill={C.textSecondary}
              fontSize={11} fontFamily={FONT}>41.7C</text>

            {/* Radio messages */}
            <rect x={528} y={topRowH + midRowH + 8} width={W - 760} height={bottomBarH - 16}
              fill="rgba(255,255,255,0.02)" stroke={C.panelBorder} strokeWidth={1} rx={4} />
            <text x={540} y={topRowH + midRowH + 22} fill={C.textMuted} fontSize={8}
              fontFamily={FONT}>TEAM RADIO</text>
            <clipPath id="radio-clip">
              <rect x={528} y={topRowH + midRowH + 26} width={W - 764} height={bottomBarH - 38} />
            </clipPath>
            <g clipPath="url(#radio-clip)">
              {RADIO_MSGS.slice(0, visibleRadioCount).map((msg, mi) => {
                const msgY = topRowH + midRowH + 38 + mi * 14;
                const typeDelay = Math.max(0, frame - mi * 30);
                const charsShown = Math.min(msg.text.length, Math.floor(typeDelay * 2));
                return (
                  <g key={`radio-${mi}`}>
                    <text x={540} y={msgY} fill={C.textMuted} fontSize={8} fontFamily={FONT}>
                      {msg.time}
                    </text>
                    <text x={606} y={msgY} fill={msg.fromColor} fontSize={8}
                      fontFamily={FONT} fontWeight="bold">{msg.from}</text>
                    <text x={640} y={msgY} fill={C.textSecondary} fontSize={8} fontFamily={FONT}>
                      {msg.text.substring(0, charsShown)}
                    </text>
                  </g>
                );
              })}
            </g>

            {/* Safety car / VSC indicator */}
            <rect x={W - 220} y={topRowH + midRowH + 8} width={208} height={bottomBarH - 16}
              fill="rgba(255,255,255,0.03)" stroke={C.panelBorder} strokeWidth={1} rx={4} />
            {isYellow ? (
              <g>
                <text x={W - 116} y={topRowH + midRowH + 28} fill={C.flagYellow}
                  fontSize={12} fontFamily={FONT} textAnchor="middle" fontWeight="bold"
                  filter="url(#f1-glow)">VSC DEPLOYED</text>
                <rect x={W - 210} y={topRowH + midRowH + 34} width={188} height={3}
                  fill={C.flagYellow} opacity={0.4 + Math.sin(frame * 0.3) * 0.3} rx={1} />
                <text x={W - 116} y={topRowH + midRowH + bottomBarH - 14} fill={C.textMuted}
                  fontSize={9} fontFamily={FONT} textAnchor="middle">DELTA +4.2s</text>
              </g>
            ) : (
              <g>
                <text x={W - 116} y={topRowH + midRowH + 28} fill={C.flagGreen}
                  fontSize={12} fontFamily={FONT} textAnchor="middle" fontWeight="bold">CLEAR</text>
                <text x={W - 116} y={topRowH + midRowH + bottomBarH - 14} fill={C.textMuted}
                  fontSize={9} fontFamily={FONT} textAnchor="middle">NO INCIDENTS</text>
              </g>
            )}
          </g>

          {/* ── Panel border glow (team cyan accent) ──────────────────────── */}
          <rect width={W} height={H} fill="none"
            stroke={`rgba(${hexToRgb(C.teal)}, 0.06)`} strokeWidth={2} rx={4} />

          {/* ── Scan line overlay ─────────────────────────────────────────── */}
          {Array.from({ length: Math.floor(H / 4) }, (_, i) => (
            <rect key={`scanl-${i}`} x={0} y={i * 4} width={W} height={1}
              fill={C.textPrimary} opacity={0.012} />
          ))}

          {/* ── Chromatic aberration ──────────────────────────────────────── */}
          {(() => {
            const chromaOff = 0.5 + Math.sin(frame * 0.05) * 0.3;
            return (
              <g>
                <rect x={0} y={0} width={chromaOff} height={H}
                  fill="rgba(255,0,0,0.02)" />
                <rect x={W - chromaOff} y={0} width={chromaOff} height={H}
                  fill="rgba(0,0,255,0.02)" />
              </g>
            );
          })()}

          {/* Intro wipe curtain */}
          {wipeProgress < 1 && (
            <rect x={0} y={0} width={W} height={H}
              fill={C.bgDeep}
              opacity={1 - wipeProgress} />
          )}

          {/* Theme reference */}
          <rect x={-10} y={-10} width={1} height={1}
            fill={colors.cyan} opacity={0} />

        </svg>
      </div>
    </AbsoluteFill>
  );
};

export default F1PitWall;
