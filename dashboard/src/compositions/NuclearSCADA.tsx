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

// ── Deterministic random ──────────────────────────────────────────────────────

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── SCADA Color Palette ───────────────────────────────────────────────────────

const S = {
  bg: '#0f0f11',
  panelGray: '#3a3a3e',
  panelDark: '#1a1a1e',
  panelBorder: '#4a4a4e',
  warningAmber: '#ffaa00',
  dangerRed: '#ff2200',
  dangerRedDim: '#aa1100',
  clinicalWhite: '#e0e0d8',
  labelDim: '#808078',
  radioGreen: '#66ff00',
  radioGreenDim: '#338800',
  coolantBlue: '#3388cc',
  coolantFlow: '#55aaee',
  rodGray: '#999999',
  instrumentFace: '#141418',
  needleRed: '#cc3333',
  scramFlash: '#ff0000',
  ledOn: '#44ff44',
  ledOff: '#1a3a1a',
  ledWarn: '#ffaa00',
};

// ── Alarm journal entries ─────────────────────────────────────────────────────

const ALARMS = [
  { t: '14:27:01', sev: 'INFO' as const, msg: 'c9-OPERATOR: session pool initialized (4 slots)' },
  { t: '14:27:03', sev: 'INFO' as const, msg: 'BROKER: primary coolant loop nominal' },
  { t: '14:27:08', sev: 'WARN' as const, msg: 'AGENT-\u03b1: token consumption rate elevated' },
  { t: '14:27:12', sev: 'INFO' as const, msg: 'HUB: steam generator output stable' },
  { t: '14:27:19', sev: 'WARN' as const, msg: 'AGENT-\u03b3: xenon buildup detected in context' },
  { t: '14:27:22', sev: 'INFO' as const, msg: 'GATEWAY: turbine RPM within tolerance' },
  { t: '14:27:28', sev: 'TRIP' as const, msg: 'SCRAM: NEUTRON FLUX EXCEEDED SETPOINT' },
  { t: '14:27:29', sev: 'TRIP' as const, msg: 'SCRAM: ALL RODS INSERTING' },
  { t: '14:27:30', sev: 'TRIP' as const, msg: 'SCRAM: REACTOR POWER DROPPING' },
  { t: '14:27:35', sev: 'WARN' as const, msg: 'BROKER: coolant temp spike — decay heat' },
  { t: '14:27:40', sev: 'INFO' as const, msg: 'c9-OPERATOR: emergency shutdown sequence OK' },
  { t: '14:27:45', sev: 'INFO' as const, msg: 'AGENT-\u03b2: context checkpoint saved' },
  { t: '14:27:50', sev: 'INFO' as const, msg: 'GATEWAY: all API endpoints responding' },
  { t: '14:27:55', sev: 'WARN' as const, msg: 'AGENT-\u03b4: session approaching TTL limit' },
  { t: '14:28:01', sev: 'INFO' as const, msg: 'HUB: reconnecting websocket clients (23)' },
];

// ── Gauge definitions ─────────────────────────────────────────────────────────

const GAUGES = [
  { label: 'REACTOR PWR', unit: '%', min: 0, max: 110, redZone: 95, nominal: 78 },
  { label: 'COOLANT T', unit: '\u00b0C', min: 200, max: 350, redZone: 320, nominal: 285 },
  { label: 'PRESSURE', unit: 'bar', min: 0, max: 200, redZone: 175, nominal: 155 },
  { label: 'FLOW RATE', unit: 'm\u00b3/s', min: 0, max: 50, redZone: 45, nominal: 32 },
  { label: 'NEUTRON FLX', unit: 'n/cm\u00b2', min: 0, max: 100, redZone: 88, nominal: 65 },
  { label: 'ROD POS', unit: '%', min: 0, max: 100, redZone: 95, nominal: 72 },
  { label: 'XENON LVL', unit: 'ppb', min: 0, max: 100, redZone: 80, nominal: 35 },
  { label: 'CONTAIN P', unit: 'kPa', min: 0, max: 120, redZone: 100, nominal: 42 },
];

// ── Agent resource data ───────────────────────────────────────────────────────

