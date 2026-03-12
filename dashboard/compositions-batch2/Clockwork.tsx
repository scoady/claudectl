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

interface GearNode {
  id: string;
  label: string;
  sublabel: string;
  x: number;
  y: number;
  radius: number;
  teeth: number;
  color: string;
  role: 'balance' | 'mainspring' | 'escapement' | 'crown' | 'gear' | 'date' | 'dial';
  rotationSpeed: number;
  rotationDirection: 1 | -1;
  enterDelay: number;
}

interface MeshConnection {
  fromId: string;
  toId: string;
  label: string;
  ratio: string;
  enterDelay: number;
}

// -- Gear tooth path generator --------------------------------------------------

function generateGearPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  teeth: number,
): string {
  const points: string[] = [];
  const anglePerTooth = (Math.PI * 2) / teeth;
  const toothWidth = anglePerTooth * 0.35;

  for (let i = 0; i < teeth; i++) {
    const baseAngle = i * anglePerTooth;
    // Inner start
    const a0 = baseAngle - toothWidth;
    // Outer start
    const a1 = baseAngle - toothWidth * 0.6;
    // Outer end
    const a2 = baseAngle + toothWidth * 0.6;
    // Inner end
    const a3 = baseAngle + toothWidth;

    if (i === 0) {
      points.push(`M ${cx + Math.cos(a0) * innerR} ${cy + Math.sin(a0) * innerR}`);
    }

    points.push(`L ${cx + Math.cos(a1) * outerR} ${cy + Math.sin(a1) * outerR}`);
    points.push(`L ${cx + Math.cos(a2) * outerR} ${cy + Math.sin(a2) * outerR}`);
    points.push(`L ${cx + Math.cos(a3) * innerR} ${cy + Math.sin(a3) * innerR}`);

    // Arc along inner radius to next tooth
    const nextA0 = (i + 1) * anglePerTooth - toothWidth;
    if (i < teeth - 1) {
      points.push(`A ${innerR} ${innerR} 0 0 1 ${cx + Math.cos(nextA0) * innerR} ${cy + Math.sin(nextA0) * innerR}`);
    }
  }
  points.push('Z');
  return points.join(' ');
}

// -- Spiral path for mainspring -------------------------------------------------

function generateSpiralPath(cx: number, cy: number, maxR: number, turns: number, unwind: number): string {
  const points: string[] = [];
  const steps = turns * 60;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = t * turns * Math.PI * 2 + unwind;
    const r = 6 + (maxR - 6) * t;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    points.push(i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`);
  }
  return points.join(' ');
}

// -- Hairspring path for balance wheel -------------------------------------------

function generateHairspringPath(cx: number, cy: number, maxR: number, turns: number): string {
  const points: string[] = [];
  const steps = turns * 40;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = t * turns * Math.PI * 2;
    const r = 3 + (maxR - 3) * t;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    points.push(i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`);
  }
  return points.join(' ');
}

// -- Clockwork Architecture Diagram ---------------------------------------------

