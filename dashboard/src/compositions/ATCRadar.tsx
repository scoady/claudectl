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

// ── Types ────────────────────────────────────────────────────────────────────

interface Target {
  callsign: string;
  squawk: string;
  altitude: string;
  speed: number;
  bearing: number;
  range: number;
  heading: number;
  tasksPerMin: number;
}

interface FlightStrip {
  callsign: string;
  squawk: string;
  acType: string;
  origin: string;
  dest: string;
  altitude: string;
  heading: string;
  speed: string;
  route: string;
  status: string;
  borderColor: string;
}

// ── ATC Color Palette ────────────────────────────────────────────────────────

const P = {
  bg: '#050f0a',
  scopeCenter: '#0b170b',
  scopeEdge: '#050f0a',
  panelBg: '#0a1410',
  radarGreen: '#00ff66',
  targetBright: '#33ff99',
  conflict: '#ffaa00',
  alert: '#ff3300',
  weatherLight: '#00aaff',
  weatherMod: '#0088dd',
  weatherHeavy: '#0066ff',
  greenDim: '#117733',
  stripBg: '#121c16',
  stripBorder: '#1a3a22',
  stripText: '#bbddbb',
  stripTextDim: '#557755',
  panelBorder: '#1a3a1a',
  rangeRing: 'rgba(0,255,102,0.10)',
  gridLine: 'rgba(0,255,102,0.05)',
  textSecondary: '#11aa44',
  commBarBg: '#080e0a',
};

const FONT = "'Fira Code', 'IBM Plex Mono', monospace";

// ── Polar helpers ────────────────────────────────────────────────────────────

function polarToXY(
  cx: number, cy: number, bearing: number, range: number, scale: number,
): { x: number; y: number } {
  const rad = ((bearing - 90) * Math.PI) / 180;
  return { x: cx + Math.cos(rad) * range * scale, y: cy + Math.sin(rad) * range * scale };
}

// ── ATIS string ──────────────────────────────────────────────────────────────

const ATIS_TEXT =
  'C9-OPERATOR ATIS INFO BRAVO  1427Z  AGENTS ACTIVE 5  DISPATCH QUEUE 3  ' +
  'TOKEN BUDGET 78% CONSUMED  SESSION POOL 12/20  BROKER STATUS NOMINAL  ' +
  'WIND 270/08KT  ALTM 29.92  ILS RWY 28L IN USE  ADVISE ON INITIAL CONTACT YOU HAVE INFO BRAVO';

// ── Component ────────────────────────────────────────────────────────────────

