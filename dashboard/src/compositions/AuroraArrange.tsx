import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from 'remotion';

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

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export interface AuroraArrangeProps {
  title?: string;
  barCount?: number;
  trackCount?: number;
}

interface Track {
  name: string;
  color: string;
  type: 'drums' | 'bass' | 'keys' | 'pad' | 'lead' | 'vocals' | 'fx' | 'master';
}

interface Clip {
  track: number;
  startBar: number;
  lengthBars: number;
  name: string;
  selected?: boolean;
}

const TRACKS: Track[] = [
  { name: 'Drums', color: aurora.orange, type: 'drums' },
  { name: 'Bass', color: aurora.teal, type: 'bass' },
  { name: 'Keys', color: aurora.purple, type: 'keys' },
  { name: 'Pad', color: aurora.pink, type: 'pad' },
  { name: 'Lead', color: aurora.cyan, type: 'lead' },
  { name: 'Vocals', color: aurora.green, type: 'vocals' },
  { name: 'FX', color: aurora.gold, type: 'fx' },
  { name: 'Master', color: '#ffffff', type: 'master' },
];

const CLIPS: Clip[] = [
  // Drums
  { track: 0, startBar: 1, lengthBars: 8, name: 'Beat A' },
  { track: 0, startBar: 9, lengthBars: 8, name: 'Beat B' },
  { track: 0, startBar: 17, lengthBars: 8, name: 'Beat A' },
  { track: 0, startBar: 25, lengthBars: 8, name: 'Fill + Beat' },
  // Bass
  { track: 1, startBar: 1, lengthBars: 8, name: 'Bass Line' },
  { track: 1, startBar: 9, lengthBars: 8, name: 'Walking' },
  { track: 1, startBar: 17, lengthBars: 8, name: 'Bass Line' },
  { track: 1, startBar: 25, lengthBars: 8, name: 'Bass Fill' },
  // Keys
  { track: 2, startBar: 5, lengthBars: 8, name: 'Chords A' },
  { track: 2, startBar: 13, lengthBars: 8, name: 'Chords B' },
  { track: 2, startBar: 21, lengthBars: 8, name: 'Chords A' },
  // Pad
  { track: 3, startBar: 1, lengthBars: 16, name: 'Atmosphere' },
  { track: 3, startBar: 17, lengthBars: 16, name: 'Atmosphere 2' },
  // Lead
  { track: 4, startBar: 17, lengthBars: 8, name: 'Hook', selected: true },
  { track: 4, startBar: 25, lengthBars: 4, name: 'Lead Fill' },
  // Vocals
  { track: 5, startBar: 9, lengthBars: 8, name: 'Verse 1' },
  { track: 5, startBar: 17, lengthBars: 8, name: 'Chorus' },
  { track: 5, startBar: 25, lengthBars: 8, name: 'Bridge' },
  // FX
  { track: 6, startBar: 8, lengthBars: 2, name: 'Riser' },
  { track: 6, startBar: 16, lengthBars: 2, name: 'Riser' },
  { track: 6, startBar: 24, lengthBars: 2, name: 'Impact' },
  { track: 6, startBar: 31, lengthBars: 2, name: 'Tail' },
];

interface SectionMarker {
  bar: number;
  label: string;
  color: string;
}

const SECTIONS: SectionMarker[] = [
  { bar: 1, label: 'INTRO', color: aurora.teal },
  { bar: 9, label: 'VERSE', color: aurora.green },
  { bar: 17, label: 'CHORUS', color: aurora.cyan },
  { bar: 25, label: 'BRIDGE', color: aurora.purple },
];

// Layout constants
const HEADER_WIDTH = 180;
const RULER_HEIGHT = 35;
const TRACK_HEIGHT = 85;
const ENERGY_HEIGHT = 50;
const GRID_LEFT = HEADER_WIDTH;
const GRID_TOP = RULER_HEIGHT;
const GRID_WIDTH = 1920 - HEADER_WIDTH;
const TOTAL_BARS = 32;

