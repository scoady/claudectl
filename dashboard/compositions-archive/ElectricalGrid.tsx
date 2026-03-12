import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from 'remotion';
import { colors, hexToRgb } from './theme';

// ── Electrical palette ────────────────────────────────────────────────────────

const elec = {
  yellow: '#FFD700',
  hvBlue: '#00BFFF',
  orange: '#FF6B00',
  green: '#39FF14',
  red: '#FF1744',
  gray: '#4A4A4A',
  ceramic: '#F5F5DC',
  bgMidnight: '#0a0a2e',
};

// ── Deterministic random ──────────────────────────────────────────────────────

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface GridNode {
  id: string;
  label: string;
  sublabel: string;
  x: number;
  y: number;
  color: string;
  icon: string;
  size: number;
  enterDelay: number;
  type: 'plant' | 'substation' | 'tower' | 'generator' | 'switch' | 'battery' | 'control';
}

interface PowerLine {
  from: string;
  to: string;
  label?: string;
  voltage?: string;
  color: string;
  enterDelay: number;
  thick?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function zigzagPath(
  x1: number, y1: number, x2: number, y2: number,
  segments: number, amplitude: number, rng: () => number,
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  const nx = -dy / len;
  const ny = dx / len;
  let d = `M${x1},${y1}`;
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const mx = x1 + dx * t;
    const my = y1 + dy * t;
    const offset = (rng() - 0.5) * 2 * amplitude;
    d += ` L${mx + nx * offset},${my + ny * offset}`;
  }
  d += ` L${x2},${y2}`;
  return d;
}

function catenaryPath(x1: number, y1: number, x2: number, y2: number, sag: number): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 + sag;
  return `M${x1},${y1} Q${mx},${my} ${x2},${y2}`;
}

function sineWavePath(
  cx: number, cy: number, width: number, amplitude: number, freq: number, phaseOffset: number,
): string {
  let d = '';
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const x = cx - width / 2 + t * width;
    const y = cy + Math.sin(t * Math.PI * 2 * freq + phaseOffset) * amplitude;
    d += i === 0 ? `M${x},${y}` : ` L${x},${y}`;
  }
  return d;
}

// ── ElectricalGrid Composition ────────────────────────────────────────────────

