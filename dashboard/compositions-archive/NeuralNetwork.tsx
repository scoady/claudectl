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

interface NeuronDef {
  id: string;
  label: string;
  brainRegion: string;
  x: number;
  y: number;
  color: string;
  somaRadius: number;
  enterDelay: number;
  fireDelay: number;
  dendriteBranches: number;
}

interface AxonDef {
  from: string;
  to: string;
  color: string;
  enterDelay: number;
  myelinated: boolean;
}

// ── Bio colors ───────────────────────────────────────────────────────────────

const bio = {
  cyan: '#00E5FF',
  pink: '#FF4081',
  gold: '#FFD54F',
  purple: '#B388FF',
  soma: '#FF8A65',
  myelin: '#448AFF',
  tissue: '#0D0D1F',
};

// ── Organic path helpers ─────────────────────────────────────────────────────

function organicSomaPath(cx: number, cy: number, r: number, rng: () => number): string {
  const pts = 10;
  const coords: [number, number][] = [];
  for (let i = 0; i < pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const wobble = r * (0.85 + rng() * 0.3);
    coords.push([cx + Math.cos(a) * wobble, cy + Math.sin(a) * wobble]);
  }
  let d = `M ${coords[0][0]} ${coords[0][1]}`;
  for (let i = 0; i < pts; i++) {
    const curr = coords[i];
    const next = coords[(i + 1) % pts];
    const cpx = (curr[0] + next[0]) / 2 + (rng() - 0.5) * r * 0.4;
    const cpy = (curr[1] + next[1]) / 2 + (rng() - 0.5) * r * 0.4;
    d += ` Q ${cpx} ${cpy} ${next[0]} ${next[1]}`;
  }
  return d + ' Z';
}

function dendritePath(
  ox: number, oy: number, angle: number, length: number, rng: () => number,
): string {
  const segments = 4;
  const segLen = length / segments;
  let x = ox;
  let y = oy;
  let a = angle;
  let d = `M ${x} ${y}`;
  for (let i = 0; i < segments; i++) {
    a += (rng() - 0.5) * 0.6;
    const nx = x + Math.cos(a) * segLen;
    const ny = y + Math.sin(a) * segLen;
    const cpx = (x + nx) / 2 + (rng() - 0.5) * segLen * 0.5;
    const cpy = (y + ny) / 2 + (rng() - 0.5) * segLen * 0.5;
    d += ` Q ${cpx} ${cpy} ${nx} ${ny}`;
    x = nx;
    y = ny;
  }
  return d;
}

