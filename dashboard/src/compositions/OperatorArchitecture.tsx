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

interface NodeDef {
  id: string;
  label: string;
  sublabel?: string;
  x: number;
  y: number;
  color: string;
  icon: string;
  size: number;
  enterDelay: number;
  glowIntensity?: number;
}

interface EdgeDef {
  from: string;
  to: string;
  label?: string;
  color: string;
  enterDelay: number;
  animated?: boolean;
  dashed?: boolean;
  bidirectional?: boolean;
}

// ── Architecture Diagram ─────────────────────────────────────────────────────

export const OperatorArchitecture: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // ── Background particles ───────────────────────────────────────────────────

  const bgParticles = useMemo(() => {
    const rng = seededRandom(42);
    return Array.from({ length: 120 }, () => ({
      x: rng() * width,
      y: rng() * height,
      size: rng() * 1.5 + 0.3,
      speed: rng() * 0.3 + 0.05,
      angle: rng() * Math.PI * 2,
      opacity: rng() * 0.4 + 0.1,
      color: [colors.cyan, colors.purple, colors.blue, '#ffffff'][Math.floor(rng() * 4)],
    }));
  }, [width, height]);

  // ── Grid lines ─────────────────────────────────────────────────────────────

  const gridOpacity = interpolate(frame, [0, 30], [0, 0.06], { extrapolateRight: 'clamp' });

  // ── Node definitions ───────────────────────────────────────────────────────

  const cx = width / 2;
  const cy = height / 2;

  const nodes: NodeDef[] = [
    // Top: User / API layer
    {
      id: 'api', label: 'API Gateway', sublabel: 'HTTP + WebSocket',
      x: cx, y: 90, color: colors.blue, icon: '⚡', size: 56, enterDelay: 5,
    },
    // Center: The Operator (hero node)
    {
      id: 'operator', label: 'c9-operator', sublabel: 'Event Bus + Reconciler',
      x: cx, y: cy - 20, color: colors.cyan, icon: '◈', size: 80, enterDelay: 0,
      glowIntensity: 1.5,
    },
    // Left: Broker
    {
      id: 'broker', label: 'Broker', sublabel: 'Session Lifecycle',
      x: cx - 280, y: cy - 20, color: colors.purple, icon: '⬡', size: 52, enterDelay: 10,
    },
    // Right: Hub
    {
      id: 'hub', label: 'Hub', sublabel: 'WS Broadcast',
      x: cx + 280, y: cy - 20, color: colors.green, icon: '◎', size: 52, enterDelay: 10,
    },
    // Bottom row: Agents
    {
      id: 'agent1', label: 'Agent α', sublabel: 'claude subprocess',
      x: cx - 240, y: cy + 200, color: colors.amber, icon: '★', size: 44, enterDelay: 20,
    },
    {
      id: 'agent2', label: 'Agent β', sublabel: 'claude subprocess',
      x: cx - 60, y: cy + 220, color: colors.amber, icon: '★', size: 44, enterDelay: 25,
    },
    {
      id: 'agent3', label: 'Agent γ', sublabel: 'claude subprocess',
      x: cx + 120, y: cy + 200, color: colors.amber, icon: '★', size: 44, enterDelay: 30,
    },
    {
      id: 'agent4', label: 'Agent δ', sublabel: 'spawned by α',
      x: cx + 300, y: cy + 220, color: colors.rose, icon: '✦', size: 40, enterDelay: 50,
    },
    // Top left: Projects
    {
      id: 'projects', label: 'Projects', sublabel: 'Managed Repos',
      x: cx - 320, y: 100, color: colors.textDim, icon: '▣', size: 44, enterDelay: 15,
    },
    // Top right: Dashboard
    {
      id: 'dashboard', label: 'Dashboard', sublabel: 'React + Remotion',
      x: cx + 320, y: 100, color: colors.textDim, icon: '◧', size: 44, enterDelay: 15,
    },
  ];

  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));

  // ── Edge definitions ───────────────────────────────────────────────────────

  const edges: EdgeDef[] = [
    // API → Operator
    { from: 'api', to: 'operator', label: 'dispatch', color: colors.blue, enterDelay: 8, animated: true },
    // Operator ↔ Broker
    { from: 'operator', to: 'broker', label: 'spawn', color: colors.purple, enterDelay: 12, animated: true, bidirectional: true },
    // Operator ↔ Hub
    { from: 'operator', to: 'hub', label: 'events', color: colors.green, enterDelay: 12, animated: true, bidirectional: true },
    // Broker → Agents
    { from: 'broker', to: 'agent1', color: colors.amber, enterDelay: 22, animated: true },
    { from: 'broker', to: 'agent2', color: colors.amber, enterDelay: 27, animated: true },
    { from: 'broker', to: 'agent3', color: colors.amber, enterDelay: 32, animated: true },
    // Agent1 spawns Agent4 (via operator)
    { from: 'agent1', to: 'operator', label: 'spawn_request', color: colors.rose, enterDelay: 45, dashed: true, animated: true },
    { from: 'broker', to: 'agent4', color: colors.rose, enterDelay: 52, animated: true },
    // Hub → Dashboard
    { from: 'hub', to: 'dashboard', label: 'stream', color: colors.green, enterDelay: 16, animated: true },
    // Projects ↔ API
    { from: 'projects', to: 'api', label: 'CRUD', color: colors.textMuted, enterDelay: 18, dashed: true },
    // Agents → Hub (status)
    { from: 'agent2', to: 'hub', label: '', color: `rgba(${hexToRgb(colors.amber)}, 0.3)`, enterDelay: 35, dashed: true },
  ];

  // ── Title ──────────────────────────────────────────────────────────────────

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [0, 20], [-10, 0], { extrapolateRight: 'clamp' });

  // ── Render helpers ─────────────────────────────────────────────────────────

  const renderEdge = (edge: EdgeDef, i: number) => {
    const from = nodeMap[edge.from];
    const to = nodeMap[edge.to];
    if (!from || !to) return null;

    const enterFrame = edge.enterDelay;
    const progress = interpolate(frame, [enterFrame, enterFrame + 20], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    });

    if (progress <= 0) return null;

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const nx = dx / dist;
    const ny = dy / dist;

    // Offset from node center by radius
    const fromR = from.size / 2 + 8;
    const toR = to.size / 2 + 8;
    const x1 = from.x + nx * fromR;
    const y1 = from.y + ny * fromR;
    const x2 = from.x + dx - nx * toR;
    const y2 = from.y + dy - ny * toR;

    // Animated particle along edge
    const particleT = edge.animated ? ((frame - enterFrame) % 60) / 60 : 0;
    const px = x1 + (x2 - x1) * particleT;
    const py = y1 + (y2 - y1) * particleT;

    const dashArray = edge.dashed ? '6 4' : 'none';
    const lineId = `edge-${i}`;

    return (
      <g key={lineId} opacity={progress}>
        {/* Edge glow */}
        <line
          x1={x1} y1={y1} x2={x1 + (x2 - x1) * progress} y2={y1 + (y2 - y1) * progress}
          stroke={edge.color}
          strokeWidth={3}
          strokeDasharray={dashArray}
          opacity={0.15}
          filter="url(#edgeGlow)"
        />
        {/* Edge line */}
        <line
          x1={x1} y1={y1} x2={x1 + (x2 - x1) * progress} y2={y1 + (y2 - y1) * progress}
          stroke={edge.color}
          strokeWidth={1.2}
          strokeDasharray={dashArray}
          opacity={0.7}
        />
        {/* Arrowhead */}
        {progress > 0.9 && (
          <polygon
            points={`0,-4 8,0 0,4`}
            fill={edge.color}
            opacity={0.8}
            transform={`translate(${x2}, ${y2}) rotate(${Math.atan2(dy, dx) * 180 / Math.PI})`}
          />
        )}
        {/* Animated particle */}
        {edge.animated && progress >= 1 && (
          <circle cx={px} cy={py} r={3} fill={edge.color} opacity={0.9}>
            <animate attributeName="opacity" values="0.9;0.3;0.9" dur="1s" repeatCount="indefinite" />
          </circle>
        )}
        {/* Edge label */}
        {edge.label && progress > 0.8 && (
          <text
            x={(x1 + x2) / 2}
            y={(y1 + y2) / 2 - 8}
            textAnchor="middle"
            fill={edge.color}
            fontSize={9}
            fontFamily="'IBM Plex Mono', monospace"
            fontWeight={500}
            opacity={0.7}
          >
            {edge.label}
          </text>
        )}
      </g>
    );
  };

  const renderNode = (node: NodeDef) => {
    const enterFrame = node.enterDelay;
    const s = spring({ frame: frame - enterFrame, fps, config: { damping: 12, stiffness: 80 } });
    if (s <= 0.01) return null;

    const scale = s;
    const glowIntensity = node.glowIntensity || 1;
    const isOperator = node.id === 'operator';

    // Pulse for the operator node
    const pulse = isOperator
      ? 1 + Math.sin(frame * 0.08) * 0.05
      : 1;

    // Orbit ring for operator
    const orbitAngle = frame * 0.02;

    return (
      <g key={node.id} transform={`translate(${node.x}, ${node.y}) scale(${scale * pulse})`}>
        {/* Outer glow */}
        <circle
          r={node.size / 2 + 16}
          fill="none"
          stroke={node.color}
          strokeWidth={1}
          opacity={0.1 * glowIntensity}
          filter="url(#nodeGlow)"
        />
        {/* Radial glow fill */}
        <circle
          r={node.size / 2 + 8}
          fill={`rgba(${hexToRgb(node.color)}, 0.06)`}
          stroke="none"
        />

        {/* Orbit ring for operator */}
        {isOperator && (
          <>
            <circle
              r={node.size / 2 + 24}
              fill="none"
              stroke={node.color}
              strokeWidth={0.5}
              opacity={0.2}
              strokeDasharray="3 6"
            />
            {/* Orbiting dot */}
            <circle
              cx={Math.cos(orbitAngle) * (node.size / 2 + 24)}
              cy={Math.sin(orbitAngle) * (node.size / 2 + 24)}
              r={3}
              fill={node.color}
              opacity={0.6}
            />
            <circle
              cx={Math.cos(orbitAngle + Math.PI) * (node.size / 2 + 24)}
              cy={Math.sin(orbitAngle + Math.PI) * (node.size / 2 + 24)}
              r={2}
              fill={colors.purple}
              opacity={0.4}
            />
          </>
        )}

        {/* Node body */}
        <circle
          r={node.size / 2}
          fill={colors.bgDeep}
          stroke={node.color}
          strokeWidth={isOperator ? 2 : 1.2}
          opacity={0.95}
        />
        {/* Inner gradient ring */}
        <circle
          r={node.size / 2 - 3}
          fill="none"
          stroke={`rgba(${hexToRgb(node.color)}, 0.15)`}
          strokeWidth={1}
        />

        {/* Icon */}
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={isOperator ? 28 : 18}
          fill={node.color}
          style={{ filter: `drop-shadow(0 0 6px rgba(${hexToRgb(node.color)}, 0.5))` }}
        >
          {node.icon}
        </text>

        {/* Label */}
        <text
          y={node.size / 2 + 16}
          textAnchor="middle"
          fill={colors.text}
          fontSize={isOperator ? 13 : 11}
          fontFamily="'Outfit', 'DM Sans', sans-serif"
          fontWeight={isOperator ? 700 : 600}
          letterSpacing={isOperator ? 1.5 : 0.5}
        >
          {node.label}
        </text>
        {/* Sublabel */}
        {node.sublabel && (
          <text
            y={node.size / 2 + 30}
            textAnchor="middle"
            fill={colors.textMuted}
            fontSize={9}
            fontFamily="'IBM Plex Mono', monospace"
          >
            {node.sublabel}
          </text>
        )}
      </g>
    );
  };

  // ── Event bus visualization (center ring) ──────────────────────────────────

  const eventBusOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const eventDots = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => ({
      angle: (i / 8) * Math.PI * 2,
      color: [colors.cyan, colors.purple, colors.amber, colors.green, colors.blue, colors.rose, colors.cyan, colors.purple][i],
    }));
  }, []);

  // ── Legend ─────────────────────────────────────────────────────────────────

  const legendOpacity = interpolate(frame, [40, 55], [0, 1], { extrapolateRight: 'clamp' });

  const legendItems = [
    { color: colors.cyan, label: 'Operator (reconciler)' },
    { color: colors.amber, label: 'Agent (claude subprocess)' },
    { color: colors.rose, label: 'Sub-agent (spawned by agent)' },
    { color: colors.purple, label: 'Broker (lifecycle mgmt)' },
    { color: colors.green, label: 'Hub (WebSocket broadcast)' },
  ];

  // ── Floating event labels ──────────────────────────────────────────────────

  const eventLabels = [
    { text: 'TaskDispatched', delay: 35, x: cx - 100, y: cy - 80 },
    { text: 'AgentSpawned', delay: 42, x: cx + 80, y: cy - 70 },
    { text: 'AgentDone', delay: 55, x: cx + 110, y: cy + 40 },
    { text: 'SpawnRequest', delay: 48, x: cx - 120, y: cy + 30 },
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bgDeep }}>
      {/* SVG canvas */}
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          {/* Glow filters */}
          <filter id="nodeGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="edgeGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
          <filter id="textGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Radial gradient for center */}
          <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={colors.cyan} stopOpacity="0.08" />
            <stop offset="60%" stopColor={colors.purple} stopOpacity="0.03" />
            <stop offset="100%" stopColor={colors.bgDeep} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Background grid */}
        <g opacity={gridOpacity}>
          {Array.from({ length: Math.ceil(width / 60) + 1 }, (_, i) => (
            <line key={`vg${i}`} x1={i * 60} y1={0} x2={i * 60} y2={height}
              stroke={colors.cyan} strokeWidth={0.3} opacity={0.3} />
          ))}
          {Array.from({ length: Math.ceil(height / 60) + 1 }, (_, i) => (
            <line key={`hg${i}`} x1={0} y1={i * 60} x2={width} y2={i * 60}
              stroke={colors.cyan} strokeWidth={0.3} opacity={0.3} />
          ))}
        </g>

        {/* Center radial glow */}
        <circle cx={cx} cy={cy - 20} r={200} fill="url(#centerGlow)" opacity={eventBusOpacity} />

        {/* Background particles */}
        {bgParticles.map((p, i) => {
          const px = (p.x + Math.cos(p.angle) * p.speed * frame) % width;
          const py = (p.y + Math.sin(p.angle) * p.speed * frame) % height;
          const twinkle = 0.5 + Math.sin(frame * 0.05 + i) * 0.5;
          return (
            <circle
              key={`bp${i}`}
              cx={px < 0 ? px + width : px}
              cy={py < 0 ? py + height : py}
              r={p.size}
              fill={p.color}
              opacity={p.opacity * twinkle * gridOpacity}
            />
          );
        })}

        {/* Event bus ring around operator */}
        <g opacity={eventBusOpacity}>
          {eventDots.map((dot, i) => {
            const r = 56;
            const a = dot.angle + frame * 0.015;
            const dx = cx + Math.cos(a) * r;
            const dy = (cy - 20) + Math.sin(a) * r;
            return (
              <circle key={`ed${i}`} cx={dx} cy={dy} r={2} fill={dot.color} opacity={0.5}>
                <animate attributeName="opacity" values="0.3;0.8;0.3" dur={`${1.5 + i * 0.2}s`} repeatCount="indefinite" />
              </circle>
            );
          })}
        </g>

        {/* Edges (render before nodes) */}
        {edges.map(renderEdge)}

        {/* Nodes */}
        {nodes.map(renderNode)}

        {/* Floating event labels */}
        {eventLabels.map((evt, i) => {
          const evtOpacity = interpolate(frame, [evt.delay, evt.delay + 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          const evtY = interpolate(frame, [evt.delay, evt.delay + 15], [evt.y + 8, evt.y], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          const float = Math.sin(frame * 0.04 + i * 1.5) * 3;
          if (evtOpacity <= 0) return null;
          return (
            <g key={`evt${i}`} opacity={evtOpacity * 0.6}>
              <rect
                x={evt.x - 52} y={evtY + float - 10}
                width={104} height={18}
                rx={9}
                fill={colors.bgDeep}
                stroke={colors.cyan}
                strokeWidth={0.5}
                opacity={0.8}
              />
              <text
                x={evt.x} y={evtY + float + 2}
                textAnchor="middle"
                fill={colors.cyan}
                fontSize={8}
                fontFamily="'IBM Plex Mono', monospace"
                fontWeight={500}
                letterSpacing={0.5}
              >
                {evt.text}
              </text>
            </g>
          );
        })}

        {/* Title */}
        <g opacity={titleOpacity} transform={`translate(0, ${titleY})`}>
          <text
            x={cx} y={height - 55}
            textAnchor="middle"
            fill={colors.cyan}
            fontSize={22}
            fontFamily="'Outfit', 'DM Sans', sans-serif"
            fontWeight={800}
            letterSpacing={4}
            filter="url(#textGlow)"
          >
            c9-operator
          </text>
          <text
            x={cx} y={height - 34}
            textAnchor="middle"
            fill={colors.textMuted}
            fontSize={11}
            fontFamily="'IBM Plex Mono', monospace"
            letterSpacing={2}
          >
            EVENT-DRIVEN AGENT ORCHESTRATION
          </text>
        </g>

        {/* Legend */}
        <g opacity={legendOpacity} transform={`translate(20, ${height - 130})`}>
          {legendItems.map((item, i) => (
            <g key={`leg${i}`} transform={`translate(0, ${i * 18})`}>
              <circle cx={6} cy={0} r={4} fill={item.color} opacity={0.8} />
              <text x={16} y={4} fill={colors.textDim} fontSize={9} fontFamily="'IBM Plex Mono', monospace">
                {item.label}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </AbsoluteFill>
  );
};

export default OperatorArchitecture;