export const ElectricalGrid: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const cx = width / 2;
  const cy = height / 2;

  // ── Engineering paper grid ────────────────────────────────────────────────

  const gridOpacity = interpolate(frame, [0, 30], [0, 0.08], { extrapolateRight: 'clamp' });

  // ── Node definitions ──────────────────────────────────────────────────────

  const nodes: GridNode[] = useMemo(() => [
    {
      id: 'api', label: 'API Gateway', sublabel: 'MAIN BREAKER PANEL',
      x: cx, y: 68, color: elec.orange, icon: '', size: 52, enterDelay: 5, type: 'switch',
    },
    {
      id: 'operator', label: 'c9-operator', sublabel: 'POWER PLANT',
      x: cx, y: cy - 10, color: elec.yellow, icon: '', size: 88, enterDelay: 0, type: 'plant',
    },
    {
      id: 'broker', label: 'Broker', sublabel: 'SUBSTATION',
      x: cx - 300, y: cy - 10, color: elec.hvBlue, icon: '', size: 56, enterDelay: 10, type: 'substation',
    },
    {
      id: 'hub', label: 'Hub', sublabel: 'TRANSMISSION TOWER',
      x: cx + 300, y: cy - 10, color: elec.green, icon: '', size: 56, enterDelay: 10, type: 'tower',
    },
    {
      id: 'agent1', label: 'Agent \u03b1', sublabel: 'GENERATOR #1',
      x: cx - 280, y: cy + 200, color: elec.yellow, icon: '', size: 46, enterDelay: 20, type: 'generator',
    },
    {
      id: 'agent2', label: 'Agent \u03b2', sublabel: 'GENERATOR #2',
      x: cx - 80, y: cy + 220, color: elec.yellow, icon: '', size: 46, enterDelay: 25, type: 'generator',
    },
    {
      id: 'agent3', label: 'Agent \u03b3', sublabel: 'GENERATOR #3',
      x: cx + 120, y: cy + 200, color: elec.yellow, icon: '', size: 46, enterDelay: 30, type: 'generator',
    },
    {
      id: 'agent4', label: 'Agent \u03b4', sublabel: 'GENERATOR #4',
      x: cx + 320, y: cy + 220, color: elec.red, icon: '', size: 42, enterDelay: 50, type: 'generator',
    },
    {
      id: 'projects', label: 'Projects', sublabel: 'BATTERY BANK',
      x: cx - 340, y: 90, color: elec.hvBlue, icon: '', size: 46, enterDelay: 15, type: 'battery',
    },
    {
      id: 'dashboard', label: 'Dashboard', sublabel: 'SCADA CONTROL',
      x: cx + 340, y: 90, color: elec.green, icon: '', size: 46, enterDelay: 15, type: 'control',
    },
  ], [cx, cy]);

  const nodeMap = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);

  // ── Power line definitions ────────────────────────────────────────────────

  const lines: PowerLine[] = useMemo(() => [
    { from: 'api', to: 'operator', label: 'dispatch', voltage: '500kV', color: elec.orange, enterDelay: 8, thick: true },
    { from: 'operator', to: 'broker', label: 'spawn', voltage: '345kV', color: elec.hvBlue, enterDelay: 12, thick: true },
    { from: 'operator', to: 'hub', label: 'events', voltage: '345kV', color: elec.green, enterDelay: 12, thick: true },
    { from: 'broker', to: 'agent1', voltage: '138kV', color: elec.yellow, enterDelay: 22 },
    { from: 'broker', to: 'agent2', voltage: '138kV', color: elec.yellow, enterDelay: 27 },
    { from: 'broker', to: 'agent3', voltage: '138kV', color: elec.yellow, enterDelay: 32 },
    { from: 'broker', to: 'agent4', voltage: '69kV', color: elec.red, enterDelay: 52 },
    { from: 'hub', to: 'dashboard', label: 'stream', voltage: '230kV', color: elec.green, enterDelay: 16 },
    { from: 'projects', to: 'api', label: 'CRUD', voltage: '115kV', color: elec.hvBlue, enterDelay: 18 },
    { from: 'agent2', to: 'hub', voltage: '69kV', color: elec.yellow, enterDelay: 35 },
  ], []);

  // ── Background sparks ─────────────────────────────────────────────────────

  const bgSparks = useMemo(() => {
    const rng = seededRandom(77);
    return Array.from({ length: 80 }, () => ({
      x: rng() * width,
      y: rng() * height,
      size: rng() * 1.2 + 0.3,
      speed: rng() * 0.2 + 0.05,
      angle: rng() * Math.PI * 2,
      opacity: rng() * 0.3 + 0.05,
    }));
  }, [width, height]);

  // ── Lightning bolts (randomized per ~60-frame cycle) ──────────────────────

  const lightningBolts = useMemo(() => {
    const bolts: Array<{ path: string; opacity: number; color: string }> = [];
    const cycle = Math.floor(frame / 45);
    const rng = seededRandom(cycle * 1000 + 7);
    const count = Math.floor(rng() * 3);
    for (let i = 0; i < count; i++) {
      const sx = rng() * width * 0.6 + width * 0.2;
      const sy = rng() * height * 0.3;
      const ex = sx + (rng() - 0.5) * 200;
      const ey = sy + rng() * 150 + 80;
      const path = zigzagPath(sx, sy, ex, ey, 8, 20, rng);
      const flickerPhase = (frame % 45) / 45;
      const opacity = flickerPhase < 0.15 ? interpolate(flickerPhase, [0, 0.08, 0.15], [0, 0.9, 0], { extrapolateRight: 'clamp' }) : 0;
      bolts.push({ path, opacity, color: i % 2 === 0 ? elec.yellow : elec.hvBlue });
    }
    return bolts;
  }, [frame, width, height]);

  // ── Title ─────────────────────────────────────────────────────────────────

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [0, 20], [-10, 0], { extrapolateRight: 'clamp' });

  // ── Render: power line ────────────────────────────────────────────────────

  const renderPowerLine = (line: PowerLine, i: number) => {
    const from = nodeMap[line.from];
    const to = nodeMap[line.to];
    if (!from || !to) return null;

    const progress = interpolate(frame, [line.enterDelay, line.enterDelay + 20], [0, 1], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });
    if (progress <= 0) return null;

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const nx = dx / dist;
    const ny = dy / dist;
    const fromR = from.size / 2 + 10;
    const toR = to.size / 2 + 10;
    const x1 = from.x + nx * fromR;
    const y1 = from.y + ny * fromR;
    const x2 = from.x + dx - nx * toR;
    const y2 = from.y + dy - ny * toR;

    const sag = Math.abs(dx) > 100 ? 25 : 12;
    const catPath = catenaryPath(x1, y1, x2, y2, sag);
    const sw = line.thick ? 2.5 : 1.5;

    // Animated current dot along line
    const dotCount = line.thick ? 3 : 2;
    const dots = [];
    for (let d = 0; d < dotCount; d++) {
      const t = ((frame * 0.02 + d / dotCount) % 1);
      const px = x1 + (x2 - x1) * t;
      const sagY = sag * 4 * t * (1 - t);
      const py = y1 + (y2 - y1) * t + sagY;
      dots.push({ px, py });
    }

    // Transformer coil at midpoint
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2 + sag * 0.5;
    const coilSize = 6;
    const coilPath = `M${midX - coilSize},${midY} ` +
      `L${midX - coilSize * 0.6},${midY - coilSize * 0.5} ` +
      `L${midX - coilSize * 0.2},${midY + coilSize * 0.3} ` +
      `L${midX + coilSize * 0.2},${midY - coilSize * 0.3} ` +
      `L${midX + coilSize * 0.6},${midY + coilSize * 0.5} ` +
      `L${midX + coilSize},${midY}`;

    return (
      <g key={`pl${i}`} opacity={progress}>
        {/* Glow under line */}
        <path d={catPath} fill="none" stroke={line.color} strokeWidth={sw + 4} opacity={0.08} filter="url(#elecGlow)" />
        {/* Main power line */}
        <path d={catPath} fill="none" stroke={line.color} strokeWidth={sw} opacity={0.6} />
        {/* Second wire (parallel) for thick lines */}
        {line.thick && (
          <path
            d={catenaryPath(x1, y1 - 4, x2, y2 - 4, sag - 2)}
            fill="none" stroke={line.color} strokeWidth={1} opacity={0.3}
          />
        )}
        {/* Transformer coil symbol */}
        <path d={coilPath} fill="none" stroke={elec.ceramic} strokeWidth={1.2} opacity={0.5} />
        {/* Current flow dots */}
        {progress >= 1 && dots.map((dot, di) => (
          <circle key={`cd${i}-${di}`} cx={dot.px} cy={dot.py} r={line.thick ? 3 : 2}
            fill={line.color} opacity={0.9}>
            <animate attributeName="opacity" values="1;0.4;1" dur="0.6s" repeatCount="indefinite" />
          </circle>
        ))}
        {/* Voltage label */}
        {line.voltage && progress > 0.8 && (
          <g>
            <rect x={midX - 22} y={midY - 18} width={44} height={14} rx={3}
              fill={elec.bgMidnight} stroke={line.color} strokeWidth={0.5} opacity={0.8} />
            <text x={midX} y={midY - 8} textAnchor="middle" fill={line.color}
              fontSize={7} fontFamily="'IBM Plex Mono', monospace" fontWeight={700}>
              {line.voltage}
            </text>
          </g>
        )}
        {/* Edge label */}
        {line.label && progress > 0.8 && (
          <text x={midX} y={midY + 16} textAnchor="middle" fill={line.color}
            fontSize={8} fontFamily="'IBM Plex Mono', monospace" opacity={0.6}>
            {line.label}
          </text>
        )}
      </g>
    );
  };

  // ── Render: node ──────────────────────────────────────────────────────────

  const renderNode = (node: GridNode) => {
    const s = spring({ frame: frame - node.enterDelay, fps, config: { damping: 12, stiffness: 80 } });
    if (s <= 0.01) return null;

    const isOperator = node.id === 'operator';
    const pulse = isOperator ? 1 + Math.sin(frame * 0.1) * 0.04 : 1;
    const jitter = node.type === 'tower'
      ? Math.sin(frame * 0.3 + 17) * 0.8
      : 0;

    // Generator rotation angle
    const genAngle = node.type === 'generator' ? (frame * 3) % 360 : 0;

    // Load indicator for generators (oscillates)
    const loadPct = node.type === 'generator'
      ? 50 + Math.sin(frame * 0.05 + node.x * 0.01) * 40
      : 0;

    return (
      <g key={node.id} transform={`translate(${node.x + jitter}, ${node.y}) scale(${s * pulse})`}>
        {/* Tesla coil arcs for operator */}
        {isOperator && Array.from({ length: 5 }, (_, ai) => {
          const arcR = node.size / 2 + 18 + ai * 10;
          const arcOpacity = 0.15 - ai * 0.025;
          const arcFlicker = 0.7 + Math.sin(frame * 0.15 + ai * 2) * 0.3;
          const dashOff = (frame * 2 + ai * 20) % 100;
          return (
            <circle key={`tc${ai}`} r={arcR} fill="none" stroke={elec.yellow}
              strokeWidth={1.2 - ai * 0.15} opacity={arcOpacity * arcFlicker}
              strokeDasharray="8 12 4 16" strokeDashoffset={dashOff} />
          );
        })}

        {/* Reactor core glow for operator */}
        {isOperator && (
          <>
            <circle r={node.size / 2 + 6}
              fill={`rgba(${hexToRgb(elec.yellow)}, ${0.04 + Math.sin(frame * 0.08) * 0.02})`} />
            <circle r={node.size / 2 + 2}
              fill={`rgba(${hexToRgb(elec.yellow)}, ${0.06 + Math.sin(frame * 0.12) * 0.03})`} />
          </>
        )}

        {/* Node body — hexagonal for substation, circle for others */}
        {node.type === 'substation' ? (
          <polygon
            points={hexPoints(node.size / 2)}
            fill={elec.bgMidnight} stroke={node.color} strokeWidth={1.5} opacity={0.95}
          />
        ) : node.type === 'switch' ? (
          <rect x={-node.size / 2} y={-node.size / 2.5} width={node.size} height={node.size / 1.25}
            rx={4} fill={elec.bgMidnight} stroke={node.color} strokeWidth={1.5} opacity={0.95} />
        ) : (
          <circle r={node.size / 2} fill={elec.bgMidnight} stroke={node.color}
            strokeWidth={isOperator ? 2.5 : 1.5} opacity={0.95} />
        )}

        {/* Inner ring */}
        <circle r={node.size / 2 - 4} fill="none"
          stroke={`rgba(${hexToRgb(node.color)}, 0.12)`} strokeWidth={1} />

        {/* Generator spinning element */}
        {node.type === 'generator' && (
          <g transform={`rotate(${genAngle})`}>
            {[0, 60, 120, 180, 240, 300].map((a) => (
              <line key={`gbl${a}`} x1={0} y1={0}
                x2={Math.cos(a * Math.PI / 180) * (node.size / 2 - 8)}
                y2={Math.sin(a * Math.PI / 180) * (node.size / 2 - 8)}
                stroke={node.color} strokeWidth={1} opacity={0.4} />
            ))}
            <circle r={4} fill={node.color} opacity={0.6} />
          </g>
        )}

        {/* Transmission tower cross-beams */}
        {node.type === 'tower' && (
          <g>
            <line x1={-12} y1={-8} x2={12} y2={8} stroke={elec.ceramic} strokeWidth={1} opacity={0.4} />
            <line x1={12} y1={-8} x2={-12} y2={8} stroke={elec.ceramic} strokeWidth={1} opacity={0.4} />
            <line x1={0} y1={-node.size / 2 + 4} x2={0} y2={-node.size / 2 - 12}
              stroke={node.color} strokeWidth={1.5} opacity={0.6} />
            {/* Radiating signal arcs */}
            {[1, 2, 3].map((ri) => {
              const sigOp = 0.3 - ri * 0.08 + Math.sin(frame * 0.1 + ri) * 0.1;
              return (
                <path key={`sig${ri}`}
                  d={`M${-ri * 8},${-node.size / 2 - 12 - ri * 5} Q0,${-node.size / 2 - 12 - ri * 8} ${ri * 8},${-node.size / 2 - 12 - ri * 5}`}
                  fill="none" stroke={node.color} strokeWidth={1} opacity={Math.max(0, sigOp)} />
              );
            })}
          </g>
        )}

        {/* Battery bank bars */}
        {node.type === 'battery' && (
          <g>
            {[-10, -3, 4, 11].map((bx, bi) => {
              const bh = 10 + Math.sin(frame * 0.04 + bi * 1.5) * 4;
              return (
                <rect key={`bat${bi}`} x={bx - 2} y={-bh / 2} width={4} height={bh}
                  fill={node.color} opacity={0.3 + bi * 0.1} rx={1} />
              );
            })}
          </g>
        )}

        {/* SCADA display for control room */}
        {node.type === 'control' && (
          <g>
            <rect x={-14} y={-10} width={28} height={16} rx={2}
              fill={`rgba(${hexToRgb(elec.green)}, 0.1)`} stroke={elec.green} strokeWidth={0.5} opacity={0.6} />
            {/* Mini sine wave in SCADA screen */}
            <path
              d={sineWavePath(0, -2, 22, 4, 2, frame * 0.1)}
              fill="none" stroke={elec.green} strokeWidth={0.8} opacity={0.7} />
          </g>
        )}

        {/* High-voltage warning */}
        {(node.type === 'plant' || node.type === 'substation') && (
          <text x={node.size / 2 + 6} y={-node.size / 2 + 4}
            fontSize={12} fill={elec.orange} opacity={0.6 + Math.sin(frame * 0.15) * 0.2}>
            {'\u26A1'}
          </text>
        )}

        {/* Icon text */}
        {!['generator', 'control'].includes(node.type) && (
          <text textAnchor="middle" dominantBaseline="central"
            fontSize={isOperator ? 26 : 16} fill={node.color}
            style={{ filter: `drop-shadow(0 0 6px rgba(${hexToRgb(node.color)}, 0.6))` }}>
            {node.type === 'plant' ? '\u2607' : node.type === 'substation' ? '\u2B21'
              : node.type === 'tower' ? '\u25CE' : node.type === 'switch' ? '\u23DA'
                : node.type === 'battery' ? '\u25A3' : '\u25C8'}
          </text>
        )}

        {/* Load indicator bar for generators */}
        {node.type === 'generator' && (
          <g transform={`translate(${node.size / 2 + 8}, ${-8})`}>
            <rect x={0} y={0} width={5} height={16} rx={1}
              fill="none" stroke={elec.gray} strokeWidth={0.5} opacity={0.5} />
            <rect x={0.5} y={16 - loadPct * 0.16} width={4} height={loadPct * 0.16} rx={0.5}
              fill={loadPct > 80 ? elec.red : loadPct > 50 ? elec.orange : elec.green}
              opacity={0.7} />
          </g>
        )}

        {/* Label */}
        <text y={node.size / 2 + 16} textAnchor="middle" fill={colors.text}
          fontSize={isOperator ? 13 : 11} fontFamily="'Outfit', 'DM Sans', sans-serif"
          fontWeight={isOperator ? 800 : 600} letterSpacing={isOperator ? 2 : 0.5}>
          {node.label}
        </text>
        {/* Sublabel */}
        <text y={node.size / 2 + 30} textAnchor="middle" fill={colors.textMuted}
          fontSize={8} fontFamily="'IBM Plex Mono', monospace" letterSpacing={1}>
          {node.sublabel}
        </text>
      </g>
    );
  };

  // ── Hex points helper ─────────────────────────────────────────────────────

  function hexPoints(r: number): string {
    return Array.from({ length: 6 }, (_, i) => {
      const a = (i * 60 - 30) * Math.PI / 180;
      return `${Math.cos(a) * r},${Math.sin(a) * r}`;
    }).join(' ');
  }

  // ── Sine wave display (frequency indicator) ───────────────────────────────

  const sineOpacity = interpolate(frame, [25, 40], [0, 1], { extrapolateRight: 'clamp' });

  // ── Voltage meter ─────────────────────────────────────────────────────────

  const meterNeedleAngle = interpolate(
    Math.sin(frame * 0.06),
    [-1, 1],
    [-40, 40],
  );

  // ── Legend ─────────────────────────────────────────────────────────────────

  const legendOpacity = interpolate(frame, [40, 55], [0, 1], { extrapolateRight: 'clamp' });

  const legendItems = useMemo(() => [
    { color: elec.yellow, label: 'Power Plant (operator)' },
    { color: elec.hvBlue, label: 'Substation (broker)' },
    { color: elec.green, label: 'Transmission (hub)' },
    { color: elec.orange, label: 'Breaker Panel (API)' },
    { color: elec.red, label: 'Overloaded Generator' },
  ], []);

  // ── Spark particles near high-energy nodes ────────────────────────────────

  const sparks = useMemo(() => {
    const rng = seededRandom(frame * 3 + 99);
    const sparkNodes = ['operator', 'broker', 'hub'];
    const result: Array<{ x: number; y: number; dx: number; dy: number; color: string; life: number }> = [];
    sparkNodes.forEach((nid) => {
      const n = nodes.find((nd) => nd.id === nid);
      if (!n) return;
      const count = nid === 'operator' ? 5 : 2;
      for (let i = 0; i < count; i++) {
        const angle = rng() * Math.PI * 2;
        const dist = n.size / 2 + rng() * 12;
        result.push({
          x: n.x + Math.cos(angle) * dist,
          y: n.y + Math.sin(angle) * dist,
          dx: (rng() - 0.5) * 3,
          dy: (rng() - 0.5) * 3,
          color: nid === 'operator' ? elec.yellow : nid === 'broker' ? elec.hvBlue : elec.green,
          life: rng(),
        });
      }
    });
    return result;
  }, [frame, nodes]);

  return (
    <AbsoluteFill style={{ backgroundColor: elec.bgMidnight }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <filter id="elecGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="arcGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
          <filter id="titleGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="reactorGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={elec.yellow} stopOpacity="0.1" />
            <stop offset="50%" stopColor={elec.orange} stopOpacity="0.04" />
            <stop offset="100%" stopColor={elec.bgMidnight} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Engineering paper grid */}
        <g opacity={gridOpacity}>
          {Array.from({ length: Math.ceil(width / 40) + 1 }, (_, i) => (
            <line key={`vg${i}`} x1={i * 40} y1={0} x2={i * 40} y2={height}
              stroke={elec.hvBlue} strokeWidth={0.3} opacity={i % 5 === 0 ? 0.5 : 0.2} />
          ))}
          {Array.from({ length: Math.ceil(height / 40) + 1 }, (_, i) => (
            <line key={`hg${i}`} x1={0} y1={i * 40} x2={width} y2={i * 40}
              stroke={elec.hvBlue} strokeWidth={0.3} opacity={i % 5 === 0 ? 0.5 : 0.2} />
          ))}
        </g>

        {/* Reactor core center glow */}
        <circle cx={cx} cy={cy - 10} r={220} fill="url(#reactorGlow)"
          opacity={interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' })} />

        {/* Background spark particles */}
        {bgSparks.map((p, i) => {
          const px = (p.x + Math.cos(p.angle) * p.speed * frame) % width;
          const py = (p.y + Math.sin(p.angle) * p.speed * frame) % height;
          const twinkle = 0.5 + Math.sin(frame * 0.06 + i * 1.3) * 0.5;
          return (
            <circle key={`sp${i}`}
              cx={px < 0 ? px + width : px}
              cy={py < 0 ? py + height : py}
              r={p.size} fill={elec.yellow} opacity={p.opacity * twinkle * gridOpacity} />
          );
        })}

        {/* Lightning bolts */}
        {lightningBolts.map((bolt, i) => bolt.opacity > 0 && (
          <g key={`lb${i}`}>
            <path d={bolt.path} fill="none" stroke={bolt.color} strokeWidth={3}
              opacity={bolt.opacity * 0.3} filter="url(#arcGlow)" />
            <path d={bolt.path} fill="none" stroke="#FFFFFF" strokeWidth={1.5}
              opacity={bolt.opacity} />
          </g>
        ))}

        {/* Power lines (render before nodes) */}
        {lines.map(renderPowerLine)}

        {/* Nodes */}
        {nodes.map(renderNode)}

        {/* Spark particles near high-energy nodes */}
        {sparks.map((sp, i) => (
          <circle key={`spk${i}`} cx={sp.x + sp.dx} cy={sp.y + sp.dy}
            r={1} fill={sp.color} opacity={sp.life * 0.6}>
            <animate attributeName="opacity" values={`${sp.life * 0.6};0`} dur="0.3s" repeatCount="indefinite" />
          </circle>
        ))}

        {/* 60Hz Sine wave display — bottom-right */}
        <g opacity={sineOpacity} transform={`translate(${width - 140}, ${height - 165})`}>
          <rect x={-5} y={-18} width={120} height={36} rx={4}
            fill={elec.bgMidnight} stroke={elec.green} strokeWidth={0.6} opacity={0.7} />
          <text x={55} y={-22} textAnchor="middle" fill={elec.green}
            fontSize={7} fontFamily="'IBM Plex Mono', monospace" opacity={0.6}>
            60 Hz GRID FREQ
          </text>
          <path d={sineWavePath(55, 0, 105, 10, 3, frame * 0.12)}
            fill="none" stroke={elec.green} strokeWidth={1} opacity={0.8} />
        </g>

        {/* Voltage meter — bottom-right above sine */}
        <g opacity={sineOpacity} transform={`translate(${width - 80}, ${height - 210})`}>
          <circle r={22} fill={elec.bgMidnight} stroke={elec.ceramic} strokeWidth={0.8} opacity={0.7} />
          {/* Meter arc */}
          <path d="M-16,-8 A20,20 0 0,1 16,-8" fill="none"
            stroke={elec.yellow} strokeWidth={1.5} opacity={0.5} />
          {/* Needle */}
          <line x1={0} y1={0}
            x2={Math.cos((meterNeedleAngle - 90) * Math.PI / 180) * 16}
            y2={Math.sin((meterNeedleAngle - 90) * Math.PI / 180) * 16}
            stroke={elec.red} strokeWidth={1} opacity={0.8} />
          <circle r={2} fill={elec.ceramic} opacity={0.6} />
          <text y={14} textAnchor="middle" fill={elec.ceramic}
            fontSize={6} fontFamily="'IBM Plex Mono', monospace" opacity={0.5}>
            VOLTS
          </text>
        </g>

        {/* Title */}
        <g opacity={titleOpacity} transform={`translate(0, ${titleY})`}>
          <text x={cx} y={height - 52} textAnchor="middle" fill={elec.yellow}
            fontSize={24} fontFamily="'Outfit', 'DM Sans', sans-serif"
            fontWeight={900} letterSpacing={6} filter="url(#titleGlow)">
            c9-operator
          </text>
          <text x={cx} y={height - 30} textAnchor="middle" fill={elec.orange}
            fontSize={11} fontFamily="'IBM Plex Mono', monospace"
            letterSpacing={4} fontWeight={700}>
            HIGH-VOLTAGE AGENT GRID
          </text>
          {/* Decorative lines flanking title */}
          <line x1={cx - 180} y1={height - 40} x2={cx - 80} y2={height - 40}
            stroke={elec.yellow} strokeWidth={0.5} opacity={0.3} />
          <line x1={cx + 80} y1={height - 40} x2={cx + 180} y2={height - 40}
            stroke={elec.yellow} strokeWidth={0.5} opacity={0.3} />
          {/* Warning triangles */}
          <text x={cx - 195} y={height - 36} fontSize={10} fill={elec.orange} opacity={0.5}>{'\u26A0'}</text>
          <text x={cx + 186} y={height - 36} fontSize={10} fill={elec.orange} opacity={0.5}>{'\u26A0'}</text>
        </g>

        {/* Legend */}
        <g opacity={legendOpacity} transform={`translate(18, ${height - 138})`}>
          <rect x={-6} y={-14} width={170} height={legendItems.length * 18 + 16} rx={4}
            fill={elec.bgMidnight} stroke={elec.gray} strokeWidth={0.5} opacity={0.6} />
          <text x={0} y={-2} fill={elec.ceramic} fontSize={8}
            fontFamily="'IBM Plex Mono', monospace" fontWeight={700} letterSpacing={1} opacity={0.6}>
            LEGEND
          </text>
          {legendItems.map((item, i) => (
            <g key={`leg${i}`} transform={`translate(0, ${i * 18 + 14})`}>
              <rect x={0} y={-4} width={8} height={8} rx={1} fill={item.color} opacity={0.8} />
              <text x={14} y={4} fill={colors.textDim} fontSize={9}
                fontFamily="'IBM Plex Mono', monospace">
                {item.label}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </AbsoluteFill>
  );
};

export default ElectricalGrid;
