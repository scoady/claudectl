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

interface Contraption {
  id: string;
  label: string;
  sublabel: string;
  x: number;
  y: number;
  color: string;
  triggerFrame: number;
  step: number;
  sfx: string;
}

interface MechanicalLink {
  from: string;
  to: string;
  type: 'ramp' | 'rope' | 'gear' | 'fuse' | 'water' | 'domino' | 'pullstring';
  triggerFrame: number;
  color: string;
}

// ── Rube Goldberg Machine ───────────────────────────────────────────────────

export const RubeGoldberg: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // ── Chalkboard texture dots ──────────────────────────────────────────────

  const chalkDots = useMemo(() => {
    const rng = seededRandom(77);
    return Array.from({ length: 200 }, () => ({
      x: rng() * width,
      y: rng() * height,
      size: rng() * 1.2 + 0.2,
      opacity: rng() * 0.08 + 0.02,
    }));
  }, [width, height]);

  // ── Contraption definitions (left → right chain reaction) ────────────────

  const contraptions: Contraption[] = [
    {
      id: 'api', label: 'API Gateway', sublabel: 'Pull the lever!',
      x: 90, y: 120, color: colors.blue, triggerFrame: 0, step: 1, sfx: 'CLICK!',
    },
    {
      id: 'projects', label: 'Projects', sublabel: 'Filing Cabinet',
      x: 200, y: 80, color: colors.textDim, triggerFrame: 15, step: 2, sfx: 'CREAK!',
    },
    {
      id: 'operator', label: 'c9-operator', sublabel: 'Catapult Mechanism',
      x: width * 0.32, y: height * 0.38, color: colors.cyan, triggerFrame: 30, step: 3, sfx: 'TWANG!',
    },
    {
      id: 'hub', label: 'Hub', sublabel: 'Domino Chain',
      x: width * 0.55, y: 130, color: colors.green, triggerFrame: 55, step: 4, sfx: 'CLACK!',
    },
    {
      id: 'dashboard', label: 'Dashboard', sublabel: 'TV Screen',
      x: width * 0.82, y: 140, color: colors.textDim, triggerFrame: 75, step: 5, sfx: 'BZZT!',
    },
    {
      id: 'broker', label: 'Broker', sublabel: 'Water Wheel',
      x: width * 0.22, y: height * 0.68, color: colors.purple, triggerFrame: 45, step: 6, sfx: 'SPLASH!',
    },
    {
      id: 'agent1', label: 'Agent \u03b1', sublabel: 'Hammer',
      x: width * 0.35, y: height * 0.82, color: colors.amber, triggerFrame: 70, step: 7, sfx: 'BANG!',
    },
    {
      id: 'agent2', label: 'Agent \u03b2', sublabel: 'Windmill',
      x: width * 0.48, y: height * 0.80, color: colors.amber, triggerFrame: 80, step: 8, sfx: 'WHOOSH!',
    },
    {
      id: 'agent3', label: 'Agent \u03b3', sublabel: 'Pulley',
      x: width * 0.61, y: height * 0.82, color: colors.amber, triggerFrame: 88, step: 9, sfx: 'WHIRR!',
    },
    {
      id: 'agent4', label: 'Agent \u03b4', sublabel: 'Rocket',
      x: width * 0.76, y: height * 0.78, color: colors.rose, triggerFrame: 100, step: 10, sfx: 'FWOOOM!',
    },
  ];

  const contraptionMap = Object.fromEntries(contraptions.map((c) => [c.id, c]));

  // ── Mechanical links ─────────────────────────────────────────────────────

  const links: MechanicalLink[] = [
    { from: 'api', to: 'projects', type: 'pullstring', triggerFrame: 5, color: colors.textDim },
    { from: 'api', to: 'operator', type: 'ramp', triggerFrame: 10, color: colors.blue },
    { from: 'operator', to: 'hub', type: 'domino', triggerFrame: 40, color: colors.green },
    { from: 'hub', to: 'dashboard', type: 'rope', triggerFrame: 65, color: colors.green },
    { from: 'operator', to: 'broker', type: 'water', triggerFrame: 35, color: colors.purple },
    { from: 'broker', to: 'agent1', type: 'gear', triggerFrame: 60, color: colors.amber },
    { from: 'agent1', to: 'agent2', type: 'gear', triggerFrame: 75, color: colors.amber },
    { from: 'agent2', to: 'agent3', type: 'gear', triggerFrame: 84, color: colors.amber },
    { from: 'agent1', to: 'agent4', type: 'fuse', triggerFrame: 90, color: colors.rose },
  ];

  // ── Ball position (follows the chain) ────────────────────────────────────

  const ballPositions: Array<{ frame: number; x: number; y: number }> = [
    { frame: 0, x: 90, y: 120 },
    { frame: 15, x: width * 0.2, y: 200 },
    { frame: 30, x: width * 0.32, y: height * 0.38 },
    { frame: 42, x: width * 0.28, y: height * 0.55 },
    { frame: 55, x: width * 0.22, y: height * 0.68 },
    { frame: 65, x: width * 0.28, y: height * 0.75 },
    { frame: 75, x: width * 0.35, y: height * 0.82 },
    { frame: 85, x: width * 0.48, y: height * 0.80 },
    { frame: 92, x: width * 0.61, y: height * 0.82 },
    { frame: 105, x: width * 0.76, y: height * 0.78 },
    { frame: 120, x: width * 0.76, y: height * 0.5 },
  ];

  const ballFrames = ballPositions.map((p) => p.frame);
  const ballXs = ballPositions.map((p) => p.x);
  const ballYs = ballPositions.map((p) => p.y);
  const ballX = interpolate(frame, ballFrames, ballXs, { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const ballY = interpolate(frame, ballFrames, ballYs, { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // ── Sketchy line helper (wobble offsets) ──────────────────────────────────

  const wobblePoints = useMemo(() => {
    const rng = seededRandom(99);
    return Array.from({ length: 500 }, () => (rng() - 0.5) * 3);
  }, []);

  // ── Render: dashed trajectory path ───────────────────────────────────────

  const renderTrajectory = (link: MechanicalLink, i: number) => {
    const fromC = contraptionMap[link.from];
    const toC = contraptionMap[link.to];
    if (!fromC || !toC) return null;

    const progress = interpolate(frame, [link.triggerFrame, link.triggerFrame + 20], [0, 1], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });
    if (progress <= 0) return null;

    const mx = (fromC.x + toC.x) / 2;
    const my = (fromC.y + toC.y) / 2;
    const curveOffset = link.type === 'ramp' ? -40 : link.type === 'water' ? 30 : -20;
    const w1 = wobblePoints[(i * 7) % wobblePoints.length];
    const w2 = wobblePoints[(i * 13 + 3) % wobblePoints.length];

    const pathD = `M ${fromC.x + w1} ${fromC.y + w2} Q ${mx + curveOffset} ${my + curveOffset} ${fromC.x + (toC.x - fromC.x) * progress} ${fromC.y + (toC.y - fromC.y) * progress}`;

    const typeSymbol = {
      ramp: '\u2299', rope: '\u2248', gear: '\u2699', fuse: '\u2604',
      water: '\u2248', domino: '\u25ae', pullstring: '\u2192',
    }[link.type];

    return (
      <g key={`link-${i}`} opacity={progress * 0.8}>
        <path
          d={pathD}
          fill="none"
          stroke={link.color}
          strokeWidth={1.5}
          strokeDasharray="5 4"
          opacity={0.5}
        />
        {/* Type symbol at midpoint */}
        {progress > 0.5 && (
          <text
            x={mx + curveOffset * 0.3}
            y={my + curveOffset * 0.3 - 6}
            textAnchor="middle"
            fill={link.color}
            fontSize={12}
            opacity={0.6}
          >
            {typeSymbol}
          </text>
        )}
        {/* Velocity arrow */}
        {progress > 0.7 && (
          <g opacity={0.4}>
            <line
              x1={mx - 15} y1={my + curveOffset * 0.3 + 10}
              x2={mx + 15} y2={my + curveOffset * 0.3 + 10}
              stroke={link.color} strokeWidth={0.8}
              markerEnd="url(#arrowSketch)"
            />
          </g>
        )}
      </g>
    );
  };

  // ── Render: contraption ──────────────────────────────────────────────────

  const renderContraption = (c: Contraption) => {
    const activated = frame >= c.triggerFrame;
    const enterScale = spring({ frame: Math.max(0, frame - c.triggerFrame), fps, config: { damping: 14, stiffness: 90 } });
    const baseOpacity = interpolate(frame, [c.triggerFrame - 10, c.triggerFrame], [0.3, 1], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });

    const isOperator = c.id === 'operator';
    const isRocket = c.id === 'agent4';
    const boxW = isOperator ? 130 : 100;
    const boxH = isOperator ? 80 : 60;

    // Activation shake
    const shake = activated && frame < c.triggerFrame + 8
      ? Math.sin((frame - c.triggerFrame) * 2) * 3
      : 0;

    // Rocket launch animation
    const rocketLift = isRocket && frame > c.triggerFrame + 10
      ? interpolate(frame, [c.triggerFrame + 10, c.triggerFrame + 60], [0, -120], { extrapolateRight: 'clamp' })
      : 0;

    // Wobble indices
    const wi = (c.step * 17) % wobblePoints.length;
    const w1 = wobblePoints[wi] * 0.5;
    const w2 = wobblePoints[(wi + 1) % wobblePoints.length] * 0.5;
    const w3 = wobblePoints[(wi + 2) % wobblePoints.length] * 0.5;
    const w4 = wobblePoints[(wi + 3) % wobblePoints.length] * 0.5;

    // Sketchy rectangle path (hand-drawn effect)
    const sketchRect = `
      M ${c.x - boxW / 2 + w1} ${c.y - boxH / 2 + w2}
      L ${c.x + boxW / 2 + w3} ${c.y - boxH / 2 + w4}
      L ${c.x + boxW / 2 + w2} ${c.y + boxH / 2 + w1}
      L ${c.x - boxW / 2 + w4} ${c.y + boxH / 2 + w3}
      Z
    `;

    // Machine-specific decorations
    const renderMachineDetail = () => {
      if (c.id === 'api') {
        // Lever
        const leverAngle = activated
          ? interpolate(frame, [c.triggerFrame, c.triggerFrame + 10], [0, -45], { extrapolateRight: 'clamp' })
          : 0;
        return (
          <g>
            <line
              x1={c.x + 30} y1={c.y}
              x2={c.x + 30 + Math.cos((leverAngle - 90) * Math.PI / 180) * 35}
              y2={c.y + Math.sin((leverAngle - 90) * Math.PI / 180) * 35}
              stroke={c.color} strokeWidth={3} strokeLinecap="round"
            />
            <circle cx={c.x + 30} cy={c.y} r={4} fill={c.color} opacity={0.6} />
            {/* Hand icon */}
            <text x={c.x + 55} y={c.y - 15} fontSize={20} opacity={activated ? 0.8 : 0.4}>
              {'\u270b'}
            </text>
          </g>
        );
      }
      if (isOperator) {
        // See-saw / catapult
        const tiltAngle = activated
          ? interpolate(frame, [c.triggerFrame, c.triggerFrame + 12], [0, 25], { extrapolateRight: 'clamp' })
          : 0;
        return (
          <g>
            {/* Fulcrum triangle */}
            <polygon
              points={`${c.x},${c.y + boxH / 2} ${c.x - 12},${c.y + boxH / 2 + 15} ${c.x + 12},${c.y + boxH / 2 + 15}`}
              fill="none" stroke={c.color} strokeWidth={1.5}
            />
            {/* See-saw beam */}
            <line
              x1={c.x - 40} y1={c.y + boxH / 2}
              x2={c.x + 40} y2={c.y + boxH / 2}
              stroke={c.color} strokeWidth={2.5} strokeLinecap="round"
              transform={`rotate(${tiltAngle}, ${c.x}, ${c.y + boxH / 2})`}
            />
            {/* Physics annotation */}
            {activated && (
              <text
                x={c.x + 50} y={c.y - boxH / 2 - 8}
                fill={colors.textMuted} fontSize={8}
                fontFamily="'IBM Plex Mono', monospace"
                fontStyle="italic" opacity={0.5}
              >
                F=ma
              </text>
            )}
          </g>
        );
      }
      if (c.id === 'hub') {
        // Dominos
        const dominoCount = 5;
        return (
          <g>
            {Array.from({ length: dominoCount }, (_, di) => {
              const dx = c.x - 30 + di * 14;
              const dy = c.y + boxH / 2 + 5;
              const fallFrame = c.triggerFrame + di * 4;
              const fallAngle = frame >= fallFrame
                ? interpolate(frame, [fallFrame, fallFrame + 6], [0, 70], { extrapolateRight: 'clamp' })
                : 0;
              return (
                <rect
                  key={`dom-${di}`}
                  x={dx - 3} y={dy - 18}
                  width={6} height={18}
                  rx={1}
                  fill="none"
                  stroke={c.color}
                  strokeWidth={1.2}
                  transform={`rotate(${fallAngle}, ${dx}, ${dy})`}
                  opacity={0.7}
                />
              );
            })}
            {/* Bell at end */}
            {frame >= c.triggerFrame + dominoCount * 4 && (
              <g>
                <text
                  x={c.x + 45} y={c.y + boxH / 2}
                  fontSize={16}
                  opacity={Math.abs(Math.sin((frame - c.triggerFrame) * 0.3)) * 0.8 + 0.2}
                >
                  {'\ud83d\udd14'}
                </text>
              </g>
            )}
          </g>
        );
      }
      if (c.id === 'broker') {
        // Water wheel
        const wheelAngle = activated ? (frame - c.triggerFrame) * 3 : 0;
        return (
          <g transform={`translate(${c.x}, ${c.y})`}>
            <circle r={22} fill="none" stroke={c.color} strokeWidth={1.2} opacity={0.5} />
            {Array.from({ length: 6 }, (_, si) => {
              const a = (si / 6) * Math.PI * 2 + (wheelAngle * Math.PI / 180);
              return (
                <line
                  key={`spoke-${si}`}
                  x1={0} y1={0}
                  x2={Math.cos(a) * 20} y2={Math.sin(a) * 20}
                  stroke={c.color} strokeWidth={1} opacity={0.6}
                />
              );
            })}
            {/* Water drops */}
            {activated && Array.from({ length: 3 }, (_, wi2) => {
              const dropFrame = c.triggerFrame + wi2 * 8;
              const dropProgress = interpolate(frame, [dropFrame, dropFrame + 15], [0, 1], {
                extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
              });
              return (
                <circle
                  key={`drop-${wi2}`}
                  cx={-25 + wi2 * 5}
                  cy={-30 + dropProgress * 60}
                  r={2}
                  fill={colors.blue}
                  opacity={(1 - dropProgress) * 0.6}
                />
              );
            })}
          </g>
        );
      }
      if (c.id === 'agent1') {
        // Hammer
        const hammerAngle = activated
          ? interpolate(frame, [c.triggerFrame, c.triggerFrame + 8], [0, -90], { extrapolateRight: 'clamp' })
          : 0;
        return (
          <g>
            <line
              x1={c.x + 20} y1={c.y + 10}
              x2={c.x + 20 + Math.cos((hammerAngle - 90) * Math.PI / 180) * 28}
              y2={c.y + 10 + Math.sin((hammerAngle - 90) * Math.PI / 180) * 28}
              stroke={c.color} strokeWidth={2.5} strokeLinecap="round"
            />
            <rect
              x={c.x + 20 + Math.cos((hammerAngle - 90) * Math.PI / 180) * 28 - 6}
              y={c.y + 10 + Math.sin((hammerAngle - 90) * Math.PI / 180) * 28 - 4}
              width={12} height={8} rx={1}
              fill={c.color} opacity={0.7}
            />
          </g>
        );
      }
      if (c.id === 'agent2') {
        // Windmill / fan
        const fanAngle = activated ? (frame - c.triggerFrame) * 5 : 0;
        return (
          <g transform={`translate(${c.x}, ${c.y})`}>
            {Array.from({ length: 4 }, (_, bi) => {
              const a = (bi / 4) * Math.PI * 2 + (fanAngle * Math.PI / 180);
              return (
                <ellipse
                  key={`blade-${bi}`}
                  cx={Math.cos(a) * 12}
                  cy={Math.sin(a) * 12}
                  rx={10} ry={3}
                  fill={c.color}
                  opacity={0.4}
                  transform={`rotate(${(bi * 90) + fanAngle}, ${Math.cos(a) * 12}, ${Math.sin(a) * 12})`}
                />
              );
            })}
            <circle r={3} fill={c.color} opacity={0.7} />
          </g>
        );
      }
      if (c.id === 'agent3') {
        // Pulley
        return (
          <g>
            <circle cx={c.x} cy={c.y - boxH / 2 - 10} r={8} fill="none" stroke={c.color} strokeWidth={1.5} opacity={0.6} />
            {activated && (
              <>
                <line
                  x1={c.x - 8} y1={c.y - boxH / 2 - 10}
                  x2={c.x - 8} y2={c.y + boxH / 2 + 10}
                  stroke={c.color} strokeWidth={1} strokeDasharray="3 2" opacity={0.5}
                />
                <line
                  x1={c.x + 8} y1={c.y - boxH / 2 - 10}
                  x2={c.x + 8} y2={c.y + boxH / 2 + 10}
                  stroke={c.color} strokeWidth={1} strokeDasharray="3 2" opacity={0.5}
                />
              </>
            )}
          </g>
        );
      }
      if (isRocket) {
        // Rocket
        return (
          <g transform={`translate(${c.x + 35}, ${c.y + rocketLift})`}>
            {/* Rocket body */}
            <path
              d="M 0 -20 L 8 0 L 5 15 L -5 15 L -8 0 Z"
              fill="none" stroke={c.color} strokeWidth={1.5}
            />
            {/* Nose cone */}
            <path d="M 0 -20 L 4 -12 L -4 -12 Z" fill={c.color} opacity={0.4} />
            {/* Flame */}
            {activated && frame > c.triggerFrame + 5 && (
              <g>
                <path
                  d={`M -4 15 Q 0 ${25 + Math.sin(frame * 0.8) * 5} 4 15`}
                  fill={colors.amber} opacity={0.7}
                />
                <path
                  d={`M -2 15 Q 0 ${20 + Math.sin(frame * 1.2) * 3} 2 15`}
                  fill={colors.rose} opacity={0.5}
                />
              </g>
            )}
          </g>
        );
      }
      if (c.id === 'projects') {
        // Filing cabinet drawers
        return (
          <g>
            {Array.from({ length: 3 }, (_, di) => {
              const dy = c.y - 12 + di * 14;
              const openAmount = activated && di === 0
                ? interpolate(frame, [c.triggerFrame, c.triggerFrame + 10], [0, 12], { extrapolateRight: 'clamp' })
                : 0;
              return (
                <g key={`drawer-${di}`}>
                  <rect
                    x={c.x - 20 + openAmount} y={dy - 4}
                    width={40} height={10} rx={1}
                    fill="none" stroke={c.color} strokeWidth={0.8} opacity={0.5}
                  />
                  <line
                    x1={c.x - 5 + openAmount} y1={dy + 1}
                    x2={c.x + 5 + openAmount} y2={dy + 1}
                    stroke={c.color} strokeWidth={0.6} opacity={0.4}
                  />
                </g>
              );
            })}
          </g>
        );
      }
      if (c.id === 'dashboard') {
        // TV screen turning on
        const screenOn = activated
          ? interpolate(frame, [c.triggerFrame, c.triggerFrame + 15], [0, 1], { extrapolateRight: 'clamp' })
          : 0;
        return (
          <g>
            {/* Screen frame */}
            <rect
              x={c.x - 25} y={c.y - 18}
              width={50} height={34} rx={2}
              fill={`rgba(${hexToRgb(c.color)}, ${screenOn * 0.15})`}
              stroke={c.color} strokeWidth={1.2} opacity={0.6}
            />
            {/* Stand */}
            <line x1={c.x} y1={c.y + 16} x2={c.x} y2={c.y + 24} stroke={c.color} strokeWidth={1} opacity={0.4} />
            <line x1={c.x - 10} y1={c.y + 24} x2={c.x + 10} y2={c.y + 24} stroke={c.color} strokeWidth={1} opacity={0.4} />
            {/* Screen glow */}
            {screenOn > 0.5 && (
              <>
                <rect
                  x={c.x - 20} y={c.y - 13}
                  width={40} height={24} rx={1}
                  fill={`rgba(${hexToRgb(colors.green)}, ${screenOn * 0.1})`}
                />
                {/* Scan lines */}
                {Array.from({ length: 4 }, (_, li) => (
                  <line
                    key={`scan-${li}`}
                    x1={c.x - 18} y1={c.y - 10 + li * 6}
                    x2={c.x + 18} y2={c.y - 10 + li * 6}
                    stroke={colors.green} strokeWidth={0.4} opacity={0.3}
                  />
                ))}
              </>
            )}
          </g>
        );
      }
      return null;
    };

    return (
      <g key={c.id} transform={`translate(${shake}, 0) scale(${enterScale})`} opacity={baseOpacity} style={{ transformOrigin: `${c.x}px ${c.y}px` }}>
        {/* Contraption background box (sketchy) */}
        <path
          d={sketchRect}
          fill={`rgba(${hexToRgb(c.color)}, ${activated ? 0.08 : 0.03})`}
          stroke={c.color}
          strokeWidth={activated ? 1.8 : 1}
          opacity={activated ? 0.7 : 0.35}
          strokeLinejoin="round"
        />

        {/* Step number circle */}
        <circle
          cx={c.x - boxW / 2 + 12}
          cy={c.y - boxH / 2 + 12}
          r={10}
          fill={activated ? c.color : 'none'}
          stroke={c.color}
          strokeWidth={1}
          opacity={activated ? 0.8 : 0.4}
        />
        <text
          x={c.x - boxW / 2 + 12}
          y={c.y - boxH / 2 + 16}
          textAnchor="middle"
          fill={activated ? colors.bgDeep : c.color}
          fontSize={10}
          fontWeight={700}
          fontFamily="'IBM Plex Mono', monospace"
        >
          {c.step}
        </text>

        {/* Machine-specific visual */}
        {renderMachineDetail()}

        {/* Label */}
        <text
          x={c.x}
          y={c.y + boxH / 2 + 16}
          textAnchor="middle"
          fill={activated ? c.color : colors.textDim}
          fontSize={isOperator ? 12 : 10}
          fontFamily="'Outfit', 'DM Sans', sans-serif"
          fontWeight={isOperator ? 700 : 600}
          letterSpacing={isOperator ? 1.5 : 0.5}
        >
          {c.label}
        </text>
        <text
          x={c.x}
          y={c.y + boxH / 2 + 28}
          textAnchor="middle"
          fill={colors.textMuted}
          fontSize={8}
          fontFamily="'IBM Plex Mono', monospace"
          fontStyle="italic"
        >
          {c.sublabel}
        </text>

        {/* SFX text burst */}
        {activated && frame < c.triggerFrame + 25 && (
          <g>
            {(() => {
              const burstProgress = interpolate(
                frame,
                [c.triggerFrame, c.triggerFrame + 5, c.triggerFrame + 25],
                [0, 1, 0],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
              );
              const burstScale = interpolate(
                frame,
                [c.triggerFrame, c.triggerFrame + 8],
                [0.5, 1.2],
                { extrapolateRight: 'clamp' }
              );
              return (
                <text
                  x={c.x + boxW / 2 + 5}
                  y={c.y - boxH / 2 - 5}
                  fill={c.color}
                  fontSize={14}
                  fontWeight={900}
                  fontFamily="'Outfit', 'DM Sans', sans-serif"
                  fontStyle="italic"
                  opacity={burstProgress}
                  transform={`scale(${burstScale})`}
                  style={{ transformOrigin: `${c.x + boxW / 2 + 5}px ${c.y - boxH / 2 - 5}px` }}
                >
                  {c.sfx}
                </text>
              );
            })()}
          </g>
        )}

        {/* Activation flash */}
        {activated && frame >= c.triggerFrame && frame < c.triggerFrame + 6 && (
          <circle
            cx={c.x} cy={c.y}
            r={boxW / 2 + (frame - c.triggerFrame) * 8}
            fill="none"
            stroke={c.color}
            strokeWidth={2 - (frame - c.triggerFrame) * 0.3}
            opacity={1 - (frame - c.triggerFrame) / 6}
          />
        )}

        {/* Rocket vertical lift */}
        {isRocket && rocketLift < -5 && (
          <g>
            {/* Smoke trail */}
            {Array.from({ length: 5 }, (_, si) => {
              const smokeY = c.y + 30 - si * 8;
              const smokeOpacity = interpolate(
                frame,
                [c.triggerFrame + 15 + si * 3, c.triggerFrame + 40 + si * 3],
                [0.4, 0],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
              );
              return (
                <circle
                  key={`smoke-${si}`}
                  cx={c.x + 35 + Math.sin(frame * 0.2 + si) * 5}
                  cy={smokeY}
                  r={4 + si * 2}
                  fill={colors.textMuted}
                  opacity={smokeOpacity}
                />
              );
            })}
          </g>
        )}
      </g>
    );
  };

  // ── Fuse trail (Agent alpha → Agent delta) ───────────────────────────────

  const renderFuseTrail = () => {
    const fuseLink = links.find((l) => l.type === 'fuse');
    if (!fuseLink) return null;
    const fromC = contraptionMap[fuseLink.from];
    const toC = contraptionMap[fuseLink.to];
    if (!fromC || !toC) return null;

    const fuseProgress = interpolate(frame, [fuseLink.triggerFrame, fuseLink.triggerFrame + 15], [0, 1], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });
    if (fuseProgress <= 0) return null;

    // Fuse path segments
    const segments = 20;
    const points: string[] = [];
    for (let si = 0; si < segments; si++) {
      const t = si / (segments - 1);
      const px = fromC.x + (toC.x - fromC.x) * t;
      const py = fromC.y + (toC.y - fromC.y) * t + Math.sin(t * Math.PI * 4) * 8;
      points.push(`${px},${py}`);
    }

    return (
      <g>
        {/* Fuse line */}
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke={colors.rose}
          strokeWidth={2}
          strokeDasharray="4 3"
          opacity={0.6}
        />
        {/* Sparks at burn point */}
        {fuseProgress > 0 && fuseProgress < 1 && (
          <g>
            {Array.from({ length: 4 }, (_, si) => {
              const sparkAngle = (si / 4) * Math.PI * 2 + frame * 0.5;
              const burnT = fuseProgress;
              const burnX = fromC.x + (toC.x - fromC.x) * burnT;
              const burnY = fromC.y + (toC.y - fromC.y) * burnT + Math.sin(burnT * Math.PI * 4) * 8;
              return (
                <circle
                  key={`spark-${si}`}
                  cx={burnX + Math.cos(sparkAngle) * 6}
                  cy={burnY + Math.sin(sparkAngle) * 6}
                  r={1.5}
                  fill={colors.amber}
                  opacity={0.8}
                />
              );
            })}
          </g>
        )}
        {/* Label */}
        <text
          x={(fromC.x + toC.x) / 2}
          y={(fromC.y + toC.y) / 2 - 14}
          textAnchor="middle"
          fill={colors.rose}
          fontSize={8}
          fontFamily="'IBM Plex Mono', monospace"
          fontStyle="italic"
          opacity={fuseProgress * 0.7}
        >
          spawn chain
        </text>
      </g>
    );
  };

  // ── Title ────────────────────────────────────────────────────────────────

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [0, 20], [-8, 0], { extrapolateRight: 'clamp' });

  // ── Background kraft paper gradient ──────────────────────────────────────

  const gridFade = interpolate(frame, [0, 25], [0, 0.04], { extrapolateRight: 'clamp' });

  // ── Progress bar (chain reaction completion) ─────────────────────────────

  const totalSteps = contraptions.length;
  const activatedSteps = contraptions.filter((c) => frame >= c.triggerFrame).length;
  const chainProgress = activatedSteps / totalSteps;

  return (
    <AbsoluteFill style={{ backgroundColor: '#1a1410' }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          {/* Glow filters */}
          <filter id="rgGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="ballGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="10" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Sketch arrow marker */}
          <marker id="arrowSketch" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M 0 0 L 6 3 L 0 6" fill="none" stroke={colors.textMuted} strokeWidth={0.8} />
          </marker>
          {/* Chalkboard gradient background */}
          <radialGradient id="chalkBg" cx="50%" cy="40%" r="70%">
            <stop offset="0%" stopColor="#2a2018" />
            <stop offset="100%" stopColor="#0f0c08" />
          </radialGradient>
        </defs>

        {/* Background */}
        <rect width={width} height={height} fill="url(#chalkBg)" />

        {/* Chalk dust texture */}
        {chalkDots.map((dot, i) => (
          <circle
            key={`chalk-${i}`}
            cx={dot.x} cy={dot.y}
            r={dot.size}
            fill="#d4c5a9"
            opacity={dot.opacity}
          />
        ))}

        {/* Very subtle grid (blueprint style) */}
        <g opacity={gridFade}>
          {Array.from({ length: Math.ceil(width / 80) + 1 }, (_, i) => (
            <line
              key={`vg-${i}`}
              x1={i * 80} y1={0} x2={i * 80} y2={height}
              stroke="#6b5c3f" strokeWidth={0.3} opacity={0.2}
            />
          ))}
          {Array.from({ length: Math.ceil(height / 80) + 1 }, (_, i) => (
            <line
              key={`hg-${i}`}
              x1={0} y1={i * 80} x2={width} y2={i * 80}
              stroke="#6b5c3f" strokeWidth={0.3} opacity={0.2}
            />
          ))}
        </g>

        {/* Trajectory paths (links between contraptions) */}
        {links.map(renderTrajectory)}

        {/* Fuse trail (special: agent alpha → delta) */}
        {renderFuseTrail()}

        {/* Contraptions */}
        {contraptions.map(renderContraption)}

        {/* The Ball — always visible, travels through the chain */}
        <g filter="url(#ballGlow)">
          <circle
            cx={ballX} cy={ballY}
            r={7}
            fill={colors.amber}
            opacity={0.9}
          />
          <circle
            cx={ballX} cy={ballY}
            r={4}
            fill="#fff"
            opacity={0.6}
          />
          {/* Ball trail */}
          {Array.from({ length: 6 }, (_, ti) => {
            const trailFrame = Math.max(0, frame - ti * 2);
            const tx = interpolate(trailFrame, ballFrames, ballXs, { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            const ty = interpolate(trailFrame, ballFrames, ballYs, { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            return (
              <circle
                key={`trail-${ti}`}
                cx={tx} cy={ty}
                r={5 - ti * 0.7}
                fill={colors.amber}
                opacity={0.3 - ti * 0.04}
              />
            );
          })}
        </g>

        {/* Title — top center */}
        <g opacity={titleOpacity} transform={`translate(0, ${titleY})`}>
          <text
            x={width / 2} y={height - 40}
            textAnchor="middle"
            fill="#d4c5a9"
            fontSize={20}
            fontFamily="'Outfit', 'DM Sans', sans-serif"
            fontWeight={800}
            letterSpacing={5}
            fontStyle="italic"
          >
            THE RUBE GOLDBERG MACHINE
          </text>
          <text
            x={width / 2} y={height - 20}
            textAnchor="middle"
            fill={colors.textMuted}
            fontSize={10}
            fontFamily="'IBM Plex Mono', monospace"
            letterSpacing={2}
            fontStyle="italic"
          >
            c9-operator :: chain reaction architecture
          </text>
        </g>

        {/* Progress indicator — bottom left */}
        <g transform={`translate(20, ${height - 60})`}>
          <rect x={0} y={0} width={140} height={6} rx={3} fill="#2a2018" stroke="#4a3d2a" strokeWidth={0.5} />
          <rect x={0} y={0} width={140 * chainProgress} height={6} rx={3} fill={colors.amber} opacity={0.7} />
          <text x={0} y={-5} fill={colors.textMuted} fontSize={8} fontFamily="'IBM Plex Mono', monospace">
            Chain: {Math.round(chainProgress * 100)}%
          </text>
        </g>

        {/* Step counter legend — top right */}
        <g opacity={titleOpacity} transform={`translate(${width - 160}, 20)`}>
          <text fill="#d4c5a9" fontSize={9} fontFamily="'IBM Plex Mono', monospace" fontWeight={600} opacity={0.6}>
            REACTION STEPS
          </text>
          {contraptions.slice(0, 5).map((c, i) => (
            <g key={`legend-${i}`} transform={`translate(0, ${14 + i * 13})`}>
              <circle cx={6} cy={0} r={3} fill={frame >= c.triggerFrame ? c.color : 'none'} stroke={c.color} strokeWidth={0.8} opacity={0.6} />
              <text x={14} y={3} fill={colors.textDim} fontSize={8} fontFamily="'IBM Plex Mono', monospace">
                {c.step}. {c.label}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </AbsoluteFill>
  );
};

export default RubeGoldberg;