const AGENTS = [
  { id: '\u03b1', name: 'Betelgeuse', util: 0.72 },
  { id: '\u03b2', name: 'Sirius', util: 0.58 },
  { id: '\u03b3', name: 'Vega', util: 0.91 },
  { id: '\u03b4', name: 'Rigel', util: 0.45 },
];

// ── Composition ───────────────────────────────────────────────────────────────

export const NuclearSCADA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // ── Seeded data ─────────────────────────────────────────────────────────────
  const dustMotes = useMemo(() => {
    const rng = seededRandom(42);
    return Array.from({ length: 40 }, () => ({
      x: rng() * 1920, y: rng() * 1080,
      vx: (rng() - 0.5) * 0.3, vy: -0.1 - rng() * 0.2,
      size: 0.5 + rng() * 1.5, opacity: 0.05 + rng() * 0.1,
    }));
  }, []);

  const geigerDots = useMemo(() => {
    const rng = seededRandom(99);
    return Array.from({ length: 200 }, () => ({
      x: rng() * 1920, y: rng() * 1080, frame: Math.floor(rng() * 300),
    }));
  }, []);

  // ── SCRAM logic (frame 100) ─────────────────────────────────────────────────
  const isScram = frame >= 100;
  const scramProgress = interpolate(frame, [100, 160], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const scramFlash = frame >= 100 && frame <= 130 ? Math.sin((frame - 100) * 0.8) * 0.3 : 0;
  const scramShake = frame >= 100 && frame <= 140 ? Math.sin(frame * 2.3) * (1 - (frame - 100) / 40) * 3 : 0;

  // ── Fluorescent flicker ─────────────────────────────────────────────────────
  const flicker = 1 - Math.abs(Math.sin(frame * 0.7) * Math.sin(frame * 1.3)) * 0.02;

  // ── Gauge values with SCRAM drop ────────────────────────────────────────────
  const gaugeValues = GAUGES.map((g, i) => {
    const wobble = Math.sin(t * (1.2 + i * 0.3) + i * 2.1) * 3;
    const base = isScram && i === 0 ? interpolate(scramProgress, [0, 1], [g.nominal, 8]) :
      isScram && i === 4 ? interpolate(scramProgress, [0, 1], [g.nominal, 5]) :
      isScram && i === 5 ? interpolate(scramProgress, [0, 1], [g.nominal, 2]) : g.nominal;
    return Math.max(g.min, Math.min(g.max, base + wobble));
  });

  // ── Control rod positions ───────────────────────────────────────────────────
  const rodPositions = [0.72, 0.65, 0.78, 0.60].map((base, i) => {
    if (isScram) return interpolate(scramProgress, [0, 1], [base, 0.02]);
    return base + Math.sin(t * 0.5 + i * 1.5) * 0.05;
  });

  // ── Flow animation offset ──────────────────────────────────────────────────
  const flowOffset = (frame * 2) % 20;

  // ── Visible alarms (scroll in over time) ───────────────────────────────────
  const visibleAlarms = Math.min(ALARMS.length, Math.floor(frame / 18) + 1);

  // ── LED blink cycle ────────────────────────────────────────────────────────
  const ledBlink = Math.sin(frame * 0.3) > 0;

  // ── Easing-driven intro opacity ────────────────────────────────────────────
  const introOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: 'clamp', easing: Easing.out(Easing.quad),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: S.bg, opacity: introOpacity }}>
      <svg
        viewBox="0 0 1920 1080"
        style={{
          width: '100%', height: '100%',
          transform: `translate(${scramShake}px, ${scramShake * 0.5}px)`,
          opacity: flicker,
        }}
      >
        <defs>
          <radialGradient id="nuc-vignette">
            <stop offset="40%" stopColor="transparent" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.6)" />
          </radialGradient>
          <filter id="nuc-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="nuc-crt">
            <feGaussianBlur stdDeviation="0.5" />
          </filter>
          <pattern id="nuc-noise" width="100" height="100" patternUnits="userSpaceOnUse">
            {Array.from({ length: 50 }, (_, i) => {
              const rng = seededRandom(i + 500);
              return <rect key={i} x={rng() * 100} y={rng() * 100} width="1" height="1" fill={`rgba(255,255,255,${rng() * 0.03})`} />;
            })}
          </pattern>
        </defs>

        {/* Panel background texture */}
        <rect width="1920" height="1080" fill={S.bg} />
        <rect width="1920" height="1080" fill="url(#nuc-noise)" />

        {/* ─── MIMIC PANEL (top 580px) ─────────────────────────────────── */}
        <rect x="10" y="10" width="1900" height="580" rx="4" fill={S.panelDark} stroke={S.panelBorder} strokeWidth="2" />
        {/* Panel bevel effect */}
        <line x1="12" y1="12" x2="1908" y2="12" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        <line x1="12" y1="588" x2="1908" y2="588" stroke="rgba(0,0,0,0.3)" strokeWidth="1" />
        <text x="960" y="36" textAnchor="middle" fill={S.clinicalWhite} fontSize="14" fontFamily="monospace" fontWeight="bold" letterSpacing="4">
          c9-OPERATOR REACTOR MIMIC PANEL
        </text>
        {/* Panel label plate (embossed nameplate) */}
        <rect x="830" y="44" width="260" height="16" rx="2" fill={S.panelGray} stroke={S.panelBorder} strokeWidth="0.5" />
        <text x="960" y="56" textAnchor="middle" fill={S.labelDim} fontSize="7" fontFamily="monospace" letterSpacing="2">
          UNIT 9 — REVISION 3.2.1
        </text>

        {/* Containment building outline */}
        <path d="M 580 450 L 580 220 Q 680 140 780 220 L 780 450 Z" fill="none"
          stroke={S.panelBorder} strokeWidth="1.5" strokeDasharray="6 3" opacity="0.4" />
        <text x="680" y="470" textAnchor="middle" fill={S.labelDim} fontSize="7" fontFamily="monospace">CONTAINMENT</text>

        {/* Radiation symbol watermark behind core */}
        <g opacity="0.06" transform="translate(680,320)">
          {[0, 120, 240].map(deg => {
            const rad = (deg - 90) * Math.PI / 180;
            return (
              <path key={`rad-${deg}`}
                d={`M 0 0 L ${Math.cos(rad - 0.5) * 45} ${Math.sin(rad - 0.5) * 45} A 45 45 0 0 1 ${Math.cos(rad + 0.5) * 45} ${Math.sin(rad + 0.5) * 45} Z`}
                fill={S.warningAmber} />
            );
          })}
          <circle r="12" fill={S.bg} />
        </g>

        {/* Reactor Core — center */}
        <circle cx="680" cy="320" r="110" fill="none" stroke={S.warningAmber} strokeWidth="3" opacity={isScram ? 0.4 : 0.8} />
        <circle cx="680" cy="320" r="85" fill="none" stroke={S.warningAmber} strokeWidth="1.5" opacity={0.5} />
        <circle cx="680" cy="320" r="60" fill={`rgba(${hexToRgb(S.warningAmber)},${isScram ? 0.05 : 0.15})`} stroke={S.warningAmber} strokeWidth="1" />
        <text x="680" y="312" textAnchor="middle" fill={S.clinicalWhite} fontSize="11" fontFamily="monospace">REACTOR</text>
        <text x="680" y="328" textAnchor="middle" fill={S.clinicalWhite} fontSize="11" fontFamily="monospace">CORE</text>
        <text x="680" y="350" textAnchor="middle" fill={isScram ? S.dangerRed : S.radioGreen} fontSize="10" fontFamily="monospace" filter="url(#nuc-glow)">
          {isScram ? 'SCRAM' : 'NOMINAL'}
        </text>

        {/* Control Rod Assemblies — above core */}
        {rodPositions.map((pos, i) => {
          const rx = 620 + i * 40;
          const rodTop = 100;
          const rodBottom = 200;
          const rodY = rodTop + (1 - pos) * (rodBottom - rodTop);
          return (
            <g key={`rod-${i}`}>
              <rect x={rx} y={rodTop} width="12" height={rodBottom - rodTop} fill={S.panelDark} stroke={S.panelBorder} strokeWidth="1" />
              <rect x={rx + 1} y={rodY} width="10" height={rodBottom - rodY} fill={pos < 0.1 ? S.radioGreen : S.rodGray} rx="1" />
              <text x={rx + 6} y={rodTop - 8} textAnchor="middle" fill={S.labelDim} fontSize="7" fontFamily="monospace">R{i + 1}</text>
              <circle cx={rx + 6} cy={rodTop - 20} r="4" fill={pos < 0.1 ? S.ledOn : ledBlink ? S.ledWarn : S.ledOff} />
            </g>
          );
        })}

        {/* Broker — Primary Coolant Pump (left of core) */}
        <rect x="340" y="280" width="140" height="80" rx="6" fill={S.panelDark} stroke={S.coolantBlue} strokeWidth="2" />
        <text x="410" y="310" textAnchor="middle" fill={S.clinicalWhite} fontSize="9" fontFamily="monospace">PRIMARY COOLANT</text>
        <text x="410" y="325" textAnchor="middle" fill={S.coolantBlue} fontSize="10" fontFamily="monospace" fontWeight="bold">BROKER PUMP</text>
        <circle cx="410" cy="345" r="5" fill={ledBlink ? S.ledOn : S.ledOff} />

        {/* Hub — Steam Generator (right of core) */}
        <rect x="880" y="280" width="140" height="80" rx="6" fill={S.panelDark} stroke={S.coolantBlue} strokeWidth="2" />
        <text x="950" y="310" textAnchor="middle" fill={S.clinicalWhite} fontSize="9" fontFamily="monospace">STEAM GENERATOR</text>
        <text x="950" y="325" textAnchor="middle" fill={S.coolantBlue} fontSize="10" fontFamily="monospace" fontWeight="bold">HUB</text>
        <circle cx="950" cy="345" r="5" fill={S.ledOn} />

        {/* API Gateway — Turbine (far right) */}
        <rect x="1140" y="280" width="130" height="80" rx="6" fill={S.panelDark} stroke={colors.amber} strokeWidth="2" />
        <text x="1205" y="310" textAnchor="middle" fill={S.clinicalWhite} fontSize="9" fontFamily="monospace">TURBINE</text>
        <text x="1205" y="325" textAnchor="middle" fill={colors.amber} fontSize="10" fontFamily="monospace" fontWeight="bold">API GATEWAY</text>
        <circle cx="1205" cy="345" r="5" fill={S.ledOn} />

        {/* Pipeline: Pump → Core (with flow arrows) */}
        <line x1="480" y1="320" x2="570" y2="320" stroke={S.coolantBlue} strokeWidth="4" />
        {[0, 1, 2, 3].map(i => (
          <circle key={`flow-pc-${i}`} cx={480 + ((flowOffset + i * 22) % 90)} cy={320} r="2" fill={S.coolantFlow} />
        ))}

        {/* Pipeline: Core → Generator */}
        <line x1="790" y1="320" x2="880" y2="320" stroke={S.coolantBlue} strokeWidth="4" />
        {[0, 1, 2, 3].map(i => (
          <circle key={`flow-cg-${i}`} cx={790 + ((flowOffset + i * 22) % 90)} cy={320} r="2" fill={S.coolantFlow} />
        ))}

        {/* Pipeline: Generator → Turbine (steam, dashed) */}
        <line x1="1020" y1="320" x2="1140" y2="320" stroke={S.panelBorder} strokeWidth="3" strokeDasharray="8 4" strokeDashoffset={-flowOffset} />

        {/* Steam particles drifting from generator to turbine */}
        {Array.from({ length: 8 }, (_, i) => {
          const px = 1030 + ((frame * 0.8 + i * 15) % 110);
          const py = 320 + Math.sin(frame * 0.1 + i) * 6;
          return <circle key={`steam-${i}`} cx={px} cy={py} r="1.5" fill={S.clinicalWhite} opacity={0.15 - (px - 1030) / 1100} />;
        })}

        {/* Toggle switches for each component with label plates */}
        {[
          { x: 410, y: 372, on: true, label: 'PUMP' },
          { x: 680, y: 482, on: !isScram, label: 'CORE' },
          { x: 950, y: 372, on: true, label: 'STEN' },
          { x: 1205, y: 372, on: true, label: 'TURB' },
        ].map((sw, i) => (
          <g key={`sw-${i}`}>
            <rect x={sw.x - 8} y={sw.y} width="16" height="28" rx="2" fill={S.panelGray} stroke={S.panelBorder} strokeWidth="1" />
            <rect x={sw.x - 5} y={sw.on ? sw.y + 2 : sw.y + 14} width="10" height="12" rx="1" fill={sw.on ? S.radioGreen : S.dangerRed} />
            {/* Switch label plate */}
            <rect x={sw.x - 14} y={sw.y + 30} width="28" height="10" rx="1" fill={S.panelGray} />
            <text x={sw.x} y={sw.y + 38} textAnchor="middle" fill={S.labelDim} fontSize="5" fontFamily="monospace">{sw.label}</text>
          </g>
        ))}

        {/* Return coolant line (bottom, pump back to core) */}
        <path d="M 410 360 L 410 500 L 570 500 L 570 380" fill="none" stroke={S.coolantBlue} strokeWidth="3" opacity="0.5" />
        {[0, 1, 2].map(i => {
          const progress = ((flowOffset + i * 30) % 90) / 90;
          const px = progress < 0.33 ? 410 : progress < 0.66 ? 410 + (progress - 0.33) / 0.33 * 160 : 570;
          const py = progress < 0.33 ? 360 + progress / 0.33 * 140 : progress < 0.66 ? 500 : 500 - (progress - 0.66) / 0.34 * 120;
          return <circle key={`ret-${i}`} cx={px} cy={py} r="1.5" fill={S.coolantFlow} opacity="0.6" />;
        })}

        {/* Status LED bank (6 indicator lights in a row above mimic) */}
        {[
          { label: 'PWR', color: isScram ? S.dangerRed : S.ledOn },
          { label: 'RCP', color: S.ledOn },
          { label: 'SG', color: S.ledOn },
          { label: 'FW', color: ledBlink ? S.ledWarn : S.ledOn },
          { label: 'AUX', color: S.ledOff },
          { label: 'DG', color: S.ledOn },
        ].map((led, i) => (
          <g key={`led-bank-${i}`}>
            <circle cx={120 + i * 48} cy="560" r="6" fill={led.color} filter={led.color === S.ledOn || led.color === S.dangerRed ? 'url(#nuc-glow)' : undefined} />
            <text x={120 + i * 48} y="576" textAnchor="middle" fill={S.labelDim} fontSize="6" fontFamily="monospace">{led.label}</text>
          </g>
        ))}

        {/* ─── SCRAM panel (top right) ───────────────────────────────── */}
        <rect x="1380" y="50" width="510" height="200" rx="4" fill={S.panelDark} stroke={isScram ? S.dangerRed : S.panelBorder} strokeWidth={isScram ? 2 : 1} />
        <text x="1635" y="76" textAnchor="middle" fill={S.dangerRed} fontSize="12" fontFamily="monospace" fontWeight="bold" letterSpacing="3">
          EMERGENCY SCRAM PANEL
        </text>
        <circle cx="1635" cy="140" r="40" fill={isScram ? S.scramFlash : '#440000'} stroke={S.dangerRed} strokeWidth="3"
          opacity={isScram && frame % 10 < 5 ? 1 : 0.8} filter={isScram ? 'url(#nuc-glow)' : undefined} />
        <text x="1635" y="145" textAnchor="middle" fill={S.clinicalWhite} fontSize="14" fontFamily="monospace" fontWeight="bold">SCRAM</text>
        <text x="1635" y="210" textAnchor="middle" fill={isScram ? S.dangerRed : S.radioGreenDim} fontSize="9" fontFamily="monospace">
          {isScram ? 'SCRAM ACTIVE \u2014 RODS INSERTING' : 'SCRAM NOT ACTIVE'}
        </text>

        {/* ─── Digital readout panel (top right, below SCRAM) ─────────── */}
        <rect x="1380" y="260" width="510" height="200" rx="4" fill={S.panelDark} stroke={S.panelBorder} strokeWidth="1" />
        <text x="1635" y="282" textAnchor="middle" fill={S.clinicalWhite} fontSize="10" fontFamily="monospace" letterSpacing="2">DIGITAL READOUT</text>
        {[
          { label: 'PWR OUTPUT', val: `${gaugeValues[0].toFixed(1)}%` },
          { label: 'SESSIONS', val: '4 ACTIVE' },
          { label: 'MSG/SEC', val: '2,847' },
          { label: 'UPTIME', val: '72:14:33' },
          { label: 'XENON', val: `${gaugeValues[6].toFixed(0)} ppb` },
          { label: 'CONTAIN', val: `${gaugeValues[7].toFixed(0)} kPa` },
        ].map((item, i) => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          return (
            <g key={`dro-${i}`}>
              <text x={1410 + col * 260} y={308 + row * 42} fill={S.labelDim} fontSize="8" fontFamily="monospace">{item.label}</text>
              <text x={1410 + col * 260} y={324 + row * 42} fill={S.radioGreen} fontSize="15" fontFamily="monospace" filter="url(#nuc-crt)">{item.val}</text>
            </g>
          );
        })}

        {/* ─── BOTTOM LEFT: Analog gauges (4x2 grid) ──────────────────── */}
        {GAUGES.map((g, i) => {
          const col = i % 4;
          const row = Math.floor(i / 4);
          const cx = 110 + col * 170;
          const cy = 688 + row * 190;
          const r = 68;
          const value = gaugeValues[i];
          const frac = (value - g.min) / (g.max - g.min);
          const redFrac = (g.redZone - g.min) / (g.max - g.min);
          const needleAngle = -135 + frac * 270;
          const smoothAngle = spring({ frame, fps, config: { damping: 15, stiffness: 40, mass: 1.5 },
            from: -135 + ((g.nominal - 5) / (g.max - g.min)) * 270, to: needleAngle });
          const inRedZone = frac > redFrac;

          return (
            <g key={`gauge-${i}`}>
              <circle cx={cx} cy={cy} r={r + 4} fill={S.panelGray} stroke={S.panelBorder} strokeWidth="2" />
              <circle cx={cx} cy={cy} r={r} fill={S.instrumentFace} />
              {/* Scale markings */}
              {Array.from({ length: 28 }, (_, j) => {
                const a = (-135 + j * (270 / 27)) * Math.PI / 180;
                const isMajor = j % 3 === 0;
                const inner = r - (isMajor ? 14 : 8);
                const isRed = j / 27 > redFrac;
                return (
                  <line key={j} x1={cx + Math.cos(a) * inner} y1={cy + Math.sin(a) * inner}
                    x2={cx + Math.cos(a) * (r - 3)} y2={cy + Math.sin(a) * (r - 3)}
                    stroke={isRed ? S.dangerRed : S.labelDim} strokeWidth={isMajor ? 1.5 : 0.5} />
                );
              })}
              {/* Needle */}
              {(() => {
                const a = smoothAngle * Math.PI / 180;
                return <line x1={cx} y1={cy} x2={cx + Math.cos(a) * (r - 16)} y2={cy + Math.sin(a) * (r - 16)}
                  stroke={inRedZone ? S.needleRed : S.clinicalWhite} strokeWidth="2" strokeLinecap="round" />;
              })()}
              <circle cx={cx} cy={cy} r="4" fill={S.rodGray} />
              <text x={cx} y={cy + r - 18} textAnchor="middle" fill={S.labelDim} fontSize="7" fontFamily="monospace">{g.label}</text>
              <text x={cx} y={cy + r - 8} textAnchor="middle" fill={inRedZone ? S.dangerRed : S.clinicalWhite} fontSize="9" fontFamily="monospace">
                {value.toFixed(1)} {g.unit}
              </text>
            </g>
          );
        })}

        {/* ─── BOTTOM CENTER: Alarm journal ───────────────────────────── */}
        <rect x="700" y="610" width="540" height="460" rx="4" fill={S.panelDark} stroke={S.panelBorder} strokeWidth="1" />
        <rect x="700" y="610" width="540" height="22" fill={S.panelGray} />
        <text x="970" y="626" textAnchor="middle" fill={S.clinicalWhite} fontSize="10" fontFamily="monospace" letterSpacing="2">ALARM JOURNAL</text>
        <clipPath id="alarm-clip"><rect x="705" y="636" width="530" height="428" /></clipPath>
        <g clipPath="url(#alarm-clip)">
          {ALARMS.slice(0, visibleAlarms).map((alarm, i) => {
            const ay = 650 + i * 26;
            const sevColor = alarm.sev === 'TRIP' ? S.dangerRed : alarm.sev === 'WARN' ? S.warningAmber : S.clinicalWhite;
            const isNew = i === visibleAlarms - 1;
            const flashOn = isNew && frame % 12 < 6 && (frame - (visibleAlarms - 1) * 18) < 54;
            return (
              <g key={`alarm-${i}`} opacity={flashOn ? 0.3 : 1}>
                <rect x="710" y={ay - 10} width="520" height="22" fill={alarm.sev === 'TRIP' ? `rgba(${hexToRgb(S.dangerRed)},0.08)` : 'transparent'} />
                <text x="715" y={ay + 3} fill={S.labelDim} fontSize="8" fontFamily="monospace">{alarm.t}</text>
                <text x="790" y={ay + 3} fill={sevColor} fontSize="8" fontFamily="monospace" fontWeight="bold">{alarm.sev}</text>
                <text x="830" y={ay + 3} fill={sevColor} fontSize="8" fontFamily="monospace">{alarm.msg}</text>
              </g>
            );
          })}
        </g>

        {/* ─── BOTTOM RIGHT: Agent utilization bars ───────────────────── */}
        <rect x="1260" y="610" width="640" height="200" rx="4" fill={S.panelDark} stroke={S.panelBorder} strokeWidth="1" />
        <text x="1580" y="632" textAnchor="middle" fill={S.clinicalWhite} fontSize="10" fontFamily="monospace" letterSpacing="2">AGENT RESOURCE UTILIZATION</text>
        {AGENTS.map((agent, i) => {
          const by = 652 + i * 40;
          const barW = 400;
          const utilPct = isScram
            ? interpolate(scramProgress, [0, 1], [agent.util, 0.1], { extrapolateRight: 'clamp' })
            : agent.util + Math.sin(t + i) * 0.05;
          const barColor = utilPct > 0.85 ? S.dangerRed : utilPct > 0.65 ? S.warningAmber : S.radioGreen;
          return (
            <g key={`agent-bar-${i}`}>
              <text x="1275" y={by + 14} fill={S.clinicalWhite} fontSize="8" fontFamily="monospace">AGENT-{agent.id}</text>
              <text x="1275" y={by + 24} fill={S.labelDim} fontSize="7" fontFamily="monospace">{agent.name}</text>
              <rect x="1375" y={by + 4} width={barW} height="18" fill={S.instrumentFace} stroke={S.panelBorder} strokeWidth="1" rx="2" />
              <rect x="1376" y={by + 5} width={Math.max(0, barW * utilPct - 2)} height="16" fill={barColor} rx="1" opacity="0.8" />
              <text x={1785} y={by + 17} textAnchor="end" fill={S.clinicalWhite} fontSize="9" fontFamily="monospace">
                {(utilPct * 100).toFixed(0)}%
              </text>
            </g>
          );
        })}

        {/* ─── Bottom right: process variables ────────────────────────── */}
        <rect x="1260" y="820" width="640" height="250" rx="4" fill={S.panelDark} stroke={S.panelBorder} strokeWidth="1" />
        <text x="1580" y="842" textAnchor="middle" fill={S.clinicalWhite} fontSize="10" fontFamily="monospace" letterSpacing="2">PROCESS VARIABLES</text>
        {[
          { label: 'COOLANT FLOW', val: `${gaugeValues[3].toFixed(2)} m\u00b3/s`, color: S.coolantBlue },
          { label: 'DECAY HEAT', val: isScram ? 'RISING' : 'STABLE', color: isScram ? S.dangerRed : S.radioGreen },
          { label: 'ROD AVERAGE', val: `${(rodPositions.reduce((a, b) => a + b, 0) / 4 * 100).toFixed(1)}%`, color: S.radioGreen },
          { label: 'TRIPS TODAY', val: isScram ? '1' : '0', color: isScram ? S.dangerRed : S.clinicalWhite },
        ].map((pv, i) => (
          <g key={`pv-${i}`}>
            <text x="1280" y={870 + i * 46} fill={S.labelDim} fontSize="8" fontFamily="monospace">{pv.label}</text>
            <text x="1280" y={890 + i * 46} fill={pv.color} fontSize="18" fontFamily="monospace" filter="url(#nuc-crt)">{pv.val}</text>
          </g>
        ))}

        {/* ─── Radiation level strip indicator ─────────────────────────── */}
        <rect x="700" y="1040" width="540" height="30" rx="3" fill={S.panelDark} stroke={S.panelBorder} strokeWidth="1" />
        <text x="710" y="1058" fill={S.labelDim} fontSize="7" fontFamily="monospace">RAD LEVEL</text>
        {Array.from({ length: 20 }, (_, i) => {
          const barColor = i < 12 ? S.radioGreenDim : i < 16 ? S.warningAmber : S.dangerRed;
          const radLevel = isScram ? 18 : 8 + Math.sin(t * 2 + i * 0.3) * 2;
          const active = i < radLevel;
          return (
            <rect key={`rad-bar-${i}`} x={790 + i * 22} y="1046" width="18" height="16" rx="1"
              fill={active ? barColor : S.instrumentFace} opacity={active ? 0.9 : 0.3} />
          );
        })}
        <text x="1230" y="1058" fill={isScram ? S.dangerRed : S.radioGreen} fontSize="8" fontFamily="monospace" fontWeight="bold">
          {isScram ? 'ELEVATED' : 'NORMAL'}
        </text>

        {/* ─── Panel mounting bolts (industrial detail) ────────────────── */}
        {[
          [20, 20], [1900, 20], [20, 580], [1900, 580],
          [20, 600], [1900, 600], [20, 1070], [1900, 1070],
        ].map(([bx, by], i) => (
          <g key={`bolt-${i}`}>
            <circle cx={bx} cy={by} r="5" fill={S.panelGray} stroke={S.panelBorder} strokeWidth="0.5" />
            <line x1={bx - 3} y1={by} x2={bx + 3} y2={by} stroke={S.labelDim} strokeWidth="0.5" />
            <line x1={bx} y1={by - 3} x2={bx} y2={by + 3} stroke={S.labelDim} strokeWidth="0.5" />
          </g>
        ))}

        {/* ─── Geiger counter visual (random dots) ────────────────────── */}
        {geigerDots.map((dot, i) => {
          const visible = Math.abs(frame - dot.frame) < 2;
          return visible ? <circle key={`g-${i}`} cx={dot.x} cy={dot.y} r="0.8" fill={S.radioGreen} opacity="0.3" /> : null;
        })}

        {/* ─── Dust motes floating in harsh light ─────────────────────── */}
        {dustMotes.map((m, i) => {
          const mx = (m.x + m.vx * frame) % 1920;
          const my = ((m.y + m.vy * frame) % 1080 + 1080) % 1080;
          return <circle key={`dust-${i}`} cx={mx} cy={my} r={m.size} fill={S.clinicalWhite} opacity={m.opacity} />;
        })}

        {/* ─── SCRAM strobe overlay ───────────────────────────────────── */}
        {scramFlash > 0 && (
          <rect width="1920" height="1080" fill={S.scramFlash} opacity={scramFlash} />
        )}

        {/* ─── CRT scanlines ──────────────────────────────────────────── */}
        {Array.from({ length: 270 }, (_, i) => (
          <line key={`scan-${i}`} x1="0" y1={i * 4} x2="1920" y2={i * 4} stroke="rgba(0,0,0,0.06)" strokeWidth="1" />
        ))}

        {/* ─── Vignette (heavy, bunker feel) ──────────────────────────── */}
        <rect width="1920" height="1080" fill="url(#nuc-vignette)" />
      </svg>
    </AbsoluteFill>
  );
};

export default NuclearSCADA;