function barToX(bar: number): number {
  return GRID_LEFT + ((bar - 1) / TOTAL_BARS) * GRID_WIDTH;
}

function barsToWidth(bars: number): number {
  return (bars / TOTAL_BARS) * GRID_WIDTH;
}

function drawClipContent(
  type: Track['type'],
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  seed: number,
): React.ReactNode {
  const rng = seededRandom(seed);
  const contentY = y + 16;
  const contentH = h - 22;
  const midY = contentY + contentH / 2;

  switch (type) {
    case 'drums': {
      const beats = Math.floor(w / 8);
      const lines: React.ReactNode[] = [];
      for (let i = 0; i < beats; i++) {
        const lx = x + 6 + (i / beats) * (w - 12);
        const lh = 6 + rng() * (contentH - 10);
        const ly = contentY + (contentH - lh) / 2;
        lines.push(
          <line
            key={`d-${i}`}
            x1={lx}
            y1={ly}
            x2={lx}
            y2={ly + lh}
            stroke={hexToRgba(color, 0.4)}
            strokeWidth={1.5}
          />,
        );
      }
      return <>{lines}</>;
    }
    case 'bass':
    case 'lead': {
      const points: string[] = [];
      const steps = Math.max(Math.floor(w / 6), 8);
      for (let i = 0; i <= steps; i++) {
        const px = x + 6 + (i / steps) * (w - 12);
        const py =
          midY +
          Math.sin(i * 0.8 + seed) * (contentH * 0.3) +
          (rng() - 0.5) * (contentH * 0.2);
        points.push(`${px},${py}`);
      }
      return (
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke={hexToRgba(color, 0.45)}
          strokeWidth={1.5}
        />
      );
    }
    case 'keys': {
      const blocks: React.ReactNode[] = [];
      const numChords = Math.floor(w / 30);
      for (let i = 0; i < numChords; i++) {
        const bx = x + 6 + (i / numChords) * (w - 16);
        const bw = Math.max((w - 16) / numChords - 4, 8);
        const notesInChord = 3 + Math.floor(rng() * 2);
        for (let n = 0; n < notesInChord; n++) {
          const ny = contentY + 4 + rng() * (contentH - 12);
          blocks.push(
            <rect
              key={`k-${i}-${n}`}
              x={bx}
              y={ny}
              width={bw}
              height={3}
              rx={1}
              fill={hexToRgba(color, 0.35)}
            />,
          );
        }
      }
      return <>{blocks}</>;
    }
    case 'pad': {
      const points: string[] = [];
      const steps = Math.max(Math.floor(w / 4), 12);
      for (let i = 0; i <= steps; i++) {
        const px = x + 4 + (i / steps) * (w - 8);
        const py = midY + Math.sin(i * 0.15 + seed * 0.5) * (contentH * 0.25);
        points.push(`${px},${py}`);
      }
      return (
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke={hexToRgba(color, 0.3)}
          strokeWidth={2}
          strokeLinejoin="round"
        />
      );
    }
    case 'vocals': {
      const points: string[] = [];
      const steps = Math.max(Math.floor(w / 3), 16);
      for (let i = 0; i <= steps; i++) {
        const px = x + 4 + (i / steps) * (w - 8);
        const envelope =
          Math.sin((i / steps) * Math.PI) * 0.7 + 0.3;
        const noise = (rng() - 0.5) * 2;
        const py = midY + noise * envelope * (contentH * 0.35);
        points.push(`${px},${py}`);
      }
      return (
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke={hexToRgba(color, 0.45)}
          strokeWidth={1.2}
        />
      );
    }
    case 'fx': {
      const isTail = seed % 3 === 0;
      if (isTail) {
        // spike then decay
        return (
          <polyline
            points={`${x + 4},${midY + contentH * 0.3} ${x + w * 0.15},${midY - contentH * 0.4} ${x + w - 4},${midY + contentH * 0.1}`}
            fill="none"
            stroke={hexToRgba(color, 0.5)}
            strokeWidth={1.5}
          />
        );
      }
      // diagonal ramp
      return (
        <line
          x1={x + 4}
          y1={midY + contentH * 0.3}
          x2={x + w - 4}
          y2={midY - contentH * 0.35}
          stroke={hexToRgba(color, 0.5)}
          strokeWidth={2}
        />
      );
    }
    default:
      return null;
  }
}

