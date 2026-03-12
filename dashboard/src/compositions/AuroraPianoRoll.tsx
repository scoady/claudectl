import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from 'remotion';

// Aurora palette
const aurora = {
  bg: '#0d1520',
  teal: '#2dd4bf',
  green: '#34d399',
  cyan: '#67e8f9',
  purple: '#a78bfa',
  pink: '#f472b6',
  gold: '#fbbf24',
  text: '#e2e8f0',
  textDim: '#94a3b8',
  glass: 'rgba(120,200,220,0.06)',
  glassBorder: 'rgba(120,200,220,0.12)',
};

// Deterministic pseudo-random from seed
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── Note data types ──────────────────────────────────────────────────────────

interface MidiNote {
  pitch: number;    // semitone index 0-23 (C3=0, B4=23)
  start: number;    // beat position (0-8)
  duration: number; // in beats
  velocity: number; // 0-1
}

interface NoteRow {
  name: string;
  isBlack: boolean;
  pitch: number;
}

// ── Props ────────────────────────────────────────────────────────────────────

export interface AuroraPianoRollProps {
  title?: string;
  currentChord?: string;
  chordQuality?: string;
  musicalKey?: string;
  bpm?: number;
  progression?: string[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const W = 1920;
const H = 800;
const PIANO_X = 60;
const PIANO_W = 30;
const ROLL_X = PIANO_X + PIANO_W;
const ROLL_W = W * 0.6 - ROLL_X;
const ROLL_Y = 30;
const ROLL_H = H - 90 - 60; // leave room for title strip + spectrum
const BEATS = 8;
const KEYS = 24;
const KEY_H = ROLL_H / KEYS;
const BEAT_W = ROLL_W / BEATS;
const SPECTRUM_H = 50;

const CIRCLE_R = 115;

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const CIRCLE_KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];
const MINOR_KEYS  = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'Bbm', 'Fm', 'Cm', 'Gm', 'Dm'];

const DEFAULT_PROGRESSION = ['Em9', 'Am7', 'D7', 'Gmaj7', 'Cmaj9', 'F#\u00F87', 'B7'];

// Build the 24-key layout (C3 at bottom, B4 at top)
function buildKeyboard(): NoteRow[] {
  const rows: NoteRow[] = [];
  for (let octave = 3; octave <= 4; octave++) {
    for (let n = 0; n < 12; n++) {
      const name = `${NOTE_NAMES[n]}${octave}`;
      const isBlack = [1, 3, 6, 8, 10].includes(n);
      rows.push({ name, isBlack, pitch: (octave - 3) * 12 + n });
    }
  }
  return rows.reverse(); // top = B4, bottom = C3
}

// Generate musical MIDI notes: Em chord voicings + melody
function generateNotes(rand: () => number): MidiNote[] {
  const notes: MidiNote[] = [];

  // Em chord tones: E3(4), G3(7), B3(11), D4(14), F#4(18)
  const chordTones = [4, 7, 11, 14, 18];
  // Strum pattern across beats
  chordTones.forEach((pitch, i) => {
    notes.push({ pitch, start: 0.0 + i * 0.12, duration: 2.5, velocity: 0.7 + rand() * 0.2 });
    notes.push({ pitch, start: 3.0 + i * 0.1, duration: 2.0, velocity: 0.6 + rand() * 0.2 });
  });

  // Melody line over the top
  const melody: [number, number, number][] = [
    [18, 0.5, 0.8], [19, 1.5, 0.5], [21, 2.0, 1.0], [23, 3.5, 0.6],
    [21, 4.2, 0.7], [19, 5.0, 0.9], [18, 5.8, 0.5], [16, 6.5, 1.2],
    [14, 7.2, 0.6],
  ];
  melody.forEach(([pitch, start, dur]) => {
    notes.push({ pitch, start, duration: dur, velocity: 0.85 + rand() * 0.15 });
  });

  // Bass notes
  const bass: [number, number, number][] = [
    [4, 0, 1.8], [0, 2.0, 1.5], [4, 4.0, 1.8], [7, 6.0, 1.5],
  ];
  bass.forEach(([pitch, start, dur]) => {
    notes.push({ pitch, start, duration: dur, velocity: 0.5 + rand() * 0.15 });
  });

  return notes;
}

// Velocity to color
function velocityColor(v: number): string {
  if (v >= 0.85) return aurora.pink;
  if (v >= 0.7) return aurora.cyan;
  if (v >= 0.5) return aurora.green;
  return aurora.teal;
}