function curvedAxonPath(
  x1: number, y1: number, x2: number, y2: number, rng: () => number,
): string {
  const mx = (x1 + x2) / 2 + (rng() - 0.5) * 80;
  const my = (y1 + y2) / 2 + (rng() - 0.5) * 60;
  return `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
}

// ── Neural Network Composition ───────────────────────────────────────────────

export const NeuralNetwork: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const cx = width / 2;
  const cy = height / 2;

  // ── Neuron definitions ───────────────────────────────────────────────────

  const neurons: NeuronDef[] = useMemo(() => [
    // Central cortex — c9-operator
    {
      id: 'operator', label: 'c9-operator', brainRegion: 'Central Cortex',
      x: cx, y: cy - 10, color: bio.cyan, somaRadius: 38,
      enterDelay: 0, fireDelay: 15, dendriteBranches: 8,
    },
    // Basal ganglia — Broker
    {
      id: 'broker', label: 'Broker', brainRegion: 'Basal Ganglia',
      x: cx - 260, y: cy + 20, color: bio.purple, somaRadius: 26,
      enterDelay: 8, fireDelay: 25, dendriteBranches: 5,
    },
    // Thalamus — Hub
    {
      id: 'hub', label: 'Hub', brainRegion: 'Thalamus',
      x: cx + 260, y: cy + 20, color: bio.pink, somaRadius: 26,
      enterDelay: 8, fireDelay: 25, dendriteBranches: 5,
    },
    // Sensory input — API Gateway
    {
      id: 'api', label: 'API Gateway', brainRegion: 'Sensory Cortex',
      x: cx, y: 80, color: bio.myelin, somaRadius: 24,
      enterDelay: 4, fireDelay: 10, dendriteBranches: 4,
    },
    // Individual neurons — Agents
    {
      id: 'alpha', label: 'Agent \u03B1', brainRegion: 'Motor Neuron',
      x: cx - 220, y: cy + 200, color: bio.gold, somaRadius: 20,
      enterDelay: 18, fireDelay: 40, dendriteBranches: 4,
    },
    {
      id: 'beta', label: 'Agent \u03B2', brainRegion: 'Motor Neuron',
      x: cx - 60, y: cy + 230, color: bio.gold, somaRadius: 20,
      enterDelay: 22, fireDelay: 45, dendriteBranches: 4,
    },
    {
      id: 'gamma', label: 'Agent \u03B3', brainRegion: 'Motor Neuron',
      x: cx + 110, y: cy + 210, color: bio.gold, somaRadius: 20,
      enterDelay: 26, fireDelay: 50, dendriteBranches: 4,
    },
    {
      id: 'delta', label: 'Agent \u03B4', brainRegion: 'Motor Neuron',
      x: cx + 280, y: cy + 220, color: bio.gold, somaRadius: 18,
      enterDelay: 30, fireDelay: 55, dendriteBranches: 3,
    },
    // Hippocampus — Projects
    {
      id: 'projects', label: 'Projects', brainRegion: 'Hippocampus',
      x: cx - 310, y: 110, color: bio.soma, somaRadius: 22,
      enterDelay: 12, fireDelay: 30, dendriteBranches: 4,
    },
    // Visual cortex — Dashboard
    {
      id: 'dashboard', label: 'Dashboard', brainRegion: 'Visual Cortex',
      x: cx + 310, y: 110, color: bio.soma, somaRadius: 22,
      enterDelay: 12, fireDelay: 30, dendriteBranches: 4,
    },
  ], [cx, cy]);

  const neuronMap = useMemo(
    () => Object.fromEntries(neurons.map((n) => [n.id, n])),
    [neurons],
  );

  // ── Axon connections ─────────────────────────────────────────────────────

  const axons: AxonDef[] = useMemo(() => [
    { from: 'api', to: 'operator', color: bio.myelin, enterDelay: 6, myelinated: true },
    { from: 'operator', to: 'broker', color: bio.purple, enterDelay: 10, myelinated: true },
    { from: 'operator', to: 'hub', color: bio.pink, enterDelay: 10, myelinated: true },
    { from: 'broker', to: 'alpha', color: bio.gold, enterDelay: 20, myelinated: true },
    { from: 'broker', to: 'beta', color: bio.gold, enterDelay: 24, myelinated: true },
    { from: 'broker', to: 'gamma', color: bio.gold, enterDelay: 28, myelinated: true },
    { from: 'broker', to: 'delta', color: bio.gold, enterDelay: 32, myelinated: false },
    { from: 'hub', to: 'dashboard', color: bio.pink, enterDelay: 14, myelinated: true },
    { from: 'projects', to: 'api', color: bio.soma, enterDelay: 16, myelinated: false },
    { from: 'alpha', to: 'hub', color: bio.gold, enterDelay: 42, myelinated: false },
    { from: 'beta', to: 'hub', color: bio.gold, enterDelay: 48, myelinated: false },
    { from: 'gamma', to: 'operator', color: bio.cyan, enterDelay: 52, myelinated: false },
  ], []);

  // ── Background fibers (faint neuron texture) ────────────────────────────

  const bgFibers = useMemo(() => {
    const rng = seededRandom(77);
    return Array.from({ length: 40 }, () => {
      const sx = rng() * width;
      const sy = rng() * height;
      const angle = rng() * Math.PI * 2;
      const len = 80 + rng() * 200;
      return dendritePath(sx, sy, angle, len, rng);
    });
  }, [width, height]);

  // ── Background neural flashes ──────────────────────────────────────────

  const bgFlashes = useMemo(() => {
    const rng = seededRandom(99);
    return Array.from({ length: 20 }, () => ({
      x: rng() * width,
      y: rng() * height,
      period: 60 + Math.floor(rng() * 120),
      offset: Math.floor(rng() * 180),
      radius: 2 + rng() * 4,
    }));
  }, [width, height]);

  // ── Precomputed dendrite data ──────────────────────────────────────────

  const dendriteData = useMemo(() => {
    const rng = seededRandom(123);
    const result: { neuronId: string; path: string; length: number }[] = [];
    for (const n of neurons) {
      for (let b = 0; b < n.dendriteBranches; b++) {
        const angle = (b / n.dendriteBranches) * Math.PI * 2 + (rng() - 0.5) * 0.4;
        const startX = n.x + Math.cos(angle) * n.somaRadius;
        const startY = n.y + Math.sin(angle) * n.somaRadius;
        const len = 30 + rng() * 50;
        const path = dendritePath(startX, startY, angle, len, rng);
        result.push({ neuronId: n.id, path, length: len });
        // Sub-branch
        if (rng() > 0.4) {
          const subAngle = angle + (rng() - 0.5) * 1.2;
          const subStartX = startX + Math.cos(angle) * len * 0.6;
          const subStartY = startY + Math.sin(angle) * len * 0.6;
          const subLen = 15 + rng() * 25;
          const subPath = dendritePath(subStartX, subStartY, subAngle, subLen, rng);
          result.push({ neuronId: n.id, path: subPath, length: subLen });
        }
      }
    }
    return result;
  }, [neurons]);

  // ── Precomputed soma paths ─────────────────────────────────────────────

  const somaPaths = useMemo(() => {
    const rng = seededRandom(456);
    const map: Record<string, string> = {};
    for (const n of neurons) {
      map[n.id] = organicSomaPath(0, 0, n.somaRadius, rng);
    }
    return map;
  }, [neurons]);

  // ── Precomputed axon paths ─────────────────────────────────────────────

  const axonPaths = useMemo(() => {
    const rng = seededRandom(789);
    return axons.map((a) => {
      const from = neuronMap[a.from];
      const to = neuronMap[a.to];
      if (!from || !to) return '';
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const nx = dx / dist;
      const ny = dy / dist;
      const x1 = from.x + nx * (from.somaRadius + 4);
      const y1 = from.y + ny * (from.somaRadius + 4);
      const x2 = to.x - nx * (to.somaRadius + 4);
      const y2 = to.y - ny * (to.somaRadius + 4);
      return curvedAxonPath(x1, y1, x2, y2, rng);
    });
  }, [axons, neuronMap]);

  // ── Neurotransmitter particle pools ────────────────────────────────────

  const synapticParticles = useMemo(() => {
    const rng = seededRandom(321);
    return axons.map(() =>
      Array.from({ length: 6 }, () => ({
        angle: rng() * Math.PI * 2,
        speed: 0.5 + rng() * 1.5,
        radius: 1 + rng() * 2,
        orbitR: 4 + rng() * 10,
        phase: rng() * Math.PI * 2,
      })),
    );
  }, [axons]);

  // ── Title animation ────────────────────────────────────────────────────

  const titleOpacity = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [0, 25], [-12, 0], { extrapolateRight: 'clamp' });

  // ── Legend ──────────────────────────────────────────────────────────────

  const legendOpacity = interpolate(frame, [45, 60], [0, 1], { extrapolateRight: 'clamp' });

  const legendItems = [
    { color: bio.cyan, arch: 'c9-operator', brain: 'Central Cortex' },
    { color: bio.purple, arch: 'Broker', brain: 'Basal Ganglia' },
    { color: bio.pink, arch: 'Hub', brain: 'Thalamus' },
    { color: bio.gold, arch: 'Agents', brain: 'Motor Neurons' },
    { color: bio.myelin, arch: 'API Gateway', brain: 'Sensory Cortex' },
    { color: bio.soma, arch: 'Projects / Dashboard', brain: 'Hippocampus / Visual Cortex' },
  ];

  // ── Tissue background opacity ──────────────────────────────────────────

  const tissueOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  // ── Render helpers ─────────────────────────────────────────────────────

  const renderAxon = (axon: AxonDef, i: number) => {
    const pathD = axonPaths[i];
    if (!pathD) return null;

    const progress = interpolate(frame, [axon.enterDelay, axon.enterDelay + 25], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    if (progress <= 0) return null;

    // Action potential pulse position (cycles every 80 frames)
    const pulseT = progress >= 1 ? ((frame - axon.enterDelay - 25) % 80) / 80 : -1;

    // Myelin sheath dash pattern
    const dashArray = axon.myelinated ? '12 6' : 'none';

    // Synaptic burst at terminus
    const burstActive = progress >= 1 && pulseT > 0.85 && pulseT < 1.0;
    const particles = synapticParticles[i];
    const to = neuronMap[axon.to];

    return (
      <g key={`axon-${i}`}>
        {/* Axon glow */}
        <path
          d={pathD}
          fill="none"
          stroke={axon.color}
          strokeWidth={4}
          strokeDasharray={dashArray}
          opacity={0.08 * progress}
          filter="url(#axonGlow)"
        />
        {/* Axon line */}
        <path
          d={pathD}
          fill="none"
          stroke={axon.color}
          strokeWidth={1.4}
          strokeDasharray={dashArray}
          opacity={0.5 * progress}
          strokeDashoffset={axon.myelinated ? -frame * 0.3 : 0}
          pathLength={100}
          strokeLinecap="round"
        />
        {/* Action potential pulse traveling along axon */}
        {pulseT >= 0 && (
          <circle r={4} fill={axon.color} opacity={0.9} filter="url(#pulseGlow)">
            <animateMotion
              dur="2.67s"
              repeatCount="indefinite"
              path={pathD}
              keyPoints="0;1"
              keyTimes="0;1"
              calcMode="linear"
            />
          </circle>
        )}
        {/* Manual pulse position as fallback — frame-driven */}
        {pulseT >= 0 && (
          <circle
            r={5}
            fill="white"
            opacity={interpolate(
              Math.sin(pulseT * Math.PI),
              [0, 1],
              [0.1, 0.8],
            )}
            filter="url(#pulseGlow)"
          >
            <animateMotion
              dur="2.67s"
              repeatCount="indefinite"
              path={pathD}
            />
          </circle>
        )}
        {/* Synaptic burst — neurotransmitter spray */}
        {burstActive && to && particles.map((p, pi) => {
          const burstProgress = (pulseT - 0.85) / 0.15;
          const bx = to.x + Math.cos(p.angle) * p.orbitR * burstProgress * 2;
          const by = to.y + Math.sin(p.angle) * p.orbitR * burstProgress * 2;
          return (
            <circle
              key={`burst-${i}-${pi}`}
              cx={bx}
              cy={by}
              r={p.radius * (1 - burstProgress * 0.5)}
              fill={axon.color}
              opacity={0.8 * (1 - burstProgress)}
            />
          );
        })}
        {/* Neurotransmitter pool orbiting near synapse */}
        {progress >= 1 && to && particles.slice(0, 3).map((p, pi) => {
          const orbitX = to.x + Math.cos(frame * 0.03 + p.phase) * (to.somaRadius + p.orbitR);
          const orbitY = to.y + Math.sin(frame * 0.03 + p.phase) * (to.somaRadius + p.orbitR);
          return (
            <circle
              key={`pool-${i}-${pi}`}
              cx={orbitX}
              cy={orbitY}
              r={1.2}
              fill={axon.color}
              opacity={0.3 + Math.sin(frame * 0.05 + pi) * 0.2}
            />
          );
        })}
      </g>
    );
  };

  const renderNeuron = (neuron: NeuronDef) => {
    const s = spring({
      frame: frame - neuron.enterDelay,
      fps,
      config: { damping: 14, stiffness: 60 },
    });
    if (s <= 0.01) return null;

    const somaPath = somaPaths[neuron.id];
    const isOperator = neuron.id === 'operator';

    // Membrane potential breathing
    const membrane = 1 + Math.sin(frame * 0.06 + neuron.enterDelay) * 0.04;

    // Neuron firing flash — cascade timing
    const fireCycle = 90;
    const firePhase = (frame - neuron.fireDelay) % fireCycle;
    const fireIntensity = firePhase >= 0 && firePhase < 12
      ? interpolate(firePhase, [0, 4, 12], [0, 1, 0], { extrapolateRight: 'clamp' })
      : 0;

    // Nucleus shimmer
    const nucleusR = neuron.somaRadius * 0.35;
    const nucleusPulse = 1 + Math.sin(frame * 0.1 + neuron.enterDelay * 2) * 0.08;

    // Dendrite growth (path length animation)
    const dendriteGrowth = interpolate(
      frame,
      [neuron.enterDelay + 5, neuron.enterDelay + 40],
      [0, 1],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
    );

    // Operator cluster — extra soma shapes orbiting
    const clusterDots = isOperator ? 6 : 0;

    return (
      <g key={neuron.id}>
        {/* Dendrites extending from soma */}
        {dendriteData
          .filter((d) => d.neuronId === neuron.id)
          .map((d, di) => (
            <path
              key={`dend-${neuron.id}-${di}`}
              d={d.path}
              fill="none"
              stroke={neuron.color}
              strokeWidth={0.8}
              opacity={0.25 * dendriteGrowth}
              strokeDasharray={d.length * 4}
              strokeDashoffset={d.length * 4 * (1 - dendriteGrowth)}
              strokeLinecap="round"
            />
          ))}

        <g transform={`translate(${neuron.x}, ${neuron.y}) scale(${s * membrane})`}>
          {/* Firing flash — outer burst */}
          {fireIntensity > 0 && (
            <>
              <circle
                r={neuron.somaRadius + 20}
                fill={`rgba(${hexToRgb(neuron.color)}, ${0.15 * fireIntensity})`}
              />
              <circle
                r={neuron.somaRadius + 35}
                fill="none"
                stroke={neuron.color}
                strokeWidth={1}
                opacity={0.3 * fireIntensity}
                filter="url(#pulseGlow)"
              />
            </>
          )}

          {/* Outer membrane glow */}
          <path
            d={somaPath}
            fill="none"
            stroke={neuron.color}
            strokeWidth={1.5}
            opacity={0.12 + fireIntensity * 0.3}
            filter="url(#somaGlow)"
            transform={`scale(${1.15})`}
          />

          {/* Cell body — irregular soma */}
          <path
            d={somaPath}
            fill={bio.tissue}
            stroke={neuron.color}
            strokeWidth={isOperator ? 2.2 : 1.4}
            opacity={0.95}
          />

          {/* Inner cytoplasm gradient */}
          <path
            d={somaPath}
            fill={`rgba(${hexToRgb(neuron.color)}, ${0.06 + fireIntensity * 0.15})`}
            stroke="none"
            transform="scale(0.9)"
          />

          {/* Nucleus */}
          <ellipse
            rx={nucleusR * nucleusPulse}
            ry={nucleusR * 0.85 * nucleusPulse}
            fill={`rgba(${hexToRgb(neuron.color)}, 0.15)`}
            stroke={neuron.color}
            strokeWidth={0.6}
            opacity={0.5}
          />
          <ellipse
            rx={nucleusR * 0.5}
            ry={nucleusR * 0.4}
            fill={neuron.color}
            opacity={0.2 + fireIntensity * 0.4}
          />

          {/* Operator cluster — dense interconnected soma */}
          {Array.from({ length: clusterDots }, (_, ci) => {
            const ca = (ci / clusterDots) * Math.PI * 2 + frame * 0.008;
            const cr = neuron.somaRadius * 0.55;
            const ccx = Math.cos(ca) * cr;
            const ccy = Math.sin(ca) * cr;
            return (
              <circle
                key={`cluster-${ci}`}
                cx={ccx}
                cy={ccy}
                r={3}
                fill={neuron.color}
                opacity={0.15 + Math.sin(frame * 0.04 + ci) * 0.1}
              />
            );
          })}

          {/* Label */}
          <text
            y={neuron.somaRadius + 18}
            textAnchor="middle"
            fill={colors.text}
            fontSize={isOperator ? 13 : 10}
            fontFamily="'Outfit', 'DM Sans', sans-serif"
            fontWeight={isOperator ? 700 : 600}
            letterSpacing={isOperator ? 1.5 : 0.5}
          >
            {neuron.label}
          </text>
          {/* Brain region sublabel */}
          <text
            y={neuron.somaRadius + 31}
            textAnchor="middle"
            fill={colors.textMuted}
            fontSize={8}
            fontFamily="'IBM Plex Mono', monospace"
            fontStyle="italic"
          >
            {neuron.brainRegion}
          </text>
        </g>
      </g>
    );
  };

  // ── Firing cascade sequence ────────────────────────────────────────────

  const cascadeOrder = ['api', 'operator', 'broker', 'hub', 'alpha', 'beta', 'gamma', 'delta'];
  const cascadeFlashes = useMemo(() => {
    return cascadeOrder.map((id, i) => ({
      id,
      startFrame: 70 + i * 8,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AbsoluteFill style={{ backgroundColor: bio.tissue }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          {/* Glow filters */}
          <filter id="somaGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="6" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="axonGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <filter id="pulseGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="4" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="textGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Tissue radial gradient */}
          <radialGradient id="tissueGlow" cx="50%" cy="45%" r="50%">
            <stop offset="0%" stopColor={bio.cyan} stopOpacity="0.05" />
            <stop offset="40%" stopColor={bio.purple} stopOpacity="0.025" />
            <stop offset="100%" stopColor={bio.tissue} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Background tissue texture — faint fiber network */}
        <g opacity={tissueOpacity * 0.12}>
          {bgFibers.map((path, i) => (
            <path
              key={`fiber-${i}`}
              d={path}
              fill="none"
              stroke={i % 3 === 0 ? bio.purple : i % 3 === 1 ? bio.cyan : bio.pink}
              strokeWidth={0.4}
              opacity={0.3 + Math.sin(frame * 0.02 + i * 0.7) * 0.15}
            />
          ))}
        </g>

        {/* Central tissue glow */}
        <ellipse
          cx={cx}
          cy={cy}
          rx={320}
          ry={260}
          fill="url(#tissueGlow)"
          opacity={tissueOpacity}
        />

        {/* Background neural activity flashes */}
        {bgFlashes.map((fl, i) => {
          const flashPhase = (frame + fl.offset) % fl.period;
          const flashOpacity = flashPhase < 8
            ? interpolate(flashPhase, [0, 3, 8], [0, 0.4, 0], { extrapolateRight: 'clamp' })
            : 0;
          return flashOpacity > 0 ? (
            <circle
              key={`flash-${i}`}
              cx={fl.x}
              cy={fl.y}
              r={fl.radius}
              fill={bio.cyan}
              opacity={flashOpacity * tissueOpacity}
              filter="url(#pulseGlow)"
            />
          ) : null;
        })}

        {/* Axon connections (rendered behind neurons) */}
        {axons.map(renderAxon)}

        {/* Firing cascade — additional highlight ripples */}
        {cascadeFlashes.map((cf) => {
          const n = neuronMap[cf.id];
          if (!n) return null;
          const cascadePhase = (frame - cf.startFrame) % 120;
          if (cascadePhase < 0 || cascadePhase > 20) return null;
          const rippleR = interpolate(cascadePhase, [0, 20], [n.somaRadius, n.somaRadius + 40], {
            extrapolateRight: 'clamp',
          });
          const rippleOp = interpolate(cascadePhase, [0, 20], [0.4, 0], {
            extrapolateRight: 'clamp',
          });
          return (
            <circle
              key={`cascade-${cf.id}`}
              cx={n.x}
              cy={n.y}
              r={rippleR}
              fill="none"
              stroke={n.color}
              strokeWidth={1.5}
              opacity={rippleOp}
            />
          );
        })}

        {/* Neurons */}
        {neurons.map(renderNeuron)}

        {/* Title */}
        <g opacity={titleOpacity} transform={`translate(0, ${titleY})`}>
          <text
            x={cx}
            y={height - 52}
            textAnchor="middle"
            fill={bio.cyan}
            fontSize={22}
            fontFamily="'Outfit', 'DM Sans', sans-serif"
            fontWeight={800}
            letterSpacing={4}
            filter="url(#textGlow)"
          >
            c9-operator
          </text>
          <text
            x={cx}
            y={height - 32}
            textAnchor="middle"
            fill={colors.textMuted}
            fontSize={11}
            fontFamily="'IBM Plex Mono', monospace"
            letterSpacing={2.5}
          >
            SYNAPTIC AGENT NETWORK
          </text>
        </g>

        {/* Legend — brain region to architecture mapping */}
        <g opacity={legendOpacity} transform={`translate(16, ${height - 145})`}>
          <text
            x={0}
            y={-8}
            fill={colors.textDim}
            fontSize={8}
            fontFamily="'IBM Plex Mono', monospace"
            letterSpacing={1.5}
            opacity={0.6}
          >
            REGION MAP
          </text>
          {legendItems.map((item, i) => (
            <g key={`leg-${i}`} transform={`translate(0, ${i * 17 + 6})`}>
              <circle cx={5} cy={0} r={3.5} fill={item.color} opacity={0.8} />
              <text
                x={14}
                y={3.5}
                fill={colors.textDim}
                fontSize={8}
                fontFamily="'IBM Plex Mono', monospace"
              >
                {item.arch}
              </text>
              <text
                x={130}
                y={3.5}
                fill={colors.textMuted}
                fontSize={7.5}
                fontFamily="'IBM Plex Mono', monospace"
                fontStyle="italic"
              >
                {item.brain}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </AbsoluteFill>
  );
};

export default NeuralNetwork;
