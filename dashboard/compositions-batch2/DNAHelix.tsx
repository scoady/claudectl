import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
} from 'remotion';
import { colors, hexToRgb } from './theme';

// -- Deterministic random -------------------------------------------------------

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// -- Types ----------------------------------------------------------------------

interface HelixNode {
  id: string;
  label: string;
  sublabel: string;
  strand: 'left' | 'right';
  index: number;
  color: string;
  nucleotide: string;
  enterDelay: number;
}

interface BasePair {
  leftId: string;
  rightId: string;
  baseType: 'AT' | 'GC';
  enterDelay: number;
}

// -- DNA Helix Architecture Diagram ---------------------------------------------

export const DNAHelix: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const cx = width / 2;
  const helixAmplitude = 160;
  const helixPeriod = height * 0.22;
  const nodeStartY = 80;
  const nodeSpacingY = (height - 160) / 4;

  // Phase rotation over time
  const phaseShift = frame * 0.012;

  // -- Helix strand path generator -----------------------------------------------

  const getStrandX = (y: number, phase: number): number => {
    return cx + Math.sin((y / helixPeriod) * Math.PI * 2 + phase + phaseShift) * helixAmplitude;
  };

  const getStrandDepth = (y: number, phase: number): number => {
    return Math.cos((y / helixPeriod) * Math.PI * 2 + phase + phaseShift);
  };

  // -- Node definitions -----------------------------------------------------------

  const nodes: HelixNode[] = useMemo(() => [
    // Left strand (top to bottom)
    { id: 'api', label: 'API Gateway', sublabel: 'Entry Point', strand: 'left', index: 0, color: colors.blue, nucleotide: 'A', enterDelay: 5 },
    { id: 'operator', label: 'c9-operator', sublabel: 'Coordinator', strand: 'left', index: 1, color: colors.cyan, nucleotide: 'G', enterDelay: 0 },
    { id: 'broker', label: 'Broker', sublabel: 'Session Lifecycle', strand: 'left', index: 2, color: colors.purple, nucleotide: 'C', enterDelay: 10 },
    { id: 'agent1', label: 'Agent \u03b1', sublabel: 'Worker', strand: 'left', index: 3, color: colors.amber, nucleotide: 'T', enterDelay: 20 },
    { id: 'agent2', label: 'Agent \u03b2', sublabel: 'Worker', strand: 'left', index: 4, color: colors.amber, nucleotide: 'A', enterDelay: 25 },
    // Right strand (top to bottom)
    { id: 'dashboard', label: 'Dashboard', sublabel: 'UI Layer', strand: 'right', index: 0, color: colors.textDim, nucleotide: 'T', enterDelay: 5 },
    { id: 'hub', label: 'Hub', sublabel: 'WS Broadcast', strand: 'right', index: 1, color: colors.green, nucleotide: 'C', enterDelay: 10 },
    { id: 'projects', label: 'Projects', sublabel: 'Storage', strand: 'right', index: 2, color: colors.textDim, nucleotide: 'G', enterDelay: 15 },
    { id: 'agent3', label: 'Agent \u03b3', sublabel: 'Worker', strand: 'right', index: 3, color: colors.amber, nucleotide: 'A', enterDelay: 30 },
    { id: 'agent4', label: 'Agent \u03b4', sublabel: 'Spawned by \u03b1', strand: 'right', index: 4, color: colors.rose, nucleotide: 'T', enterDelay: 50 },
  ], []);

  // -- Base pair definitions -------------------------------------------------------

  const basePairs: BasePair[] = useMemo(() => [
    { leftId: 'api', rightId: 'dashboard', baseType: 'AT', enterDelay: 12 },
    { leftId: 'operator', rightId: 'hub', baseType: 'GC', enterDelay: 15 },
    { leftId: 'broker', rightId: 'projects', baseType: 'GC', enterDelay: 20 },
    { leftId: 'agent1', rightId: 'agent3', baseType: 'AT', enterDelay: 35 },
    { leftId: 'agent2', rightId: 'agent4', baseType: 'AT', enterDelay: 55 },
  ], []);

  // -- Compute node positions -----------------------------------------------------

  const getNodePos = (node: HelixNode) => {
    const y = nodeStartY + node.index * nodeSpacingY;
    const phase = node.strand === 'left' ? 0 : Math.PI;
    const x = getStrandX(y, phase);
    const depth = getStrandDepth(y, phase);
    return { x, y, depth };
  };

  // -- Background particles -------------------------------------------------------

  const bgParticles = useMemo(() => {
    const rng = seededRandom(77);
    return Array.from({ length: 80 }, () => ({
      x: rng() * 1920,
      y: rng() * 1080,
      size: rng() * 2 + 0.5,
      speed: rng() * 0.15 + 0.02,
      angle: rng() * Math.PI * 2,
      opacity: rng() * 0.3 + 0.05,
      color: [colors.cyan, colors.purple, colors.green, '#ffffff'][Math.floor(rng() * 4)],
    }));
  }, []);

  // -- Phosphorescent molecules ---------------------------------------------------

  const molecules = useMemo(() => {
    const rng = seededRandom(99);
    return Array.from({ length: 25 }, () => ({
      x: rng() * 1920,
      y: rng() * 1080,
      size: rng() * 4 + 2,
      rotSpeed: (rng() - 0.5) * 0.03,
      drift: rng() * 0.2,
      hue: rng() > 0.5 ? colors.cyan : colors.purple,
    }));
  }, []);

  // -- Gel electrophoresis lanes ---------------------------------------------------

  const gelLanes = useMemo(() => {
    const rng = seededRandom(33);
    return Array.from({ length: 6 }, (_, i) => ({
      x: 40 + i * 35,
      bands: Array.from({ length: 4 + Math.floor(rng() * 3) }, () => ({
        y: 100 + rng() * (1080 - 200),
        width: 18 + rng() * 8,
        opacity: rng() * 0.12 + 0.03,
      })),
    }));
  }, []);

  // -- Codon table ---------------------------------------------------------------

  const codonMappings = useMemo(() => [
    { codon: 'API', amino: 'Gateway' },
    { codon: 'OPR', amino: 'Coordinator' },
    { codon: 'BRK', amino: 'Lifecycle' },
    { codon: 'HUB', amino: 'Broadcast' },
    { codon: 'AGT', amino: 'Worker' },
  ], []);

  // -- Animations ----------------------------------------------------------------

  const fadeIn = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });
  const helicaseY = interpolate(frame, [10, 120], [-30, height * 0.35], { extrapolateRight: 'clamp' });
  const helicaseOpacity = interpolate(frame, [10, 20, 100, 120], [0, 0.8, 0.8, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // -- Strand path rendering ------------------------------------------------------

  const renderStrandPath = (phase: number, color: string) => {
    const segments = 200;

    // Render depth-aware strand segments
    const strandSegments: React.ReactElement[] = [];
    for (let i = 1; i <= segments; i++) {
      const y0 = ((i - 1) / segments) * height;
      const y1 = (i / segments) * height;
      const x0 = getStrandX(y0, phase);
      const x1 = getStrandX(y1, phase);
      const d0 = getStrandDepth(y0, phase);
      const d1 = getStrandDepth(y1, phase);
      const avgDepth = (d0 + d1) / 2;
      const segOpacity = avgDepth > 0 ? 0.9 : 0.2;
      const segWidth = avgDepth > 0 ? 3.5 : 1.5;

      strandSegments.push(
        <line
          key={`s-${phase.toFixed(1)}-${i}`}
          x1={x0} y1={y0} x2={x1} y2={y1}
          stroke={color}
          strokeWidth={segWidth}
          opacity={segOpacity * fadeIn}
          strokeLinecap="round"
        />
      );
    }
    return strandSegments;
  };

  // -- Render base pair rungs -----------------------------------------------------

  const renderBasePair = (pair: BasePair, i: number) => {
    const leftNode = nodes.find(n => n.id === pair.leftId);
    const rightNode = nodes.find(n => n.id === pair.rightId);
    if (!leftNode || !rightNode) return null;

    const leftPos = getNodePos(leftNode);
    const rightPos = getNodePos(rightNode);

    const enterProgress = spring({
      frame: frame - pair.enterDelay,
      fps,
      config: { damping: 14, stiffness: 60 },
    });

    if (enterProgress <= 0.01) return null;

    const pairColor = pair.baseType === 'AT' ? colors.rose : colors.blue;
    const pairLabel = pair.baseType === 'AT' ? 'A=T' : 'G\u2261C';

    const midX = (leftPos.x + rightPos.x) / 2;
    const midY = (leftPos.y + rightPos.y) / 2;

    // Hydrogen bond dots
    const bondCount = pair.baseType === 'AT' ? 2 : 3;
    const bonds: React.ReactElement[] = [];
    for (let b = 0; b < bondCount; b++) {
      const t = (b + 1) / (bondCount + 1);
      const bx = leftPos.x + (rightPos.x - leftPos.x) * t;
      const by = leftPos.y + (rightPos.y - leftPos.y) * t;
      bonds.push(
        <circle
          key={`bond-${i}-${b}`}
          cx={bx} cy={by} r={1.5}
          fill={pairColor}
          opacity={0.6 * enterProgress}
        />
      );
    }

    return (
      <g key={`bp-${i}`} opacity={enterProgress}>
        {/* Main rung line */}
        <line
          x1={leftPos.x} y1={leftPos.y}
          x2={leftPos.x + (rightPos.x - leftPos.x) * enterProgress}
          y2={leftPos.y + (rightPos.y - leftPos.y) * enterProgress}
          stroke={pairColor}
          strokeWidth={1.5}
          strokeDasharray="4 3"
          opacity={0.5}
        />
        {/* Hydrogen bonds */}
        {bonds}
        {/* Base pair label */}
        {enterProgress > 0.8 && (
          <text
            x={midX} y={midY - 10}
            textAnchor="middle"
            fill={pairColor}
            fontSize={8}
            fontFamily="'IBM Plex Mono', monospace"
            fontWeight={600}
            opacity={0.7}
          >
            {pairLabel}
          </text>
        )}
      </g>
    );
  };

  // -- Render node ----------------------------------------------------------------

  const renderNode = (node: HelixNode) => {
    const pos = getNodePos(node);
    const s = spring({
      frame: frame - node.enterDelay,
      fps,
      config: { damping: 12, stiffness: 80 },
    });
    if (s <= 0.01) return null;

    const isOperator = node.id === 'operator';
    const depthScale = 0.85 + (pos.depth + 1) / 2 * 0.3;
    const depthOpacity = pos.depth > 0 ? 1 : 0.5;
    const nodeSize = isOperator ? 32 : 24;
    const pulse = isOperator ? 1 + Math.sin(frame * 0.08) * 0.04 : 1;

    // Electron orbital rings
    const orbitalAngle1 = frame * 0.025 + node.index;
    const orbitalAngle2 = frame * 0.018 + node.index + 2;

    // Label offset based on strand
    const labelOffsetX = node.strand === 'left' ? -55 : 55;
    const labelAnchor = node.strand === 'left' ? 'end' : 'start';

    return (
      <g
        key={node.id}
        transform={`translate(${pos.x}, ${pos.y}) scale(${s * depthScale * pulse})`}
        opacity={depthOpacity}
      >
        {/* Outer orbital ring 1 */}
        <ellipse
          cx={0} cy={0}
          rx={nodeSize + 10}
          ry={(nodeSize + 10) * 0.35}
          fill="none"
          stroke={node.color}
          strokeWidth={0.6}
          opacity={0.25}
          transform={`rotate(${orbitalAngle1 * 30})`}
        />
        {/* Outer orbital ring 2 */}
        <ellipse
          cx={0} cy={0}
          rx={nodeSize + 14}
          ry={(nodeSize + 14) * 0.3}
          fill="none"
          stroke={node.color}
          strokeWidth={0.4}
          opacity={0.15}
          transform={`rotate(${-orbitalAngle2 * 25})`}
        />
        {/* Electron on orbital */}
        <circle
          cx={Math.cos(orbitalAngle1) * (nodeSize + 10)}
          cy={Math.sin(orbitalAngle1) * (nodeSize + 10) * 0.35}
          r={2}
          fill={node.color}
          opacity={0.7}
        />

        {/* CRISPR indicator for operator */}
        {isOperator && (
          <g opacity={0.6}>
            <rect
              x={nodeSize + 18} y={-8}
              width={42} height={16}
              rx={3}
              fill={colors.bgDeep}
              stroke={colors.cyan}
              strokeWidth={0.5}
            />
            <text
              x={nodeSize + 39} y={4}
              textAnchor="middle"
              fill={colors.cyan}
              fontSize={7}
              fontFamily="'IBM Plex Mono', monospace"
              fontWeight={700}
            >
              CRISPR
            </text>
          </g>
        )}

        {/* Glow */}
        <circle
          r={nodeSize + 6}
          fill={`rgba(${hexToRgb(node.color)}, 0.06)`}
          stroke="none"
        />
        {/* Node body */}
        <circle
          r={nodeSize}
          fill={colors.bgDeep}
          stroke={node.color}
          strokeWidth={isOperator ? 2.5 : 1.5}
          opacity={0.95}
        />
        {/* Inner ring */}
        <circle
          r={nodeSize - 4}
          fill="none"
          stroke={`rgba(${hexToRgb(node.color)}, 0.12)`}
          strokeWidth={0.8}
        />

        {/* Nucleotide letter */}
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={isOperator ? 22 : 16}
          fill={node.color}
          fontFamily="'IBM Plex Mono', monospace"
          fontWeight={800}
          style={{ filter: `drop-shadow(0 0 4px rgba(${hexToRgb(node.color)}, 0.5))` }}
        >
          {node.nucleotide}
        </text>

        {/* Labels */}
        <text
          x={labelOffsetX} y={-4}
          textAnchor={labelAnchor}
          fill={colors.text}
          fontSize={isOperator ? 12 : 10}
          fontFamily="'Outfit', 'DM Sans', sans-serif"
          fontWeight={isOperator ? 700 : 600}
          letterSpacing={isOperator ? 1.2 : 0.4}
        >
          {node.label}
        </text>
        <text
          x={labelOffsetX} y={10}
          textAnchor={labelAnchor}
          fill={colors.textMuted}
          fontSize={8}
          fontFamily="'IBM Plex Mono', monospace"
        >
          {node.sublabel}
        </text>
      </g>
    );
  };

  // -- Helicase enzyme animation ---------------------------------------------------

  const renderHelicase = () => {
    if (helicaseOpacity <= 0.01) return null;
    const hx = getStrandX(helicaseY, Math.PI / 2);
    const wobble = Math.sin(frame * 0.15) * 8;

    return (
      <g opacity={helicaseOpacity} transform={`translate(${hx + wobble}, ${helicaseY})`}>
        {/* Enzyme body */}
        <ellipse
          cx={0} cy={0}
          rx={28} ry={16}
          fill={`rgba(${hexToRgb(colors.green)}, 0.15)`}
          stroke={colors.green}
          strokeWidth={1.2}
        />
        {/* Wedge shape */}
        <polygon
          points="-12,-8 12,-8 0,14"
          fill={`rgba(${hexToRgb(colors.green)}, 0.1)`}
          stroke={colors.green}
          strokeWidth={0.8}
          opacity={0.7}
        />
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fill={colors.green}
          fontSize={7}
          fontFamily="'IBM Plex Mono', monospace"
          fontWeight={700}
        >
          HELICASE
        </text>
        {/* Unzipping sparks */}
        {[0, 1, 2].map(si => {
          const sparkAngle = frame * 0.2 + si * 2.1;
          const sparkR = 20 + Math.sin(sparkAngle) * 8;
          return (
            <circle
              key={`spark-${si}`}
              cx={Math.cos(sparkAngle) * sparkR}
              cy={Math.sin(sparkAngle) * sparkR * 0.5 + 10}
              r={1.5}
              fill={colors.green}
              opacity={0.5 + Math.sin(sparkAngle) * 0.3}
            />
          );
        })}
      </g>
    );
  };

  // -- Replication fork -----------------------------------------------------------

  const forkOpacity = interpolate(frame, [15, 30], [0, 0.7], { extrapolateRight: 'clamp' });
  const forkY = 35;

  // -- Connection arrows (architectural flow) -------------------------------------

  const flowArrows = useMemo(() => [
    { from: 'api', to: 'operator', label: 'dispatch', color: colors.blue, delay: 8 },
    { from: 'operator', to: 'broker', label: 'spawn', color: colors.purple, delay: 14 },
    { from: 'broker', to: 'agent1', label: 'lifecycle', color: colors.amber, delay: 22 },
    { from: 'broker', to: 'agent2', label: '', color: colors.amber, delay: 27 },
    { from: 'hub', to: 'dashboard', label: 'stream', color: colors.green, delay: 16 },
    { from: 'agent1', to: 'operator', label: 'spawn_req', color: colors.rose, delay: 45 },
    { from: 'broker', to: 'agent3', label: '', color: colors.amber, delay: 32 },
  ], []);

  const renderFlowArrow = (arrow: typeof flowArrows[0], i: number) => {
    const fromNode = nodes.find(n => n.id === arrow.from);
    const toNode = nodes.find(n => n.id === arrow.to);
    if (!fromNode || !toNode) return null;

    const fromPos = getNodePos(fromNode);
    const toPos = getNodePos(toNode);

    const progress = interpolate(frame, [arrow.delay, arrow.delay + 25], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    if (progress <= 0) return null;

    // Curved path between nodes (outside the helix)
    const isLeft = fromNode.strand === 'left' && toNode.strand === 'left';
    const curveOffset = isLeft ? -80 : 80;
    const midY = (fromPos.y + toPos.y) / 2;
    const midX = (fromPos.x + toPos.x) / 2 + curveOffset;

    const pathD = `M ${fromPos.x} ${fromPos.y} Q ${midX} ${midY} ${toPos.x} ${toPos.y}`;

    // Animated particle
    const particleT = progress >= 1 ? ((frame - arrow.delay) % 50) / 50 : 0;

    return (
      <g key={`flow-${i}`} opacity={progress * 0.6}>
        <path
          d={pathD}
          fill="none"
          stroke={arrow.color}
          strokeWidth={1}
          strokeDasharray="3 4"
          opacity={0.5}
        />
        {arrow.label && progress > 0.8 && (
          <text
            x={midX + (isLeft ? -10 : 10)}
            y={midY}
            textAnchor="middle"
            fill={arrow.color}
            fontSize={7}
            fontFamily="'IBM Plex Mono', monospace"
            opacity={0.6}
          >
            {arrow.label}
          </text>
        )}
        {progress >= 1 && (
          <circle
            cx={fromPos.x + (toPos.x - fromPos.x) * particleT}
            cy={fromPos.y + (toPos.y - fromPos.y) * particleT}
            r={2}
            fill={arrow.color}
            opacity={0.8}
          />
        )}
      </g>
    );
  };

  // -- Groove labels ---------------------------------------------------------------

  const grooveOpacity = interpolate(frame, [25, 40], [0, 0.4], { extrapolateRight: 'clamp' });

  // -- Title -----------------------------------------------------------------------

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  // -- Codon table opacity ---------------------------------------------------------

  const codonOpacity = interpolate(frame, [45, 60], [0, 0.7], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bgDeep }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <filter id="dnaGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="dnaEdgeGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
          <linearGradient id="cyanStrand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.cyan} />
            <stop offset="50%" stopColor={colors.cyanDim} />
            <stop offset="100%" stopColor={colors.cyan} />
          </linearGradient>
          <linearGradient id="magentaStrand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.purple} />
            <stop offset="50%" stopColor={colors.rose} />
            <stop offset="100%" stopColor={colors.purple} />
          </linearGradient>
          <radialGradient id="dnaCenter" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={colors.cyan} stopOpacity="0.05" />
            <stop offset="100%" stopColor={colors.bgDeep} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Gel electrophoresis lanes (far left background) */}
        <g opacity={fadeIn * 0.5}>
          {gelLanes.map((lane, li) =>
            lane.bands.map((band, bi) => (
              <rect
                key={`gel-${li}-${bi}`}
                x={lane.x} y={band.y}
                width={band.width} height={3}
                rx={1}
                fill={colors.cyan}
                opacity={band.opacity}
              />
            ))
          )}
        </g>

        {/* Background floating particles */}
        {bgParticles.map((p, i) => {
          const px = (p.x + Math.cos(p.angle) * p.speed * frame) % width;
          const py = (p.y + Math.sin(p.angle) * p.speed * frame) % height;
          const twinkle = 0.5 + Math.sin(frame * 0.04 + i * 0.7) * 0.5;
          return (
            <circle
              key={`bp-${i}`}
              cx={px < 0 ? px + width : px}
              cy={py < 0 ? py + height : py}
              r={p.size}
              fill={p.color}
              opacity={p.opacity * twinkle * fadeIn}
            />
          );
        })}

        {/* Phosphorescent molecules */}
        {molecules.map((mol, i) => {
          const mx = mol.x + Math.sin(frame * mol.drift + i) * 15;
          const my = mol.y + Math.cos(frame * mol.drift * 0.7 + i) * 10;
          const rot = frame * mol.rotSpeed * 50;
          return (
            <g key={`mol-${i}`} transform={`translate(${mx}, ${my}) rotate(${rot})`} opacity={fadeIn * 0.3}>
              <circle r={mol.size} fill="none" stroke={mol.hue} strokeWidth={0.5} opacity={0.4} />
              <circle r={mol.size * 0.4} fill={mol.hue} opacity={0.2} />
              <line x1={-mol.size * 1.3} y1={0} x2={mol.size * 1.3} y2={0} stroke={mol.hue} strokeWidth={0.3} opacity={0.3} />
              <line x1={0} y1={-mol.size * 1.3} x2={0} y2={mol.size * 1.3} stroke={mol.hue} strokeWidth={0.3} opacity={0.3} />
            </g>
          );
        })}

        {/* Center glow */}
        <circle cx={cx} cy={height / 2} r={250} fill="url(#dnaCenter)" opacity={fadeIn} />

        {/* DNA backbone strands - LEFT (cyan) */}
        {renderStrandPath(0, colors.cyan)}
        {/* DNA backbone strands - RIGHT (magenta/purple) */}
        {renderStrandPath(Math.PI, colors.purple)}

        {/* Strand glow underlay */}
        {renderStrandPath(0, colors.cyan)?.filter((_, fi) => fi % 5 === 0).map((_, gi) => (
          <line
            key={`glow-l-${gi}`}
            x1={0} y1={0} x2={0} y2={0}
            stroke={colors.cyan}
            strokeWidth={8}
            opacity={0.05}
            filter="url(#dnaEdgeGlow)"
          />
        ))}

        {/* Base pair rungs */}
        {basePairs.map(renderBasePair)}

        {/* Groove labels */}
        <g opacity={grooveOpacity}>
          <text
            x={cx - helixAmplitude - 30} y={nodeStartY + nodeSpacingY * 0.5}
            textAnchor="middle"
            fill={colors.textMuted}
            fontSize={8}
            fontFamily="'IBM Plex Mono', monospace"
            transform={`rotate(-90, ${cx - helixAmplitude - 30}, ${nodeStartY + nodeSpacingY * 0.5})`}
          >
            MAJOR GROOVE
          </text>
          <text
            x={cx + helixAmplitude + 30} y={nodeStartY + nodeSpacingY * 2.5}
            textAnchor="middle"
            fill={colors.textMuted}
            fontSize={8}
            fontFamily="'IBM Plex Mono', monospace"
            transform={`rotate(90, ${cx + helixAmplitude + 30}, ${nodeStartY + nodeSpacingY * 2.5})`}
          >
            MINOR GROOVE
          </text>
        </g>

        {/* Flow arrows (architectural connections outside helix) */}
        {flowArrows.map(renderFlowArrow)}

        {/* Nodes on helix */}
        {nodes.map(renderNode)}

        {/* Helicase enzyme */}
        {renderHelicase()}

        {/* Replication fork indicator */}
        <g opacity={forkOpacity}>
          <path
            d={`M ${cx - 40} ${forkY} L ${cx} ${forkY + 25} L ${cx + 40} ${forkY}`}
            fill="none"
            stroke={colors.green}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          <text
            x={cx} y={forkY - 8}
            textAnchor="middle"
            fill={colors.green}
            fontSize={7}
            fontFamily="'IBM Plex Mono', monospace"
            fontWeight={600}
            opacity={0.7}
          >
            REPLICATION FORK
          </text>
        </g>

        {/* Codon table (bottom right) */}
        <g opacity={codonOpacity} transform={`translate(${width - 180}, ${height - 140})`}>
          <rect
            x={0} y={0}
            width={150} height={codonMappings.length * 18 + 22}
            rx={4}
            fill={colors.bgDeep}
            stroke={colors.textMuted}
            strokeWidth={0.5}
            opacity={0.8}
          />
          <text
            x={75} y={14}
            textAnchor="middle"
            fill={colors.textDim}
            fontSize={8}
            fontFamily="'IBM Plex Mono', monospace"
            fontWeight={700}
            letterSpacing={1}
          >
            CODON TABLE
          </text>
          {codonMappings.map((cm, ci) => (
            <g key={`cod-${ci}`} transform={`translate(10, ${ci * 18 + 28})`}>
              <text
                x={0} y={0}
                fill={colors.cyan}
                fontSize={8}
                fontFamily="'IBM Plex Mono', monospace"
                fontWeight={700}
              >
                {cm.codon}
              </text>
              <text
                x={35} y={0}
                fill={colors.textMuted}
                fontSize={7}
                fontFamily="'IBM Plex Mono', monospace"
              >
                {'\u2192'}
              </text>
              <text
                x={50} y={0}
                fill={colors.textDim}
                fontSize={8}
                fontFamily="'IBM Plex Mono', monospace"
              >
                {cm.amino}
              </text>
            </g>
          ))}
        </g>

        {/* Legend */}
        <g opacity={fadeIn} transform={`translate(20, ${height - 120})`}>
          {[
            { color: colors.cyan, label: 'Left strand (5\u2032\u21923\u2032)' },
            { color: colors.purple, label: 'Right strand (3\u2032\u21925\u2032)' },
            { color: colors.rose, label: 'A=T base pair' },
            { color: colors.blue, label: 'G\u2261C base pair' },
            { color: colors.green, label: 'Helicase enzyme' },
          ].map((item, i) => (
            <g key={`leg-${i}`} transform={`translate(0, ${i * 16})`}>
              <circle cx={6} cy={0} r={3.5} fill={item.color} opacity={0.8} />
              <text x={16} y={3} fill={colors.textDim} fontSize={8} fontFamily="'IBM Plex Mono', monospace">
                {item.label}
              </text>
            </g>
          ))}
        </g>

        {/* Title */}
        <g opacity={titleOpacity}>
          <text
            x={cx} y={height - 40}
            textAnchor="middle"
            fill={colors.cyan}
            fontSize={20}
            fontFamily="'Outfit', 'DM Sans', sans-serif"
            fontWeight={800}
            letterSpacing={4}
            filter="url(#dnaGlow)"
          >
            GENETIC ARCHITECTURE
          </text>
          <text
            x={cx} y={height - 20}
            textAnchor="middle"
            fill={colors.textMuted}
            fontSize={10}
            fontFamily="'IBM Plex Mono', monospace"
            letterSpacing={2}
          >
            c9-operator DOUBLE HELIX
          </text>
        </g>
      </svg>
    </AbsoluteFill>
  );
};

export default DNAHelix;