export const Clockwork: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const cx = width / 2;
  const cy = height / 2;

  // -- Balance wheel oscillation ---------------------------------------------------

  const balanceAngle = Math.sin(frame * 0.12) * 25; // oscillates +/- 25 degrees
  const escapementTick = Math.floor(frame / 15) % 2; // ticks every 15 frames

  // -- Mainspring unwind -----------------------------------------------------------

  const mainspringUnwind = frame * 0.005;

  // -- Gear nodes -----------------------------------------------------------------

  const gearNodes: GearNode[] = useMemo(() => [
    // CENTER: c9-operator as balance wheel
    {
      id: 'operator', label: 'c9-operator', sublabel: 'Balance Wheel',
      x: cx, y: cy, radius: 65, teeth: 0, color: colors.cyan,
      role: 'balance', rotationSpeed: 0, rotationDirection: 1, enterDelay: 0,
    },
    // LEFT: Broker as mainspring barrel
    {
      id: 'broker', label: 'Broker', sublabel: 'Mainspring',
      x: cx - 240, y: cy - 20, radius: 55, teeth: 24, color: colors.purple,
      role: 'mainspring', rotationSpeed: 0.3, rotationDirection: -1, enterDelay: 8,
    },
    // RIGHT: Hub as escapement wheel
    {
      id: 'hub', label: 'Hub', sublabel: 'Escapement',
      x: cx + 240, y: cy - 20, radius: 50, teeth: 15, color: colors.green,
      role: 'escapement', rotationSpeed: 0.8, rotationDirection: 1, enterDelay: 8,
    },
    // TOP: API Gateway as crown/stem
    {
      id: 'api', label: 'API Gateway', sublabel: 'Crown / Stem',
      x: cx, y: 80, radius: 35, teeth: 12, color: colors.blue,
      role: 'crown', rotationSpeed: 0.5, rotationDirection: -1, enterDelay: 5,
    },
    // BOTTOM ROW: Agent gear train
    {
      id: 'agent1', label: 'Agent \u03b1', sublabel: 'First Wheel',
      x: cx - 210, y: cy + 200, radius: 48, teeth: 20, color: colors.amber,
      role: 'gear', rotationSpeed: 0.4, rotationDirection: 1, enterDelay: 18,
    },
    {
      id: 'agent2', label: 'Agent \u03b2', sublabel: 'Second Wheel',
      x: cx - 60, y: cy + 210, radius: 40, teeth: 16, color: colors.amber,
      role: 'gear', rotationSpeed: 0.6, rotationDirection: -1, enterDelay: 22,
    },
    {
      id: 'agent3', label: 'Agent \u03b3', sublabel: 'Third Wheel',
      x: cx + 90, y: cy + 200, radius: 36, teeth: 14, color: colors.amber,
      role: 'gear', rotationSpeed: 0.9, rotationDirection: 1, enterDelay: 26,
    },
    {
      id: 'agent4', label: 'Agent \u03b4', sublabel: 'Fourth Wheel',
      x: cx + 220, y: cy + 210, radius: 30, teeth: 10, color: colors.rose,
      role: 'gear', rotationSpeed: 1.4, rotationDirection: -1, enterDelay: 45,
    },
    // UPPER LEFT: Projects as date wheel
    {
      id: 'projects', label: 'Projects', sublabel: 'Date Wheel',
      x: cx - 300, y: 120, radius: 45, teeth: 31, color: colors.textDim,
      role: 'date', rotationSpeed: 0.1, rotationDirection: 1, enterDelay: 12,
    },
    // UPPER RIGHT: Dashboard as dial
    {
      id: 'dashboard', label: 'Dashboard', sublabel: 'Dial Face',
      x: cx + 300, y: 110, radius: 55, teeth: 0, color: colors.textDim,
      role: 'dial', rotationSpeed: 0, rotationDirection: 1, enterDelay: 12,
    },
  ], [cx, cy]);

  // -- Mesh connections -----------------------------------------------------------

  const meshConnections: MeshConnection[] = useMemo(() => [
    { fromId: 'api', toId: 'operator', label: 'dispatch', ratio: '1:3', enterDelay: 10 },
    { fromId: 'operator', toId: 'broker', label: 'spawn', ratio: '3:1', enterDelay: 14 },
    { fromId: 'operator', toId: 'hub', label: 'events', ratio: '2:1', enterDelay: 14 },
    { fromId: 'broker', toId: 'agent1', label: 'lifecycle', ratio: '4:1', enterDelay: 20 },
    { fromId: 'agent1', toId: 'agent2', label: 'mesh', ratio: '5:4', enterDelay: 24 },
    { fromId: 'agent2', toId: 'agent3', label: 'mesh', ratio: '8:7', enterDelay: 28 },
    { fromId: 'agent3', toId: 'agent4', label: 'mesh', ratio: '7:5', enterDelay: 47 },
    { fromId: 'hub', toId: 'dashboard', label: 'stream', ratio: '12:1', enterDelay: 18 },
    { fromId: 'agent1', toId: 'operator', label: 'spawn_req', ratio: '', enterDelay: 40 },
  ], []);

  // -- Background: Geneva stripes ------------------------------------------------

  const genevaStripes = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => ({
      offset: i * 45,
    }));
  }, []);

  // -- Blued screws ---------------------------------------------------------------

  const screws = useMemo(() => {
    const rng = seededRandom(55);
    return Array.from({ length: 16 }, () => ({
      x: 100 + rng() * (1920 - 200),
      y: 80 + rng() * (1080 - 160),
      size: 4 + rng() * 3,
    }));
  }, []);

  // -- Animations ----------------------------------------------------------------

  const fadeIn = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: 'clamp' });
  const plateOpacity = interpolate(frame, [0, 15], [0, 0.15], { extrapolateRight: 'clamp' });

  // -- Power reserve indicator ----------------------------------------------------

  const powerReserve = interpolate(frame, [0, 300], [1, 0.15], { extrapolateRight: 'clamp' });
  const prOpacity = interpolate(frame, [20, 35], [0, 0.8], { extrapolateRight: 'clamp' });

  // -- Render a gear --------------------------------------------------------------

  const renderGear = (gear: GearNode) => {
    const s = spring({
      frame: frame - gear.enterDelay,
      fps,
      config: { damping: 14, stiffness: 70 },
    });
    if (s <= 0.01) return null;

    // Rotation angle
    let rotation = 0;
    if (gear.role === 'balance') {
      rotation = balanceAngle;
    } else if (gear.rotationSpeed > 0) {
      rotation = frame * gear.rotationSpeed * gear.rotationDirection;
    }

    const isOperator = gear.id === 'operator';
    const isBroker = gear.role === 'mainspring';
    const isEscapement = gear.role === 'escapement';
    const isDial = gear.role === 'dial';
    const isDate = gear.role === 'date';

    return (
      <g key={gear.id} transform={`translate(${gear.x}, ${gear.y})`} opacity={s}>
        {/* Gear body with teeth */}
        {gear.teeth > 0 && (
          <g transform={`rotate(${rotation})`}>
            {/* Gear teeth path */}
            <path
              d={generateGearPath(0, 0, gear.radius, gear.radius * 0.82, gear.teeth)}
              fill={`rgba(${hexToRgb(gear.color)}, 0.08)`}
              stroke={gear.color}
              strokeWidth={1.2}
              opacity={0.8}
            />
            {/* Inner hub circle */}
            <circle
              r={gear.radius * 0.35}
              fill={colors.bgDeep}
              stroke={gear.color}
              strokeWidth={0.8}
              opacity={0.6}
            />
            {/* Spokes */}
            {Array.from({ length: 4 }, (_, i) => {
              const a = (i / 4) * Math.PI * 2;
              return (
                <line
                  key={`spoke-${i}`}
                  x1={Math.cos(a) * gear.radius * 0.35}
                  y1={Math.sin(a) * gear.radius * 0.35}
                  x2={Math.cos(a) * gear.radius * 0.78}
                  y2={Math.sin(a) * gear.radius * 0.78}
                  stroke={gear.color}
                  strokeWidth={0.6}
                  opacity={0.3}
                />
              );
            })}
          </g>
        )}

        {/* Balance wheel (special rendering) */}
        {isOperator && (
          <g transform={`rotate(${rotation})`}>
            {/* Balance wheel rim */}
            <circle
              r={gear.radius}
              fill="none"
              stroke={gear.color}
              strokeWidth={3}
              opacity={0.9}
            />
            {/* Balance wheel arms */}
            {[0, 90, 180, 270].map(a => (
              <line
                key={`barm-${a}`}
                x1={0} y1={0}
                x2={Math.cos((a * Math.PI) / 180) * gear.radius}
                y2={Math.sin((a * Math.PI) / 180) * gear.radius}
                stroke={gear.color}
                strokeWidth={2}
                opacity={0.6}
              />
            ))}
            {/* Counterweights */}
            {[45, 225].map(a => (
              <circle
                key={`cw-${a}`}
                cx={Math.cos((a * Math.PI) / 180) * gear.radius * 0.75}
                cy={Math.sin((a * Math.PI) / 180) * gear.radius * 0.75}
                r={6}
                fill={`rgba(${hexToRgb(gear.color)}, 0.3)`}
                stroke={gear.color}
                strokeWidth={0.8}
              />
            ))}
            {/* Hairspring */}
            <path
              d={generateHairspringPath(0, 0, gear.radius * 0.45, 4)}
              fill="none"
              stroke={colors.cyan}
              strokeWidth={0.6}
              opacity={0.5}
            />
          </g>
        )}

        {/* Mainspring spiral */}
        {isBroker && (
          <path
            d={generateSpiralPath(0, 0, gear.radius * 0.7, 3.5, mainspringUnwind)}
            fill="none"
            stroke={colors.purple}
            strokeWidth={1.5}
            opacity={0.5}
          />
        )}

        {/* Escapement pallet fork */}
        {isEscapement && (
          <g transform={`rotate(${escapementTick * 12 - 6})`}>
            <line
              x1={0} y1={-gear.radius - 15}
              x2={0} y2={gear.radius + 15}
              stroke={colors.green}
              strokeWidth={2}
              opacity={0.5}
            />
            {/* Pallet stones */}
            <rect
              x={-4} y={-gear.radius - 18}
              width={8} height={6}
              rx={1}
              fill={colors.rose}
              opacity={0.7}
            />
            <rect
              x={-4} y={gear.radius + 12}
              width={8} height={6}
              rx={1}
              fill={colors.rose}
              opacity={0.7}
            />
          </g>
        )}

        {/* Date wheel numbers */}
        {isDate && (
          <g transform={`rotate(${rotation})`}>
            {Array.from({ length: 12 }, (_, i) => {
              const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
              return (
                <text
                  key={`date-${i}`}
                  x={Math.cos(a) * gear.radius * 0.7}
                  y={Math.sin(a) * gear.radius * 0.7 + 3}
                  textAnchor="middle"
                  fill={colors.textDim}
                  fontSize={7}
                  fontFamily="'IBM Plex Mono', monospace"
                  opacity={0.5}
                >
                  {i + 1}
                </text>
              );
            })}
          </g>
        )}

        {/* Dial face with clock hands */}
        {isDial && (
          <>
            {/* Dial circle */}
            <circle
              r={gear.radius}
              fill={`rgba(${hexToRgb(colors.surface0)}, 0.3)`}
              stroke={colors.textDim}
              strokeWidth={2}
              opacity={0.8}
            />
            {/* Hour markers */}
            {Array.from({ length: 12 }, (_, i) => {
              const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
              const inner = gear.radius * 0.8;
              const outer = gear.radius * 0.92;
              return (
                <line
                  key={`hm-${i}`}
                  x1={Math.cos(a) * inner} y1={Math.sin(a) * inner}
                  x2={Math.cos(a) * outer} y2={Math.sin(a) * outer}
                  stroke={colors.text}
                  strokeWidth={i % 3 === 0 ? 2 : 1}
                  opacity={0.7}
                />
              );
            })}
            {/* Hour hand */}
            <line
              x1={0} y1={0}
              x2={Math.cos((frame * 0.002 - Math.PI / 2)) * gear.radius * 0.45}
              y2={Math.sin((frame * 0.002 - Math.PI / 2)) * gear.radius * 0.45}
              stroke={colors.text}
              strokeWidth={3}
              strokeLinecap="round"
              opacity={0.9}
            />
            {/* Minute hand */}
            <line
              x1={0} y1={0}
              x2={Math.cos((frame * 0.024 - Math.PI / 2)) * gear.radius * 0.65}
              y2={Math.sin((frame * 0.024 - Math.PI / 2)) * gear.radius * 0.65}
              stroke={colors.text}
              strokeWidth={2}
              strokeLinecap="round"
              opacity={0.8}
            />
            {/* Second hand */}
            <line
              x1={0} y1={4}
              x2={Math.cos((frame * 0.1 - Math.PI / 2)) * gear.radius * 0.75}
              y2={Math.sin((frame * 0.1 - Math.PI / 2)) * gear.radius * 0.75}
              stroke={colors.rose}
              strokeWidth={1}
              strokeLinecap="round"
              opacity={0.9}
            />
            {/* Center pin */}
            <circle r={3} fill={colors.text} opacity={0.9} />
          </>
        )}

        {/* Jewel bearing */}
        <circle
          r={isOperator ? 5 : 3.5}
          fill={colors.rose}
          stroke={`rgba(${hexToRgb(colors.rose)}, 0.5)`}
          strokeWidth={1}
          opacity={0.7}
          style={{ filter: `drop-shadow(0 0 3px rgba(${hexToRgb(colors.rose)}, 0.4))` }}
        />

        {/* Label */}
        <text
          y={gear.radius + 20}
          textAnchor="middle"
          fill={colors.text}
          fontSize={isOperator ? 12 : 10}
          fontFamily="'Outfit', 'DM Sans', sans-serif"
          fontWeight={isOperator ? 700 : 600}
          letterSpacing={isOperator ? 1.2 : 0.4}
        >
          {gear.label}
        </text>
        <text
          y={gear.radius + 34}
          textAnchor="middle"
          fill={colors.textMuted}
          fontSize={8}
          fontFamily="'IBM Plex Mono', monospace"
        >
          {gear.sublabel}
        </text>
      </g>
    );
  };

  // -- Render mesh connection -----------------------------------------------------

  const renderMesh = (mesh: MeshConnection, i: number) => {
    const fromGear = gearNodes.find(g => g.id === mesh.fromId);
    const toGear = gearNodes.find(g => g.id === mesh.toId);
    if (!fromGear || !toGear) return null;

    const progress = interpolate(frame, [mesh.enterDelay, mesh.enterDelay + 20], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
    if (progress <= 0) return null;

    const dx = toGear.x - fromGear.x;
    const dy = toGear.y - fromGear.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const nx = dx / dist;
    const ny = dy / dist;

    const x1 = fromGear.x + nx * (fromGear.radius + 5);
    const y1 = fromGear.y + ny * (fromGear.radius + 5);
    const x2 = fromGear.x + (dx - nx * (toGear.radius + 5)) * progress;
    const y2 = fromGear.y + (dy - ny * (toGear.radius + 5)) * progress;

    const midX = (x1 + toGear.x - nx * (toGear.radius + 5)) / 2;
    const midY = (y1 + toGear.y - ny * (toGear.radius + 5)) / 2;

    // Power flow particle
    const particleT = progress >= 1 ? ((frame - mesh.enterDelay) % 40) / 40 : 0;
    const px = x1 + (toGear.x - nx * (toGear.radius + 5) - x1) * particleT;
    const py = y1 + (toGear.y - ny * (toGear.radius + 5) - y1) * particleT;

    const lineColor = fromGear.color;

    return (
      <g key={`mesh-${i}`} opacity={progress * 0.7}>
        {/* Connection line */}
        <line
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={lineColor}
          strokeWidth={1.2}
          strokeDasharray="5 3"
          opacity={0.5}
        />
        {/* Glow underlay */}
        <line
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={lineColor}
          strokeWidth={4}
          opacity={0.08}
          filter="url(#cwGlow)"
        />
        {/* Ratio label */}
        {mesh.ratio && progress > 0.8 && (
          <g>
            <rect
              x={midX - 16} y={midY - 9}
              width={32} height={14}
              rx={3}
              fill={colors.bgDeep}
              stroke={lineColor}
              strokeWidth={0.4}
              opacity={0.8}
            />
            <text
              x={midX} y={midY + 2}
              textAnchor="middle"
              fill={lineColor}
              fontSize={7}
              fontFamily="'IBM Plex Mono', monospace"
              fontWeight={600}
              opacity={0.8}
            >
              {mesh.ratio}
            </text>
          </g>
        )}
        {/* Connection label */}
        {mesh.label && mesh.label !== 'mesh' && progress > 0.8 && (
          <text
            x={midX} y={midY - 14}
            textAnchor="middle"
            fill={lineColor}
            fontSize={7}
            fontFamily="'IBM Plex Mono', monospace"
            opacity={0.5}
          >
            {mesh.label}
          </text>
        )}
        {/* Power flow particle */}
        {progress >= 1 && (
          <circle cx={px} cy={py} r={2.5} fill={lineColor} opacity={0.8}>
            <animate attributeName="opacity" values="0.8;0.3;0.8" dur="0.8s" repeatCount="indefinite" />
          </circle>
        )}
      </g>
    );
  };

  // -- Copperplate engraving text ---------------------------------------------------

  const engravingOpacity = interpolate(frame, [30, 50], [0, 0.4], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0808' }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <filter id="cwGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="cwTextGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Brass/gold gradient for plate */}
          <linearGradient id="brassPlate" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2a1f0a" />
            <stop offset="30%" stopColor="#3d2d10" />
            <stop offset="60%" stopColor="#2a1f0a" />
            <stop offset="100%" stopColor="#1a1208" />
          </linearGradient>
          {/* Beveled edge gradient */}
          <linearGradient id="bevelEdge" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5a4520" />
            <stop offset="50%" stopColor="#3d2d10" />
            <stop offset="100%" stopColor="#1a1208" />
          </linearGradient>
          <radialGradient id="plateCenter" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#4a3818" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#0a0808" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Base plate (brass background) */}
        <rect
          x={60} y={40}
          width={width - 120} height={height - 80}
          rx={12}
          fill="url(#brassPlate)"
          stroke="url(#bevelEdge)"
          strokeWidth={2}
          opacity={plateOpacity * 5}
        />

        {/* Geneva stripes (Cotes de Geneve) */}
        <g opacity={plateOpacity * 2} clipPath="url(#plateClip)">
          <clipPath id="plateClip">
            <rect x={60} y={40} width={width - 120} height={height - 80} rx={12} />
          </clipPath>
          {genevaStripes.map((stripe, i) => (
            <line
              key={`gs-${i}`}
              x1={stripe.offset - 200}
              y1={0}
              x2={stripe.offset + height}
              y2={height}
              stroke="#5a4520"
              strokeWidth={20}
              opacity={0.08 + (i % 2) * 0.04}
            />
          ))}
        </g>

        {/* Screw holes in plate */}
        <g opacity={fadeIn}>
          {[
            { x: 100, y: 70 }, { x: width - 100, y: 70 },
            { x: 100, y: height - 70 }, { x: width - 100, y: height - 70 },
            { x: cx, y: 55 }, { x: cx, y: height - 55 },
          ].map((hole, i) => (
            <g key={`hole-${i}`}>
              <circle cx={hole.x} cy={hole.y} r={8} fill="#1a1208" stroke="#3d2d10" strokeWidth={1} opacity={0.6} />
              <circle cx={hole.x} cy={hole.y} r={5} fill="#0a0808" opacity={0.8} />
            </g>
          ))}
        </g>

        {/* Blued screws */}
        {screws.map((screw, i) => {
          const screwOpacity = interpolate(frame, [5 + i * 2, 15 + i * 2], [0, 0.6], { extrapolateRight: 'clamp' });
          return (
            <g key={`screw-${i}`} opacity={screwOpacity}>
              <circle
                cx={screw.x} cy={screw.y}
                r={screw.size}
                fill="#1a2a5a"
                stroke="#2a4a8a"
                strokeWidth={0.5}
                opacity={0.5}
              />
              {/* Screw slot */}
              <line
                x1={screw.x - screw.size * 0.6}
                y1={screw.y}
                x2={screw.x + screw.size * 0.6}
                y2={screw.y}
                stroke="#0a1030"
                strokeWidth={1}
                opacity={0.5}
              />
            </g>
          );
        })}

        {/* Center plate glow */}
        <circle cx={cx} cy={cy} r={200} fill="url(#plateCenter)" opacity={fadeIn} />

        {/* Mesh connections (render before gears) */}
        {meshConnections.map(renderMesh)}

        {/* All gear nodes */}
        {gearNodes.map(renderGear)}

        {/* Jewel bearings rendered inside each gear node */}

        {/* Power reserve indicator (top left) */}
        <g opacity={prOpacity} transform={`translate(${160}, ${height - 100})`}>
          <text
            x={0} y={-12}
            fill={colors.textDim}
            fontSize={8}
            fontFamily="'IBM Plex Mono', monospace"
            fontWeight={600}
            letterSpacing={1}
          >
            POWER RESERVE
          </text>
          {/* Arc background */}
          <path
            d={`M -40 0 A 40 40 0 0 1 40 0`}
            fill="none"
            stroke={colors.surface1}
            strokeWidth={6}
            strokeLinecap="round"
            opacity={0.4}
          />
          {/* Arc fill */}
          <path
            d={`M -40 0 A 40 40 0 0 1 ${-40 + 80 * powerReserve} ${-Math.sin(Math.acos(-1 + 2 * powerReserve)) * 40}`}
            fill="none"
            stroke={powerReserve > 0.3 ? colors.green : colors.rose}
            strokeWidth={6}
            strokeLinecap="round"
            opacity={0.8}
          />
          {/* Percentage */}
          <text
            x={0} y={20}
            textAnchor="middle"
            fill={colors.textDim}
            fontSize={10}
            fontFamily="'IBM Plex Mono', monospace"
            fontWeight={700}
          >
            {Math.round(powerReserve * 100)}%
          </text>
        </g>

        {/* Copperplate engraving */}
        <g opacity={engravingOpacity}>
          <text
            x={cx} y={cy - 100}
            textAnchor="middle"
            fill="#5a4520"
            fontSize={14}
            fontFamily="Georgia, 'Times New Roman', serif"
            fontStyle="italic"
            fontWeight={400}
            letterSpacing={3}
          >
            c9-operator
          </text>
          <text
            x={cx} y={cy - 82}
            textAnchor="middle"
            fill="#4a3818"
            fontSize={8}
            fontFamily="Georgia, 'Times New Roman', serif"
            fontStyle="italic"
            letterSpacing={2}
          >
            Swiss Movement
          </text>
        </g>

        {/* Tick-tock indicator */}
        <g opacity={fadeIn * 0.6} transform={`translate(${width - 160}, ${height - 100})`}>
          <text
            x={0} y={-12}
            fill={colors.textDim}
            fontSize={8}
            fontFamily="'IBM Plex Mono', monospace"
            fontWeight={600}
            letterSpacing={1}
          >
            BEAT RATE
          </text>
          <text
            x={0} y={8}
            fill={escapementTick ? colors.cyan : colors.purple}
            fontSize={16}
            fontFamily="'IBM Plex Mono', monospace"
            fontWeight={800}
          >
            {escapementTick ? 'TICK' : 'TOCK'}
          </text>
          <text
            x={0} y={24}
            fill={colors.textMuted}
            fontSize={8}
            fontFamily="'IBM Plex Mono', monospace"
          >
            28,800 vph
          </text>
        </g>

        {/* Legend */}
        <g opacity={fadeIn} transform={`translate(20, ${height - 150})`}>
          {[
            { color: colors.cyan, label: 'Balance Wheel (regulator)' },
            { color: colors.purple, label: 'Mainspring (energy store)' },
            { color: colors.green, label: 'Escapement (event release)' },
            { color: colors.amber, label: 'Gear Train (agents)' },
            { color: colors.rose, label: 'Jewel Bearings (pivots)' },
            { color: colors.blue, label: 'Crown / Stem (input)' },
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
        <g opacity={fadeIn}>
          <text
            x={cx} y={height - 35}
            textAnchor="middle"
            fill="#c4a44a"
            fontSize={20}
            fontFamily="'Outfit', 'DM Sans', sans-serif"
            fontWeight={800}
            letterSpacing={4}
            filter="url(#cwTextGlow)"
          >
            PRECISION CLOCKWORK
          </text>
          <text
            x={cx} y={height - 15}
            textAnchor="middle"
            fill={colors.textMuted}
            fontSize={10}
            fontFamily="'IBM Plex Mono', monospace"
            letterSpacing={2}
          >
            c9-operator MECHANICAL MOVEMENT
          </text>
        </g>
      </svg>
    </AbsoluteFill>
  );
};

export default Clockwork;
