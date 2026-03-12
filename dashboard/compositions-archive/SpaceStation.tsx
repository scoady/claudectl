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

// ── Custom palette ───────────────────────────────────────────────────────────

const station = {
  hull: '#E0E5EC',
  solar: '#1565C0',
  thruster: '#FF6D00',
  viewport: '#00E5FF',
  warning: '#FFB300',
  deepSpace: '#030318',
  nebula: '#4A148C',
  starlight: '#FFFDE7',
  navRed: '#FF1744',
  navGreen: '#00E676',
};

// ── Space Station Composition ────────────────────────────────────────────────

export const SpaceStation: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const cx = width / 2;
  const cy = height / 2;

  // ── Background stars ─────────────────────────────────────────────────────

  const stars = useMemo(() => {
    const rng = seededRandom(77);
    return Array.from({ length: 350 }, () => ({
      x: rng() * width,
      y: rng() * height,
      size: rng() * 1.6 + 0.2,
      brightness: rng() * 0.7 + 0.3,
      twinkleSpeed: rng() * 0.06 + 0.02,
      twinkleOffset: rng() * Math.PI * 2,
      color: rng() > 0.85
        ? station.starlight
        : rng() > 0.7
          ? '#AAC8FF'
          : '#FFFFFF',
    }));
  }, [width, height]);

  // ── EVA particles ────────────────────────────────────────────────────────

  const evaParticles = useMemo(() => {
    const rng = seededRandom(99);
    return Array.from({ length: 15 }, () => ({
      baseX: cx + (rng() - 0.5) * 120,
      baseY: cy - 60 + (rng() - 0.5) * 80,
      driftX: (rng() - 0.5) * 0.4,
      driftY: (rng() - 0.5) * 0.3,
      size: rng() * 1.2 + 0.4,
      opacity: rng() * 0.4 + 0.2,
    }));
  }, [cx, cy]);

  // ── Orbital path dots ────────────────────────────────────────────────────

  const orbitDots = useMemo(() => {
    return Array.from({ length: 60 }, (_, i) => {
      const angle = (i / 60) * Math.PI * 2;
      return { angle, rx: 420, ry: 160 };
    });
  }, []);

  // ── Station rotation ─────────────────────────────────────────────────────

  const stationRotation = frame * 0.033; // ~1 deg/sec at 30fps

  // ── Solar panel angle tracking ───────────────────────────────────────────

  const solarAngle = Math.sin(frame * 0.008) * 8;

  // ── Animation timings ────────────────────────────────────────────────────

  const fadeIn = (delay: number, dur = 25) =>
    interpolate(frame, [delay, delay + dur], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

  const stationScale = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 60 },
  });

  // ── Agent pod positions & docking ────────────────────────────────────────

  const agentPods = useMemo(() => [
    { id: 'alpha', label: 'Agent \u03B1', dockX: cx - 180, dockY: cy - 30, startX: cx - 380, startY: cy - 200, dockDelay: 20, docked: true, color: station.warning },
    { id: 'beta', label: 'Agent \u03B2', dockX: cx - 180, dockY: cy + 50, startX: cx - 350, startY: cy + 250, dockDelay: 30, docked: true, color: station.warning },
    { id: 'gamma', label: 'Agent \u03B3', dockX: cx + 180, dockY: cy + 50, startX: cx + 400, startY: cy + 220, dockDelay: 40, docked: false, color: station.warning },
    { id: 'delta', label: 'Agent \u03B4', dockX: cx + 180, dockY: cy - 30, startX: cx + 350, startY: cy - 240, dockDelay: 55, docked: false, color: station.thruster },
  ], [cx, cy]);

  // ── Running lights blink ─────────────────────────────────────────────────

  const blinkA = Math.sin(frame * 0.15) > 0 ? 0.9 : 0.1;
  const blinkB = Math.sin(frame * 0.15 + Math.PI) > 0 ? 0.9 : 0.1;

  // ── Communication pulses ─────────────────────────────────────────────────

  const commPulseT = (frame % 90) / 90;
  const commPulseOpacity = interpolate(commPulseT, [0, 0.3, 1], [0.8, 0.4, 0], {
    extrapolateRight: 'clamp',
  });

  // ── Viewport glow pulse ──────────────────────────────────────────────────

  const viewportGlow = 0.4 + Math.sin(frame * 0.06) * 0.25;

  // ── Title ────────────────────────────────────────────────────────────────

  const titleOpacity = fadeIn(5, 30);
  const titleY = interpolate(frame, [5, 35], [-12, 0], { extrapolateRight: 'clamp' });

  // ── Legend ───────────────────────────────────────────────────────────────

  const legendOpacity = fadeIn(50, 20);

  const legendItems = useMemo(() => [
    { color: station.hull, label: 'c9-operator (Command Module)' },
    { color: station.solar, label: 'Broker (Docking Control)' },
    { color: station.viewport, label: 'Hub (Comms Array)' },
    { color: station.warning, label: 'Agents (Spacecraft Pods)' },
    { color: colors.rose, label: 'API Gateway (Airlock)' },
    { color: colors.textDim, label: 'Projects (Cargo Modules)' },
    { color: station.nebula, label: 'Dashboard (Observation Deck)' },
  ], []);

  // ── Helper: draw a cylindrical module ────────────────────────────────────

  const drawModule = (
    mx: number, my: number, mw: number, mh: number,
    fillColor: string, strokeColor: string, panelLines: number,
    opacity: number, label?: string, sublabel?: string,
  ) => {
    const r = Math.min(mw, mh) * 0.25;
    return (
      <g opacity={opacity}>
        {/* Hull shadow / glow */}
        <rect x={mx - mw / 2 - 2} y={my - mh / 2 - 2} width={mw + 4} height={mh + 4}
          rx={r + 2} fill="none" stroke={strokeColor} strokeWidth={1.5} opacity={0.15}
          filter="url(#moduleGlow)" />
        {/* Hull body */}
        <rect x={mx - mw / 2} y={my - mh / 2} width={mw} height={mh}
          rx={r} fill={fillColor} stroke={strokeColor} strokeWidth={1.2} opacity={0.95} />
        {/* Panel lines */}
        {Array.from({ length: panelLines }, (_, i) => {
          const ly = my - mh / 2 + ((i + 1) / (panelLines + 1)) * mh;
          return (
            <line key={`pl${i}`} x1={mx - mw / 2 + 4} y1={ly} x2={mx + mw / 2 - 4} y2={ly}
              stroke={strokeColor} strokeWidth={0.4} opacity={0.3} />
          );
        })}
        {/* Label */}
        {label && (
          <text x={mx} y={my + mh / 2 + 14} textAnchor="middle" fill={colors.text}
            fontSize={10} fontFamily="'Outfit', 'DM Sans', sans-serif" fontWeight={600}
            letterSpacing={0.8}>
            {label}
          </text>
        )}
        {sublabel && (
          <text x={mx} y={my + mh / 2 + 26} textAnchor="middle" fill={colors.textMuted}
            fontSize={8} fontFamily="'IBM Plex Mono', monospace">
            {sublabel}
          </text>
        )}
      </g>
    );
  };

  // ── Helper: draw solar panel array ───────────────────────────────────────

  const drawSolarPanel = (px: number, py: number, pw: number, ph: number, angle: number, opacity: number) => {
    const cellsX = Math.floor(pw / 10);
    const cellsY = Math.floor(ph / 8);
    return (
      <g opacity={opacity} transform={`rotate(${angle}, ${px}, ${py})`}>
        {/* Panel frame */}
        <rect x={px - pw / 2} y={py - ph / 2} width={pw} height={ph}
          fill={station.solar} stroke="#0D47A1" strokeWidth={0.8} opacity={0.85} />
        {/* Cell grid */}
        {Array.from({ length: cellsX }, (_, i) => (
          <line key={`sx${i}`} x1={px - pw / 2 + (i + 1) * (pw / (cellsX + 1))} y1={py - ph / 2 + 1}
            x2={px - pw / 2 + (i + 1) * (pw / (cellsX + 1))} y2={py + ph / 2 - 1}
            stroke="#0D47A1" strokeWidth={0.3} opacity={0.6} />
        ))}
        {Array.from({ length: cellsY }, (_, i) => (
          <line key={`sy${i}`} x1={px - pw / 2 + 1} y1={py - ph / 2 + (i + 1) * (ph / (cellsY + 1))}
            x2={px + pw / 2 - 1} y2={py - ph / 2 + (i + 1) * (ph / (cellsY + 1))}
            stroke="#0D47A1" strokeWidth={0.3} opacity={0.6} />
        ))}
        {/* Reflection highlight */}
        <rect x={px - pw / 2 + 2} y={py - ph / 2 + 1} width={pw * 0.3} height={ph - 2}
          fill="white" opacity={0.06} />
      </g>
    );
  };

  // ── Helper: draw docking tube ────────────────────────────────────────────

  const drawDockingTube = (x1: number, y1: number, x2: number, y2: number, opacity: number) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;
    return (
      <g opacity={opacity}>
        <rect x={midX - dist / 2} y={midY - 4} width={dist} height={8}
          rx={3} fill={colors.surface1} stroke={station.hull} strokeWidth={0.6}
          transform={`rotate(${angle}, ${midX}, ${midY})`} opacity={0.8} />
        {/* Tube ribbing */}
        {Array.from({ length: Math.max(2, Math.floor(dist / 16))}, (_, i) => {
          const t = (i + 1) / (Math.floor(dist / 16) + 1);
          const lx = x1 + dx * t;
          const ly = y1 + dy * t;
          return (
            <circle key={`rib${i}`} cx={lx} cy={ly} r={3.5}
              fill="none" stroke={station.hull} strokeWidth={0.4} opacity={0.35} />
          );
        })}
      </g>
    );
  };

  // ── Module positions ─────────────────────────────────────────────────────

  const modules = {
    core: { x: cx, y: cy, w: 120, h: 70 },
    broker: { x: cx - 100, y: cy - 80, w: 70, h: 50 },
    hub: { x: cx + 110, y: cy - 70, w: 60, h: 45 },
    airlock: { x: cx, y: cy - 130, w: 50, h: 30 },
    cargo1: { x: cx - 90, y: cy + 80, w: 55, h: 35 },
    cargo2: { x: cx + 80, y: cy + 85, w: 55, h: 35 },
    observation: { x: cx + 10, y: cy + 100, w: 50, h: 30 },
  };

  return (
    <AbsoluteFill style={{ backgroundColor: station.deepSpace }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <filter id="moduleGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="6" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="10" />
          </filter>
          <filter id="titleGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="nebulaGrad" cx="85%" cy="20%" r="50%">
            <stop offset="0%" stopColor={station.nebula} stopOpacity="0.12" />
            <stop offset="60%" stopColor={station.nebula} stopOpacity="0.04" />
            <stop offset="100%" stopColor={station.deepSpace} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="earthGlow" cx="50%" cy="100%" r="60%">
            <stop offset="0%" stopColor="#1565C0" stopOpacity="0.08" />
            <stop offset="40%" stopColor="#0D47A1" stopOpacity="0.04" />
            <stop offset="100%" stopColor={station.deepSpace} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="earthLimb" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#42A5F5" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#1565C0" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* ── Nebula gradient ─────────────────────────────────────── */}
        <rect x={0} y={0} width={width} height={height} fill="url(#nebulaGrad)" />

        {/* ── Earth glow at bottom ────────────────────────────────── */}
        <ellipse cx={cx} cy={height + 200} rx={width * 0.7} ry={300}
          fill="url(#earthGlow)" opacity={fadeIn(0, 40)} />
        {/* Earth atmospheric limb */}
        <ellipse cx={cx} cy={height + 180} rx={width * 0.55} ry={220}
          fill="none" stroke="#42A5F5" strokeWidth={2} opacity={0.08 + Math.sin(frame * 0.02) * 0.03} />

        {/* ── Starfield with parallax ─────────────────────────────── */}
        {stars.map((star, i) => {
          const parallax = star.size > 1 ? 0.15 : 0.05;
          const sx = (star.x + frame * parallax * 0.3) % width;
          const sy = star.y;
          const twinkle = 0.5 + Math.sin(frame * star.twinkleSpeed + star.twinkleOffset) * 0.5;
          return (
            <circle key={`s${i}`} cx={sx} cy={sy} r={star.size}
              fill={star.color} opacity={star.brightness * twinkle * fadeIn(0, 15)} />
          );
        })}

        {/* ── Orbital path ────────────────────────────────────────── */}
        <g opacity={fadeIn(10, 20) * 0.25}>
          {orbitDots.map((dot, i) => {
            const a = dot.angle + frame * 0.002;
            const ox = cx + Math.cos(a) * dot.rx;
            const oy = cy + Math.sin(a) * dot.ry;
            return (
              <circle key={`od${i}`} cx={ox} cy={oy} r={0.8}
                fill={station.hull} opacity={i % 3 === 0 ? 0.5 : 0.2} />
            );
          })}
        </g>

        {/* ── Station complex (with subtle rotation) ──────────────── */}
        <g transform={`rotate(${stationRotation}, ${cx}, ${cy})`} opacity={stationScale}>

          {/* ── Docking tubes ───────────────────────────────────────── */}
          {drawDockingTube(modules.core.x - 30, modules.core.y - 25,
            modules.broker.x + 15, modules.broker.y + 15, fadeIn(12))}
          {drawDockingTube(modules.core.x + 40, modules.core.y - 20,
            modules.hub.x - 15, modules.hub.y + 12, fadeIn(12))}
          {drawDockingTube(modules.core.x, modules.core.y - 35,
            modules.airlock.x, modules.airlock.y + 15, fadeIn(8))}
          {drawDockingTube(modules.core.x - 25, modules.core.y + 30,
            modules.cargo1.x + 10, modules.cargo1.y - 12, fadeIn(14))}
          {drawDockingTube(modules.core.x + 25, modules.core.y + 30,
            modules.cargo2.x - 10, modules.cargo2.y - 12, fadeIn(14))}
          {drawDockingTube(modules.core.x + 5, modules.core.y + 35,
            modules.observation.x, modules.observation.y - 12, fadeIn(16))}

          {/* ── Solar panel arrays ──────────────────────────────────── */}
          {/* Left wing */}
          <g>
            <line x1={modules.core.x - 60} y1={modules.core.y}
              x2={modules.core.x - 100} y2={modules.core.y}
              stroke={station.hull} strokeWidth={2} opacity={fadeIn(6) * 0.7} />
            {drawSolarPanel(modules.core.x - 145, modules.core.y - 2, 70, 35, solarAngle, fadeIn(6))}
            {drawSolarPanel(modules.core.x - 220, modules.core.y - 2, 70, 35, solarAngle, fadeIn(8))}
          </g>
          {/* Right wing */}
          <g>
            <line x1={modules.core.x + 60} y1={modules.core.y}
              x2={modules.core.x + 100} y2={modules.core.y}
              stroke={station.hull} strokeWidth={2} opacity={fadeIn(6) * 0.7} />
            {drawSolarPanel(modules.core.x + 145, modules.core.y - 2, 70, 35, -solarAngle, fadeIn(6))}
            {drawSolarPanel(modules.core.x + 220, modules.core.y - 2, 70, 35, -solarAngle, fadeIn(8))}
          </g>

          {/* ── Core command module ─────────────────────────────────── */}
          {drawModule(modules.core.x, modules.core.y, modules.core.w, modules.core.h,
            colors.surface0, station.hull, 4, fadeIn(0), 'c9-operator', 'Command Module')}
          {/* Core inner glow */}
          <rect x={modules.core.x - 20} y={modules.core.y - 8} width={40} height={16}
            rx={3} fill={station.viewport} opacity={0.08 + viewportGlow * 0.1}
            filter="url(#softGlow)" />

          {/* ── Broker module ───────────────────────────────────────── */}
          {drawModule(modules.broker.x, modules.broker.y, modules.broker.w, modules.broker.h,
            colors.surface0, station.solar, 3, fadeIn(10), 'Broker', 'Docking Control')}

          {/* ── Hub / comms array ───────────────────────────────────── */}
          {drawModule(modules.hub.x, modules.hub.y, modules.hub.w, modules.hub.h,
            colors.surface0, station.viewport, 2, fadeIn(10), 'Hub', 'Comms Array')}
          {/* Antenna dish */}
          <g opacity={fadeIn(12)}>
            <line x1={modules.hub.x} y1={modules.hub.y - 22}
              x2={modules.hub.x} y2={modules.hub.y - 42}
              stroke={station.hull} strokeWidth={1.5} />
            <ellipse cx={modules.hub.x} cy={modules.hub.y - 46} rx={16} ry={6}
              fill="none" stroke={station.viewport} strokeWidth={1} opacity={0.7} />
            <ellipse cx={modules.hub.x} cy={modules.hub.y - 46} rx={10} ry={4}
              fill={`rgba(${hexToRgb(station.viewport)}, 0.1)`}
              stroke={station.viewport} strokeWidth={0.5} opacity={0.5} />
            {/* Communication beams */}
            {[- 25, -10, 10, 25].map((angleDeg, i) => {
              const rad = (angleDeg - 90) * Math.PI / 180;
              const beamLen = 60 + commPulseT * 80;
              const bx = modules.hub.x + Math.cos(rad) * beamLen;
              const by = modules.hub.y - 46 + Math.sin(rad) * beamLen;
              return (
                <line key={`beam${i}`}
                  x1={modules.hub.x} y1={modules.hub.y - 46}
                  x2={bx} y2={by}
                  stroke={station.viewport} strokeWidth={0.5}
                  opacity={commPulseOpacity * 0.5} strokeDasharray="3 5" />
              );
            })}
            {/* Signal pulse rings */}
            {[0, 30, 60].map((delay, i) => {
              const pulseFrame = (frame + delay) % 90;
              const pulseR = interpolate(pulseFrame, [0, 89], [5, 50], { extrapolateRight: 'clamp' });
              const pulseOp = interpolate(pulseFrame, [0, 60, 89], [0.4, 0.15, 0], { extrapolateRight: 'clamp' });
              return (
                <ellipse key={`sig${i}`} cx={modules.hub.x} cy={modules.hub.y - 46}
                  rx={pulseR} ry={pulseR * 0.4}
                  fill="none" stroke={station.viewport} strokeWidth={0.6} opacity={pulseOp * fadeIn(15)} />
              );
            })}
          </g>

          {/* ── API Gateway / Airlock ──────────────────────────────── */}
          {drawModule(modules.airlock.x, modules.airlock.y, modules.airlock.w, modules.airlock.h,
            colors.surface0, colors.rose, 1, fadeIn(8), 'API Gateway', 'Airlock')}
          {/* Airlock hatch indicator */}
          <circle cx={modules.airlock.x} cy={modules.airlock.y - 18}
            r={4} fill="none" stroke={colors.rose} strokeWidth={0.8}
            opacity={fadeIn(8) * 0.6} />
          <circle cx={modules.airlock.x} cy={modules.airlock.y - 18}
            r={1.5} fill={colors.rose} opacity={fadeIn(8) * blinkA} />

          {/* ── Cargo modules (Projects) ───────────────────────────── */}
          {drawModule(modules.cargo1.x, modules.cargo1.y, modules.cargo1.w, modules.cargo1.h,
            colors.surface0, colors.textDim, 2, fadeIn(14), 'Project A', 'Cargo Bay')}
          {drawModule(modules.cargo2.x, modules.cargo2.y, modules.cargo2.w, modules.cargo2.h,
            colors.surface0, colors.textDim, 2, fadeIn(14), 'Project B', 'Cargo Bay')}
          {/* Cargo hatches */}
          <rect x={modules.cargo1.x - 6} y={modules.cargo1.y - 4} width={12} height={8}
            rx={1} fill="none" stroke={colors.textMuted} strokeWidth={0.5}
            opacity={fadeIn(16) * 0.5} />
          <rect x={modules.cargo2.x - 6} y={modules.cargo2.y - 4} width={12} height={8}
            rx={1} fill="none" stroke={colors.textMuted} strokeWidth={0.5}
            opacity={fadeIn(16) * 0.5} />

          {/* ── Observation deck (Dashboard) ───────────────────────── */}
          {drawModule(modules.observation.x, modules.observation.y, modules.observation.w, modules.observation.h,
            colors.surface0, station.nebula, 1, fadeIn(16), 'Dashboard', 'Observation Deck')}
          {/* Viewport window glow */}
          <rect x={modules.observation.x - 14} y={modules.observation.y - 5} width={28} height={10}
            rx={4} fill={station.viewport}
            opacity={viewportGlow * 0.2 * fadeIn(18)} filter="url(#softGlow)" />
          <rect x={modules.observation.x - 12} y={modules.observation.y - 4} width={24} height={8}
            rx={3} fill="none" stroke={station.viewport} strokeWidth={0.6}
            opacity={fadeIn(18) * 0.6} />

          {/* ── Running lights along hull ──────────────────────────── */}
          {[
            { x: modules.core.x - 60, y: modules.core.y - 10, c: station.navRed, b: blinkA },
            { x: modules.core.x + 60, y: modules.core.y - 10, c: station.navGreen, b: blinkB },
            { x: modules.core.x - 60, y: modules.core.y + 10, c: station.navRed, b: blinkB },
            { x: modules.core.x + 60, y: modules.core.y + 10, c: station.navGreen, b: blinkA },
            { x: modules.broker.x - 35, y: modules.broker.y, c: station.navRed, b: blinkA },
            { x: modules.hub.x + 30, y: modules.hub.y, c: station.navGreen, b: blinkB },
            { x: modules.airlock.x - 25, y: modules.airlock.y, c: station.warning, b: blinkA },
            { x: modules.airlock.x + 25, y: modules.airlock.y, c: station.warning, b: blinkB },
          ].map((light, i) => (
            <circle key={`rl${i}`} cx={light.x} cy={light.y} r={1.8}
              fill={light.c} opacity={light.b * fadeIn(5)} />
          ))}

          {/* ── EVA particles near airlock ─────────────────────────── */}
          {evaParticles.map((p, i) => {
            const ex = p.baseX + p.driftX * frame;
            const ey = p.baseY + p.driftY * frame;
            const eo = p.opacity * (0.5 + Math.sin(frame * 0.04 + i * 2) * 0.5);
            return (
              <circle key={`eva${i}`} cx={ex} cy={ey} r={p.size}
                fill="white" opacity={eo * fadeIn(20)} />
            );
          })}
        </g>

        {/* ── Agent pods (outside station rotation for independent motion) ── */}
        {agentPods.map((pod) => {
          const dockProgress = interpolate(
            frame,
            [pod.dockDelay, pod.dockDelay + 40],
            [0, pod.docked ? 1 : 0.6],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );

          // Maneuvering agents orbit slightly when undocked
          const orbitOffset = pod.docked
            ? 0
            : Math.sin(frame * 0.02 + agentPods.indexOf(pod)) * 15;

          const podX = interpolate(dockProgress, [0, 1], [pod.startX, pod.dockX], {
            extrapolateRight: 'clamp',
          }) + (pod.docked ? 0 : orbitOffset);
          const podY = interpolate(dockProgress, [0, 1], [pod.startY, pod.dockY], {
            extrapolateRight: 'clamp',
          }) + (pod.docked ? 0 : Math.cos(frame * 0.025) * 10);

          const podOpacity = fadeIn(pod.dockDelay - 5, 15);

          // Thruster active when moving
          const thrusterActive = dockProgress > 0.01 && dockProgress < (pod.docked ? 0.95 : 0.55);
          const thrusterFlicker = 0.5 + Math.sin(frame * 0.8 + agentPods.indexOf(pod) * 3) * 0.5;

          const podScale = spring({
            frame: frame - pod.dockDelay + 5,
            fps,
            config: { damping: 12, stiffness: 80 },
          });

          return (
            <g key={pod.id} opacity={podOpacity} transform={`translate(${podX}, ${podY}) scale(${Math.max(0, podScale)})`}>
              {/* Pod body */}
              <rect x={-14} y={-10} width={28} height={20} rx={6}
                fill={colors.surface0} stroke={pod.color} strokeWidth={1} opacity={0.9} />
              {/* Cockpit window */}
              <rect x={-6} y={-5} width={12} height={5} rx={2}
                fill={station.viewport} opacity={0.25} />
              {/* Pod panel line */}
              <line x1={-10} y1={2} x2={10} y2={2}
                stroke={pod.color} strokeWidth={0.3} opacity={0.4} />

              {/* Thruster flame */}
              {thrusterActive && (
                <g>
                  <ellipse cx={0} cy={14} rx={4 * thrusterFlicker} ry={6 * thrusterFlicker}
                    fill={station.thruster} opacity={0.6 * thrusterFlicker} />
                  <ellipse cx={0} cy={12} rx={2 * thrusterFlicker} ry={3 * thrusterFlicker}
                    fill={station.starlight} opacity={0.8 * thrusterFlicker} />
                </g>
              )}

              {/* Pod nav lights */}
              <circle cx={-14} cy={0} r={1.2} fill={station.navRed} opacity={blinkA * 0.7} />
              <circle cx={14} cy={0} r={1.2} fill={station.navGreen} opacity={blinkB * 0.7} />

              {/* Label */}
              <text x={0} y={28} textAnchor="middle" fill={pod.color}
                fontSize={8} fontFamily="'IBM Plex Mono', monospace" fontWeight={500}
                opacity={0.8}>
                {pod.label}
              </text>
            </g>
          );
        })}

        {/* ── Title ───────────────────────────────────────────────── */}
        <g opacity={titleOpacity} transform={`translate(0, ${titleY})`}>
          <text x={cx} y={height - 50} textAnchor="middle"
            fill={station.viewport} fontSize={22}
            fontFamily="'Outfit', 'DM Sans', sans-serif" fontWeight={800}
            letterSpacing={4} filter="url(#titleGlow)">
            c9-operator
          </text>
          <text x={cx} y={height - 30} textAnchor="middle"
            fill={colors.textMuted} fontSize={11}
            fontFamily="'IBM Plex Mono', monospace" letterSpacing={2.5}>
            ORBITAL AGENT STATION
          </text>
        </g>

        {/* ── Legend ──────────────────────────────────────────────── */}
        <g opacity={legendOpacity} transform={`translate(16, ${height - 150})`}>
          {legendItems.map((item, i) => (
            <g key={`leg${i}`} transform={`translate(0, ${i * 16})`}>
              <rect x={0} y={-4} width={8} height={8} rx={1.5}
                fill={item.color} opacity={0.75} />
              <text x={14} y={4} fill={colors.textDim} fontSize={8.5}
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

export default SpaceStation;