export const AuroraArrange: React.FC<AuroraArrangeProps> = ({
  title = 'AURORA — ARRANGEMENT',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Background aurora orbs ──
  const auroraOrbs = useMemo(() => {
    const rng = seededRandom(42);
    return Array.from({ length: 5 }, (_, i) => ({
      cx: 200 + rng() * 1500,
      cy: 100 + rng() * 600,
      rx: 200 + rng() * 300,
      ry: 150 + rng() * 200,
      color: [aurora.teal, aurora.purple, aurora.cyan, aurora.green, aurora.pink][i],
      speedX: (rng() - 0.5) * 0.4,
      speedY: (rng() - 0.5) * 0.3,
    }));
  }, []);

  // ── Animation springs ──
  const bgFade = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const rulerSlide = spring({ frame: frame - 5, fps, config: { damping: 50, stiffness: 60, mass: 0.8 } });
  const gridFade = interpolate(frame, [30, 50], [0, 1], { extrapolateRight: 'clamp' });
  const energyReveal = interpolate(frame, [40, 60], [0, 1], { extrapolateRight: 'clamp' });

  const playheadStart = 50;
  const playheadX = frame >= playheadStart
    ? interpolate(frame, [playheadStart, 299], [barToX(1), barToX(33)], { extrapolateRight: 'clamp' })
    : barToX(1);
  const playheadOpacity = interpolate(frame, [playheadStart, playheadStart + 10], [0, 1], { extrapolateRight: 'clamp' });

  // ── Sorted clips for staggered entrance ──
  const sortedClips = useMemo(() => {
    return CLIPS.map((clip, i) => ({ ...clip, index: i }))
      .sort((a, b) => a.startBar - b.startBar || a.track - b.track);
  }, []);

  // ── Energy curve data ──
  const energyData = useMemo(() => {
    // 32 energy values: low intro, building verse, peak chorus, dip bridge
    const vals = [
      0.2, 0.22, 0.25, 0.28, 0.3, 0.33, 0.35, 0.38,    // bars 1-8: intro
      0.45, 0.5, 0.55, 0.6, 0.65, 0.68, 0.7, 0.72,      // bars 9-16: verse
      0.85, 0.9, 0.95, 1.0, 0.98, 0.95, 0.9, 0.88,      // bars 17-24: chorus peak
      0.55, 0.5, 0.48, 0.45, 0.42, 0.4, 0.35, 0.3,      // bars 25-32: bridge
    ];
    return vals;
  }, []);

  const energyTop = GRID_TOP + TRACK_HEIGHT * 8 + 8;
  const energyH = ENERGY_HEIGHT;

  function energyPath(): string {
    const points = energyData.map((v, i) => {
      const x = GRID_LEFT + ((i + 0.5) / TOTAL_BARS) * GRID_WIDTH;
      const y = energyTop + energyH - v * (energyH - 6);
      return { x, y };
    });
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx = (prev.x + curr.x) / 2;
      d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
    }
    return d;
  }

  function energyAreaPath(): string {
    const line = energyPath();
    const lastX = GRID_LEFT + GRID_WIDTH;
    return `${line} L ${lastX} ${energyTop + energyH} L ${GRID_LEFT} ${energyTop + energyH} Z`;
  }

  return (
    <AbsoluteFill style={{ backgroundColor: aurora.bg }}>
      {/* ── Background aurora orbs ── */}
      <svg
        width="1920"
        height="800"
        style={{ position: 'absolute', inset: 0, opacity: bgFade }}
      >
        <defs>
          {auroraOrbs.map((orb, i) => (
            <radialGradient key={`ag-${i}`} id={`aurora-orb-${i}`}>
              <stop offset="0%" stopColor={orb.color} stopOpacity={0.12} />
              <stop offset="60%" stopColor={orb.color} stopOpacity={0.04} />
              <stop offset="100%" stopColor={orb.color} stopOpacity={0} />
            </radialGradient>
          ))}
          {/* Playhead glow filter */}
          <filter id="playhead-glow" x="-200%" y="-10%" width="500%" height="120%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          {/* Selected clip glow */}
          <filter id="selected-glow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          {/* Aurora energy gradient */}
          <linearGradient id="energy-fill" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={aurora.teal} stopOpacity={0.2} />
            <stop offset="25%" stopColor={aurora.green} stopOpacity={0.25} />
            <stop offset="50%" stopColor={aurora.cyan} stopOpacity={0.35} />
            <stop offset="75%" stopColor={aurora.purple} stopOpacity={0.2} />
            <stop offset="100%" stopColor={aurora.pink} stopOpacity={0.15} />
          </linearGradient>
          <clipPath id="energy-clip">
            <rect
              x={GRID_LEFT}
              y={energyTop}
              width={GRID_WIDTH * energyReveal}
              height={energyH}
            />
          </clipPath>
        </defs>

        {/* Drifting aurora orbs */}
        {auroraOrbs.map((orb, i) => {
          const dx = Math.sin(frame * 0.007 + i * 1.3) * 60 * orb.speedX;
          const dy = Math.cos(frame * 0.005 + i * 0.9) * 40 * orb.speedY;
          return (
            <ellipse
              key={`orb-${i}`}
              cx={orb.cx + dx}
              cy={orb.cy + dy}
              rx={orb.rx}
              ry={orb.ry}
              fill={`url(#aurora-orb-${i})`}
            />
          );
        })}
      </svg>

      {/* ── Main SVG ── */}
      <svg
        width="1920"
        height="800"
        style={{ position: 'absolute', inset: 0 }}
      >
        {/* ── Timeline Ruler ── */}
        <g
          transform={`translate(0, ${interpolate(rulerSlide, [0, 1], [-40, 0])})`}
          opacity={rulerSlide}
        >
          {/* Ruler background */}
          <rect
            x={GRID_LEFT}
            y={0}
            width={GRID_WIDTH}
            height={RULER_HEIGHT}
            fill="rgba(13,21,32,0.8)"
          />

          {/* Bar numbers and beat ticks */}
          {Array.from({ length: TOTAL_BARS }, (_, i) => {
            const bar = i + 1;
            const x = barToX(bar);
            const barW = barsToWidth(1);
            return (
              <g key={`bar-${bar}`}>
                <text
                  x={x + barW / 2}
                  y={14}
                  textAnchor="middle"
                  fill={aurora.textDim}
                  fontSize={9}
                  fontFamily="monospace"
                >
                  {bar}
                </text>
                {/* Beat subdivision ticks */}
                {[0, 0.25, 0.5, 0.75].map((beat, bi) => (
                  <line
                    key={`tick-${bar}-${bi}`}
                    x1={x + beat * barW}
                    y1={bi === 0 ? 20 : 26}
                    x2={x + beat * barW}
                    y2={RULER_HEIGHT}
                    stroke={bi === 0 ? 'rgba(120,200,220,0.25)' : 'rgba(120,200,220,0.1)'}
                    strokeWidth={bi === 0 ? 1 : 0.5}
                  />
                ))}
              </g>
            );
          })}

          {/* Section flags */}
          {SECTIONS.map((section) => {
            const x = barToX(section.bar);
            const pulse = frame >= 50 ? 0.7 + Math.sin(frame * 0.06 + section.bar * 0.5) * 0.3 : 1;
            return (
              <g key={`section-${section.bar}`} opacity={rulerSlide * pulse}>
                {/* Flag triangle */}
                <polygon
                  points={`${x},2 ${x + 50},2 ${x + 50},18 ${x + 45},14 ${x},14`}
                  fill={hexToRgba(section.color, 0.7)}
                />
                <text
                  x={x + 6}
                  y={12}
                  fill={aurora.bg}
                  fontSize={8}
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  {section.label}
                </text>
              </g>
            );
          })}
        </g>

        {/* ── Track Headers ── */}
        {TRACKS.map((track, i) => {
          const headerSpring = spring({
            frame: frame - 10 - i * 3,
            fps,
            config: { damping: 50, stiffness: 60, mass: 0.8 },
          });
          const y = GRID_TOP + i * TRACK_HEIGHT;
          const levelWidth = 20 + seededRandom(i * 7 + 99)() * 40;

          return (
            <g
              key={`header-${i}`}
              transform={`translate(${interpolate(headerSpring, [0, 1], [-200, 0])}, 0)`}
              opacity={headerSpring}
            >
              {/* Glass background */}
              <rect
                x={0}
                y={y}
                width={HEADER_WIDTH}
                height={TRACK_HEIGHT - 2}
                rx={4}
                fill={aurora.glass}
                stroke={aurora.glassBorder}
                strokeWidth={0.5}
              />
              {/* Color left stripe */}
              <rect
                x={0}
                y={y}
                width={4}
                height={TRACK_HEIGHT - 2}
                rx={2}
                fill={track.color}
              />
              {/* Color dot */}
              <circle
                cx={20}
                cy={y + 22}
                r={5}
                fill={track.color}
              />
              {/* Track name */}
              <text
                x={32}
                y={y + 26}
                fill={aurora.text}
                fontSize={13}
                fontFamily="monospace"
                fontWeight="600"
              >
                {track.name}
              </text>
              {/* M/S buttons */}
              <rect x={32} y={y + 38} width={18} height={14} rx={2} fill="rgba(120,200,220,0.08)" stroke="rgba(120,200,220,0.15)" strokeWidth={0.5} />
              <text x={37} y={y + 49} fill={aurora.textDim} fontSize={8} fontFamily="monospace">M</text>
              <rect x={54} y={y + 38} width={18} height={14} rx={2} fill="rgba(120,200,220,0.08)" stroke="rgba(120,200,220,0.15)" strokeWidth={0.5} />
              <text x={59.5} y={y + 49} fill={aurora.textDim} fontSize={8} fontFamily="monospace">S</text>
              {/* Level indicator */}
              <rect x={32} y={y + 60} width={80} height={4} rx={2} fill="rgba(120,200,220,0.06)" />
              <rect x={32} y={y + 60} width={levelWidth} height={4} rx={2} fill={hexToRgba(track.color, 0.4)} />
            </g>
          );
        })}

        {/* ── Grid Lines ── */}
        <g opacity={gridFade}>
          {/* Horizontal track separators */}
          {Array.from({ length: 9 }, (_, i) => {
            const y = GRID_TOP + i * TRACK_HEIGHT;
            return (
              <line
                key={`h-${i}`}
                x1={GRID_LEFT}
                y1={y}
                x2={1920}
                y2={y}
                stroke="rgba(120,200,220,0.06)"
                strokeWidth={0.5}
              />
            );
          })}
          {/* Vertical bar lines */}
          {Array.from({ length: TOTAL_BARS + 1 }, (_, i) => {
            const bar = i + 1;
            const x = barToX(bar);
            const isSection = SECTIONS.some((s) => s.bar === bar);
            return (
              <line
                key={`v-${i}`}
                x1={x}
                y1={GRID_TOP}
                x2={x}
                y2={GRID_TOP + TRACK_HEIGHT * 8}
                stroke={isSection ? 'rgba(120,200,220,0.18)' : 'rgba(120,200,220,0.08)'}
                strokeWidth={isSection ? 1 : 0.5}
              />
            );
          })}
        </g>

        {/* ── Section Boundary Bands ── */}
        <g opacity={gridFade * 0.6}>
          {SECTIONS.map((section) => {
            const x = barToX(section.bar);
            return (
              <rect
                key={`band-${section.bar}`}
                x={x - 1}
                y={GRID_TOP}
                width={3}
                height={TRACK_HEIGHT * 8}
                fill={hexToRgba(section.color, 0.15)}
              />
            );
          })}
        </g>

        {/* ── Clips ── */}
        {sortedClips.map((clip, sortIdx) => {
          const track = TRACKS[clip.track];
          const clipDelay = 15 + sortIdx * 2;
          const clipSpring = spring({
            frame: frame - clipDelay,
            fps,
            config: { damping: 45, stiffness: 70, mass: 0.7 },
          });

          const x = barToX(clip.startBar);
          const y = GRID_TOP + clip.track * TRACK_HEIGHT + 3;
          const w = barsToWidth(clip.lengthBars) - 2;
          const h = TRACK_HEIGHT - 8;

          return (
            <g
              key={`clip-${clip.index}`}
              opacity={clipSpring}
              transform={`translate(${x}, ${y}) scale(${clipSpring}, 1) translate(${-x}, ${-y})`}
            >
              {/* Selected glow */}
              {clip.selected && (
                <rect
                  x={x - 2}
                  y={y - 2}
                  width={w + 4}
                  height={h + 4}
                  rx={6}
                  fill="none"
                  stroke={hexToRgba(track.color, 0.5)}
                  strokeWidth={2}
                  filter="url(#selected-glow)"
                />
              )}
              {/* Clip body */}
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                rx={4}
                fill={hexToRgba(track.color, clip.selected ? 0.22 : 0.15)}
                stroke={hexToRgba(track.color, clip.selected ? 0.5 : 0.3)}
                strokeWidth={clip.selected ? 1.5 : 0.8}
              />
              {/* Clip name */}
              <text
                x={x + 6}
                y={y + 12}
                fill={hexToRgba(track.color, 0.8)}
                fontSize={9}
                fontFamily="monospace"
                fontWeight="500"
              >
                {clip.name}
              </text>
              {/* Clip content */}
              {drawClipContent(track.type, x, y, w, h, track.color, clip.index * 17 + clip.startBar)}
            </g>
          );
        })}

        {/* ── Energy Curve ── */}
        <g clipPath="url(#energy-clip)">
          <path
            d={energyAreaPath()}
            fill="url(#energy-fill)"
          />
          <path
            d={energyPath()}
            fill="none"
            stroke={aurora.cyan}
            strokeWidth={1.5}
            opacity={0.6}
          />
        </g>

        {/* Energy baseline */}
        <line
          x1={GRID_LEFT}
          y1={energyTop + energyH}
          x2={GRID_LEFT + GRID_WIDTH}
          y2={energyTop + energyH}
          stroke="rgba(120,200,220,0.1)"
          strokeWidth={0.5}
          opacity={gridFade}
        />

        {/* ── Playhead ── */}
        {playheadOpacity > 0 && (
          <g opacity={playheadOpacity}>
            <line
              x1={playheadX}
              y1={0}
              x2={playheadX}
              y2={energyTop + energyH}
              stroke={aurora.cyan}
              strokeWidth={1.5}
              filter="url(#playhead-glow)"
            />
            {/* Playhead triangle at top */}
            <polygon
              points={`${playheadX - 5},0 ${playheadX + 5},0 ${playheadX},8`}
              fill={aurora.cyan}
            />
          </g>
        )}

        {/* ── Title ── */}
        <text
          x={14}
          y={16}
          fill={aurora.textDim}
          fontSize={10}
          fontFamily="monospace"
          letterSpacing={2}
          opacity={rulerSlide}
        >
          {title}
        </text>
      </svg>
    </AbsoluteFill>
  );
};
