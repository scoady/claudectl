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

// ── LCARS + tactical palette ─────────────────────────────────────────────────

const C = {
  bg: '#060812',
  panelBg: '#0c0c1a',
  panelBorder: '#1a1a3e',
  lcarsOrange: '#ff9933',
  lcarsBlue: '#6688ff',
  lcarsPurple: '#cc99ff',
  tacticalRed: '#ff3344',
  shieldBlue: '#44aaff',
  hullAmber: '#ffcc44',
  textPrimary: '#e0e8ff',
  textSecondary: '#8899bb',
  textMuted: '#3a4466',
  gridLine: '#141430',
  sensorGreen: '#00ff88',
  warpBlue: '#3366ff',
};

const MONO = "'SF Mono', 'JetBrains Mono', monospace";
const SANS = "'Inter', 'Helvetica Neue', sans-serif";

// ── Helpers ──────────────────────────────────────────────────────────────────

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function pulseVal(frame: number, period: number, min: number, max: number): number {
  return min + (max - min) * (0.5 + 0.5 * Math.sin((frame / period) * Math.PI * 2));
}

// ── LCARS button data ────────────────────────────────────────────────────────

interface LCARSButton { label: string; section: string; color: string; status: string }
const lcarsButtons: LCARSButton[] = [
  { label: 'COMMAND', section: 'cmd', color: C.lcarsOrange, status: 'ONLINE' },
  { label: 'BROKER', section: 'cmd', color: C.lcarsOrange, status: 'ACTIVE' },
  { label: 'HUB', section: 'ops', color: C.hullAmber, status: 'NOMINAL' },
  { label: 'API GATEWAY', section: 'ops', color: C.hullAmber, status: 'ONLINE' },
  { label: 'SENSORS', section: 'sci', color: C.lcarsBlue, status: 'SCANNING' },
  { label: 'COMMS ARRAY', section: 'sci', color: C.lcarsBlue, status: 'OPEN' },
  { label: 'TELEMETRY', section: 'sci', color: C.lcarsPurple, status: 'STREAMING' },
];

// ── Tactical contacts ────────────────────────────────────────────────────────

interface TacContact {
  id: string; label: string; angle0: number; dist: number;
  speed: number; friendly: boolean;
}
const tacContacts: TacContact[] = [
  { id: 'A1', label: 'Agent-Alpha', angle0: 30, dist: 0.35, speed: 0.3, friendly: true },
  { id: 'A2', label: 'Agent-Beta', angle0: 110, dist: 0.55, speed: -0.2, friendly: true },
  { id: 'A3', label: 'Agent-Gamma', angle0: 200, dist: 0.45, speed: 0.15, friendly: true },
  { id: 'A4', label: 'Agent-Delta', angle0: 280, dist: 0.65, speed: -0.25, friendly: true },
  { id: 'U1', label: 'Unknown', angle0: 160, dist: 0.78, speed: 0.1, friendly: false },
];

// ── Power systems ────────────────────────────────────────────────────────────

interface PowerSystem { label: string; color: string; baseLevel: number }
const powerSystems: PowerSystem[] = [
  { label: 'REACTOR', color: C.warpBlue, baseLevel: 0.95 },
  { label: 'SHIELDS', color: C.shieldBlue, baseLevel: 0.80 },
  { label: 'WEAPONS', color: C.tacticalRed, baseLevel: 0.45 },
  { label: 'SENSORS', color: C.sensorGreen, baseLevel: 0.70 },
  { label: 'LIFE SUP', color: colors.green, baseLevel: 0.92 },
];

// ── Component ────────────────────────────────────────────────────────────────