// SVG arc path helper for circle of fifths
function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);
  const large = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

// ── Component ────────────────────────────────────────────────────────────────

export const AuroraPianoRoll: React.FC<AuroraPianoRollProps> = ({
  title = 'AURORA DAW',
  currentChord = 'Em9',
  chordQuality = 'minor ninth',
  musicalKey = 'Em',
  bpm = 92,
  progression,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const prog = progression || DEFAULT_PROGRESSION;

  const keyboard = useMemo(() => buildKeyboard(), []);
  const midiNotes = useMemo(() => generateNotes(seededRandom(137)), []);

  // ── Entrance springs ────────────────────────────────────────────────────

  const bgEntrance = spring({ frame, fps, config: { damping: 80, stiffness: 30 } });

  const gridEntrance = spring({
    frame: frame - 10,
    fps,
    config: { damping: 60, stiffness: 40 },
  });

  const chordEntrance = spring({
    frame: frame - 30,
    fps,
    config: { damping: 50, stiffness: 50, mass: 0.8 },
  });

  const circleEntrance = spring({
    frame: frame - 40,
    fps,
    config: { damping: 70, stiffness: 35 },
  });

  const spectrumEntrance = spring({
    frame: frame - 50,
    fps,
    config: { damping: 60, stiffness: 45 },
  });

  // Active chord index cycles every 40 frames
  const activeChordIdx = Math.floor(frame / 40) % prog.length;

  // Playhead position (starts at frame 50)
  const playheadProgress = frame > 50
    ? interpolate(frame, [50, 290], [0, 1], { extrapolateRight: 'clamp' })
    : 0;
  const playheadX = ROLL_X + playheadProgress * ROLL_W;

  // Chord glow pulse
  const chordGlow = Math.sin(frame * 0.06) * 8 + 16;

  return (
    <AbsoluteFill>
      {/* ── SVG Filters ─────────────────────────────────────────────────── */}
      <svg width={0} height={0} style={{ position: 'absolute' }}>
        <defs>
          <filter id="aur-glow-teal" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="aur-glow-soft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="aur-glow-strong" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="aur-glow-note" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="aur-glow-text" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={chordGlow} result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
      </svg>

      {/* ── Background ──────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: aurora.bg,
          opacity: bgEntrance,
        }}
      />

      {/* Aurora gradient orbs — drifting via sine/cos */}
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0, opacity: bgEntrance }}>
        <defs>
          <radialGradient id="aur-orb1" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={aurora.teal} stopOpacity={0.15} />
            <stop offset="100%" stopColor={aurora.teal} stopOpacity={0} />
          </radialGradient>
          <radialGradient id="aur-orb2" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={aurora.purple} stopOpacity={0.12} />
            <stop offset="100%" stopColor={aurora.purple} stopOpacity={0} />
          </radialGradient>
          <radialGradient id="aur-orb3" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={aurora.cyan} stopOpacity={0.1} />
            <stop offset="100%" stopColor={aurora.cyan} stopOpacity={0} />
          </radialGradient>
          <radialGradient id="aur-orb4" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={aurora.pink} stopOpacity={0.08} />
            <stop offset="100%" stopColor={aurora.pink} stopOpacity={0} />
          </radialGradient>
        </defs>

        {/* Orb 1 — top-left teal */}
        <circle
          cx={300 + Math.sin(frame * 0.008) * 80}
          cy={200 + Math.cos(frame * 0.006) * 60}
          r={320}
          fill="url(#aur-orb1)"
        />
        {/* Orb 2 — center-right purple */}
        <circle
          cx={1400 + Math.cos(frame * 0.007) * 70}
          cy={350 + Math.sin(frame * 0.009) * 50}
          r={380}
          fill="url(#aur-orb2)"
        />
        {/* Orb 3 — bottom-left cyan */}
        <circle
          cx={500 + Math.sin(frame * 0.01 + 1) * 60}
          cy={600 + Math.cos(frame * 0.008 + 2) * 40}
          r={280}
          fill="url(#aur-orb3)"
        />
        {/* Orb 4 — top-right pink */}
        <circle
          cx={1600 + Math.cos(frame * 0.006 + 3) * 50}
          cy={150 + Math.sin(frame * 0.01 + 1) * 45}
          r={250}
          fill="url(#aur-orb4)"
        />
      </svg>

      {/* ── Piano Roll Section (left 60%) ───────────────────────────────── */}
      <svg
        width={W * 0.6 + 20}
        height={H}
        style={{ position: 'absolute', left: 0, top: 0 }}
      >
        {/* Title strip */}
        <text
          x={PIANO_X}
          y={22}
          fill={aurora.cyan}
          fontSize={13}
          fontFamily="'Inter', sans-serif"
          fontWeight={600}
          letterSpacing="0.2em"
          opacity={interpolate(frame, [0, 30], [0, 0.9], { extrapolateRight: 'clamp' })}
        >
          {title}
        </text>
        <text
          x={PIANO_X + 160}
          y={22}
          fill={aurora.textDim}
          fontSize={11}
          fontFamily="'JetBrains Mono', monospace"
          opacity={interpolate(frame, [0, 30], [0, 0.6], { extrapolateRight: 'clamp' })}
        >
          {bpm} BPM &middot; {musicalKey}
        </text>

        {/* Clip the grid entrance */}
        <defs>
          <clipPath id="aur-roll-clip">
            <rect
              x={PIANO_X}
              y={ROLL_Y}
              width={(PIANO_W + ROLL_W) * gridEntrance}
              height={ROLL_H}
            />
          </clipPath>
        </defs>

        <g clipPath="url(#aur-roll-clip)">
          {/* Piano keyboard */}
          {keyboard.map((key, i) => {
            const y = ROLL_Y + i * KEY_H;
            return (
              <g key={key.name}>
                <rect
                  x={PIANO_X}
                  y={y}
                  width={key.isBlack ? 20 : PIANO_W}
                  height={KEY_H - 1}
                  fill={key.isBlack ? 'rgba(10,15,25,0.8)' : 'rgba(200,220,230,0.1)'}
                  stroke={aurora.glassBorder}
                  strokeWidth={0.5}
                  rx={1}
                />
                {!key.isBlack && (
                  <text
                    x={PIANO_X - 4}
                    y={y + KEY_H * 0.65}
                    textAnchor="end"
                    fill={aurora.textDim}
                    fontSize={8}
                    fontFamily="'JetBrains Mono', monospace"
                    opacity={0.5}
                  >
                    {key.name}
                  </text>
                )}
              </g>
            );
          })}

          {/* Grid lines */}
          {/* Horizontal — note rows */}
          {keyboard.map((_, i) => (
            <line
              key={`hr-${i}`}
              x1={ROLL_X}
              y1={ROLL_Y + i * KEY_H}
              x2={ROLL_X + ROLL_W}
              y2={ROLL_Y + i * KEY_H}
              stroke={aurora.glassBorder}
              strokeWidth={0.4}
            />
          ))}
          {/* Vertical — beat lines */}
          {Array.from({ length: BEATS + 1 }, (_, i) => (
            <line
              key={`vb-${i}`}
              x1={ROLL_X + i * BEAT_W}
              y1={ROLL_Y}
              x2={ROLL_X + i * BEAT_W}
              y2={ROLL_Y + ROLL_H}
              stroke={i % 4 === 0 ? 'rgba(120,200,220,0.2)' : aurora.glassBorder}
              strokeWidth={i % 4 === 0 ? 1 : 0.4}
            />
          ))}
          {/* Sub-beat lines (16ths) */}
          {Array.from({ length: BEATS * 4 }, (_, i) => {
            if (i % 4 === 0) return null;
            const x = ROLL_X + (i / 4) * BEAT_W;
            return (
              <line
                key={`sb-${i}`}
                x1={x} y1={ROLL_Y} x2={x} y2={ROLL_Y + ROLL_H}
                stroke="rgba(120,200,220,0.04)"
                strokeWidth={0.3}
              />
            );
          })}

          {/* MIDI notes with staggered entrance */}
          {midiNotes.map((note, i) => {
            // Row index — reversed because keyboard is top=B4
            const rowIdx = KEYS - 1 - note.pitch;
            if (rowIdx < 0 || rowIdx >= KEYS) return null;

            const noteY = ROLL_Y + rowIdx * KEY_H + 1;
            const noteX = ROLL_X + note.start * BEAT_W;
            const noteW = note.duration * BEAT_W - 2;
            const noteH = KEY_H - 2;

            // Stagger entrance — each note slides in from right
            const entranceFrame = 20 + i * 2;
            const slideIn = spring({
              frame: frame - entranceFrame,
              fps,
              config: { damping: 40, stiffness: 60, mass: 0.6 },
            });
            const animX = interpolate(slideIn, [0, 1], [noteX + 200, noteX]);
            const noteOpacity = interpolate(slideIn, [0, 1], [0, 1]);

            const color = velocityColor(note.velocity);
            const opacityMul = note.velocity < 0.5 ? 0.5 : note.velocity < 0.7 ? 0.8 : 1.0;

            return (
              <g key={`note-${i}`} opacity={noteOpacity * opacityMul}>
                {/* Note glow */}
                <rect
                  x={animX - 2}
                  y={noteY - 1}
                  width={noteW + 4}
                  height={noteH + 2}
                  rx={3}
                  fill={color}
                  opacity={0.2}
                  filter="url(#aur-glow-note)"
                />
                {/* Note body */}
                <rect
                  x={animX}
                  y={noteY}
                  width={noteW}
                  height={noteH}
                  rx={2}
                  fill={color}
                  opacity={0.85}
                />
                {/* Highlight edge */}
                <rect
                  x={animX}
                  y={noteY}
                  width={3}
                  height={noteH}
                  rx={1}
                  fill="#ffffff"
                  opacity={0.4}
                />
              </g>
            );
          })}

          {/* Playhead */}
          {frame > 50 && (
            <g>
              <line
                x1={playheadX}
                y1={ROLL_Y}
                x2={playheadX}
                y2={ROLL_Y + ROLL_H}
                stroke={aurora.cyan}
                strokeWidth={2}
                filter="url(#aur-glow-teal)"
                opacity={0.9}
              />
              {/* Playhead top triangle */}
              <polygon
                points={`${playheadX - 5},${ROLL_Y} ${playheadX + 5},${ROLL_Y} ${playheadX},${ROLL_Y + 8}`}
                fill={aurora.cyan}
                opacity={0.8}
              />
            </g>
          )}
        </g>
      </svg>

      {/* ── Chord Display (right 40%, top half) ─────────────────────────── */}
      <svg
        width={W * 0.4}
        height={H * 0.5}
        viewBox={`0 0 ${W * 0.4} ${H * 0.5}`}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          opacity: chordEntrance,
          transform: `scale(${interpolate(chordEntrance, [0, 1], [0.9, 1])})`,
          transformOrigin: 'center center',
        }}
      >
        {/* Large chord name with aurora glow */}
        <text
          x={W * 0.2}
          y={120}
          textAnchor="middle"
          fill={aurora.cyan}
          fontSize={80}
          fontFamily="'Inter', sans-serif"
          fontWeight={700}
          filter="url(#aur-glow-text)"
        >
          {prog[activeChordIdx] || currentChord}
        </text>
        <text
          x={W * 0.2}
          y={155}
          textAnchor="middle"
          fill={aurora.textDim}
          fontSize={16}
          fontFamily="'Inter', sans-serif"
          fontWeight={300}
          letterSpacing="0.15em"
        >
          {chordQuality}
        </text>

        {/* Mini keyboard showing chord tones */}
        {(() => {
          const kbX = W * 0.2 - 105;
          const kbY = 180;
          const kw = 14;
          const kh = 50;
          const bkh = 30;
          // Chord tones for Em9: E, G, B, D, F#
          const chordPitches = new Set([4, 7, 11, 2, 6]); // mod 12
          const whiteKeys = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B
          const blackKeys = [1, 3, 6, 8, 10];        // C# D# F# G# A#
          const blackOffsets: Record<number, number> = {
            1: 0.7, 3: 1.7, 6: 3.7, 8: 4.7, 10: 5.7,
          };

          return (
            <g>
              {/* White keys */}
              {whiteKeys.map((pitch, wi) => (
                <rect
                  key={`mk-w-${pitch}`}
                  x={kbX + wi * kw}
                  y={kbY}
                  width={kw - 1}
                  height={kh}
                  rx={1}
                  fill={chordPitches.has(pitch) ? aurora.teal : 'rgba(200,220,230,0.12)'}
                  opacity={chordPitches.has(pitch) ? 0.9 : 0.5}
                  stroke={aurora.glassBorder}
                  strokeWidth={0.5}
                />
              ))}
              {/* Black keys */}
              {blackKeys.map((pitch) => {
                const bx = kbX + blackOffsets[pitch] * kw;
                return (
                  <rect
                    key={`mk-b-${pitch}`}
                    x={bx}
                    y={kbY}
                    width={kw * 0.65}
                    height={bkh}
                    rx={1}
                    fill={chordPitches.has(pitch) ? aurora.purple : 'rgba(10,15,25,0.85)'}
                    opacity={chordPitches.has(pitch) ? 0.9 : 0.8}
                    stroke={aurora.glassBorder}
                    strokeWidth={0.5}
                  />
                );
              })}
            </g>
          );
        })()}

        {/* Chord progression pills */}
        <g transform={`translate(${W * 0.2 - (prog.length * 52) / 2}, 260)`}>
          {prog.map((chord, ci) => {
            const isActive = ci === activeChordIdx;
            const pillX = ci * 52;
            const glowOp = isActive
              ? interpolate(Math.sin(frame * 0.1), [-1, 1], [0.6, 1])
              : 0.3;
            return (
              <g key={`prog-${ci}`}>
                {isActive && (
                  <rect
                    x={pillX - 2}
                    y={-2}
                    width={48}
                    height={28}
                    rx={6}
                    fill={aurora.cyan}
                    opacity={0.15}
                    filter="url(#aur-glow-soft)"
                  />
                )}
                <rect
                  x={pillX}
                  y={0}
                  width={44}
                  height={24}
                  rx={5}
                  fill={isActive ? 'rgba(45,212,191,0.2)' : aurora.glass}
                  stroke={isActive ? aurora.teal : aurora.glassBorder}
                  strokeWidth={isActive ? 1.5 : 0.8}
                  opacity={glowOp + 0.3}
                />
                <text
                  x={pillX + 22}
                  y={16}
                  textAnchor="middle"
                  fill={isActive ? aurora.cyan : aurora.textDim}
                  fontSize={10}
                  fontFamily="'JetBrains Mono', monospace"
                  fontWeight={isActive ? 700 : 400}
                >
                  {chord}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* ── Circle of Fifths (right 40%, bottom half) ───────────────────── */}
      <svg
        width={W * 0.4}
        height={H * 0.5 + 20}
        viewBox={`0 0 ${W * 0.4} ${H * 0.5 + 20}`}
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          opacity: circleEntrance,
        }}
      >
        {/* Center the circle within this viewport */}
        {(() => {
          const cx = W * 0.2;
          const cy = H * 0.25 + 10;
          const outerR = CIRCLE_R;
          const innerR = outerR * 0.65;
          const segAngle = (2 * Math.PI) / 12;

          // Highlighted keys for Em: E and relative major G
          const highlightKeys = new Set(['E', 'G']);
          const highlightMinor = new Set(['Em']);

          return (
            <g>
              {/* Outer ring segments */}
              {CIRCLE_KEYS.map((key, ki) => {
                const startAngle = -Math.PI / 2 + ki * segAngle - segAngle / 2;
                const endAngle = startAngle + segAngle;
                const isHighlight = highlightKeys.has(key);
                const pulse = isHighlight
                  ? interpolate(Math.sin(frame * 0.05 + ki), [-1, 1], [0.5, 1])
                  : 0.3;

                // Stroke-dasharray animation for draw-in
                const circumSlice = outerR * segAngle;
                const dashLen = circumSlice * circleEntrance;

                // Label position
                const labelAngle = -Math.PI / 2 + ki * segAngle;
                const labelR = outerR * 0.83;
                const lx = cx + labelR * Math.cos(labelAngle);
                const ly = cy + labelR * Math.sin(labelAngle);

                return (
                  <g key={`cof-${ki}`}>
                    <path
                      d={arcPath(cx, cy, outerR, startAngle, endAngle)}
                      fill={isHighlight ? 'rgba(45,212,191,0.15)' : aurora.glass}
                      stroke={isHighlight ? aurora.teal : aurora.glassBorder}
                      strokeWidth={isHighlight ? 2 : 0.8}
                      opacity={pulse}
                      strokeDasharray={`${dashLen} ${circumSlice}`}
                    />
                    {isHighlight && (
                      <path
                        d={arcPath(cx, cy, outerR, startAngle, endAngle)}
                        fill="none"
                        stroke={aurora.cyan}
                        strokeWidth={3}
                        opacity={pulse * 0.4}
                        filter="url(#aur-glow-soft)"
                      />
                    )}
                    <text
                      x={lx}
                      y={ly + 4}
                      textAnchor="middle"
                      fill={isHighlight ? aurora.cyan : aurora.text}
                      fontSize={isHighlight ? 14 : 12}
                      fontFamily="'Inter', sans-serif"
                      fontWeight={isHighlight ? 700 : 400}
                      opacity={circleEntrance}
                    >
                      {key}
                    </text>
                  </g>
                );
              })}

              {/* Inner ring — minor keys */}
              {MINOR_KEYS.map((key, ki) => {
                const labelAngle = -Math.PI / 2 + ki * segAngle;
                const lx = cx + innerR * 0.75 * Math.cos(labelAngle);
                const ly = cy + innerR * 0.75 * Math.sin(labelAngle);
                const isHL = highlightMinor.has(key);

                return (
                  <text
                    key={`cof-m-${ki}`}
                    x={lx}
                    y={ly + 3}
                    textAnchor="middle"
                    fill={isHL ? aurora.purple : aurora.textDim}
                    fontSize={isHL ? 11 : 9}
                    fontFamily="'Inter', sans-serif"
                    fontWeight={isHL ? 600 : 300}
                    opacity={circleEntrance * (isHL ? 0.9 : 0.5)}
                  >
                    {key}
                  </text>
                );
              })}

              {/* Inner circle border */}
              <circle
                cx={cx}
                cy={cy}
                r={innerR}
                fill="none"
                stroke={aurora.glassBorder}
                strokeWidth={0.6}
                opacity={circleEntrance * 0.5}
              />
              {/* Outer circle border */}
              <circle
                cx={cx}
                cy={cy}
                r={outerR}
                fill="none"
                stroke={aurora.glassBorder}
                strokeWidth={0.8}
                opacity={circleEntrance * 0.6}
              />
            </g>
          );
        })()}
      </svg>

      {/* ── Spectrum Analyzer (bottom strip) ────────────────────────────── */}
      <svg
        width={W}
        height={SPECTRUM_H + 10}
        style={{
          position: 'absolute',
          left: 0,
          bottom: 0,
          opacity: spectrumEntrance,
        }}
      >
        <defs>
          <linearGradient id="aur-spec-grad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={aurora.teal} stopOpacity={0.8} />
            <stop offset="50%" stopColor={aurora.green} stopOpacity={0.6} />
            <stop offset="100%" stopColor={aurora.purple} stopOpacity={0.9} />
          </linearGradient>
        </defs>

        {Array.from({ length: 48 }, (_, i) => {
          const freq = 0.3 + i * 0.15;
          const amplitude = Math.sin(frame * 0.1 + i * freq) * 0.5 + 0.5;
          const secondHarmonic = Math.sin(frame * 0.07 + i * 0.4) * 0.2;
          const height = (amplitude + secondHarmonic) * SPECTRUM_H * 0.8;
          const barW = (W - 48) / 48;
          const x = i * (barW + 1);

          return (
            <rect
              key={`spec-${i}`}
              x={x}
              y={SPECTRUM_H - height + 5}
              width={barW}
              height={Math.max(2, height)}
              rx={1}
              fill="url(#aur-spec-grad)"
              opacity={0.6 + amplitude * 0.3}
            />
          );
        })}

        {/* Subtle glow line at top of spectrum */}
        <line
          x1={0} y1={5} x2={W} y2={5}
          stroke={aurora.teal}
          strokeWidth={0.5}
          opacity={0.2}
        />
      </svg>

      {/* ── Glass overlay panel borders ─────────────────────────────────── */}
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {/* Piano roll panel border */}
        <rect
          x={PIANO_X - 5}
          y={ROLL_Y - 5}
          width={ROLL_W + PIANO_W + 10}
          height={ROLL_H + 10}
          rx={6}
          fill="none"
          stroke={aurora.glassBorder}
          strokeWidth={0.8}
          opacity={gridEntrance * 0.6}
        />
        {/* Chord panel border */}
        <rect
          x={W * 0.62}
          y={10}
          width={W * 0.36}
          height={H * 0.44}
          rx={6}
          fill="none"
          stroke={aurora.glassBorder}
          strokeWidth={0.6}
          opacity={chordEntrance * 0.4}
        />
        {/* Circle of fifths panel border */}
        <rect
          x={W * 0.62}
          y={H * 0.47}
          width={W * 0.36}
          height={H * 0.42}
          rx={6}
          fill="none"
          stroke={aurora.glassBorder}
          strokeWidth={0.6}
          opacity={circleEntrance * 0.4}
        />
      </svg>
    </AbsoluteFill>
  );
};