export const ATCRadar: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const W = 1920;
  const H = 1080;
  const scopeDivider = 0.6;
  const scopeAreaW = W * scopeDivider;
  const commBarH = 72;

  // Radar scope geometry
  const scopeR = 380;
  const scopeX = scopeAreaW / 2;
  const scopeY = (H - commBarH) / 2;
  const rangeScale = scopeR / 80;

  // Sweep: ~180 frames per revolution (~6s at 30fps)
  const sweepAngle = (frame / 180) * 360;
  const sweepRad = ((sweepAngle - 90) * Math.PI) / 180;

  // ── Static target data ──────────────────────────────────────────────────────
  const targets: Target[] = useMemo(() => [
    { callsign: 'C9A-ALPHA', squawk: '4201', altitude: 'FL350', speed: 480, bearing: 35, range: 22, heading: 215, tasksPerMin: 3.2 },
    { callsign: 'C9B-BETA', squawk: '4202', altitude: 'FL280', speed: 420, bearing: 145, range: 38, heading: 310, tasksPerMin: 2.8 },
    { callsign: 'C9G-GAMMA', squawk: '4203', altitude: 'FL410', speed: 510, bearing: 250, range: 15, heading: 45, tasksPerMin: 4.1 },
    { callsign: 'C9D-DELTA', squawk: '4204', altitude: 'FL320', speed: 445, bearing: 320, range: 52, heading: 160, tasksPerMin: 1.9 },
    { callsign: 'C9E-EPSLN', squawk: '4205', altitude: 'FL290', speed: 460, bearing: 85, range: 30, heading: 270, tasksPerMin: 3.5 },
  ], []);

  const flightStrips: FlightStrip[] = useMemo(() => [
    { callsign: 'C9A-ALPHA', squawk: '4201', acType: 'OPUS', origin: 'PROJ', dest: 'DONE', altitude: 'FL350', heading: '215', speed: '480', route: 'READ.BASH.EDIT', status: 'ACTIVE', borderColor: P.radarGreen },
    { callsign: 'C9B-BETA', squawk: '4202', acType: 'SNNT', origin: 'TASK', dest: 'REVW', altitude: 'FL280', heading: '310', speed: '420', route: 'GREP.WRITE.TEST', status: 'ACTIVE', borderColor: P.radarGreen },
    { callsign: 'C9G-GAMMA', squawk: '4203', acType: 'OPUS', origin: 'DISP', dest: 'DONE', altitude: 'FL410', heading: '045', speed: '510', route: 'PLAN.CODE.PUSH', status: 'ACTIVE', borderColor: P.conflict },
    { callsign: 'C9D-DELTA', squawk: '4204', acType: 'HIKU', origin: 'PROJ', dest: 'MRGD', altitude: 'FL320', heading: '160', speed: '445', route: 'READ.EDIT.CMIT', status: 'HANDOFF', borderColor: P.weatherLight },
    { callsign: 'C9E-EPSLN', squawk: '4205', acType: 'OPUS', origin: 'WAIT', dest: 'TASK', altitude: 'FL290', heading: '270', speed: '460', route: 'INIT.READ.PLAN', status: 'PENDING', borderColor: P.greenDim },
  ], []);

  // ── Animated target positions ───────────────────────────────────────────────
  const animatedTargets = useMemo(() => {
    return targets.map((t) => {
      const moveRate = t.speed * 0.00004;
      const headRad = ((t.heading - 90) * Math.PI) / 180;
      const dx = Math.cos(headRad) * moveRate * frame;
      const dy = Math.sin(headRad) * moveRate * frame;
      const basePt = polarToXY(scopeX, scopeY, t.bearing, t.range, rangeScale);
      return { ...t, x: basePt.x + dx, y: basePt.y + dy };
    });
  }, [frame, targets, scopeX, scopeY, rangeScale]);

  // ── History dots ────────────────────────────────────────────────────────────
  const historyDots = useMemo(() => {
    return targets.map((t) => {
      const dots: Array<{ x: number; y: number }> = [];
      const moveRate = t.speed * 0.00004;
      const headRad = ((t.heading - 90) * Math.PI) / 180;
      for (let i = 1; i <= 6; i++) {
        const pastFrame = Math.max(0, frame - i * 8);
        const pdx = Math.cos(headRad) * moveRate * pastFrame;
        const pdy = Math.sin(headRad) * moveRate * pastFrame;
        const basePt = polarToXY(scopeX, scopeY, t.bearing, t.range, rangeScale);
        dots.push({ x: basePt.x + pdx, y: basePt.y + pdy });
      }
      return dots;
    });
  }, [frame, targets, scopeX, scopeY, rangeScale]);

  // ── Weather patches ─────────────────────────────────────────────────────────
  const weatherPatches = useMemo(() => {
    const rng = seededRandom(777);
    return [
      { bearing: 190 + rng() * 10, range: 35, rx: 55, ry: 40, intensity: 'light' as const },
      { bearing: 205 + rng() * 5, range: 42, rx: 35, ry: 28, intensity: 'moderate' as const },
      { bearing: 200 + rng() * 5, range: 45, rx: 18, ry: 14, intensity: 'heavy' as const },
    ];
  }, []);

  // ── Conflict alert (frames 150-200) ─────────────────────────────────────────
  const conflictActive = frame >= 150 && frame <= 200;
  const conflictFlash = conflictActive ? Math.sin(frame * 0.6) > 0 : false;

  // ── New strip animation (frame 80) ──────────────────────────────────────────
  const newStripProgress = interpolate(frame, [80, 100], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const newStripSlide = interpolate(newStripProgress, [0, 1], [300, 0], {
    easing: Easing.out(Easing.cubic),
  });
  const newStripOpacity = newStripProgress;

  // ── Scan line CRT effect ────────────────────────────────────────────────────
  const scanLineY = (frame * 4) % (H - commBarH);

  // ── Intro spring ────────────────────────────────────────────────────────────
  const introScale = spring({
    frame, fps,
    config: { damping: 80, stiffness: 40, mass: 0.8 },
    from: 0.92, to: 1,
  });
  const introOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  // ── ATIS scroll offset ──────────────────────────────────────────────────────
  const atisScrollX = -(frame * 2.5) % 2400;

  // ── Phosphor persistence helper ─────────────────────────────────────────────
  const getTargetBrightness = (tBearing: number): number => {
    const targetAngle = tBearing % 360;
    const currentSweep = sweepAngle % 360;
    let angleDiff = currentSweep - targetAngle;
    if (angleDiff < 0) angleDiff += 360;
    if (angleDiff < 120) return interpolate(angleDiff, [0, 120], [1, 0.15]);
    return 0.15;
  };

  // ── CRT scan lines ─────────────────────────────────────────────────────────
  const scanLinesPattern = useMemo(() => {
    const rng = seededRandom(9090);
    return Array.from({ length: 40 }, (_, i) => ({
      y: i * ((H - commBarH) / 40),
      opacity: 0.03 + rng() * 0.02,
    }));
  }, []);

  // ── Static noise ───────────────────────────────────────────────────────────
  const noiseRects = useMemo(() => {
    const rng = seededRandom(4040 + Math.floor(frame / 3));
    return Array.from({ length: 80 }, () => ({
      x: rng() * W, y: rng() * (H - commBarH),
      w: rng() * 3 + 1, h: rng() * 2 + 0.5,
      op: rng() * 0.04,
    }));
  }, [frame]);

  // ── Bearing marks ──────────────────────────────────────────────────────────
  const bearingMarks = useMemo(() => {
    const marks: Array<{ angle: number; major: boolean; label: string }> = [];
    const cardinals: Record<number, string> = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
    for (let deg = 0; deg < 360; deg += 10) {
      marks.push({ angle: deg, major: deg % 30 === 0, label: cardinals[deg] || '' });
    }
    return marks;
  }, []);

  const rangeRings = [10, 20, 40, 80];

  return (
    <AbsoluteFill style={{
      background: P.bg, fontFamily: FONT, overflow: 'hidden',
      opacity: introOpacity, transform: `scale(${introScale})`,
    }}>
      <div style={{ position: 'absolute', inset: 0, width: W, height: H }}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H}
          style={{ position: 'absolute', top: 0, left: 0 }}>
          <defs>
            <radialGradient id="atc-scope-bg" cx="50%" cy="50%">
              <stop offset="0%" stopColor={P.scopeCenter} />
              <stop offset="100%" stopColor={P.scopeEdge} />
            </radialGradient>
            <filter id="atc-bloom">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="atc-glow-strong">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <radialGradient id="atc-vignette" cx="50%" cy="50%">
              <stop offset="40%" stopColor="transparent" />
              <stop offset="100%" stopColor="rgba(0,0,0,0.7)" />
            </radialGradient>
            <clipPath id="atc-scope-clip">
              <circle cx={scopeX} cy={scopeY} r={scopeR} />
            </clipPath>
            <radialGradient id="atc-wx-light">
              <stop offset="0%" stopColor={P.weatherLight} stopOpacity={0.15} />
              <stop offset="100%" stopColor={P.weatherLight} stopOpacity={0} />
            </radialGradient>
            <radialGradient id="atc-wx-mod">
              <stop offset="0%" stopColor={P.weatherMod} stopOpacity={0.22} />
              <stop offset="100%" stopColor={P.weatherMod} stopOpacity={0} />
            </radialGradient>
            <radialGradient id="atc-wx-heavy">
              <stop offset="0%" stopColor={P.weatherHeavy} stopOpacity={0.3} />
              <stop offset="100%" stopColor={P.weatherHeavy} stopOpacity={0} />
            </radialGradient>
            <clipPath id="atis-clip">
              <rect x={184} y={H - commBarH + 26} width={W - 484} height={34} />
            </clipPath>
          </defs>

          <rect width={W} height={H} fill={P.bg} />

          {/* ── RADAR SCOPE (left 60%) ──────────────────────────────────── */}
          <g>
            <circle cx={scopeX} cy={scopeY} r={scopeR}
              fill="url(#atc-scope-bg)" stroke={P.panelBorder} strokeWidth={2} />

            <g clipPath="url(#atc-scope-clip)">
              {/* Grid lines */}
              {Array.from({ length: 12 }, (_, i) => {
                const angle = i * 30;
                const rad = ((angle - 90) * Math.PI) / 180;
                return (
                  <line key={`grid-${i}`}
                    x1={scopeX} y1={scopeY}
                    x2={scopeX + Math.cos(rad) * scopeR}
                    y2={scopeY + Math.sin(rad) * scopeR}
                    stroke={P.gridLine} strokeWidth={0.5} />
                );
              })}

              {/* Range rings */}
              {rangeRings.map((nm) => (
                <g key={`rr-${nm}`}>
                  <circle cx={scopeX} cy={scopeY} r={nm * rangeScale}
                    fill="none" stroke={P.rangeRing} strokeWidth={0.8} />
                  <text x={scopeX + 4} y={scopeY - nm * rangeScale + 12}
                    fill={P.greenDim} fontSize={9} fontFamily={FONT}>{nm}nm</text>
                </g>
              ))}

              {/* Weather patches */}
              {weatherPatches.map((wp, i) => {
                const drift = frame * 0.02;
                const pt = polarToXY(scopeX, scopeY, wp.bearing + drift, wp.range, rangeScale);
                const gradId = wp.intensity === 'heavy'
                  ? 'atc-wx-heavy'
                  : wp.intensity === 'moderate' ? 'atc-wx-mod' : 'atc-wx-light';
                return (
                  <ellipse key={`wx-${i}`} cx={pt.x} cy={pt.y} rx={wp.rx} ry={wp.ry}
                    fill={`url(#${gradId})`}
                    transform={`rotate(${15 + drift * 2}, ${pt.x}, ${pt.y})`} />
                );
              })}

              {/* Runways at center */}
              <g opacity={0.5}>
                <line x1={scopeX - 18} y1={scopeY - 3} x2={scopeX + 18} y2={scopeY - 3}
                  stroke={P.radarGreen} strokeWidth={2} />
                <line x1={scopeX - 18} y1={scopeY + 3} x2={scopeX + 18} y2={scopeY + 3}
                  stroke={P.radarGreen} strokeWidth={2} />
                <text x={scopeX - 26} y={scopeY + 2} fill={P.greenDim} fontSize={7}
                  fontFamily={FONT} textAnchor="end">28L</text>
                <text x={scopeX + 26} y={scopeY + 2} fill={P.greenDim} fontSize={7}
                  fontFamily={FONT} textAnchor="start">10R</text>
              </g>

              {/* History dots */}
              {historyDots.map((dots, ti) => (
                <g key={`hist-${ti}`}>
                  {dots.map((d, di) => (
                    <circle key={`hd-${ti}-${di}`} cx={d.x} cy={d.y}
                      r={1.2} fill={P.radarGreen} opacity={0.5 - di * 0.07} />
                  ))}
                </g>
              ))}

              {/* Aircraft targets with data blocks */}
              {animatedTargets.map((t, i) => {
                const brightness = getTargetBrightness(t.bearing);
                const isConflictTarget = i <= 1 && conflictActive;
                const tColor = isConflictTarget && conflictFlash ? P.conflict : P.targetBright;
                const headRad = ((t.heading - 90) * Math.PI) / 180;
                const wingSpan = 10;
                const bodyLen = 14;
                const wx1 = t.x - Math.cos(headRad + Math.PI / 2) * wingSpan / 2;
                const wy1 = t.y - Math.sin(headRad + Math.PI / 2) * wingSpan / 2;
                const wx2 = t.x + Math.cos(headRad + Math.PI / 2) * wingSpan / 2;
                const wy2 = t.y + Math.sin(headRad + Math.PI / 2) * wingSpan / 2;
                const bx = t.x - Math.cos(headRad) * bodyLen;
                const by = t.y - Math.sin(headRad) * bodyLen;
                const dbOffsetX = i % 2 === 0 ? 20 : -80;
                const dbOffsetY = i < 3 ? -30 : 10;
                const dbX = t.x + dbOffsetX;
                const dbY = t.y + dbOffsetY;

                return (
                  <g key={`tgt-${i}`} opacity={brightness} filter="url(#atc-bloom)">
                    {isConflictTarget && conflictFlash && (
                      <circle cx={t.x} cy={t.y} r={18}
                        fill="none" stroke={P.conflict} strokeWidth={1.5}
                        strokeDasharray="4,4" opacity={0.9} />
                    )}
                    <line x1={wx1} y1={wy1} x2={wx2} y2={wy2}
                      stroke={tColor} strokeWidth={1.8} />
                    <line x1={t.x} y1={t.y} x2={bx} y2={by}
                      stroke={tColor} strokeWidth={1.8} />
                    <line x1={t.x} y1={t.y} x2={dbX} y2={dbY + 8}
                      stroke={tColor} strokeWidth={0.5} opacity={0.6} />
                    <rect x={dbX - 2} y={dbY - 2} width={76} height={34}
                      fill="rgba(5,15,10,0.85)" stroke={tColor} strokeWidth={0.4} rx={1} />
                    <text x={dbX + 2} y={dbY + 9} fill={tColor} fontSize={8.5}
                      fontFamily={FONT}>{t.callsign}</text>
                    <text x={dbX + 2} y={dbY + 19} fill={P.textSecondary} fontSize={7}
                      fontFamily={FONT}>{t.altitude} {t.speed}kt</text>
                    <text x={dbX + 2} y={dbY + 28} fill={P.textSecondary} fontSize={7}
                      fontFamily={FONT}>{t.tasksPerMin}t/m H{String(t.heading).padStart(3, '0')}</text>
                  </g>
                );
              })}

              {/* Conflict alert overlay */}
              {conflictActive && conflictFlash && (
                <g filter="url(#atc-glow-strong)">
                  <rect x={scopeX - 150} y={scopeY - scopeR + 16} width={300} height={22}
                    fill="rgba(255,51,0,0.12)" stroke={P.alert} strokeWidth={1} rx={2} />
                  <text x={scopeX} y={scopeY - scopeR + 32} textAnchor="middle"
                    fill={P.alert} fontSize={13} fontFamily={FONT} fontWeight="bold">
                    CONFLICT ALERT -- C9A-ALPHA / C9B-BETA
                  </text>
                </g>
              )}

              {/* Radar sweep line */}
              <line x1={scopeX} y1={scopeY}
                x2={scopeX + Math.cos(sweepRad) * scopeR}
                y2={scopeY + Math.sin(sweepRad) * scopeR}
                stroke={P.radarGreen} strokeWidth={1.5} opacity={0.9}
                filter="url(#atc-bloom)" />

              {/* Sweep afterglow trail */}
              {Array.from({ length: 40 }, (_, i) => {
                const trailAngle = sweepAngle - i * 2.5;
                const trailRad = ((trailAngle - 90) * Math.PI) / 180;
                const trailOp = interpolate(i, [0, 40], [0.25, 0]);
                return (
                  <line key={`trail-${i}`}
                    x1={scopeX} y1={scopeY}
                    x2={scopeX + Math.cos(trailRad) * scopeR}
                    y2={scopeY + Math.sin(trailRad) * scopeR}
                    stroke={P.radarGreen} strokeWidth={0.6} opacity={trailOp} />
                );
              })}

              {/* CRT scan line */}
              <rect x={scopeX - scopeR} y={scanLineY} width={scopeR * 2} height={1.5}
                fill={P.radarGreen} opacity={0.04} />

              {/* Static noise */}
              {noiseRects.map((n, i) => (
                <rect key={`noise-${i}`} x={n.x} y={n.y} width={n.w} height={n.h}
                  fill={P.radarGreen} opacity={n.op} />
              ))}
            </g>

            {/* Compass rose */}
            {bearingMarks.map((m) => {
              const rad = ((m.angle - 90) * Math.PI) / 180;
              const innerR = scopeR - (m.major ? 14 : 8);
              const labelR = scopeR + 14;
              return (
                <g key={`brg-${m.angle}`}>
                  <line
                    x1={scopeX + Math.cos(rad) * innerR}
                    y1={scopeY + Math.sin(rad) * innerR}
                    x2={scopeX + Math.cos(rad) * scopeR}
                    y2={scopeY + Math.sin(rad) * scopeR}
                    stroke={m.major ? P.radarGreen : P.greenDim}
                    strokeWidth={m.major ? 1.2 : 0.6} opacity={0.7} />
                  {m.label && (
                    <text
                      x={scopeX + Math.cos(rad) * labelR}
                      y={scopeY + Math.sin(rad) * labelR + 4}
                      fill={P.radarGreen} fontSize={12} fontFamily={FONT}
                      textAnchor="middle" fontWeight="bold">{m.label}</text>
                  )}
                </g>
              );
            })}

            <circle cx={scopeX} cy={scopeY} r={3} fill={P.radarGreen} opacity={0.7} />
          </g>

          {/* ── FLIGHT STRIP BAY (right 40%) ─────────────────────────────── */}
          <g>
            <rect x={scopeAreaW} y={0} width={W - scopeAreaW} height={H - commBarH}
              fill={P.panelBg} stroke={P.panelBorder} strokeWidth={1} />

            <rect x={scopeAreaW} y={0} width={W - scopeAreaW} height={32}
              fill="rgba(0,255,102,0.06)" />
            <text x={scopeAreaW + 16} y={22} fill={P.radarGreen} fontSize={13}
              fontFamily={FONT} fontWeight="bold">FLIGHT STRIP BAY</text>
            <text x={W - 16} y={22} fill={P.greenDim} fontSize={10}
              fontFamily={FONT} textAnchor="end">
              ACTIVE: {flightStrips.filter((s) => s.status === 'ACTIVE').length}
            </text>

            {flightStrips.map((strip, i) => {
              const isNew = i === 4;
              const stripY = 42 + i * 120;
              const stripW = W - scopeAreaW - 24;
              const stripH = 108;
              const sOpacity = isNew ? newStripOpacity : 1;
              const translateX = isNew ? newStripSlide : 0;
              const isActive = strip.status === 'ACTIVE';

              return (
                <g key={`strip-${i}`} opacity={sOpacity}
                  transform={`translate(${translateX}, 0)`}>
                  <rect x={scopeAreaW + 12} y={stripY} width={stripW} height={stripH}
                    fill={P.stripBg} stroke={strip.borderColor} strokeWidth={1.5} rx={3}
                    opacity={isActive ? 1 : 0.6} />

                  {isActive && i === 0 && (
                    <rect x={scopeAreaW + 11} y={stripY - 1}
                      width={stripW + 2} height={stripH + 2}
                      fill="none" stroke={P.radarGreen} strokeWidth={2} rx={4}
                      opacity={0.3 + Math.sin(frame * 0.1) * 0.15} />
                  )}

                  <rect x={scopeAreaW + 12} y={stripY} width={5} height={stripH}
                    fill={strip.borderColor} rx={3} />

                  <text x={scopeAreaW + 26} y={stripY + 18} fill={P.stripText}
                    fontSize={13} fontFamily={FONT} fontWeight="bold">{strip.callsign}</text>
                  <text x={scopeAreaW + stripW - 8} y={stripY + 18} fill={P.stripTextDim}
                    fontSize={9} fontFamily={FONT} textAnchor="end">{strip.squawk}</text>

                  <text x={scopeAreaW + 26} y={stripY + 34} fill={P.textSecondary}
                    fontSize={9} fontFamily={FONT}>{strip.acType}</text>
                  <text x={scopeAreaW + 80} y={stripY + 34}
                    fill={strip.status === 'HANDOFF' ? P.conflict
                      : strip.status === 'PENDING' ? P.greenDim : P.radarGreen}
                    fontSize={9} fontFamily={FONT} fontWeight="bold">{strip.status}</text>

                  <text x={scopeAreaW + 26} y={stripY + 50} fill={P.greenDim}
                    fontSize={8} fontFamily={FONT}>{strip.origin} &rarr; {strip.dest}</text>
                  <text x={scopeAreaW + stripW - 8} y={stripY + 50} fill={P.stripTextDim}
                    fontSize={8} fontFamily={FONT} textAnchor="end">{strip.route}</text>

                  <line x1={scopeAreaW + 24} y1={stripY + 58}
                    x2={scopeAreaW + stripW - 4} y2={stripY + 58}
                    stroke={P.stripBorder} strokeWidth={0.5} />

                  <text x={scopeAreaW + 26} y={stripY + 74} fill={P.stripTextDim}
                    fontSize={8} fontFamily={FONT}>ALT</text>
                  <text x={scopeAreaW + 50} y={stripY + 74} fill={P.stripText}
                    fontSize={9} fontFamily={FONT}>{strip.altitude}</text>
                  <text x={scopeAreaW + 110} y={stripY + 74} fill={P.stripTextDim}
                    fontSize={8} fontFamily={FONT}>HDG</text>
                  <text x={scopeAreaW + 136} y={stripY + 74} fill={P.stripText}
                    fontSize={9} fontFamily={FONT}>{strip.heading}</text>
                  <text x={scopeAreaW + 190} y={stripY + 74} fill={P.stripTextDim}
                    fontSize={8} fontFamily={FONT}>SPD</text>
                  <text x={scopeAreaW + 214} y={stripY + 74} fill={P.stripText}
                    fontSize={9} fontFamily={FONT}>{strip.speed}</text>

                  {(() => {
                    const hd = parseInt(strip.heading);
                    const arrowRad = ((hd - 90) * Math.PI) / 180;
                    const acx = scopeAreaW + stripW - 30;
                    const acy = stripY + 85;
                    return (
                      <g>
                        <circle cx={acx} cy={acy} r={12} fill="none"
                          stroke={P.greenDim} strokeWidth={0.5} />
                        <line x1={acx} y1={acy}
                          x2={acx + Math.cos(arrowRad) * 10}
                          y2={acy + Math.sin(arrowRad) * 10}
                          stroke={P.radarGreen} strokeWidth={1.2} />
                        <circle cx={acx} cy={acy} r={1.5} fill={P.radarGreen} />
                      </g>
                    );
                  })()}
                </g>
              );
            })}
          </g>

          {/* ── COMM BAR (bottom full width) ─────────────────────────────── */}
          <g>
            <rect x={0} y={H - commBarH} width={W} height={commBarH}
              fill={P.commBarBg} stroke={P.panelBorder} strokeWidth={1} />

            {/* Frequency */}
            <rect x={12} y={H - commBarH + 8} width={160} height={56}
              fill="rgba(0,255,102,0.04)" stroke={P.panelBorder} strokeWidth={1} rx={3} />
            <text x={92} y={H - commBarH + 24} fill={P.greenDim} fontSize={9}
              fontFamily={FONT} textAnchor="middle">FREQ</text>
            <text x={92} y={H - commBarH + 44} fill={P.radarGreen} fontSize={18}
              fontFamily={FONT} textAnchor="middle" fontWeight="bold"
              filter="url(#atc-bloom)">128.450</text>
            <text x={92} y={H - commBarH + 56} fill={P.greenDim} fontSize={8}
              fontFamily={FONT} textAnchor="middle">APP CTL</text>

            {/* ATIS scrolling */}
            <rect x={184} y={H - commBarH + 8} width={W - 480} height={56}
              fill="rgba(0,255,102,0.02)" stroke={P.panelBorder} strokeWidth={1} rx={3} />
            <text x={188} y={H - commBarH + 22} fill={P.greenDim} fontSize={8}
              fontFamily={FONT}>ATIS</text>
            <g clipPath="url(#atis-clip)">
              <text x={190 + atisScrollX} y={H - commBarH + 46} fill={P.textSecondary}
                fontSize={10} fontFamily={FONT}>{ATIS_TEXT}</text>
              <text x={190 + atisScrollX + 2400} y={H - commBarH + 46} fill={P.textSecondary}
                fontSize={10} fontFamily={FONT}>{ATIS_TEXT}</text>
            </g>

            {/* Altimeter */}
            <rect x={W - 290} y={H - commBarH + 8} width={120} height={56}
              fill="rgba(0,255,102,0.04)" stroke={P.panelBorder} strokeWidth={1} rx={3} />
            <text x={W - 230} y={H - commBarH + 24} fill={P.greenDim} fontSize={9}
              fontFamily={FONT} textAnchor="middle">ALTM</text>
            <text x={W - 230} y={H - commBarH + 44} fill={P.radarGreen} fontSize={16}
              fontFamily={FONT} textAnchor="middle" fontWeight="bold">29.92</text>
            <text x={W - 230} y={H - commBarH + 56} fill={P.greenDim} fontSize={8}
              fontFamily={FONT} textAnchor="middle">inHg</text>

            {/* UTC Clock */}
            <rect x={W - 158} y={H - commBarH + 8} width={146} height={56}
              fill="rgba(0,255,102,0.04)" stroke={P.panelBorder} strokeWidth={1} rx={3} />
            <text x={W - 85} y={H - commBarH + 24} fill={P.greenDim} fontSize={9}
              fontFamily={FONT} textAnchor="middle">UTC</text>
            {(() => {
              const secs = Math.floor(frame / 30);
              const mins = 27 + Math.floor(secs / 60);
              const ss = secs % 60;
              return (
                <text x={W - 85} y={H - commBarH + 46} fill={P.radarGreen} fontSize={20}
                  fontFamily={FONT} textAnchor="middle" fontWeight="bold"
                  filter="url(#atc-bloom)">
                  14:{String(mins).padStart(2, '0')}:{String(ss).padStart(2, '0')}Z
                </text>
              );
            })()}
          </g>

          {/* CRT scan lines */}
          <g opacity={0.5}>
            {scanLinesPattern.map((s, i) => (
              <rect key={`sl-${i}`} x={0} y={s.y} width={W} height={1}
                fill={P.radarGreen} opacity={s.opacity} />
            ))}
          </g>

          {/* Vignette */}
          <rect width={W} height={H} fill="url(#atc-vignette)" />

          {/* Screen curvature */}
          <rect width={W} height={H} fill="none"
            stroke="rgba(0,255,102,0.03)" strokeWidth={40} rx={60} />

          {/* Desk ambient green light */}
          <rect x={0} y={H - 20} width={W} height={20}
            fill={`rgba(${hexToRgb(P.radarGreen)}, 0.03)`} />
          <rect x={0} y={H - 8} width={W} height={8}
            fill={`rgba(${hexToRgb(P.radarGreen)}, 0.05)`} />

          {/* Chromatic aberration */}
          <circle cx={scopeX} cy={scopeY} r={scopeR + 2}
            fill="none" stroke="rgba(255,50,50,0.015)" strokeWidth={2} />
          <circle cx={scopeX} cy={scopeY} r={scopeR + 3}
            fill="none" stroke="rgba(50,50,255,0.015)" strokeWidth={2} />

          {/* Theme reference */}
          <rect x={-10} y={-10} width={1} height={1}
            fill={colors.cyan} opacity={0} />
        </svg>
      </div>
    </AbsoluteFill>
  );
};

export default ATCRadar;
