import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  spring,
  useVideoConfig,
  interpolate,
} from 'remotion';
// theme import available if needed

// ── Deterministic random ─────────────────────────────────────────────────────

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── Aurora palette ───────────────────────────────────────────────────────────

const aurora = {
  bg: '#0d1520',
  teal: '#2dd4bf',
  green: '#34d399',
  cyan: '#67e8f9',
  purple: '#a78bfa',
  pink: '#f472b6',
  gold: '#fbbf24',
  orange: '#fb923c',
  text: '#e2e8f0',
  textDim: '#94a3b8',
  glass: 'rgba(120,200,220,0.06)',
  glassBorder: 'rgba(120,200,220,0.12)',
};

const FONT = "'Fira Code', 'IBM Plex Mono', monospace";
const SANS = "'Inter', 'Roboto', sans-serif";

// ── Props ────────────────────────────────────────────────────────────────────

export interface AuroraMixerProps {
  title?: string;
  channelCount?: number;
  bpm?: number;
}

// ── Channel data ─────────────────────────────────────────────────────────────

interface ChannelData {
  name: string;
  color: string;
  baseLevel: number;
  pan: number; // -1 to 1
  faderDb: number;
  eqPoints: string; // SVG path d attribute for EQ curve
  eqFill: string; // SVG path d attribute for filled area
  inserts: string[];
  solo: boolean;
  mute: boolean;
  stereo: boolean;
}

function generateEqPath(
  w: number,
  h: number,
  points: number[],
): { curve: string; fill: string } {
  // points: array of 7 y-values (0-1) across the frequency range
  const step = w / (points.length - 1);
  let d = `M 0 ${h - points[0] * h}`;
  for (let i = 1; i < points.length; i++) {
    const x = i * step;
    const y = h - points[i] * h;
    const cpx1 = (i - 1) * step + step * 0.5;
    const cpy1 = h - points[i - 1] * h;
    const cpx2 = x - step * 0.5;
    const cpy2 = y;
    d += ` C ${cpx1} ${cpy1}, ${cpx2} ${cpy2}, ${x} ${y}`;
  }
  const fill = d + ` L ${w} ${h} L 0 ${h} Z`;
  return { curve: d, fill };
}

const CHANNELS: ChannelData[] = (() => {
  const eqW = 140;
  const eqH = 60;

  const channelDefs: {
    name: string;
    color: string;
    baseLevel: number;
    pan: number;
    faderDb: number;
    eqPts: number[];
    inserts: string[];
    solo: boolean;
    mute: boolean;
    stereo: boolean;
  }[] = [
    { name: 'Kick', color: aurora.orange, baseLevel: 0.7, pan: 0, faderDb: -2.4, eqPts: [0.3, 0.8, 0.9, 0.4, 0.25, 0.2, 0.15], inserts: ['Comp', 'EQ', 'Sat'], solo: false, mute: false, stereo: false },
    { name: 'Snare', color: aurora.gold, baseLevel: 0.65, pan: -0.1, faderDb: -3.2, eqPts: [0.2, 0.3, 0.5, 0.8, 0.7, 0.4, 0.3], inserts: ['Gate', 'Comp', 'EQ'], solo: false, mute: false, stereo: false },
    { name: 'Bass', color: aurora.teal, baseLevel: 0.6, pan: 0, faderDb: -4.1, eqPts: [0.5, 0.85, 0.7, 0.35, 0.2, 0.15, 0.1], inserts: ['Comp', 'EQ', 'Lim'], solo: false, mute: false, stereo: false },
    { name: 'Keys', color: aurora.purple, baseLevel: 0.45, pan: -0.3, faderDb: -6.8, eqPts: [0.15, 0.2, 0.3, 0.6, 0.7, 0.5, 0.35], inserts: ['EQ', 'Cho', 'Rev'], solo: false, mute: false, stereo: true },
    { name: 'Pad', color: aurora.pink, baseLevel: 0.4, pan: 0.2, faderDb: -8.5, eqPts: [0.1, 0.15, 0.35, 0.55, 0.65, 0.7, 0.5], inserts: ['EQ', 'Rev', 'Del'], solo: false, mute: false, stereo: true },
    { name: 'Lead', color: aurora.cyan, baseLevel: 0.55, pan: 0.15, faderDb: -5.0, eqPts: [0.1, 0.2, 0.4, 0.75, 0.85, 0.6, 0.3], inserts: ['Dist', 'EQ', 'Del'], solo: true, mute: false, stereo: true },
    { name: 'Vox', color: aurora.green, baseLevel: 0.5, pan: 0, faderDb: -3.8, eqPts: [0.08, 0.12, 0.3, 0.65, 0.8, 0.7, 0.4], inserts: ['Comp', 'EQ', 'Rev'], solo: false, mute: false, stereo: false },
    { name: 'FX', color: '#7c3aed', baseLevel: 0.35, pan: 0.4, faderDb: -10.2, eqPts: [0.2, 0.35, 0.5, 0.45, 0.55, 0.7, 0.6], inserts: ['Rev', 'Del', 'Mod'], solo: false, mute: false, stereo: true },
  ];

  return channelDefs.map((ch) => {
    const eq = generateEqPath(eqW, eqH, ch.eqPts);
    return {
      name: ch.name,
      color: ch.color,
      baseLevel: ch.baseLevel,
      pan: ch.pan,
      faderDb: ch.faderDb,
      eqPoints: eq.curve,
      eqFill: eq.fill,
      inserts: ch.inserts,
      solo: ch.solo,
      mute: ch.mute,
      stereo: ch.stereo,
    };
  });
})();

