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

// ── PCB Color Palette ────────────────────────────────────────────────────────

const pcb = {
  board: '#1a5c1a',
  boardDark: '#134d13',
  solderMask: '#2d6b2d',
  copper: '#b87333',
  copperBright: '#d4955a',
  gold: '#FFD700',
  goldDim: '#c5a600',
  icBody: '#1a1a1a',
  icBodyLight: '#2a2a2a',
  silver: '#C0C0C0',
  silkscreen: '#f0f0f0',
  ledRed: '#ff3333',
  ledGreen: '#33ff66',
  ledBlue: '#3388ff',
  ledAmber: '#ffaa00',
  signalCyan: '#00ffee',
  signalPurple: '#cc66ff',
};

// ── Types ────────────────────────────────────────────────────────────────────

interface ChipDef {
  id: string;
  label: string;
  designator: string;
  sublabel: string;
  x: number;
  y: number;
  w: number;
  h: number;
  pinCount: number;
  enterDelay: number;
  ledColor?: string;
}

interface TraceDef {
  from: string;
  to: string;
  waypoints: [number, number][];
  enterDelay: number;
  isBus?: boolean;
  busWidth?: number;
}

// ── Circuit Board Composition ────────────────────────────────────────────────

export const CircuitBoard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const cx = width / 2;
  const cy = height / 2;

  // ── FR-4 fiberglass texture vias & SMD components ────────────────────────

  const decorativeVias = useMemo(() => {
    const rng = seededRandom(101);
    return Array.from({ length: 60 }, () => ({
      x: rng() * width,
      y: rng() * height,
      size: rng() * 2 + 1.5,
    }));
  }, [width, height]);

  const smdComponents = useMemo(() => {
    const rng = seededRandom(202);
    return Array.from({ length: 40 }, (_, i) => ({
      x: rng() * (width - 100) + 50,
      y: rng() * (height - 100) + 50,
      rotation: Math.floor(rng() * 4) * 90,
      isCapacitor: rng() > 0.5,
      designator: rng() > 0.5 ? `R${i + 1}` : `C${i + 1}`,
    }));
  }, [width, height]);

  // ── Chip definitions ─────────────────────────────────────────────────────

  const chips: ChipDef[] = useMemo(() => [
    {
      id: 'operator', label: 'c9-operator', designator: 'U1',
      sublabel: 'SoC MAIN PROCESSOR', x: cx, y: cy,
      w: 120, h: 120, pinCount: 16, enterDelay: 0,
    },
    {
      id: 'broker', label: 'Broker', designator: 'U2',
      sublabel: 'MEM CONTROLLER', x: cx - 250, y: cy - 30,
      w: 80, h: 60, pinCount: 8, enterDelay: 10,
    },
    {
      id: 'hub', label: 'Hub', designator: 'U3',
      sublabel: 'RF / COMMS', x: cx + 250, y: cy - 30,
      w: 80, h: 60, pinCount: 8, enterDelay: 10,
    },
    {
      id: 'agent1', label: 'Agent \u03b1', designator: 'U4',
      sublabel: 'MCU', x: cx - 280, y: cy + 190,
      w: 56, h: 56, pinCount: 6, enterDelay: 20, ledColor: pcb.ledGreen,
    },
    {
      id: 'agent2', label: 'Agent \u03b2', designator: 'U5',
      sublabel: 'MCU', x: cx - 100, y: cy + 210,
      w: 56, h: 56, pinCount: 6, enterDelay: 25, ledColor: pcb.ledBlue,
    },
    {
      id: 'agent3', label: 'Agent \u03b3', designator: 'U6',
      sublabel: 'MCU', x: cx + 100, y: cy + 190,
      w: 56, h: 56, pinCount: 6, enterDelay: 30, ledColor: pcb.ledAmber,
    },
    {
      id: 'agent4', label: 'Agent \u03b4', designator: 'U7',
      sublabel: 'MCU', x: cx + 280, y: cy + 210,
      w: 56, h: 56, pinCount: 6, enterDelay: 50, ledColor: pcb.ledRed,
    },
    {
      id: 'api', label: 'API Gateway', designator: 'J1',
      sublabel: 'EDGE CONNECTOR', x: cx, y: 70,
      w: 200, h: 40, pinCount: 12, enterDelay: 5,
    },
    {
      id: 'projects', label: 'Projects', designator: 'U8',
      sublabel: 'FLASH / EEPROM', x: cx - 300, y: 130,
      w: 70, h: 50, pinCount: 6, enterDelay: 15,
    },
    {
      id: 'dashboard', label: 'Dashboard', designator: 'U9',
      sublabel: 'DISPLAY DRIVER', x: cx + 300, y: 130,
      w: 70, h: 50, pinCount: 6, enterDelay: 15, ledColor: pcb.signalCyan,
    },
  ], [cx, cy]);

  const chipMap = useMemo(() => Object.fromEntries(chips.map(c => [c.id, c])), [chips]);

  // ── Trace definitions (Manhattan routing with waypoints) ─────────────────

  const traces: TraceDef[] = useMemo(() => {
    const op = chipMap['operator'];
    const br = chipMap['broker'];
    const hu = chipMap['hub'];
    const ap = chipMap['api'];
    return [
      // API -> Operator (data bus)
      { from: 'api', to: 'operator', waypoints: [[ap.x, ap.y + 40], [ap.x, op.y - 80], [op.x, op.y - 80]], enterDelay: 8, isBus: true, busWidth: 4 },
      // Operator -> Broker
      { from: 'operator', to: 'broker', waypoints: [[op.x - 80, op.y], [br.x + 60, op.y], [br.x + 60, br.y]], enterDelay: 12, isBus: true, busWidth: 3 },
      // Operator -> Hub
      { from: 'operator', to: 'hub', waypoints: [[op.x + 80, op.y], [hu.x - 60, op.y], [hu.x - 60, hu.y]], enterDelay: 12, isBus: true, busWidth: 3 },
      // Broker -> Agent alpha
      { from: 'broker', to: 'agent1', waypoints: [[br.x, br.y + 50], [br.x, cy + 120], [cx - 280, cy + 120]], enterDelay: 22 },
      // Broker -> Agent beta
      { from: 'broker', to: 'agent2', waypoints: [[br.x + 20, br.y + 50], [br.x + 20, cy + 140], [cx - 100, cy + 140]], enterDelay: 27 },
      // Broker -> Agent gamma
      { from: 'broker', to: 'agent3', waypoints: [[br.x + 40, br.y + 50], [br.x + 40, cy + 100], [cx + 100, cy + 100]], enterDelay: 32 },
      // Broker -> Agent delta
      { from: 'broker', to: 'agent4', waypoints: [[br.x - 20, br.y + 50], [br.x - 20, cy + 160], [cx + 280, cy + 160]], enterDelay: 52 },
      // Hub -> Dashboard
      { from: 'hub', to: 'dashboard', waypoints: [[hu.x, hu.y - 50], [hu.x, 130], [cx + 300, 130]], enterDelay: 16 },
      // Projects -> API
      { from: 'projects', to: 'api', waypoints: [[cx - 300, 100], [cx - 120, 100], [cx - 120, 70]], enterDelay: 18 },
      // Clock trace (operator internal)
      { from: 'operator', to: 'operator', waypoints: [[op.x + 80, op.y + 40], [op.x + 160, op.y + 40], [op.x + 160, op.y - 40], [op.x + 80, op.y - 40]], enterDelay: 6 },
    ];
  }, [chipMap, cx, cy]);

  // ── Power-on sequence timing ─────────────────────────────────────────────

  const powerOnProgress = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });
  const boardOpacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  // ── Title ────────────────────────────────────────────────────────────────

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [0, 20], [-10, 0], { extrapolateRight: 'clamp' });

  // ── Render: IC chip ──────────────────────────────────────────────────────

  const renderChip = (chip: ChipDef) => {
    const s = spring({ frame: frame - chip.enterDelay, fps, config: { damping: 14, stiffness: 90 } });
    if (s <= 0.01) return null;

    const isMain = chip.id === 'operator';
    const isEdge = chip.id === 'api';
    const pinsPerSide = Math.ceil(chip.pinCount / 4);
    const pinSpacing = Math.min(chip.w, chip.h) / (pinsPerSide + 1);

    // Heat shimmer for main CPU
    const shimmerOffset = isMain ? Math.sin(frame * 0.1) * 0.5 : 0;
    const shimmerScale = isMain ? 1 + Math.sin(frame * 0.06) * 0.003 : 1;

    // LED blink for agents
    const ledOn = chip.ledColor
      ? (Math.sin(frame * 0.12 + chips.indexOf(chip) * 1.5) > -0.3)
      : false;

    // Pin activity
    const activePinIndex = Math.floor((frame * 0.3 + chips.indexOf(chip) * 7) % (pinsPerSide * 4));

    return (
      <g key={chip.id} opacity={s} transform={`translate(${chip.x}, ${chip.y}) scale(${s * shimmerScale})`}>
        {/* Solder pads underneath */}
        {!isEdge && Array.from({ length: pinsPerSide }, (_, i) => {
          const pinIdx = i;
          const topActive = activePinIndex === pinIdx;
          const botActive = activePinIndex === pinIdx + pinsPerSide;
          const leftActive = activePinIndex === pinIdx + pinsPerSide * 2;
          const rightActive = activePinIndex === pinIdx + pinsPerSide * 3;
          const offset = (i + 1) * pinSpacing - chip.w / 2;
          return (
            <React.Fragment key={`pin-${i}`}>
              {/* Top pins */}
              <rect x={offset - 3} y={-chip.h / 2 - 10} width={6} height={12} rx={1}
                fill={topActive ? pcb.copperBright : pcb.copper} opacity={topActive ? 1 : 0.7} />
              {/* Bottom pins */}
              <rect x={offset - 3} y={chip.h / 2 - 2} width={6} height={12} rx={1}
                fill={botActive ? pcb.copperBright : pcb.copper} opacity={botActive ? 1 : 0.7} />
              {/* Left pins */}
              {i < Math.ceil(chip.h / pinSpacing) && (
                <rect x={-chip.w / 2 - 10} y={offset - 3} width={12} height={6} rx={1}
                  fill={leftActive ? pcb.copperBright : pcb.copper} opacity={leftActive ? 1 : 0.7} />
              )}
              {/* Right pins */}
              {i < Math.ceil(chip.h / pinSpacing) && (
                <rect x={chip.w / 2 - 2} y={offset - 3} width={12} height={6} rx={1}
                  fill={rightActive ? pcb.copperBright : pcb.copper} opacity={rightActive ? 1 : 0.7} />
              )}
            </React.Fragment>
          );
        })}

        {/* Edge connector gold fingers */}
        {isEdge && Array.from({ length: 12 }, (_, i) => {
          const xOff = (i - 5.5) * 15;
          const active = Math.floor(frame * 0.2 + i) % 5 === 0;
          return (
            <rect key={`gf-${i}`} x={xOff - 4} y={-chip.h / 2 - 8} width={8} height={chip.h + 16}
              rx={2} fill={active ? pcb.gold : pcb.goldDim} opacity={active ? 1 : 0.8} />
          );
        })}

        {/* IC body */}
        <rect x={-chip.w / 2} y={-chip.h / 2} width={chip.w} height={chip.h}
          rx={isEdge ? 4 : 2} fill={pcb.icBody} stroke={pcb.icBodyLight} strokeWidth={1.5} />

        {/* Pin 1 indicator (notch) */}
        {!isEdge && (
          <circle cx={-chip.w / 2 + 8} cy={-chip.h / 2 + 8} r={3}
            fill="none" stroke={pcb.silver} strokeWidth={0.8} opacity={0.6} />
        )}

        {/* Main CPU: pin grid array pattern */}
        {isMain && (
          <g opacity={0.3}>
            {Array.from({ length: 6 }, (_, row) =>
              Array.from({ length: 6 }, (_, col) => (
                <circle key={`pga-${row}-${col}`}
                  cx={(col - 2.5) * 14} cy={(row - 2.5) * 14}
                  r={2} fill={pcb.silver} opacity={0.4} />
              ))
            )}
          </g>
        )}

        {/* Heat shimmer overlay for CPU */}
        {isMain && (
          <rect x={-chip.w / 2 + 2} y={-chip.h / 2 + 2 + shimmerOffset}
            width={chip.w - 4} height={chip.h - 4} rx={1}
            fill={`rgba(${hexToRgb(pcb.copperBright)}, ${0.03 + Math.sin(frame * 0.08) * 0.02})`} />
        )}

        {/* Designator (silkscreen) */}
        <text x={-chip.w / 2 + 4} y={chip.h / 2 + 20}
          fill={pcb.silkscreen} fontSize={8} fontFamily="'IBM Plex Mono', monospace"
          fontWeight={700} opacity={0.9}>
          {chip.designator}
        </text>

        {/* Chip label on body */}
        <text textAnchor="middle" dominantBaseline="central" y={isMain ? -8 : 0}
          fill={pcb.silkscreen} fontSize={isMain ? 11 : 8}
          fontFamily="'IBM Plex Mono', monospace" fontWeight={700}>
          {chip.label}
        </text>

        {/* Sublabel */}
        <text textAnchor="middle" dominantBaseline="central" y={isMain ? 10 : 14}
          fill={pcb.silver} fontSize={6}
          fontFamily="'IBM Plex Mono', monospace" opacity={0.7}>
          {chip.sublabel}
        </text>

        {/* Status LED */}
        {chip.ledColor && (
          <g transform={`translate(${chip.w / 2 + 16}, ${-chip.h / 2 + 8})`}>
            {/* LED pad */}
            <rect x={-4} y={-4} width={8} height={8} rx={1}
              fill={pcb.copper} opacity={0.6} />
            {/* LED body */}
            <rect x={-3} y={-3} width={6} height={6} rx={1}
              fill={ledOn ? chip.ledColor : '#333'} opacity={ledOn ? 1 : 0.4} />
            {/* LED glow */}
            {ledOn && (
              <circle r={10} fill={chip.ledColor} opacity={0.15} />
            )}
          </g>
        )}

        {/* Antenna traces for Hub */}
        {chip.id === 'hub' && (
          <g opacity={0.5 + Math.sin(frame * 0.1) * 0.2}>
            {[20, 30, 40].map((r, i) => (
              <path key={`ant-${i}`}
                d={`M ${chip.w / 2 + 10} 0 Q ${chip.w / 2 + r} ${-r * 0.6} ${chip.w / 2 + r + 10} ${-r * 0.3}`}
                fill="none" stroke={pcb.copper} strokeWidth={1}
                opacity={0.4 + (i === Math.floor(frame * 0.05) % 3 ? 0.4 : 0)} />
            ))}
          </g>
        )}
      </g>
    );
  };

  // ── Render: PCB trace with Manhattan routing ─────────────────────────────

  const renderTrace = (trace: TraceDef, idx: number) => {
    const enterFrame = trace.enterDelay;
    const progress = interpolate(frame, [enterFrame, enterFrame + 25], [0, 1], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });
    if (progress <= 0) return null;

    const pts = trace.waypoints;
    const busOffset = trace.isBus ? (trace.busWidth || 2) : 0;

    // Build path segments
    let pathD = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      pathD += ` L ${pts[i][0]} ${pts[i][1]}`;
    }

    // Calculate total path length for signal animation
    let totalLen = 0;
    for (let i = 1; i < pts.length; i++) {
      totalLen += Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]);
    }

    // Signal pulse position (cycles along trace)
    const signalT = ((frame - enterFrame) * 4) % totalLen;

    // Find signal position on path
    let signalX = pts[0][0];
    let signalY = pts[0][1];
    let accumulated = 0;
    for (let i = 1; i < pts.length; i++) {
      const segLen = Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]);
      if (accumulated + segLen >= signalT) {
        const t = (signalT - accumulated) / segLen;
        signalX = pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t;
        signalY = pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t;
        break;
      }
      accumulated += segLen;
    }

    return (
      <g key={`trace-${idx}`} opacity={progress}>
        {/* Bus parallel traces */}
        {trace.isBus && Array.from({ length: busOffset }, (_, b) => (
          <path key={`bus-${b}`}
            d={pathD}
            fill="none"
            stroke={pcb.copper}
            strokeWidth={1.2}
            opacity={0.3}
            transform={`translate(${(b - busOffset / 2) * 3}, ${(b - busOffset / 2) * 3})`}
          />
        ))}

        {/* Main trace */}
        <path d={pathD} fill="none" stroke={pcb.copper} strokeWidth={2}
          strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />

        {/* Signal pulse glow */}
        {progress >= 1 && (
          <>
            <circle cx={signalX} cy={signalY} r={5}
              fill={pcb.signalCyan} opacity={0.4} />
            <circle cx={signalX} cy={signalY} r={2.5}
              fill={pcb.signalCyan} opacity={0.9} />
          </>
        )}

        {/* Via holes along trace at corners */}
        {pts.slice(1, -1).map((pt, vi) => (
          <g key={`via-${vi}`}>
            <circle cx={pt[0]} cy={pt[1]} r={5} fill={pcb.board} stroke={pcb.copper} strokeWidth={2} />
            <circle cx={pt[0]} cy={pt[1]} r={1.5} fill={pcb.boardDark} />
          </g>
        ))}
      </g>
    );
  };

  // ── Render: Oscilloscope mini display ────────────────────────────────────

  const scopeTraces = useMemo(() => [
    { x: cx + 170, y: cy + 60, label: 'CLK', freq: 0.5 },
    { x: cx - 170, y: cy + 60, label: 'DATA', freq: 0.2 },
  ], [cx, cy]);

  const renderScope = (scope: { x: number; y: number; label: string; freq: number }, idx: number) => {
    const scopeOpacity = interpolate(frame, [35, 50], [0, 1], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });
    if (scopeOpacity <= 0) return null;

    const scopeW = 60;
    const scopeH = 30;
    const points: string[] = [];
    for (let px = 0; px < scopeW; px++) {
      const t = (px + frame * 2) * scope.freq;
      const isClk = scope.label === 'CLK';
      const val = isClk
        ? (Math.sin(t * 0.3) > 0 ? -1 : 1)
        : Math.sin(t * 0.15) * 0.7 + Math.sin(t * 0.4) * 0.3;
      points.push(`${scope.x - scopeW / 2 + px},${scope.y + val * scopeH * 0.35}`);
    }

    return (
      <g key={`scope-${idx}`} opacity={scopeOpacity}>
        {/* Scope background */}
        <rect x={scope.x - scopeW / 2 - 4} y={scope.y - scopeH / 2 - 4}
          width={scopeW + 8} height={scopeH + 16} rx={2}
          fill={pcb.icBody} stroke={pcb.silver} strokeWidth={0.5} opacity={0.9} />
        {/* Scope grid */}
        <rect x={scope.x - scopeW / 2} y={scope.y - scopeH / 2}
          width={scopeW} height={scopeH} fill="#001a00" opacity={0.8} />
        {[0.25, 0.5, 0.75].map(f => (
          <line key={`sg-h-${f}`}
            x1={scope.x - scopeW / 2} y1={scope.y - scopeH / 2 + scopeH * f}
            x2={scope.x + scopeW / 2} y2={scope.y - scopeH / 2 + scopeH * f}
            stroke="#003300" strokeWidth={0.5} />
        ))}
        {/* Waveform */}
        <polyline points={points.join(' ')} fill="none"
          stroke={pcb.signalCyan} strokeWidth={1.2} opacity={0.9} />
        {/* Label */}
        <text x={scope.x} y={scope.y + scopeH / 2 + 10}
          textAnchor="middle" fill={pcb.silkscreen} fontSize={6}
          fontFamily="'IBM Plex Mono', monospace" opacity={0.7}>
          {scope.label}
        </text>
      </g>
    );
  };

  // ── Legend ──────────────────────────────────────────────────────────────

  const legendOpacity = interpolate(frame, [40, 55], [0, 1], { extrapolateRight: 'clamp' });

  const legendItems = [
    { color: pcb.copper, shape: 'trace', label: 'U1  c9-operator (SoC)' },
    { color: pcb.ledGreen, shape: 'led', label: 'U2  Broker (Mem Ctrl)' },
    { color: pcb.ledBlue, shape: 'led', label: 'U3  Hub (RF/Comms)' },
    { color: pcb.ledAmber, shape: 'led', label: 'U4-U7  Agent MCUs' },
    { color: pcb.gold, shape: 'trace', label: 'J1  API Edge Connector' },
  ];

  // ── Ground plane hatch pattern coordinates ───────────────────────────────

  const groundHatch = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const spacing = 12;
    for (let i = -height; i < width + height; i += spacing) {
      lines.push({ x1: i, y1: 0, x2: i + height, y2: height });
    }
    return lines;
  }, [width, height]);

  return (
    <AbsoluteFill style={{ backgroundColor: pcb.boardDark }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          {/* FR-4 fiberglass crosshatch pattern */}
          <pattern id="fr4-texture" width="8" height="8" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="8" y2="8" stroke={pcb.board} strokeWidth="0.3" opacity="0.5" />
            <line x1="8" y1="0" x2="0" y2="8" stroke={pcb.board} strokeWidth="0.3" opacity="0.5" />
          </pattern>

          {/* Copper glow filter */}
          <filter id="copperGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Signal glow filter */}
          <filter id="signalGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* LED glow filter */}
          <filter id="ledGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" />
          </filter>

          {/* Text glow */}
          <filter id="textGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ── PCB Board Background ─────────────────────────────────────────── */}
        <rect width={width} height={height} fill={pcb.solderMask} opacity={boardOpacity} />
        <rect width={width} height={height} fill="url(#fr4-texture)" opacity={boardOpacity * 0.6} />

        {/* ── Ground plane copper hatch ─────────────────────────────────────── */}
        <g opacity={powerOnProgress * 0.06}>
          {groundHatch.map((line, i) => (
            <line key={`gh-${i}`}
              x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
              stroke={pcb.copper} strokeWidth={0.3} />
          ))}
        </g>

        {/* ── Board edge / outline ──────────────────────────────────────────── */}
        <rect x={10} y={10} width={width - 20} height={height - 20}
          rx={6} fill="none" stroke={pcb.copper} strokeWidth={1.5}
          opacity={boardOpacity * 0.4} />
        {/* Mounting holes */}
        {[[30, 30], [width - 30, 30], [30, height - 30], [width - 30, height - 30]].map(([mx, my], i) => (
          <g key={`mount-${i}`} opacity={boardOpacity}>
            <circle cx={mx} cy={my} r={8} fill="none" stroke={pcb.copper} strokeWidth={2} opacity={0.5} />
            <circle cx={mx} cy={my} r={4} fill={pcb.boardDark} />
          </g>
        ))}

        {/* ── Decorative vias ───────────────────────────────────────────────── */}
        <g opacity={powerOnProgress * 0.5}>
          {decorativeVias.map((v, i) => (
            <g key={`dv-${i}`}>
              <circle cx={v.x} cy={v.y} r={v.size + 2} fill="none"
                stroke={pcb.copper} strokeWidth={1.5} opacity={0.4} />
              <circle cx={v.x} cy={v.y} r={v.size * 0.5} fill={pcb.boardDark} />
            </g>
          ))}
        </g>

        {/* ── SMD components (decorative resistors + capacitors) ─────────── */}
        <g opacity={powerOnProgress * 0.5}>
          {smdComponents.map((smd, i) => (
            <g key={`smd-${i}`} transform={`translate(${smd.x}, ${smd.y}) rotate(${smd.rotation})`}>
              {smd.isCapacitor ? (
                <>
                  <rect x={-4} y={-3} width={8} height={6} rx={0.5}
                    fill="#3a3020" stroke={pcb.copper} strokeWidth={0.5} opacity={0.7} />
                  <rect x={-5} y={-2} width={2} height={4} fill={pcb.silver} opacity={0.6} />
                  <rect x={3} y={-2} width={2} height={4} fill={pcb.silver} opacity={0.6} />
                </>
              ) : (
                <>
                  <rect x={-5} y={-2} width={10} height={4} rx={0.5}
                    fill="#1a1a1a" opacity={0.8} />
                  <rect x={-6} y={-1.5} width={2} height={3} fill={pcb.silver} opacity={0.6} />
                  <rect x={4} y={-1.5} width={2} height={3} fill={pcb.silver} opacity={0.6} />
                </>
              )}
              <text x={12} y={2} fill={pcb.silkscreen} fontSize={4}
                fontFamily="'IBM Plex Mono', monospace" opacity={0.4}>
                {smd.designator}
              </text>
            </g>
          ))}
        </g>

        {/* ── PCB Traces ────────────────────────────────────────────────────── */}
        {traces.map(renderTrace)}

        {/* ── Chips ─────────────────────────────────────────────────────────── */}
        {chips.map(renderChip)}

        {/* ── Oscilloscope displays ─────────────────────────────────────────── */}
        {scopeTraces.map(renderScope)}

        {/* ── Power indicator LEDs (board edge) ─────────────────────────────── */}
        <g opacity={powerOnProgress}>
          {/* VCC LED */}
          <circle cx={50} cy={height / 2} r={4} fill={pcb.ledGreen}
            opacity={0.6 + Math.sin(frame * 0.05) * 0.3} />
          <circle cx={50} cy={height / 2} r={8} fill={pcb.ledGreen}
            opacity={0.1} filter="url(#ledGlow)" />
          <text x={50} y={height / 2 + 14} textAnchor="middle" fill={pcb.silkscreen}
            fontSize={5} fontFamily="'IBM Plex Mono', monospace" opacity={0.6}>
            PWR
          </text>
          {/* Activity LED */}
          <circle cx={50} cy={height / 2 + 30} r={4}
            fill={frame % 20 < 10 ? pcb.ledAmber : '#332200'}
            opacity={0.7} />
          <circle cx={50} cy={height / 2 + 30} r={8}
            fill={pcb.ledAmber} opacity={frame % 20 < 10 ? 0.1 : 0} filter="url(#ledGlow)" />
          <text x={50} y={height / 2 + 44} textAnchor="middle" fill={pcb.silkscreen}
            fontSize={5} fontFamily="'IBM Plex Mono', monospace" opacity={0.6}>
            ACT
          </text>
        </g>

        {/* ── Dashboard indicator LEDs ──────────────────────────────────────── */}
        {chips.find(c => c.id === 'dashboard') && (
          <g opacity={interpolate(frame, [20, 35], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}>
            {[pcb.ledRed, pcb.ledGreen, pcb.ledBlue, pcb.ledAmber].map((ledC, i) => {
              const dash = chipMap['dashboard'];
              const lx = dash.x - 20 + i * 14;
              const ly = dash.y + dash.h / 2 + 18;
              const on = Math.sin(frame * 0.08 + i * 2) > 0;
              return (
                <g key={`dash-led-${i}`}>
                  <rect x={lx - 3} y={ly - 3} width={6} height={6} rx={1}
                    fill={on ? ledC : '#222'} opacity={on ? 0.9 : 0.3} />
                  {on && <circle cx={lx} cy={ly} r={6} fill={ledC} opacity={0.1} filter="url(#ledGlow)" />}
                </g>
              );
            })}
            <text x={chipMap['dashboard'].x} y={chipMap['dashboard'].y + chipMap['dashboard'].h / 2 + 32}
              textAnchor="middle" fill={pcb.silkscreen} fontSize={5}
              fontFamily="'IBM Plex Mono', monospace" opacity={0.5}>
              STATUS
            </text>
          </g>
        )}

        {/* ── Title ─────────────────────────────────────────────────────────── */}
        <g opacity={titleOpacity} transform={`translate(0, ${titleY})`}>
          <text x={cx} y={height - 50} textAnchor="middle"
            fill={pcb.silkscreen} fontSize={22}
            fontFamily="'Outfit', 'DM Sans', sans-serif" fontWeight={800}
            letterSpacing={4} filter="url(#textGlow)">
            c9-operator
          </text>
          <text x={cx} y={height - 30} textAnchor="middle"
            fill={pcb.copper} fontSize={10}
            fontFamily="'IBM Plex Mono', monospace" letterSpacing={3} opacity={0.8}>
            SILICON AGENT ARCHITECTURE
          </text>
          {/* REV silkscreen */}
          <text x={cx + 160} y={height - 32} textAnchor="start"
            fill={pcb.silkscreen} fontSize={7}
            fontFamily="'IBM Plex Mono', monospace" opacity={0.4}>
            REV 1.0
          </text>
        </g>

        {/* ── Legend ─────────────────────────────────────────────────────────── */}
        <g opacity={legendOpacity} transform={`translate(${width - 180}, ${height - 120})`}>
          <rect x={-8} y={-12} width={170} height={legendItems.length * 18 + 16}
            rx={2} fill={pcb.icBody} stroke={pcb.copper} strokeWidth={0.5} opacity={0.8} />
          <text x={0} y={0} fill={pcb.silkscreen} fontSize={7}
            fontFamily="'IBM Plex Mono', monospace" fontWeight={700} letterSpacing={1}>
            BOM / DESIGNATORS
          </text>
          {legendItems.map((item, i) => (
            <g key={`leg-${i}`} transform={`translate(0, ${i * 18 + 16})`}>
              {item.shape === 'led' ? (
                <rect x={0} y={-4} width={8} height={8} rx={1}
                  fill={item.color} opacity={0.8} />
              ) : (
                <line x1={0} y1={0} x2={10} y2={0}
                  stroke={item.color} strokeWidth={2} opacity={0.8} />
              )}
              <text x={16} y={4} fill={pcb.silkscreen} fontSize={7}
                fontFamily="'IBM Plex Mono', monospace" opacity={0.7}>
                {item.label}
              </text>
            </g>
          ))}
        </g>

        {/* ── Board silkscreen branding ─────────────────────────────────────── */}
        <g opacity={boardOpacity * 0.3}>
          <text x={width - 30} y={40} textAnchor="end"
            fill={pcb.silkscreen} fontSize={6}
            fontFamily="'IBM Plex Mono', monospace" transform={`rotate(-90, ${width - 30}, 40)`}>
            CLAUDE-CTRL-BOARD-v1.0
          </text>
        </g>
      </svg>
    </AbsoluteFill>
  );
};

export default CircuitBoard;
