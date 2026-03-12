import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from 'remotion';
import { hexToRgb } from './theme';

// ── Deterministic random ─────────────────────────────────────────────────────

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── Deep Ocean Palette ───────────────────────────────────────────────────────

const ocean = {
  abyss: '#050520',
  deep: '#0a1628',
  bioCyan: '#00FFE5',
  jellyPurple: '#9C27B0',
  anglerGold: '#FFD700',
  coralPink: '#FF6B6B',
  planktonGreen: '#69F0AE',
  pressureBlue: '#1A237E',
  cableCopper: '#B87333',
  ventOrange: '#FF6D00',
  marineWhite: '#d0e8ff',
};

// ── Types ────────────────────────────────────────────────────────────────────

interface CreatureDef {
  id: string;
  label: string;
  sublabel: string;
  x: number;
  y: number;
  color: string;
  icon: string;
  size: number;
  enterDelay: number;
  creature: 'kraken' | 'vent' | 'jellyfish' | 'anglerfish' | 'buoy' | 'chest' | 'bathysphere';
}

interface CableDef {
  from: string;
  to: string;
  label?: string;
  color: string;
  enterDelay: number;
  thick?: boolean;
}

// ── Deep Ocean Bioluminescent Ecosystem ──────────────────────────────────────

export const DeepOcean: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const cx = width / 2;
  const cy = height / 2;

  // ── Marine snow (particles drifting DOWN) ─────────────────────────────────

  const marineSnow = useMemo(() => {
    const rng = seededRandom(77);
    return Array.from({ length: 100 }, () => ({
      x: rng() * width,
      y: rng() * height,
      size: rng() * 1.2 + 0.3,
      speed: rng() * 0.25 + 0.08,
      drift: (rng() - 0.5) * 0.1,
      opacity: rng() * 0.25 + 0.05,
    }));
  }, [width, height]);

  // ── Bubble streams ────────────────────────────────────────────────────────

  const bubbleStreams = useMemo(() => {
    const rng = seededRandom(33);
    return Array.from({ length: 40 }, () => ({
      baseX: rng() * width,
      size: rng() * 3 + 1,
      speed: rng() * 0.8 + 0.3,
      wobble: rng() * 8 + 2,
      wobbleSpeed: rng() * 0.06 + 0.02,
      phase: rng() * Math.PI * 2,
      opacity: rng() * 0.2 + 0.05,
    }));
  }, [width]);

  // ── Plankton clouds ───────────────────────────────────────────────────────

  const planktonClouds = useMemo(() => {
    const rng = seededRandom(99);
    return Array.from({ length: 60 }, () => ({
      x: rng() * width,
      y: rng() * height,
      size: rng() * 1.5 + 0.5,
      orbitR: rng() * 15 + 5,
      orbitSpeed: (rng() - 0.5) * 0.04,
      phase: rng() * Math.PI * 2,
      opacity: rng() * 0.3 + 0.1,
    }));
  }, [width, height]);

  // ── Creature (node) definitions ───────────────────────────────────────────

  const creatures: CreatureDef[] = [
    // Center: The Kraken (c9-operator)
    {
      id: 'operator', label: 'c9-operator', sublabel: 'Abyssal Core',
      x: cx, y: cy - 10, color: ocean.bioCyan, icon: '\u{1F419}',
      size: 90, enterDelay: 0, creature: 'kraken',
    },
    // Left: Hydrothermal Vent (Broker)
    {
      id: 'broker', label: 'Broker', sublabel: 'Hydrothermal Vent',
      x: cx - 290, y: cy + 20, color: ocean.ventOrange, icon: '\u{1F30B}',
      size: 58, enterDelay: 10, creature: 'vent',
    },
    // Right: Jellyfish Colony (Hub)
    {
      id: 'hub', label: 'Hub', sublabel: 'Jellyfish Colony',
      x: cx + 290, y: cy - 30, color: ocean.jellyPurple, icon: '\u{1FAB8}',
      size: 58, enterDelay: 10, creature: 'jellyfish',
    },
    // Bottom: Anglerfish Agents
    {
      id: 'agent1', label: 'Agent \u03B1', sublabel: 'Anglerfish',
      x: cx - 250, y: cy + 210, color: ocean.anglerGold, icon: '\u{1F41F}',
      size: 46, enterDelay: 20, creature: 'anglerfish',
    },
    {
      id: 'agent2', label: 'Agent \u03B2', sublabel: 'Anglerfish',
      x: cx - 70, y: cy + 230, color: ocean.anglerGold, icon: '\u{1F41F}',
      size: 46, enterDelay: 25, creature: 'anglerfish',
    },
    {
      id: 'agent3', label: 'Agent \u03B3', sublabel: 'Anglerfish',
      x: cx + 110, y: cy + 210, color: ocean.anglerGold, icon: '\u{1F41F}',
      size: 46, enterDelay: 30, creature: 'anglerfish',
    },
    {
      id: 'agent4', label: 'Agent \u03B4', sublabel: 'Deep Lurker',
      x: cx + 290, y: cy + 230, color: ocean.coralPink, icon: '\u{1F41F}',
      size: 42, enterDelay: 50, creature: 'anglerfish',
    },
    // Top: Surface Buoy (API Gateway)
    {
      id: 'api', label: 'API Gateway', sublabel: 'Surface Buoy',
      x: cx, y: 80, color: ocean.marineWhite, icon: '\u{1F6DF}',
      size: 52, enterDelay: 5, creature: 'buoy',
    },
    // Bottom-left: Treasure Chests (Projects)
    {
      id: 'projects', label: 'Projects', sublabel: 'Sunken Cargo',
      x: cx - 340, y: height - 110, color: ocean.cableCopper, icon: '\u{1F4E6}',
      size: 46, enterDelay: 15, creature: 'chest',
    },
    // Top-right: Bathysphere (Dashboard)
    {
      id: 'dashboard', label: 'Dashboard', sublabel: 'Bathysphere',
      x: cx + 340, y: 90, color: ocean.planktonGreen, icon: '\u{1F52D}',
      size: 46, enterDelay: 15, creature: 'bathysphere',
    },
  ];

  const creatureMap = Object.fromEntries(creatures.map((c) => [c.id, c]));

  // ── Cable (edge) definitions ──────────────────────────────────────────────

  const cables: CableDef[] = [
    { from: 'api', to: 'operator', label: 'descent', color: ocean.bioCyan, enterDelay: 8, thick: true },
    { from: 'operator', to: 'broker', label: 'tentacle', color: ocean.ventOrange, enterDelay: 12, thick: true },
    { from: 'operator', to: 'hub', label: 'signal', color: ocean.jellyPurple, enterDelay: 12, thick: true },
    { from: 'broker', to: 'agent1', color: ocean.anglerGold, enterDelay: 22 },
    { from: 'broker', to: 'agent2', color: ocean.anglerGold, enterDelay: 27 },
    { from: 'broker', to: 'agent3', color: ocean.anglerGold, enterDelay: 32 },
    { from: 'agent1', to: 'operator', label: 'spawn', color: ocean.coralPink, enterDelay: 45 },
    { from: 'broker', to: 'agent4', color: ocean.coralPink, enterDelay: 52 },
    { from: 'hub', to: 'dashboard', label: 'stream', color: ocean.planktonGreen, enterDelay: 16 },
    { from: 'projects', to: 'api', label: 'data', color: ocean.cableCopper, enterDelay: 18 },
    { from: 'agent2', to: 'hub', color: ocean.anglerGold, enterDelay: 35 },
  ];

  // ── Depth indicator ───────────────────────────────────────────────────────

  const depthZones = [
    { y: 60, label: '200m  EPIPELAGIC', opacity: 0.2 },
    { y: height * 0.3, label: '1000m  MESOPELAGIC', opacity: 0.15 },
    { y: height * 0.55, label: '4000m  BATHYPELAGIC', opacity: 0.12 },
    { y: height * 0.8, label: '6000m  ABYSSOPELAGIC', opacity: 0.1 },
  ];

  // ── Animation values ──────────────────────────────────────────────────────

  const globalFade = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: 'clamp' });
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [0, 20], [12, 0], { extrapolateRight: 'clamp' });
  const legendOpacity = interpolate(frame, [40, 55], [0, 1], { extrapolateRight: 'clamp' });

  // Bioluminescent pulse wave from center
  const pulseWaveR = interpolate(frame % 120, [0, 120], [0, 500], { extrapolateRight: 'clamp' });
  const pulseWaveOpacity = interpolate(frame % 120, [0, 30, 120], [0.15, 0.08, 0], { extrapolateRight: 'clamp' });

  // ── Render: Tentacle cables (organic bezier paths) ────────────────────────

  const renderCable = (cable: CableDef, i: number) => {
    const from = creatureMap[cable.from];
    const to = creatureMap[cable.to];
    if (!from || !to) return null;

    const progress = interpolate(frame, [cable.enterDelay, cable.enterDelay + 25], [0, 1], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });
    if (progress <= 0) return null;

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const nx = dx / dist;
    const ny = dy / dist;

    const fromR = from.size / 2 + 6;
    const toR = to.size / 2 + 6;
    const x1 = from.x + nx * fromR;
    const y1 = from.y + ny * fromR;
    const x2 = from.x + dx - nx * toR;
    const y2 = from.y + dy - ny * toR;

    // Sine-modulated control points for organic tentacle wave
    const wave = Math.sin(frame * 0.04 + i * 1.2) * 20;
    const perpX = -ny;
    const perpY = nx;
    const cp1x = x1 + dx * 0.3 + perpX * wave;
    const cp1y = y1 + dy * 0.3 + perpY * wave;
    const cp2x = x1 + dx * 0.7 - perpX * wave * 0.6;
    const cp2y = y1 + dy * 0.7 - perpY * wave * 0.6;

    const pathD = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;

    // Signal pulse traveling along cable
    const signalT = ((frame - cable.enterDelay) % 80) / 80;
    const sigX = interpolate(signalT, [0, 1], [x1, x2]);
    const sigY = interpolate(signalT, [0, 1], [y1, y2]);

    const strokeW = cable.thick ? 2.5 : 1.5;
    const rgb = hexToRgb(cable.color);

    return (
      <g key={`cable-${i}`} opacity={progress}>
        {/* Cable glow */}
        <path
          d={pathD} fill="none"
          stroke={cable.color} strokeWidth={strokeW + 4}
          opacity={0.08} filter="url(#deepGlow)"
        />
        {/* Cable line */}
        <path
          d={pathD} fill="none"
          stroke={cable.color} strokeWidth={strokeW}
          opacity={0.5} strokeLinecap="round"
          strokeDasharray={progress < 1 ? `${progress * dist} ${dist}` : 'none'}
        />
        {/* Signal pulse */}
        {progress >= 1 && (
          <circle cx={sigX} cy={sigY} r={cable.thick ? 4 : 3}
            fill={cable.color} opacity={0.8}
            filter="url(#deepGlow)"
          />
        )}
        {/* Cable label */}
        {cable.label && progress > 0.8 && (
          <text
            x={(x1 + x2) / 2 + perpX * 12}
            y={(y1 + y2) / 2 + perpY * 12 - 6}
            textAnchor="middle"
            fill={`rgba(${rgb}, 0.6)`}
            fontSize={8}
            fontFamily="'IBM Plex Mono', monospace"
            fontWeight={500}
          >
            {cable.label}
          </text>
        )}
      </g>
    );
  };

  // ── Render: Creature nodes ────────────────────────────────────────────────

  const renderCreature = (c: CreatureDef) => {
    const s = spring({ frame: frame - c.enterDelay, fps, config: { damping: 14, stiffness: 60 } });
    if (s <= 0.01) return null;

    const rgb = hexToRgb(c.color);
    const isKraken = c.creature === 'kraken';
    const isJellyfish = c.creature === 'jellyfish';
    const isAngler = c.creature === 'anglerfish';
    const isVent = c.creature === 'vent';

    // Jellyfish pulse: contract/expand
    const jellyPulse = isJellyfish ? 1 + Math.sin(frame * 0.1) * 0.08 : 1;
    // Kraken breathing
    const krakenBreath = isKraken ? 1 + Math.sin(frame * 0.05) * 0.04 : 1;
    // Anglerfish lure glow
    const lureBright = isAngler ? 0.5 + Math.sin(frame * 0.12 + c.x * 0.01) * 0.5 : 0;
    // Vent shimmer
    const ventShimmer = isVent ? 0.6 + Math.sin(frame * 0.15) * 0.4 : 0;

    const scale = s * jellyPulse * krakenBreath;
    const r = c.size / 2;

    // Gentle current drift
    const driftX = Math.sin(frame * 0.008 + c.y * 0.01) * 3;
    const driftY = Math.cos(frame * 0.006 + c.x * 0.01) * 2;

    return (
      <g key={c.id} transform={`translate(${c.x + driftX}, ${c.y + driftY}) scale(${scale})`}>
        {/* Bioluminescent aura — outer glow */}
        <circle r={r + 25} fill="none" stroke={c.color}
          strokeWidth={1.5} opacity={0.06} filter="url(#deepGlow)" />
        <circle r={r + 15} fill={`rgba(${rgb}, 0.04)`} />

        {/* Kraken: pulsing rings */}
        {isKraken && (
          <>
            <circle r={r + 35} fill="none" stroke={ocean.bioCyan}
              strokeWidth={0.8} opacity={0.1 + Math.sin(frame * 0.06) * 0.05}
              strokeDasharray="4 8" />
            <circle r={r + 50} fill="none" stroke={ocean.bioCyan}
              strokeWidth={0.4} opacity={0.05 + Math.sin(frame * 0.04) * 0.03}
              strokeDasharray="2 12" />
          </>
        )}

        {/* Jellyfish: trailing tendrils */}
        {isJellyfish && Array.from({ length: 5 }, (_, ti) => {
          const tendrilAngle = (ti / 5) * Math.PI - Math.PI * 0.3 + Math.PI / 2;
          const tendrilLen = 20 + Math.sin(frame * 0.08 + ti) * 6;
          const tx = Math.cos(tendrilAngle) * tendrilLen;
          const ty = Math.sin(tendrilAngle) * tendrilLen + r;
          return (
            <line key={`t${ti}`}
              x1={Math.cos(tendrilAngle) * r * 0.6}
              y1={r * 0.6}
              x2={tx} y2={ty}
              stroke={ocean.jellyPurple} strokeWidth={1}
              opacity={0.3 + Math.sin(frame * 0.1 + ti * 0.8) * 0.15}
            />
          );
        })}

        {/* Anglerfish: lure light */}
        {isAngler && (
          <circle cx={0} cy={-r - 8} r={4 + lureBright * 3}
            fill={ocean.anglerGold}
            opacity={0.3 + lureBright * 0.5}
            filter="url(#deepGlow)"
          />
        )}

        {/* Vent: heat shimmer particles */}
        {isVent && Array.from({ length: 4 }, (_, vi) => {
          const vy = -r - 10 - ((frame * 0.5 + vi * 15) % 40);
          const vx = Math.sin(frame * 0.1 + vi * 2) * 8;
          return (
            <circle key={`v${vi}`} cx={vx} cy={vy} r={2 + ventShimmer}
              fill={ocean.ventOrange} opacity={0.15 + ventShimmer * 0.1} />
          );
        })}

        {/* Creature body */}
        <circle r={r}
          fill={ocean.abyss}
          stroke={c.color}
          strokeWidth={isKraken ? 2.5 : 1.5}
          opacity={0.95}
        />
        {/* Inner bioluminescent ring */}
        <circle r={r - 3} fill="none"
          stroke={`rgba(${rgb}, 0.2)`} strokeWidth={1} />

        {/* Icon */}
        <text textAnchor="middle" dominantBaseline="central"
          fontSize={isKraken ? 32 : 20} fill={c.color}
          style={{ filter: `drop-shadow(0 0 8px rgba(${rgb}, 0.6))` }}
        >
          {c.icon}
        </text>

        {/* Label */}
        <text y={r + 18} textAnchor="middle" fill={ocean.marineWhite}
          fontSize={isKraken ? 13 : 10}
          fontFamily="'Outfit', 'DM Sans', sans-serif"
          fontWeight={isKraken ? 800 : 600}
          letterSpacing={isKraken ? 2 : 0.5}
        >
          {c.label}
        </text>
        {/* Sublabel */}
        <text y={r + 31} textAnchor="middle"
          fill={`rgba(${hexToRgb(ocean.marineWhite)}, 0.45)`}
          fontSize={8} fontFamily="'IBM Plex Mono', monospace"
        >
          {c.sublabel}
        </text>
      </g>
    );
  };

  // ── Silt near ocean floor ─────────────────────────────────────────────────

  const siltParticles = useMemo(() => {
    const rng = seededRandom(55);
    return Array.from({ length: 30 }, () => ({
      x: rng() * width,
      y: height - rng() * 60 - 20,
      size: rng() * 2 + 0.5,
      drift: (rng() - 0.5) * 0.15,
      opacity: rng() * 0.12 + 0.03,
    }));
  }, [width, height]);

  // ── Legend ─────────────────────────────────────────────────────────────────

  const legendItems = [
    { color: ocean.bioCyan, label: 'Kraken = c9-operator' },
    { color: ocean.ventOrange, label: 'Hydrothermal Vent = Broker' },
    { color: ocean.jellyPurple, label: 'Jellyfish Colony = Hub' },
    { color: ocean.anglerGold, label: 'Anglerfish = Agent' },
    { color: ocean.marineWhite, label: 'Surface Buoy = API Gateway' },
    { color: ocean.cableCopper, label: 'Sunken Cargo = Projects' },
    { color: ocean.planktonGreen, label: 'Bathysphere = Dashboard' },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: ocean.abyss }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          {/* Deep ocean gradient background */}
          <linearGradient id="oceanDepth" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0d1f3c" stopOpacity="1" />
            <stop offset="30%" stopColor="#0a1628" stopOpacity="1" />
            <stop offset="70%" stopColor="#060e1e" stopOpacity="1" />
            <stop offset="100%" stopColor="#020810" stopOpacity="1" />
          </linearGradient>
          {/* Bioluminescent glow filter */}
          <filter id="deepGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="10" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <filter id="textGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Radial glow from kraken */}
          <radialGradient id="krakenAura" cx="50%" cy="48%" r="45%">
            <stop offset="0%" stopColor={ocean.bioCyan} stopOpacity="0.07" />
            <stop offset="40%" stopColor={ocean.jellyPurple} stopOpacity="0.03" />
            <stop offset="100%" stopColor={ocean.abyss} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ocean depth gradient */}
        <rect width={width} height={height} fill="url(#oceanDepth)" />

        {/* Kraken central aura */}
        <circle cx={cx} cy={cy - 10} r={300} fill="url(#krakenAura)"
          opacity={globalFade} />

        {/* Bioluminescent pulse wave */}
        {pulseWaveOpacity > 0.005 && (
          <circle cx={cx} cy={cy - 10} r={pulseWaveR}
            fill="none" stroke={ocean.bioCyan}
            strokeWidth={2} opacity={pulseWaveOpacity}
            filter="url(#softGlow)"
          />
        )}

        {/* Depth zone indicators */}
        {depthZones.map((dz, i) => {
          const dzOpacity = interpolate(frame, [10 + i * 5, 25 + i * 5], [0, dz.opacity], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          });
          return (
            <g key={`dz${i}`} opacity={dzOpacity}>
              <line x1={0} y1={dz.y} x2={width} y2={dz.y}
                stroke={ocean.pressureBlue} strokeWidth={0.5}
                strokeDasharray="8 16" opacity={0.3} />
              <text x={width - 12} y={dz.y - 5} textAnchor="end"
                fill={ocean.pressureBlue} fontSize={7}
                fontFamily="'IBM Plex Mono', monospace"
                opacity={0.5}
              >
                {dz.label}
              </text>
            </g>
          );
        })}

        {/* Marine snow — drifting DOWN */}
        {marineSnow.map((p, i) => {
          const py = (p.y + p.speed * frame) % height;
          const px = p.x + Math.sin(frame * 0.01 + i * 0.5) * 8 + p.drift * frame;
          const twinkle = 0.6 + Math.sin(frame * 0.03 + i * 1.7) * 0.4;
          return (
            <circle key={`ms${i}`}
              cx={((px % width) + width) % width}
              cy={py} r={p.size}
              fill={ocean.marineWhite}
              opacity={p.opacity * twinkle * globalFade}
            />
          );
        })}

        {/* Plankton clouds */}
        {planktonClouds.map((p, i) => {
          const px = p.x + Math.cos(frame * p.orbitSpeed + p.phase) * p.orbitR;
          const py = p.y + Math.sin(frame * p.orbitSpeed + p.phase) * p.orbitR * 0.6;
          const glow = 0.5 + Math.sin(frame * 0.05 + i) * 0.5;
          return (
            <circle key={`pk${i}`}
              cx={((px % width) + width) % width}
              cy={((py % height) + height) % height}
              r={p.size} fill={ocean.planktonGreen}
              opacity={p.opacity * glow * globalFade}
            />
          );
        })}

        {/* Bubble streams — rising UP */}
        {bubbleStreams.map((b, i) => {
          const by = height - ((b.speed * frame + i * 40) % (height + 40));
          const bx = b.baseX + Math.sin(frame * b.wobbleSpeed + b.phase) * b.wobble;
          if (by < -10 || by > height + 10) return null;
          return (
            <circle key={`bb${i}`} cx={bx} cy={by} r={b.size}
              fill="none" stroke={`rgba(${hexToRgb(ocean.bioCyan)}, ${b.opacity})`}
              strokeWidth={0.5}
            />
          );
        })}

        {/* Silt near ocean floor */}
        {siltParticles.map((sp, i) => {
          const sx = sp.x + Math.sin(frame * 0.02 + i) * 10 + sp.drift * frame;
          const sy = sp.y + Math.cos(frame * 0.015 + i * 0.7) * 3;
          return (
            <circle key={`silt${i}`}
              cx={((sx % width) + width) % width} cy={sy}
              r={sp.size} fill={ocean.cableCopper}
              opacity={sp.opacity * globalFade}
            />
          );
        })}

        {/* Ocean floor terrain line */}
        <path
          d={`M 0 ${height - 35} Q ${width * 0.15} ${height - 50}, ${width * 0.3} ${height - 38} T ${width * 0.6} ${height - 42} T ${width * 0.85} ${height - 35} T ${width} ${height - 40}`}
          fill="none" stroke={`rgba(${hexToRgb(ocean.cableCopper)}, 0.15)`}
          strokeWidth={1.5} opacity={globalFade}
        />

        {/* Submarine cables (edges) */}
        {cables.map(renderCable)}

        {/* Creature nodes */}
        {creatures.map(renderCreature)}

        {/* Title */}
        <g opacity={titleOpacity} transform={`translate(0, ${titleY})`}>
          <text x={cx} y={height - 52} textAnchor="middle"
            fill={ocean.bioCyan} fontSize={22}
            fontFamily="'Outfit', 'DM Sans', sans-serif"
            fontWeight={800} letterSpacing={5}
            filter="url(#textGlow)"
          >
            c9-operator
          </text>
          <text x={cx} y={height - 32} textAnchor="middle"
            fill={`rgba(${hexToRgb(ocean.marineWhite)}, 0.4)`}
            fontSize={10} fontFamily="'IBM Plex Mono', monospace"
            letterSpacing={3}
          >
            ABYSSAL AGENT NETWORK
          </text>
        </g>

        {/* Legend */}
        <g opacity={legendOpacity} transform={`translate(16, ${height - 165})`}>
          <rect x={-6} y={-14} width={175} height={legendItems.length * 17 + 14}
            rx={4} fill={`rgba(${hexToRgb(ocean.abyss)}, 0.7)`}
            stroke={`rgba(${hexToRgb(ocean.bioCyan)}, 0.1)`} strokeWidth={0.5} />
          {legendItems.map((item, i) => (
            <g key={`leg${i}`} transform={`translate(0, ${i * 17})`}>
              <circle cx={6} cy={0} r={4} fill={item.color} opacity={0.7} />
              <text x={16} y={3.5}
                fill={`rgba(${hexToRgb(ocean.marineWhite)}, 0.55)`}
                fontSize={8} fontFamily="'IBM Plex Mono', monospace"
              >
                {item.label}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </AbsoluteFill>
  );
};

export default DeepOcean;