// ── Component ────────────────────────────────────────────────────────────────

export const AuroraMixer: React.FC<AuroraMixerProps> = ({
  title = 'AURORA',
  channelCount = 8,
  bpm = 120,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // seededRandom available if needed for future EQ randomization

  // ── Constants ──────────────────────────────────────────────────────────────
  const W = 1920;
  const H = 800;
  const HEADER_H = 40;
  const SPECTRUM_H = 120;
  const STRIP_H = H - HEADER_H - SPECTRUM_H; // 640
  const CH_W = 160;
  const MASTER_W = 200;
  const FADER_H = 200;
  const EQ_W = 140;
  const EQ_H = 60;
  const framesPerBeat = Math.round(fps / (bpm / 60)); // 15 frames at 120bpm/30fps
  const beat = Math.floor(frame / framesPerBeat) % 4;

  // ── Background aurora fade ─────────────────────────────────────────────────
  const bgOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  // ── Aurora orb positions (drifting) ────────────────────────────────────────
  const orbs = useMemo(() => {
    const r = seededRandom(7777);
    return Array.from({ length: 4 }, () => ({
      cx: 200 + r() * 1520,
      cy: 100 + r() * 600,
      rx: 200 + r() * 300,
      ry: 150 + r() * 250,
      color: [aurora.teal, aurora.purple, aurora.cyan, aurora.pink][Math.floor(r() * 4)],
      phase: r() * Math.PI * 2,
      speed: 0.003 + r() * 0.005,
    }));
  }, []);

  // ── VU level helper ────────────────────────────────────────────────────────
  function vuLevel(chIdx: number, baseLevel: number, offset = 0): number {
    const appear = interpolate(frame, [40, 50], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    if (appear <= 0) return 0;
    // Beat-synced bounce: kick on 0,2 — snare on 1,3
    let beatBoost = 0;
    if (chIdx === 0 && (beat === 0 || beat === 2)) beatBoost = 0.15;
    if (chIdx === 1 && (beat === 1 || beat === 3)) beatBoost = 0.12;
    if (chIdx === 2 && (beat === 0 || beat === 2)) beatBoost = 0.08;
    const level = Math.sin(frame * 0.15 + chIdx * 1.5 + offset) * 0.3 + baseLevel + beatBoost;
    return Math.max(0, Math.min(1, level)) * appear;
  }

  // ── Peak hold tracker (simulated) ──────────────────────────────────────────
  function peakHold(chIdx: number, baseLevel: number): number {
    // Simplified: peak sits a bit above current level and decays
    const peak = Math.min(1, baseLevel + 0.18 + Math.sin(frame * 0.04 + chIdx) * 0.05);
    return peak;
  }

  // ── Channel strip slide-in ─────────────────────────────────────────────────
  function channelSlideY(chIdx: number): number {
    const s = spring({ frame: frame - 5 - chIdx * 3, fps, config: { damping: 18, stiffness: 120, mass: 0.8 } });
    return interpolate(s, [0, 1], [STRIP_H, 0]);
  }

  // ── Fader position animation ───────────────────────────────────────────────
  function faderPosition(chIdx: number, targetDb: number): number {
    // Map dB to 0-1 range: +6 to -48
    const normalized = Math.max(0, Math.min(1, (targetDb + 48) / 54));
    const s = spring({ frame: frame - 30 - chIdx * 2, fps, config: { damping: 20, stiffness: 100, mass: 1 } });
    return normalized * s;
  }

  // ── EQ draw-in (stroke-dashoffset simulation via opacity) ──────────────────
  function eqDrawProgress(chIdx: number): number {
    return interpolate(frame, [20 + chIdx * 2, 50 + chIdx * 2], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  }

  // ── Render channel strip ───────────────────────────────────────────────────
  function renderChannel(ch: ChannelData, idx: number, x: number) {
    const slideY = channelSlideY(idx);
    const fPos = faderPosition(idx, ch.faderDb);
    const eqProg = eqDrawProgress(idx);
    const vuL = vuLevel(idx, ch.baseLevel);
    const vuR = vuLevel(idx, ch.baseLevel, 0.8);
    const peak = peakHold(idx, ch.baseLevel);

    // Layout offsets within strip
    let yOff = 8;
    const nameY = yOff; yOff += 22;
    const eqY = yOff; yOff += EQ_H + 8;
    const insertY = yOff; yOff += 52;
    const panY = yOff; yOff += 36;
    const faderY = yOff; yOff += FADER_H + 8;
    const msY = yOff;

    // Pan angle
    const panAngle = ch.pan * 135; // -135 to 135 degrees

    // Fader track
    const faderTrackH = FADER_H;
    const faderFillH = fPos * faderTrackH;
    const thumbY = faderTrackH - faderFillH;

    // dB markings
    const dbMarks = [
      { label: '+6', y: 0 },
      { label: '0', y: faderTrackH * (6 / 54) },
      { label: '-6', y: faderTrackH * (12 / 54) },
      { label: '-12', y: faderTrackH * (18 / 54) },
      { label: '-24', y: faderTrackH * (30 / 54) },
    ];

    // VU meter dimensions
    const vuBarW = ch.stereo ? 4 : 6;
    const vuBarH = faderTrackH;
    const vuX = CH_W - 28;

    return (
      <g key={ch.name} transform={`translate(${x}, ${HEADER_H + slideY})`} opacity={interpolate(slideY, [STRIP_H, STRIP_H * 0.8, 0], [0, 0.3, 1], { extrapolateRight: 'clamp' })}>
        {/* Glass panel background */}
        <rect x={0} y={0} width={CH_W} height={STRIP_H} rx={6} fill={aurora.glass} stroke={aurora.glassBorder} strokeWidth={0.5} />

        {/* Left color stripe */}
        <rect x={0} y={0} width={3} height={STRIP_H} rx={1.5} fill={ch.color} opacity={0.7} />

        {/* Channel name + dot */}
        <circle cx={14} cy={nameY + 8} r={4} fill={ch.color} opacity={0.9}>
          <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" />
        </circle>
        <text x={24} y={nameY + 12} fill={aurora.text} fontFamily={FONT} fontSize={11} fontWeight={600}>{ch.name}</text>

        {/* EQ curve */}
        <g transform={`translate(8, ${eqY})`} opacity={eqProg}>
          <rect x={0} y={0} width={EQ_W} height={EQ_H} rx={4} fill="rgba(0,0,0,0.3)" stroke={aurora.glassBorder} strokeWidth={0.5} />
          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map((r) => (
            <line key={r} x1={0} y1={EQ_H * r} x2={EQ_W} y2={EQ_H * r} stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} />
          ))}
          {/* Fill under curve */}
          <path d={ch.eqFill} fill={ch.color} opacity={0.12} />
          {/* Curve line */}
          <path
            d={ch.eqPoints}
            fill="none"
            stroke={ch.color}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeDasharray={400}
            strokeDashoffset={interpolate(eqProg, [0, 1], [400, 0])}
          />
        </g>

        {/* Insert slots */}
        {ch.inserts.map((ins, i) => (
          <g key={ins} transform={`translate(${8 + i * 46}, ${insertY})`}>
            <rect x={0} y={0} width={42} height={14} rx={3} fill="rgba(255,255,255,0.04)" stroke={aurora.glassBorder} strokeWidth={0.5} />
            <text x={21} y={10} textAnchor="middle" fill={aurora.textDim} fontFamily={FONT} fontSize={7}>{ins}</text>
          </g>
        ))}

        {/* Pan knob */}
        <g transform={`translate(${CH_W / 2}, ${panY + 14})`}>
          {/* Outer ring */}
          <circle cx={0} cy={0} r={12} fill="none" stroke={aurora.glassBorder} strokeWidth={1} />
          <circle cx={0} cy={0} r={10} fill="rgba(0,0,0,0.4)" />
          {/* Pan arc */}
          {(() => {
            const startAngle = -135;
            const endAngle = startAngle + (panAngle + 135);
            const r = 8;
            const toRad = (d: number) => (d * Math.PI) / 180;
            const x1 = Math.cos(toRad(startAngle - 90)) * r;
            const y1 = Math.sin(toRad(startAngle - 90)) * r;
            const x2 = Math.cos(toRad(endAngle - 90)) * r;
            const y2 = Math.sin(toRad(endAngle - 90)) * r;
            const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
            return (
              <path
                d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
                fill="none"
                stroke={ch.color}
                strokeWidth={2}
                strokeLinecap="round"
                opacity={0.7}
              />
            );
          })()}
          {/* Position dot */}
          {(() => {
            const angle = panAngle - 90;
            const r = 8;
            const dx = Math.cos((angle * Math.PI) / 180) * r;
            const dy = Math.sin((angle * Math.PI) / 180) * r;
            return <circle cx={dx} cy={dy} r={2} fill={ch.color} />;
          })()}
        </g>

        {/* Fader track */}
        <g transform={`translate(12, ${faderY})`}>
          {/* Track background */}
          <rect x={0} y={0} width={30} height={faderTrackH} rx={4} fill="rgba(0,0,0,0.4)" stroke={aurora.glassBorder} strokeWidth={0.5} />

          {/* Aurora gradient fill from bottom */}
          <defs>
            <linearGradient id={`fader-grad-${idx}`} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor={ch.color} stopOpacity={0.6} />
              <stop offset="50%" stopColor={aurora.cyan} stopOpacity={0.3} />
              <stop offset="100%" stopColor={aurora.purple} stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <rect x={2} y={faderTrackH - faderFillH} width={26} height={faderFillH} rx={3} fill={`url(#fader-grad-${idx})`} />

          {/* dB markings */}
          {dbMarks.map((m) => (
            <g key={m.label}>
              <line x1={32} y1={m.y} x2={38} y2={m.y} stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} />
              <text x={42} y={m.y + 3} fill={aurora.textDim} fontFamily={FONT} fontSize={6} opacity={0.6}>{m.label}</text>
            </g>
          ))}

          {/* Fader thumb */}
          <rect x={-2} y={thumbY - 4} width={34} height={8} rx={2} fill="rgba(200,220,240,0.15)" stroke={ch.color} strokeWidth={1} />
          <line x1={4} y1={thumbY} x2={26} y2={thumbY} stroke={ch.color} strokeWidth={1.5} opacity={0.9} />

          {/* Current dB text */}
          <text x={15} y={faderTrackH + 14} textAnchor="middle" fill={aurora.textDim} fontFamily={FONT} fontSize={8}>
            {ch.faderDb > 0 ? '+' : ''}{ch.faderDb.toFixed(1)}
          </text>
        </g>

        {/* VU Meters */}
        <g transform={`translate(${vuX}, ${faderY})`}>
          <defs>
            <linearGradient id={`vu-grad-${idx}`} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor={aurora.green} />
              <stop offset="40%" stopColor={aurora.teal} />
              <stop offset="70%" stopColor={aurora.gold} />
              <stop offset="85%" stopColor={aurora.orange} />
              <stop offset="100%" stopColor={aurora.pink} />
            </linearGradient>
          </defs>

          {/* Left bar */}
          <rect x={0} y={0} width={vuBarW} height={vuBarH} rx={1} fill="rgba(0,0,0,0.3)" />
          <rect x={0} y={vuBarH * (1 - vuL)} width={vuBarW} height={vuBarH * vuL} rx={1} fill={`url(#vu-grad-${idx})`} opacity={0.85} />
          {/* Peak hold L */}
          <rect x={0} y={vuBarH * (1 - peak)} width={vuBarW} height={1.5} fill={aurora.pink} opacity={0.9} />

          {/* Right bar (stereo) or second mono */}
          <rect x={vuBarW + 2} y={0} width={vuBarW} height={vuBarH} rx={1} fill="rgba(0,0,0,0.3)" />
          <rect x={vuBarW + 2} y={vuBarH * (1 - vuR)} width={vuBarW} height={vuBarH * vuR} rx={1} fill={`url(#vu-grad-${idx})`} opacity={0.85} />
          {/* Peak hold R */}
          <rect x={vuBarW + 2} y={vuBarH * (1 - peak * 0.97)} width={vuBarW} height={1.5} fill={aurora.pink} opacity={0.9} />
        </g>

        {/* Mute / Solo buttons */}
        <g transform={`translate(12, ${msY})`}>
          <rect x={0} y={0} width={28} height={16} rx={3} fill={ch.mute ? 'rgba(255,50,50,0.3)' : 'rgba(255,255,255,0.04)'} stroke={ch.mute ? '#ff4444' : aurora.glassBorder} strokeWidth={0.5} />
          <text x={14} y={11} textAnchor="middle" fill={ch.mute ? '#ff6666' : aurora.textDim} fontFamily={FONT} fontSize={8} fontWeight={700}>M</text>

          <rect x={34} y={0} width={28} height={16} rx={3} fill={ch.solo ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.04)'} stroke={ch.solo ? aurora.gold : aurora.glassBorder} strokeWidth={0.5} />
          <text x={48} y={11} textAnchor="middle" fill={ch.solo ? aurora.gold : aurora.textDim} fontFamily={FONT} fontSize={8} fontWeight={700}>S</text>
          {/* Solo glow */}
          {ch.solo && (
            <rect x={34} y={0} width={28} height={16} rx={3} fill="none" stroke={aurora.gold} strokeWidth={1} opacity={0.4 + Math.sin(frame * 0.15) * 0.3}>
              <animate attributeName="opacity" values="0.2;0.6;0.2" dur="1.5s" repeatCount="indefinite" />
            </rect>
          )}
        </g>
      </g>
    );
  }

  // ── Render master channel ──────────────────────────────────────────────────
  function renderMaster(x: number) {
    const slideY = channelSlideY(8);
    const masterLevel = CHANNELS.reduce((s, c) => s + c.baseLevel, 0) / CHANNELS.length;
    const masterFader = faderPosition(8, -1.5);
    const faderTrackH = FADER_H + 40;
    const faderFillH = masterFader * faderTrackH;
    const thumbY = faderTrackH - faderFillH;
    const vuL = vuLevel(8, masterLevel);
    const vuR = vuLevel(8, masterLevel, 1.2);
    const peak = peakHold(8, masterLevel);

    // LUFS simulation
    const lufs = -14.2 + Math.sin(frame * 0.05) * 0.8;

    return (
      <g transform={`translate(${x}, ${HEADER_H + slideY})`} opacity={interpolate(slideY, [STRIP_H, STRIP_H * 0.8, 0], [0, 0.3, 1], { extrapolateRight: 'clamp' })}>
        {/* Glass panel */}
        <rect x={0} y={0} width={MASTER_W} height={STRIP_H} rx={6} fill="rgba(120,200,220,0.08)" stroke="rgba(120,200,220,0.2)" strokeWidth={1} />

        {/* Master glow border */}
        <rect x={0} y={0} width={MASTER_W} height={STRIP_H} rx={6} fill="none" stroke={aurora.cyan} strokeWidth={0.5} opacity={0.2 + Math.sin(frame * 0.08) * 0.1} />

        {/* MASTER label */}
        <defs>
          <linearGradient id="master-text-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={aurora.teal} />
            <stop offset="50%" stopColor={aurora.cyan} />
            <stop offset="100%" stopColor={aurora.purple} />
          </linearGradient>
          <filter id="master-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <text x={MASTER_W / 2} y={24} textAnchor="middle" fill="url(#master-text-grad)" fontFamily={SANS} fontSize={14} fontWeight={700} letterSpacing={4} filter="url(#master-glow)">
          MASTER
        </text>

        {/* Master fader */}
        <g transform={`translate(20, 50)`}>
          <rect x={0} y={0} width={40} height={faderTrackH} rx={5} fill="rgba(0,0,0,0.4)" stroke={aurora.glassBorder} strokeWidth={0.5} />
          <defs>
            <linearGradient id="master-fader-grad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor={aurora.teal} stopOpacity={0.7} />
              <stop offset="40%" stopColor={aurora.cyan} stopOpacity={0.4} />
              <stop offset="70%" stopColor={aurora.purple} stopOpacity={0.25} />
              <stop offset="100%" stopColor={aurora.pink} stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <rect x={3} y={faderTrackH - faderFillH} width={34} height={faderFillH} rx={4} fill="url(#master-fader-grad)" />

          {/* Thumb */}
          <rect x={-3} y={thumbY - 5} width={46} height={10} rx={3} fill="rgba(200,230,250,0.2)" stroke={aurora.cyan} strokeWidth={1.5} />
          <line x1={6} y1={thumbY} x2={34} y2={thumbY} stroke={aurora.cyan} strokeWidth={2} opacity={0.9} />

          {/* dB markings */}
          {[
            { label: '+6', y: 0 },
            { label: '0', y: faderTrackH * (6 / 54) },
            { label: '-6', y: faderTrackH * (12 / 54) },
            { label: '-12', y: faderTrackH * (18 / 54) },
            { label: '-24', y: faderTrackH * (30 / 54) },
            { label: '-48', y: faderTrackH },
          ].map((m) => (
            <g key={m.label}>
              <line x1={42} y1={m.y} x2={50} y2={m.y} stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} />
              <text x={54} y={m.y + 3} fill={aurora.textDim} fontFamily={FONT} fontSize={7} opacity={0.6}>{m.label}</text>
            </g>
          ))}

          {/* Level text */}
          <text x={20} y={faderTrackH + 18} textAnchor="middle" fill={aurora.text} fontFamily={FONT} fontSize={10} fontWeight={600}>
            -1.5 dB
          </text>
        </g>

        {/* Master VU meters */}
        <g transform={`translate(85, 50)`}>
          <defs>
            <linearGradient id="vu-master-grad" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor={aurora.green} />
              <stop offset="35%" stopColor={aurora.teal} />
              <stop offset="65%" stopColor={aurora.gold} />
              <stop offset="82%" stopColor={aurora.orange} />
              <stop offset="100%" stopColor={aurora.pink} />
            </linearGradient>
          </defs>
          {/* Left */}
          <rect x={0} y={0} width={8} height={faderTrackH} rx={2} fill="rgba(0,0,0,0.3)" />
          <rect x={0} y={faderTrackH * (1 - vuL)} width={8} height={faderTrackH * vuL} rx={2} fill="url(#vu-master-grad)" opacity={0.9} />
          <rect x={0} y={faderTrackH * (1 - peak)} width={8} height={2} fill={aurora.pink} opacity={0.9} />
          {/* Right */}
          <rect x={14} y={0} width={8} height={faderTrackH} rx={2} fill="rgba(0,0,0,0.3)" />
          <rect x={14} y={faderTrackH * (1 - vuR)} width={8} height={faderTrackH * vuR} rx={2} fill="url(#vu-master-grad)" opacity={0.9} />
          <rect x={14} y={faderTrackH * (1 - peak * 0.98)} width={8} height={2} fill={aurora.pink} opacity={0.9} />

          {/* L/R labels */}
          <text x={4} y={faderTrackH + 14} textAnchor="middle" fill={aurora.textDim} fontFamily={FONT} fontSize={7}>L</text>
          <text x={18} y={faderTrackH + 14} textAnchor="middle" fill={aurora.textDim} fontFamily={FONT} fontSize={7}>R</text>
        </g>

        {/* LUFS display */}
        <g transform={`translate(20, ${STRIP_H - 100})`}>
          <rect x={0} y={0} width={MASTER_W - 40} height={36} rx={4} fill="rgba(0,0,0,0.3)" stroke={aurora.glassBorder} strokeWidth={0.5} />
          <text x={10} y={14} fill={aurora.textDim} fontFamily={FONT} fontSize={8}>LUFS</text>
          <text x={MASTER_W - 50} y={14} textAnchor="end" fill={aurora.cyan} fontFamily={FONT} fontSize={12} fontWeight={700}>
            {lufs.toFixed(1)}
          </text>
          {/* LUFS bar */}
          <rect x={8} y={20} width={MASTER_W - 56} height={6} rx={2} fill="rgba(0,0,0,0.3)" />
          <rect x={8} y={20} width={(MASTER_W - 56) * Math.max(0, (lufs + 24) / 24)} height={6} rx={2} fill={aurora.teal} opacity={0.7} />
        </g>

        {/* Sample rate / bit depth */}
        <text x={MASTER_W / 2} y={STRIP_H - 30} textAnchor="middle" fill={aurora.textDim} fontFamily={FONT} fontSize={8} opacity={0.6}>
          48kHz / 24bit
        </text>
      </g>
    );
  }

  // ── Spectrum analyzer data ─────────────────────────────────────────────────
  const spectrumBars = 96;
  const specMaxH = SPECTRUM_H - 20;

  return (
    <AbsoluteFill style={{ backgroundColor: aurora.bg }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%">
        <defs>
          {/* Global glow filter */}
          <filter id="glow-sm">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-lg">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Spectrum gradient */}
          <linearGradient id="spectrum-grad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={aurora.teal} stopOpacity={0.8} />
            <stop offset="30%" stopColor={aurora.green} stopOpacity={0.7} />
            <stop offset="60%" stopColor={aurora.purple} stopOpacity={0.6} />
            <stop offset="100%" stopColor={aurora.pink} stopOpacity={0.5} />
          </linearGradient>

          {/* Header text gradient */}
          <linearGradient id="aurora-text-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={aurora.teal} />
            <stop offset="100%" stopColor={aurora.cyan} />
          </linearGradient>
        </defs>

        {/* ── Background aurora gradient mesh ──────────────────────────────── */}
        <g opacity={bgOpacity}>
          <rect x={0} y={0} width={W} height={H} fill={aurora.bg} />
          {orbs.map((orb, i) => {
            const dx = Math.sin(frame * orb.speed + orb.phase) * 60;
            const dy = Math.cos(frame * orb.speed * 0.7 + orb.phase) * 40;
            return (
              <ellipse
                key={i}
                cx={orb.cx + dx}
                cy={orb.cy + dy}
                rx={orb.rx}
                ry={orb.ry}
                fill={orb.color}
                opacity={0.04 + Math.sin(frame * 0.02 + i) * 0.015}
              />
            );
          })}
          {/* Subtle noise overlay */}
          <rect x={0} y={0} width={W} height={H} fill="url(#noise-pattern)" opacity={0.03} />
        </g>

        {/* ── Header strip ─────────────────────────────────────────────────── */}
        <g>
          <rect x={0} y={0} width={W} height={HEADER_H} fill="rgba(0,0,0,0.4)" />
          <line x1={0} y1={HEADER_H} x2={W} y2={HEADER_H} stroke={aurora.glassBorder} strokeWidth={0.5} />

          {/* AURORA title */}
          <text x={20} y={26} fill="url(#aurora-text-grad)" fontFamily={SANS} fontSize={18} fontWeight={800} letterSpacing={6} filter="url(#glow-sm)">
            {title}
          </text>
          <text x={140} y={27} fill={aurora.textDim} fontFamily={FONT} fontSize={10} letterSpacing={2}>MIXER</text>

          {/* BPM */}
          <text x={W - 120} y={26} fill={aurora.textDim} fontFamily={FONT} fontSize={9}>BPM</text>
          <text x={W - 90} y={26} fill={aurora.gold} fontFamily={FONT} fontSize={12} fontWeight={700}>{bpm}</text>

          {/* Transport indicators */}
          {/* Play indicator */}
          <polygon points={`${W - 50},14 ${W - 50},28 ${W - 38},21`} fill={aurora.green} opacity={0.7 + Math.sin(frame * 0.1) * 0.2} />
          {/* Recording dot */}
          <circle cx={W - 25} cy={21} r={5} fill="#ff3333" opacity={0.5 + Math.sin(frame * 0.2) * 0.3} />
        </g>

        {/* ── Channel strips ───────────────────────────────────────────────── */}
        {(() => {
          const totalChannelWidth = CHANNELS.length * CH_W + MASTER_W;
          const startX = (W - totalChannelWidth - (CHANNELS.length) * 4) / 2;
          return (
            <>
              {CHANNELS.slice(0, channelCount).map((ch, i) => renderChannel(ch, i, startX + i * (CH_W + 4)))}
              {renderMaster(startX + channelCount * (CH_W + 4) + 8)}
            </>
          );
        })()}

        {/* ── Bottom spectrum analyzer ─────────────────────────────────────── */}
        <g transform={`translate(0, ${H - SPECTRUM_H})`}>
          {/* Background */}
          <rect x={0} y={0} width={W} height={SPECTRUM_H} fill="rgba(0,0,0,0.35)" />
          <line x1={0} y1={0} x2={W} y2={0} stroke={aurora.glassBorder} strokeWidth={0.5} />

          {/* Spectrum bars */}
          {Array.from({ length: spectrumBars }, (_, i) => {
            const specAppear = interpolate(frame, [40, 55], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            const barW = (W - 80) / spectrumBars - 1;
            const x = 40 + i * ((W - 80) / spectrumBars);
            const rawH = Math.sin(frame * 0.12 + i * 0.2) * Math.exp(-i * 0.015) * specMaxH;
            const beatPulse = (beat === 0 || beat === 2) && i < 15 ? 0.3 : 0;
            const snarePulse = (beat === 1 || beat === 3) && i > 20 && i < 50 ? 0.2 : 0;
            const h = Math.max(2, (Math.abs(rawH) + beatPulse * specMaxH + snarePulse * specMaxH) * 0.6) * specAppear;

            // Color by frequency band
            const bandProgress = i / spectrumBars;
            let barColor = aurora.teal;
            if (bandProgress > 0.25) barColor = aurora.green;
            if (bandProgress > 0.5) barColor = aurora.purple;
            if (bandProgress > 0.75) barColor = aurora.pink;

            return (
              <rect
                key={i}
                x={x}
                y={SPECTRUM_H - 10 - h}
                width={barW}
                height={h}
                rx={2}
                fill={barColor}
                opacity={0.6 + bandProgress * 0.3}
              />
            );
          })}

          {/* Frequency labels */}
          {['32', '64', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'].map((label, i) => (
            <text
              key={label}
              x={40 + (i / 9) * (W - 80)}
              y={SPECTRUM_H - 2}
              fill={aurora.textDim}
              fontFamily={FONT}
              fontSize={6}
              textAnchor="middle"
              opacity={0.5}
            >
              {label}
            </text>
          ))}
        </g>
      </svg>
    </AbsoluteFill>
  );
};

export default AuroraMixer;