export const StarshipBridge: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // ── Alert state: Yellow 80-200, then green ─────────────────────────────
  const isYellowAlert = frame >= 80 && frame < 200;
  const alertFade = isYellowAlert
    ? interpolate(frame, [80, 95, 185, 200], [0, 1, 1, 0], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        easing: Easing.inOut(Easing.ease),
      })
    : 0;

  // Shield impact at frame 160
  const isImpact = frame >= 160 && frame < 175;
  const impactFlash = isImpact
    ? interpolate(frame, [160, 162, 175], [0.4, 0.2, 0], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })
    : 0;
  const impactShake = isImpact ? Math.sin(frame * 3) * 3 * clamp01(1 - (frame - 160) / 12) : 0;

  // Camera drift
  const driftX = Math.sin(frame / 90 * Math.PI) * 1.2 + impactShake;
  const driftY = Math.cos(frame / 120 * Math.PI) * 0.8;

  // Panel entrance
  const panelEnter = spring({ frame, fps, config: { damping: 14, stiffness: 50 } });

  // Stardate
  const stardate = (47988.1 + frame * 0.01).toFixed(1);

  // ── Layout ─────────────────────────────────────────────────────────────
  const topH = height * 0.18;
  const bottomH = 50;
  const midH = height - topH - bottomH;
  const leftW = width * 0.22;
  const rightW = width * 0.22;
  const centerW = width - leftW - rightW;

  // Tactical display dimensions
  const tacCx = leftW + centerW / 2;
  const tacCy = topH + midH / 2;
  const tacR = Math.min(centerW, midH) * 0.42;

  // ── Star field ─────────────────────────────────────────────────────────
  const starLayers = useMemo(() => {
    const rng = seededRandom(7);
    const layers: Array<Array<{ x: number; y: number; size: number; brightness: number }>> = [[], [], []];
    for (let i = 0; i < 120; i++) {
      layers[0].push({ x: rng() * 1920, y: rng() * topH, size: rng() * 0.8 + 0.3, brightness: rng() * 0.3 + 0.1 });
    }
    for (let i = 0; i < 50; i++) {
      layers[1].push({ x: rng() * 1920, y: rng() * topH, size: rng() * 1.2 + 0.5, brightness: rng() * 0.4 + 0.2 });
    }
    for (let i = 0; i < 15; i++) {
      layers[2].push({ x: rng() * 1920, y: rng() * topH, size: rng() * 1.8 + 0.8, brightness: rng() * 0.5 + 0.3 });
    }
    return layers;
  }, [topH]);

  // Shooting star
  const shootingStarPhase = (frame % 180) / 180;
  const showShootingStar = frame > 30 && frame % 180 < 12;

  // ── LCARS scan highlight position ──────────────────────────────────────
  const lcarsScanY = (frame * 2.5) % (midH + 40) - 20;

  // Warp core pulse
  const warpPulse = pulseVal(frame, 20, 0.4, 1.0);
  const warpCorePeak = warpPulse > 0.85;

  // Alert status text
  const alertStatus = isYellowAlert ? 'YELLOW' : 'GREEN';
  const alertColor = isYellowAlert ? C.hullAmber : C.sensorGreen;

  // Structural integrity
  const hullIntegrity = isImpact
    ? interpolate(frame, [160, 165, 175, 200], [98, 87, 87, 95], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })
    : interpolate(frame, [0, 300], [98, 97], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{
      backgroundColor: C.bg, fontFamily: MONO,
      transform: `translate(${driftX}px, ${driftY}px)`,
    }}>

      {/* ═══════════════════════════════════════════════════════════════════
          YELLOW ALERT COLOR WASH
          ═══════════════════════════════════════════════════════════════════ */}
      {alertFade > 0 && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 55, pointerEvents: 'none',
          background: `rgba(${hexToRgb(C.hullAmber)}, ${alertFade * 0.04 * (0.6 + 0.4 * Math.sin(frame * 0.4))})`,
        }} />
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          SHIELD IMPACT FLASH
          ═══════════════════════════════════════════════════════════════════ */}
      {impactFlash > 0 && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 58, pointerEvents: 'none',
          background: `rgba(${hexToRgb(C.shieldBlue)}, ${impactFlash})`,
        }} />
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TOP — MAIN VIEWSCREEN (18%)
          ═══════════════════════════════════════════════════════════════════ */}
      <div style={{
        position: 'absolute', left: 0, top: 0, width, height: topH,
        background: `linear-gradient(180deg, #0a0c18 0%, ${C.bg} 100%)`,
        borderBottom: `1px solid ${C.panelBorder}`,
        overflow: 'hidden',
        opacity: panelEnter,
      }}>
        {/* Star field */}
        <svg width={width} height={topH} style={{ position: 'absolute', left: 0, top: 0 }}>
          {starLayers.map((layer, li) => {
            const parallax = (li + 1) * 0.15;
            const offsetX = frame * parallax;
            return layer.map((s, si) => {
              const sx = ((s.x - offsetX) % width + width) % width;
              const twinkle = 0.6 + 0.4 * Math.sin(frame * 0.05 + si * 1.7);
              return (
                <circle key={`s${li}-${si}`} cx={sx} cy={s.y}
                  r={s.size} fill="#FFFFFF" opacity={s.brightness * twinkle} />
              );
            });
          })}

          {/* Shooting star */}
          {showShootingStar && (
            <line
              x1={300 + shootingStarPhase * 400} y1={20 + shootingStarPhase * 60}
              x2={300 + shootingStarPhase * 400 + 40} y2={20 + shootingStarPhase * 60 - 5}
              stroke="#FFFFFF" strokeWidth={1.5} opacity={1 - shootingStarPhase}
            />
          )}
        </svg>

        {/* LCARS frame top header */}
        <div style={{
          position: 'absolute', left: 0, top: 0, width, height: topH,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '8px 0',
        }}>
          {/* LCARS rounded header bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 120, height: 24, borderRadius: '12px 0 0 12px',
              background: C.lcarsOrange,
            }} />
            <div style={{
              color: C.textPrimary, fontSize: 22, fontFamily: SANS, fontWeight: 700,
              letterSpacing: 4, textShadow: `0 0 10px rgba(${hexToRgb(C.lcarsOrange)}, 0.3)`,
            }}>
              c9-OPERATOR
            </div>
            <div style={{
              color: C.textSecondary, fontSize: 14, fontFamily: SANS, fontWeight: 400,
              letterSpacing: 2,
            }}>
              BRIDGE TACTICAL DISPLAY
            </div>
            <div style={{
              width: 120, height: 24, borderRadius: '0 12px 12px 0',
              background: C.lcarsBlue,
            }} />
          </div>

          {/* Stardate */}
          <div style={{
            color: C.lcarsOrange, fontSize: 12, marginTop: 6, letterSpacing: 2,
          }}>
            STARDATE {stardate}
          </div>

          {/* Ship status badges */}
          <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
            {['WARP 6.2', `HEADING 142 MK 7`, `ALERT: ${alertStatus}`].map((badge) => (
              <div key={badge} style={{
                padding: '2px 10px', borderRadius: 8,
                border: `1px solid ${badge.includes('ALERT') ? alertColor : C.panelBorder}`,
                color: badge.includes('ALERT') ? alertColor : C.textSecondary,
                fontSize: 9, letterSpacing: 1,
              }}>
                {badge}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          LEFT — LCARS CONTROL PANEL (22%)
          ═══════════════════════════════════════════════════════════════════ */}
      <div style={{
        position: 'absolute', left: 0, top: topH, width: leftW, height: midH,
        opacity: panelEnter, transform: `translateX(${(1 - panelEnter) * -20}px)`,
        overflow: 'hidden',
      }}>
        <svg width={leftW} height={midH} style={{ position: 'absolute', left: 0, top: 0 }}>
          {/* LCARS left spine — curved connector */}
          <path
            d={`M 12 0 L 12 ${midH}`}
            stroke={C.lcarsOrange} strokeWidth={8} fill="none" opacity={0.6}
          />
          <rect x={4} y={0} width={16} height={30} rx={8}
            fill={C.lcarsOrange} />
          <rect x={4} y={midH - 30} width={16} height={30} rx={8}
            fill={C.lcarsBlue} />

          {/* Scan highlight traveling down */}
          <rect x={0} y={lcarsScanY} width={leftW} height={3}
            fill={C.lcarsOrange} opacity={0.08} />
        </svg>

        {/* LCARS buttons */}
        <div style={{
          position: 'absolute', left: 28, top: 8, width: leftW - 36,
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          {lcarsButtons.map((btn, i) => {
            const sectionBreak = i > 0 && btn.section !== lcarsButtons[i - 1].section;
            return (
              <React.Fragment key={btn.label}>
                {sectionBreak && (
                  <div style={{
                    height: 4, borderRadius: 2,
                    background: `linear-gradient(90deg, ${btn.color}40, transparent)`,
                    marginTop: 2,
                  }} />
                )}
                <div style={{
                  display: 'flex', alignItems: 'center',
                  background: `rgba(${hexToRgb(btn.color)}, 0.08)`,
                  borderLeft: `3px solid ${btn.color}`,
                  borderRadius: '0 6px 6px 0',
                  padding: '6px 10px',
                  position: 'relative', overflow: 'hidden',
                }}>
                  {/* Scan-line highlight sweep */}
                  <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: 60,
                    background: `linear-gradient(90deg, transparent, rgba(${hexToRgb(btn.color)}, 0.12), transparent)`,
                    transform: `translateX(${((frame * 1.5 + i * 40) % (leftW + 60)) - 30}px)`,
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ color: btn.color, fontSize: 10, fontWeight: 600, letterSpacing: 1 }}>
                      {btn.label}
                    </div>
                  </div>
                  <div style={{
                    color: btn.status === 'SCANNING'
                      ? (frame % 30 < 15 ? C.sensorGreen : C.textMuted)
                      : C.sensorGreen,
                    fontSize: 8, letterSpacing: 1,
                  }}>
                    {btn.status}
                  </div>
                </div>
              </React.Fragment>
            );
          })}

          {/* LCARS curved connecting bars */}
          <svg width={leftW - 36} height={60} style={{ marginTop: 8 }}>
            <path d={`M 0 0 Q 0 30 ${(leftW - 36) / 2} 30 Q ${leftW - 36} 30 ${leftW - 36} 60`}
              stroke={C.lcarsPurple} strokeWidth={4} fill="none" opacity={0.4} />
            {/* Traveling light */}
            <circle
              cx={interpolate(frame % 60, [0, 60], [0, leftW - 36], {
                extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
              })}
              cy={30}
              r={3} fill={C.lcarsPurple} opacity={0.6}
            />
          </svg>

          {/* Section labels */}
          <div style={{
            display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4,
          }}>
            {[
              { label: 'CMD', color: C.lcarsOrange },
              { label: 'OPS', color: C.hullAmber },
              { label: 'SCI', color: C.lcarsBlue },
            ].map((s) => (
              <div key={s.label} style={{
                padding: '3px 12px', borderRadius: 10,
                background: s.color, color: '#000', fontSize: 9,
                fontWeight: 700, letterSpacing: 1,
              }}>
                {s.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          CENTER — TACTICAL DISPLAY (56%)
          ═══════════════════════════════════════════════════════════════════ */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{
          position: 'absolute', left: 0, top: 0, width, height,
          pointerEvents: 'none',
          opacity: panelEnter,
        }}
      >
        <defs>
          <radialGradient id="tacBg" cx="50%" cy="50%">
            <stop offset="0%" stopColor={C.panelBg} stopOpacity={0.4} />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" />
          </filter>
          <filter id="softGlow">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>

        {/* Tactical background */}
        <circle cx={tacCx} cy={tacCy} r={tacR + 20} fill="url(#tacBg)" />

        {/* Range rings */}
        {[0.25, 0.5, 0.75, 1.0].map((r) => (
          <circle key={r} cx={tacCx} cy={tacCy} r={tacR * r}
            fill="none" stroke={C.gridLine} strokeWidth={0.5}
            strokeDasharray={r < 1 ? '4 4' : 'none'} />
        ))}

        {/* Bearing lines (every 30 degrees) */}
        {Array.from({ length: 12 }, (_, i) => {
          const angle = (i * 30 * Math.PI) / 180;
          return (
            <line key={`b${i}`}
              x1={tacCx} y1={tacCy}
              x2={tacCx + Math.cos(angle) * tacR}
              y2={tacCy + Math.sin(angle) * tacR}
              stroke={C.gridLine} strokeWidth={0.3}
            />
          );
        })}

        {/* Bearing labels */}
        {[0, 90, 180, 270].map((deg) => {
          const angle = ((deg - 90) * Math.PI) / 180;
          return (
            <text key={`bl${deg}`}
              x={tacCx + Math.cos(angle) * (tacR + 14)}
              y={tacCy + Math.sin(angle) * (tacR + 14)}
              fill={C.textMuted} fontSize={8} textAnchor="middle" dominantBaseline="middle"
            >
              {`${deg}`}
            </text>
          );
        })}

        {/* Quadrant labels */}
        {['ALPHA', 'BETA', 'GAMMA', 'DELTA'].map((q, i) => {
          const qAngle = ((i * 90 + 45 - 90) * Math.PI) / 180;
          return (
            <text key={q}
              x={tacCx + Math.cos(qAngle) * tacR * 0.85}
              y={tacCy + Math.sin(qAngle) * tacR * 0.85}
              fill={C.textMuted} fontSize={7} textAnchor="middle" dominantBaseline="middle"
              opacity={0.5}
            >
              SEC-{q}
            </text>
          );
        })}

        {/* Shield arcs (4 quadrants) */}
        {[0, 90, 180, 270].map((startDeg, i) => {
          const shieldLabels = ['FORE', 'STBD', 'AFT', 'PORT'];
          const shieldHealth = isImpact && i === 0
            ? interpolate(frame, [160, 165, 175], [1, 0.4, 0.7], {
                extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
              })
            : 0.85 + Math.sin(frame * 0.02 + i) * 0.05;
          const shieldR = tacR * 0.18;
          const midAngle = ((startDeg + 45 - 90) * Math.PI) / 180;
          const startAngle = ((startDeg - 90) * Math.PI) / 180;
          const endAngle = ((startDeg + 80 - 90) * Math.PI) / 180;
          const arcR = shieldR + 6;
          const x1 = tacCx + Math.cos(startAngle) * arcR;
          const y1 = tacCy + Math.sin(startAngle) * arcR;
          const x2 = tacCx + Math.cos(endAngle) * arcR;
          const y2 = tacCy + Math.sin(endAngle) * arcR;
          const isHitArc = isImpact && i === 0;

          return (
            <g key={`shield-${i}`}>
              <path
                d={`M ${x1} ${y1} A ${arcR} ${arcR} 0 0 1 ${x2} ${y2}`}
                fill="none"
                stroke={isHitArc ? C.tacticalRed : C.shieldBlue}
                strokeWidth={3}
                opacity={shieldHealth * (isHitArc ? (0.5 + 0.5 * Math.sin(frame * 2)) : 0.7)}
                filter={isHitArc ? 'url(#glow)' : undefined}
              />
              <text
                x={tacCx + Math.cos(midAngle) * (arcR + 12)}
                y={tacCy + Math.sin(midAngle) * (arcR + 12)}
                fill={C.textMuted} fontSize={6} textAnchor="middle"
                dominantBaseline="middle"
              >
                {shieldLabels[i]} {Math.round(shieldHealth * 100)}%
              </text>
            </g>
          );
        })}

        {/* Own ship icon at center */}
        <polygon
          points={`${tacCx},${tacCy - 12} ${tacCx - 8},${tacCy + 8} ${tacCx},${tacCy + 4} ${tacCx + 8},${tacCy + 8}`}
          fill={C.lcarsOrange} opacity={0.8}
          filter="url(#glow)"
        />
        <circle cx={tacCx} cy={tacCy} r={3} fill={C.lcarsOrange} opacity={pulseVal(frame, 15, 0.4, 1)} />

        {/* Sweep line (radar) */}
        {(() => {
          const sweepAngle = ((frame * 1.5) % 360) * Math.PI / 180;
          return (
            <line
              x1={tacCx} y1={tacCy}
              x2={tacCx + Math.cos(sweepAngle) * tacR}
              y2={tacCy + Math.sin(sweepAngle) * tacR}
              stroke={C.sensorGreen} strokeWidth={1} opacity={0.25}
            />
          );
        })()}

        {/* Tactical contacts */}
        {tacContacts.map((contact) => {
          const angle = ((contact.angle0 + frame * contact.speed) % 360) * Math.PI / 180;
          const cx = tacCx + Math.cos(angle) * tacR * contact.dist;
          const cy = tacCy + Math.sin(angle) * tacR * contact.dist;
          const markerColor = contact.friendly ? C.lcarsBlue : C.tacticalRed;
          const blink = contact.friendly ? 1 : 0.5 + 0.5 * Math.sin(frame * 0.4);

          return (
            <g key={contact.id}>
              {/* Chevron marker */}
              <polygon
                points={`${cx},${cy - 5} ${cx - 4},${cy + 3} ${cx + 4},${cy + 3}`}
                fill={markerColor} opacity={blink}
              />
              {/* Label */}
              <text x={cx + 7} y={cy} fill={markerColor} fontSize={7}
                dominantBaseline="middle" opacity={0.8}>
                {contact.id}
              </text>
              {/* Detection ring */}
              <circle cx={cx} cy={cy} r={8} fill="none"
                stroke={markerColor} strokeWidth={0.5} opacity={0.3}
                strokeDasharray="2 2" />
            </g>
          );
        })}
      </svg>

      {/* ═══════════════════════════════════════════════════════════════════
          RIGHT — SYSTEMS STATUS PANEL (22%)
          ═══════════════════════════════════════════════════════════════════ */}
      <div style={{
        position: 'absolute', right: 0, top: topH, width: rightW, height: midH,
        opacity: panelEnter, transform: `translateX(${(1 - panelEnter) * 20}px)`,
        display: 'flex', flexDirection: 'column', padding: 8, gap: 6,
      }}>
        {/* Ship cutaway / systems */}
        <div style={{
          background: C.panelBg, border: `1px solid ${C.panelBorder}`,
          borderRadius: 2, padding: '8px 10px',
        }}>
          <div style={{ color: C.textSecondary, fontSize: 9, letterSpacing: 2 }}>
            STRUCTURAL INTEGRITY
          </div>
          <div style={{
            color: hullIntegrity < 90 ? C.tacticalRed : C.shieldBlue,
            fontSize: 28, fontWeight: 700, marginTop: 2,
            textShadow: hullIntegrity < 90 ? `0 0 8px ${C.tacticalRed}` : 'none',
          }}>
            {Math.round(hullIntegrity)}%
          </div>
        </div>

        {/* Power distribution */}
        <div style={{
          background: C.panelBg, border: `1px solid ${C.panelBorder}`,
          borderRadius: 2, padding: '8px 10px', flex: 1,
        }}>
          <div style={{ color: C.textSecondary, fontSize: 9, letterSpacing: 2, marginBottom: 8 }}>
            POWER DISTRIBUTION
          </div>
          {powerSystems.map((sys) => {
            const level = sys.baseLevel + Math.sin(frame * 0.04 + powerSystems.indexOf(sys)) * 0.05;
            const barW = (rightW - 40) * 0.6;
            return (
              <div key={sys.label} style={{ marginBottom: 8 }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', marginBottom: 2,
                }}>
                  <span style={{ color: sys.color, fontSize: 9, fontWeight: 600 }}>{sys.label}</span>
                  <span style={{ color: C.textMuted, fontSize: 9 }}>{Math.round(level * 100)}%</span>
                </div>
                <div style={{
                  width: barW, height: 6, background: `rgba(${hexToRgb(sys.color)}, 0.1)`,
                  borderRadius: 3, overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${level * 100}%`, height: '100%',
                    background: `linear-gradient(90deg, rgba(${hexToRgb(sys.color)}, 0.4), ${sys.color})`,
                    borderRadius: 3,
                    boxShadow: `0 0 4px rgba(${hexToRgb(sys.color)}, 0.3)`,
                  }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Warp core */}
        <div style={{
          background: C.panelBg, border: `1px solid ${C.panelBorder}`,
          borderRadius: 2, padding: '8px 10px', textAlign: 'center',
        }}>
          <div style={{ color: C.textSecondary, fontSize: 9, letterSpacing: 2 }}>
            WARP CORE
          </div>
          <div style={{
            width: 40, height: 40, borderRadius: '50%', margin: '8px auto',
            background: `radial-gradient(circle, rgba(${hexToRgb(C.warpBlue)}, ${warpPulse * 0.6}), rgba(${hexToRgb(C.warpBlue)}, 0.05))`,
            border: `2px solid rgba(${hexToRgb(C.warpBlue)}, ${warpPulse * 0.8})`,
            boxShadow: warpCorePeak
              ? `0 0 16px rgba(${hexToRgb(C.warpBlue)}, 0.5), 0 0 32px rgba(${hexToRgb(C.warpBlue)}, 0.2)`
              : `0 0 8px rgba(${hexToRgb(C.warpBlue)}, 0.2)`,
          }} />
          <div style={{ color: C.warpBlue, fontSize: 10 }}>
            {warpCorePeak ? 'PEAK OUTPUT' : 'NOMINAL'}
          </div>
        </div>

        {/* Alert status */}
        <div style={{
          background: isYellowAlert
            ? `rgba(${hexToRgb(C.hullAmber)}, 0.08)`
            : C.panelBg,
          border: `1px solid ${isYellowAlert ? C.hullAmber : C.panelBorder}`,
          borderRadius: 2, padding: '8px 10px', textAlign: 'center',
        }}>
          <div style={{ color: C.textSecondary, fontSize: 9, letterSpacing: 2 }}>
            ALERT STATUS
          </div>
          <div style={{
            color: alertColor, fontSize: 20, fontWeight: 700, marginTop: 4,
            textShadow: isYellowAlert ? `0 0 8px ${C.hullAmber}` : 'none',
            opacity: isYellowAlert ? (0.6 + 0.4 * Math.sin(frame * 0.5)) : 1,
          }}>
            {alertStatus}
          </div>
        </div>

        {/* Life support */}
        <div style={{
          background: C.panelBg, border: `1px solid ${C.panelBorder}`,
          borderRadius: 2, padding: '6px 10px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ color: C.textSecondary, fontSize: 9 }}>LIFE SUPPORT</span>
          <span style={{ color: C.sensorGreen, fontSize: 10, fontWeight: 600 }}>NOMINAL</span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          BOTTOM — OPERATIONS BAR
          ═══════════════════════════════════════════════════════════════════ */}
      <div style={{
        position: 'absolute', left: 0, bottom: 0, width, height: bottomH,
        borderTop: `1px solid ${isYellowAlert ? C.hullAmber : C.panelBorder}`,
        background: C.panelBg,
        display: 'flex', alignItems: 'center', padding: '0 16px',
        gap: 24,
        opacity: panelEnter,
      }}>
        {/* Alert strip */}
        <div style={{
          width: 10, height: bottomH - 2,
          background: isYellowAlert
            ? `linear-gradient(180deg, ${C.hullAmber}, transparent, ${C.hullAmber})`
            : C.sensorGreen,
          opacity: isYellowAlert ? (0.5 + 0.5 * Math.sin(frame * 0.6)) : 0.3,
        }} />

        {/* Status items */}
        {[
          { label: 'COMMS', value: 'OPEN', color: C.sensorGreen },
          { label: 'HEADING', value: '142 MK 7', color: C.lcarsOrange },
          { label: 'SPEED', value: 'WARP 6.2', color: C.lcarsBlue },
          { label: 'ENG PWR', value: '94%', color: C.warpBlue },
          { label: 'SHIELDS', value: isImpact ? 'IMPACT' : 'HOLDING', color: isImpact ? C.tacticalRed : C.shieldBlue },
        ].map((item) => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: C.textMuted, fontSize: 9, letterSpacing: 1 }}>{item.label}</span>
            <span style={{ color: item.color, fontSize: 11, fontWeight: 600 }}>{item.value}</span>
          </div>
        ))}

        {/* Right side: stardate */}
        <div style={{ marginLeft: 'auto', color: C.lcarsOrange, fontSize: 10, letterSpacing: 2 }}>
          SD {stardate}
        </div>
      </div>

      {/* ── Ambient panel glow ──────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 40,
        background: `radial-gradient(ellipse at 12% 50%, rgba(${hexToRgb(C.lcarsOrange)}, 0.02) 0%, transparent 40%),
                     radial-gradient(ellipse at 88% 50%, rgba(${hexToRgb(C.lcarsBlue)}, 0.02) 0%, transparent 40%)`,
      }} />

      {/* ── Lens flare from LCARS ───────────────────────────────────────── */}
      <div style={{
        position: 'absolute', left: 60, top: topH + 20, width: 30, height: 30,
        borderRadius: '50%',
        background: `radial-gradient(circle, rgba(${hexToRgb(C.lcarsOrange)}, ${pulseVal(frame, 40, 0.02, 0.06)}), transparent)`,
        pointerEvents: 'none', zIndex: 42,
      }} />

    </AbsoluteFill>
  );
};

export default StarshipBridge;
