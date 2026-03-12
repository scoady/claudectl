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

// ── Submarine color palette ──────────────────────────────────────────────────

const C = {
  bg: '#0a1628',
  panelDark: '#0d1a30',
  panelBorder: '#1a3050',
  sonarGreen: '#00ff88',
  sonarGreenDim: '#007744',
  sonarGreenGhost: '#003322',
  sonarTrail: '#005533',
  tacticalAmber: '#ffcc44',
  hostileRed: '#ff4444',
  hostileRedDim: '#992222',
  instrumentBlue: '#3388cc',
  instrumentBlueDim: '#1a4466',
  compassGold: '#cc9944',
  textPrimary: '#00ff88',
  textDim: '#006644',
  textLabel: '#88bbaa',
  rangeRing: 'rgba(0,255,136,0.12)',
  waterParticle: 'rgba(100,180,255,0.08)',
};

// ── Contact definitions ──────────────────────────────────────────────────────

interface Contact {
  desig: string;
  type: 'agent' | 'project' | 'operator';
  brg: number;
  rng: number;
  crs: number;
  spd: number;
  appearFrame: number;
}

const CONTACTS: Contact[] = [
  { desig: 'SIERRA-1', type: 'agent', brg: 45, rng: 12, crs: 180, spd: 8, appearFrame: 0 },
  { desig: 'SIERRA-2', type: 'agent', brg: 155, rng: 28, crs: 270, spd: 5, appearFrame: 0 },
  { desig: 'MASTER-1', type: 'operator', brg: 0, rng: 0, crs: 35, spd: 12, appearFrame: 0 },
  { desig: 'TANGO-1', type: 'project', brg: 280, rng: 35, crs: 90, spd: 3, appearFrame: 0 },
  { desig: 'SIERRA-3', type: 'agent', brg: 95, rng: 18, crs: 315, spd: 6, appearFrame: 60 },
  { desig: 'TANGO-2', type: 'project', brg: 210, rng: 42, crs: 45, spd: 4, appearFrame: 150 },
  { desig: 'SIERRA-4', type: 'agent', brg: 320, rng: 22, crs: 120, spd: 7, appearFrame: 220 },
];

// ── Waterfall constants ──────────────────────────────────────────────────────

const WATERFALL_COLS = 40;
const WATERFALL_ROWS = 24;

// ── Composition ──────────────────────────────────────────────────────────────

export const SubmarineCIC: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  // ── Seeded particle data ───────────────────────────────────────────────────
  const underwaterParticles = useMemo(() => {
    const rng = seededRandom(77);
    return Array.from({ length: 60 }, () => ({
      x: rng() * 1920, y: rng() * 1080,
      vx: (rng() - 0.5) * 0.15, vy: (rng() - 0.5) * 0.1,
      size: 0.5 + rng() * 2, opacity: 0.03 + rng() * 0.06,
    }));
  }, []);

  const condensation = useMemo(() => {
    const rng = seededRandom(123);
    return Array.from({ length: 20 }, () => ({
      x: rng() < 0.5 ? rng() * 30 : 1890 + rng() * 30,
      y: 200 + rng() * 680,
      r: 1 + rng() * 3,
      opacity: 0.02 + rng() * 0.05,
    }));
  }, []);

  const waterfallData = useMemo(() => {
    const rng = seededRandom(55);
    return Array.from({ length: WATERFALL_ROWS }, () =>
      Array.from({ length: WATERFALL_COLS }, () => rng() * 0.3)
    );
  }, []);

  // ── Sonar sweep (full 360 over 300 frames) ────────────────────────────────
  const sweepAngle = (frame / 300) * 360;
  const sweepRad = (sweepAngle - 90) * Math.PI / 180;

  // ── Submarine vibration (engine rumble) ────────────────────────────────────
  const jitterX = Math.sin(frame * 1.7) * 0.4;
  const jitterY = Math.cos(frame * 2.3) * 0.3;

  // ── Heading drift (submarine turning) ──────────────────────────────────────
  const heading = 35 + Math.sin(t * 0.2) * 8;

  // ── Depth fluctuation ──────────────────────────────────────────────────────
  const depth = 240 + Math.sin(t * 0.15) * 5;

  // ── New contact ping event at frame 180 ────────────────────────────────────
  const pingFrame = 180;
  const pingActive = frame >= pingFrame && frame <= pingFrame + 40;
  const pingRadius = pingActive ? interpolate(frame, [pingFrame, pingFrame + 40], [0, 300], { extrapolateRight: 'clamp' }) : 0;
  const pingOpacity = pingActive ? interpolate(frame, [pingFrame, pingFrame + 40], [0.6, 0], { extrapolateRight: 'clamp' }) : 0;

  // ── Easing-driven fade-in ──────────────────────────────────────────────────
  const introOpacity = interpolate(frame, [0, 25], [0, 1], {
    extrapolateRight: 'clamp', easing: Easing.out(Easing.quad),
  });

  // ── Visible contacts ───────────────────────────────────────────────────────
  const visibleContacts = CONTACTS.filter(c => frame >= c.appearFrame);

  // ── Sonar display center and radius ────────────────────────────────────────
  const sonarCx = 420;
  const sonarCy = 460;
  const sonarR = 360;

  // ── New contact bearing flash ──────────────────────────────────────────────
  const newContactBrg = 320;
  const newContactFlash = frame >= pingFrame && frame <= pingFrame + 20 && frame % 4 < 2;

  // ── Spring for depth gauge ─────────────────────────────────────────────────
  const depthSpring = spring({ frame, fps, config: { damping: 20, stiffness: 30, mass: 1 }, from: 220, to: depth });

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, opacity: introOpacity }}>
      <svg
        viewBox="0 0 1920 1080"
        style={{
          width: '100%', height: '100%',
          transform: `translate(${jitterX}px, ${jitterY}px)`,
        }}
      >
        <defs>
          <radialGradient id="sub-sonar-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={C.sonarGreen} stopOpacity="0.08" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <radialGradient id="sub-vignette">
            <stop offset="30%" stopColor="transparent" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.7)" />
          </radialGradient>
          <filter id="sub-glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="sub-crt">
            <feGaussianBlur stdDeviation="0.4" />
          </filter>
          <clipPath id="sonar-clip">
            <circle cx={sonarCx} cy={sonarCy} r={sonarR} />
          </clipPath>
        </defs>

        {/* Background */}
        <rect width="1920" height="1080" fill={C.bg} />

        {/* ─── PRIMARY SONAR DISPLAY (center-left, 50% width) ─────────── */}
        <rect x="30" y="30" width="800" height="820" rx="8" fill={C.panelDark} stroke={C.panelBorder} strokeWidth="2" />
        <text x={sonarCx} y="58" textAnchor="middle" fill={C.textPrimary} fontSize="11" fontFamily="monospace" letterSpacing="3">
          PRIMARY SONAR DISPLAY
        </text>

        {/* Sonar background glow */}
        <circle cx={sonarCx} cy={sonarCy} r={sonarR} fill="url(#sub-sonar-glow)" />
        <circle cx={sonarCx} cy={sonarCy} r={sonarR} fill="none" stroke={C.sonarGreenDim} strokeWidth="1.5" />

        {/* Range rings (5nm, 10nm, 20nm, 50nm) */}
        {[0.2, 0.4, 0.6, 0.8, 1.0].map((frac, i) => (
          <circle key={`ring-${i}`} cx={sonarCx} cy={sonarCy} r={sonarR * frac}
            fill="none" stroke={C.rangeRing} strokeWidth="0.5" />
        ))}
        {[
          { frac: 0.2, label: '5nm' }, { frac: 0.4, label: '10nm' },
          { frac: 0.6, label: '20nm' }, { frac: 0.8, label: '50nm' },
        ].map((rl, i) => (
          <text key={`rl-${i}`} x={sonarCx + 4} y={sonarCy - sonarR * rl.frac + 10}
            fill={C.textDim} fontSize="7" fontFamily="monospace">{rl.label}</text>
        ))}

        {/* Bearing tick marks every 10 degrees */}
        {Array.from({ length: 36 }, (_, i) => {
          const deg = i * 10;
          const rad = (deg - 90) * Math.PI / 180;
          const isMajor = deg % 90 === 0;
          const inner = sonarR - (isMajor ? 20 : 10);
          return (
            <g key={`tick-${i}`}>
              <line x1={sonarCx + Math.cos(rad) * inner} y1={sonarCy + Math.sin(rad) * inner}
                x2={sonarCx + Math.cos(rad) * sonarR} y2={sonarCy + Math.sin(rad) * sonarR}
                stroke={C.sonarGreenDim} strokeWidth={isMajor ? 1.5 : 0.5} />
              {isMajor && (
                <text x={sonarCx + Math.cos(rad) * (sonarR + 14)} y={sonarCy + Math.sin(rad) * (sonarR + 14) + 3}
                  textAnchor="middle" fill={C.textPrimary} fontSize="8" fontFamily="monospace">
                  {String(deg).padStart(3, '0')}
                </text>
              )}
            </g>
          );
        })}

        {/* Sweep line with afterglow trail */}
        <g clipPath="url(#sonar-clip)">
          {/* Afterglow arc (trailing wedge) */}
          {Array.from({ length: 15 }, (_, i) => {
            const trailAngle = sweepAngle - i * 2;
            const trailRad = (trailAngle - 90) * Math.PI / 180;
            return (
              <line key={`trail-${i}`}
                x1={sonarCx} y1={sonarCy}
                x2={sonarCx + Math.cos(trailRad) * sonarR}
                y2={sonarCy + Math.sin(trailRad) * sonarR}
                stroke={C.sonarGreen} strokeWidth="1" opacity={0.3 - i * 0.02} />
            );
          })}
          {/* Main sweep line */}
          <line x1={sonarCx} y1={sonarCy}
            x2={sonarCx + Math.cos(sweepRad) * sonarR}
            y2={sonarCy + Math.sin(sweepRad) * sonarR}
            stroke={C.sonarGreen} strokeWidth="2" filter="url(#sub-glow)" />
        </g>

        {/* Contact markers with persistence trails */}
        {visibleContacts.map((contact, i) => {
          const age = frame - contact.appearFrame;
          const fadeIn = Math.min(1, age / 10);
          const brgRad = (contact.brg - 90) * Math.PI / 180;
          const dist = (contact.rng / 50) * sonarR;
          const cx = sonarCx + Math.cos(brgRad) * dist;
          const cy = sonarCy + Math.sin(brgRad) * dist;
          const size = 6;
          const contactColor = contact.type === 'operator' ? C.sonarGreen :
            contact.type === 'agent' ? C.tacticalAmber : C.instrumentBlue;

          // Persistence trail (old positions fading)
          const trails = Array.from({ length: 4 }, (_, ti) => {
            const trailAge = ti * 8;
            if (age < trailAge) return null;
            const drift = ti * 2;
            return (
              <circle key={`ct-${i}-${ti}`} cx={cx - drift * Math.cos(brgRad)} cy={cy - drift * Math.sin(brgRad)}
                r="2" fill={contactColor} opacity={0.15 - ti * 0.03} />
            );
          });

          return (
            <g key={`contact-${i}`} opacity={fadeIn}>
              {trails}
              {contact.type === 'agent' && (
                <polygon points={`${cx},${cy - size} ${cx - size},${cy + size} ${cx + size},${cy + size}`}
                  fill="none" stroke={contactColor} strokeWidth="1.5" />
              )}
              {contact.type === 'project' && (
                <rect x={cx - size / 2} y={cy - size / 2} width={size} height={size}
                  fill="none" stroke={contactColor} strokeWidth="1.5" transform={`rotate(45,${cx},${cy})`} />
              )}
              {contact.type === 'operator' && (
                <circle cx={cx} cy={cy} r={size / 2} fill={contactColor} opacity="0.8" />
              )}
              <text x={cx + 10} y={cy - 4} fill={contactColor} fontSize="7" fontFamily="monospace">{contact.desig}</text>
            </g>
          );
        })}

        {/* Sonar ping ripple at frame 180 */}
        {pingActive && (
          <circle cx={sonarCx + Math.cos((newContactBrg - 90) * Math.PI / 180) * sonarR * 0.44}
            cy={sonarCy + Math.sin((newContactBrg - 90) * Math.PI / 180) * sonarR * 0.44}
            r={pingRadius} fill="none" stroke={C.sonarGreen} strokeWidth="2" opacity={pingOpacity} />
        )}

        {/* Bearing/range readout below sonar */}
        <rect x="30" y="860" width="800" height="50" rx="4" fill={C.panelDark} stroke={C.panelBorder} strokeWidth="1" />
        <text x="50" y="890" fill={C.textLabel} fontSize="9" fontFamily="monospace">BRG</text>
        <text x="90" y="890" fill={C.textPrimary} fontSize="12" fontFamily="monospace" filter="url(#sub-crt)">
          {newContactFlash ? `${newContactBrg}\u00b0` : `${visibleContacts[0]?.brg ?? 0}\u00b0`}
        </text>
        <text x="180" y="890" fill={C.textLabel} fontSize="9" fontFamily="monospace">RNG</text>
        <text x="220" y="890" fill={C.textPrimary} fontSize="12" fontFamily="monospace" filter="url(#sub-crt)">
          {`${visibleContacts[0]?.rng ?? 0}nm`}
        </text>
        <text x="340" y="890" fill={C.textLabel} fontSize="9" fontFamily="monospace">CRS</text>
        <text x="380" y="890" fill={C.textPrimary} fontSize="12" fontFamily="monospace">{`${visibleContacts[0]?.crs ?? 0}\u00b0`}</text>
        <text x="470" y="890" fill={C.textLabel} fontSize="9" fontFamily="monospace">SPD</text>
        <text x="510" y="890" fill={C.textPrimary} fontSize="12" fontFamily="monospace">{`${visibleContacts[0]?.spd ?? 0}kts`}</text>

        {/* ─── RIGHT SIDE: CONTACT TABLE ──────────────────────────────── */}
        <rect x="860" y="30" width="1030" height="230" rx="6" fill={C.panelDark} stroke={C.panelBorder} strokeWidth="1.5" />
        <text x="1375" y="55" textAnchor="middle" fill={C.textPrimary} fontSize="10" fontFamily="monospace" letterSpacing="2">CONTACT TABLE</text>
        {['DESIG', 'BRG', 'RNG', 'CRS', 'SPD'].map((hdr, i) => (
          <text key={`hdr-${i}`} x={890 + i * 200} y="78" fill={C.textLabel} fontSize="8" fontFamily="monospace" fontWeight="bold">{hdr}</text>
        ))}
        <line x1="870" y1="84" x2="1870" y2="84" stroke={C.panelBorder} strokeWidth="0.5" />
        {visibleContacts.map((contact, i) => {
          const ry = 100 + i * 24;
          const rowColor = contact.type === 'agent' ? C.tacticalAmber :
            contact.type === 'operator' ? C.sonarGreen : C.instrumentBlue;
          const isNewContact = frame - contact.appearFrame < 30 && frame % 6 < 3;
          return (
            <g key={`row-${i}`} opacity={isNewContact ? 0.5 : 1}>
              <text x="890" y={ry} fill={rowColor} fontSize="9" fontFamily="monospace">{contact.desig}</text>
              <text x="1090" y={ry} fill={C.textPrimary} fontSize="9" fontFamily="monospace">{`${contact.brg}\u00b0`}</text>
              <text x="1290" y={ry} fill={C.textPrimary} fontSize="9" fontFamily="monospace">{`${contact.rng}nm`}</text>
              <text x="1490" y={ry} fill={C.textPrimary} fontSize="9" fontFamily="monospace">{`${contact.crs}\u00b0`}</text>
              <text x="1690" y={ry} fill={C.textPrimary} fontSize="9" fontFamily="monospace">{`${contact.spd}kts`}</text>
            </g>
          );
        })}

        {/* ─── WATERFALL DISPLAY ───────────────────────────────────────── */}
        <rect x="860" y="270" width="500" height="300" rx="6" fill={C.panelDark} stroke={C.panelBorder} strokeWidth="1.5" />
        <text x="1110" y="292" textAnchor="middle" fill={C.textPrimary} fontSize="9" fontFamily="monospace" letterSpacing="2">WATERFALL SPECTROGRAM</text>
        <clipPath id="wf-clip"><rect x="870" y="300" width="480" height="260" /></clipPath>
        <g clipPath="url(#wf-clip)">
          {waterfallData.map((row, ri) => {
            const scrollY = 300 + ((ri * 11 + Math.floor(frame * 0.5)) % (WATERFALL_ROWS * 11));
            return row.map((val, ci) => {
              const intensity = val + Math.sin(t * 2 + ci * 0.3) * 0.1;
              const clamped = Math.max(0, Math.min(1, intensity));
              const green = Math.floor(clamped * 255);
              return (
                <rect key={`wf-${ri}-${ci}`} x={870 + ci * 12} y={scrollY} width="11" height="10"
                  fill={`rgba(0,${green},${Math.floor(green * 0.5)},${0.3 + clamped * 0.7})`} />
              );
            });
          })}
          {/* Spectral lines for agent activity sounds */}
          {[8, 16, 24, 32].map((col, i) => (
            <rect key={`spec-${i}`} x={870 + col * 12} y="300" width="3" height="260"
              fill={C.sonarGreen} opacity={0.1 + Math.sin(t * 3 + i) * 0.05} />
          ))}
        </g>

        {/* ─── DEPTH GAUGE (vertical tape) ────────────────────────────── */}
        <rect x="1380" y="270" width="120" height="300" rx="6" fill={C.panelDark} stroke={C.panelBorder} strokeWidth="1.5" />
        <text x="1440" y="292" textAnchor="middle" fill={C.textPrimary} fontSize="9" fontFamily="monospace" letterSpacing="1">DEPTH</text>
        {Array.from({ length: 11 }, (_, i) => {
          const depthVal = 150 + i * 20;
          const yPos = 310 + i * 24;
          return (
            <g key={`depth-${i}`}>
              <line x1="1400" y1={yPos} x2="1420" y2={yPos} stroke={C.sonarGreenDim} strokeWidth="0.5" />
              <text x="1425" y={yPos + 3} fill={C.textDim} fontSize="7" fontFamily="monospace">{depthVal}m</text>
            </g>
          );
        })}
        {/* Depth indicator needle */}
        {(() => {
          const depthY = 310 + ((depthSpring - 150) / 200) * 240;
          return (
            <g>
              <polygon points={`1395,${depthY} 1405,${depthY - 5} 1405,${depthY + 5}`} fill={C.sonarGreen} />
              <text x="1410" y={depthY + 4} fill={C.sonarGreen} fontSize="10" fontFamily="monospace" fontWeight="bold" filter="url(#sub-crt)">
                {depthSpring.toFixed(1)}m
              </text>
            </g>
          );
        })()}

        {/* ─── TORPEDO SOLUTION / FIRE CONTROL ────────────────────────── */}
        <rect x="1520" y="270" width="370" height="300" rx="6" fill={C.panelDark} stroke={C.panelBorder} strokeWidth="1.5" />
        <text x="1705" y="292" textAnchor="middle" fill={C.hostileRed} fontSize="9" fontFamily="monospace" letterSpacing="2">FIRE CONTROL</text>
        {[
          { label: 'TGT DESIG', val: 'SIERRA-1' },
          { label: 'TGT BRG', val: '045\u00b0' },
          { label: 'TGT RNG', val: '12nm' },
          { label: 'SOLUTION', val: frame > 100 ? 'VALID' : 'COMPUTING' },
          { label: 'TUBE 1', val: 'LOADED' },
          { label: 'TUBE 2', val: 'LOADED' },
          { label: 'TUBE 3', val: 'EMPTY' },
          { label: 'TUBE 4', val: 'LOADED' },
        ].map((fc, i) => {
          const valColor = fc.val === 'VALID' ? C.sonarGreen :
            fc.val === 'COMPUTING' ? C.tacticalAmber :
            fc.val === 'EMPTY' ? C.hostileRedDim : C.textPrimary;
          return (
            <g key={`fc-${i}`}>
              <text x="1540" y={318 + i * 30} fill={C.textLabel} fontSize="8" fontFamily="monospace">{fc.label}</text>
              <text x="1700" y={318 + i * 30} fill={valColor} fontSize="10" fontFamily="monospace" filter="url(#sub-crt)">{fc.val}</text>
            </g>
          );
        })}

        {/* ─── BOTTOM STATUS BAR ───────────────────────────────────────── */}
        <rect x="30" y="920" width="1860" height="130" rx="6" fill={C.panelDark} stroke={C.panelBorder} strokeWidth="1.5" />

        {/* Compass rose heading indicator */}
        <g transform="translate(160,985)">
          <circle r="50" fill="none" stroke={C.compassGold} strokeWidth="1" />
          <circle r="45" fill="none" stroke={`rgba(${hexToRgb(C.compassGold)},0.3)`} strokeWidth="0.5" />
          {Array.from({ length: 36 }, (_, i) => {
            const deg = i * 10;
            const rad = (deg - 90) * Math.PI / 180;
            const isMajor = deg % 90 === 0;
            const inner = isMajor ? 35 : 40;
            return (
              <line key={`comp-${i}`} x1={Math.cos(rad) * inner} y1={Math.sin(rad) * inner}
                x2={Math.cos(rad) * 45} y2={Math.sin(rad) * 45}
                stroke={C.compassGold} strokeWidth={isMajor ? 1 : 0.3} />
            );
          })}
          {['N', 'E', 'S', 'W'].map((dir, i) => {
            const rad = (i * 90 - 90) * Math.PI / 180;
            return (
              <text key={dir} x={Math.cos(rad) * 28} y={Math.sin(rad) * 28 + 3}
                textAnchor="middle" fill={C.compassGold} fontSize="8" fontFamily="monospace" fontWeight="bold">{dir}</text>
            );
          })}
          {/* Heading needle */}
          {(() => {
            const hRad = (heading - 90) * Math.PI / 180;
            return <line x1={0} y1={0} x2={Math.cos(hRad) * 40} y2={Math.sin(hRad) * 40}
              stroke={colors.rose} strokeWidth="2" strokeLinecap="round" />;
          })()}
          <circle r="3" fill={C.compassGold} />
          <text x={0} y={62} textAnchor="middle" fill={C.textPrimary} fontSize="10" fontFamily="monospace">HDG {heading.toFixed(0)}\u00b0</text>
        </g>

        {/* Speed indicator */}
        <text x="320" y="960" fill={C.textLabel} fontSize="8" fontFamily="monospace">SPEED</text>
        <text x="320" y="980" fill={C.textPrimary} fontSize="16" fontFamily="monospace" filter="url(#sub-crt)">12 KTS</text>

        {/* Depth readout */}
        <text x="500" y="960" fill={C.textLabel} fontSize="8" fontFamily="monospace">DEPTH</text>
        <text x="500" y="980" fill={C.textPrimary} fontSize="16" fontFamily="monospace" filter="url(#sub-crt)">{depth.toFixed(0)}m</text>

        {/* System time */}
        <text x="700" y="960" fill={C.textLabel} fontSize="8" fontFamily="monospace">SYSTEM TIME</text>
        <text x="700" y="980" fill={C.textPrimary} fontSize="16" fontFamily="monospace" filter="url(#sub-crt)">
          {`14:${String(27 + Math.floor(t)).padStart(2, '0')}:${String(Math.floor((t % 1) * 60)).padStart(2, '0')}`}
        </text>

        {/* CONN/SONAR comm status */}
        <text x="1000" y="960" fill={C.textLabel} fontSize="8" fontFamily="monospace">CONN/SONAR</text>
        <text x="1000" y="980" fill={C.sonarGreen} fontSize="14" fontFamily="monospace" filter="url(#sub-glow)">CONNECTED</text>

        {/* Active contacts count */}
        <text x="1250" y="960" fill={C.textLabel} fontSize="8" fontFamily="monospace">CONTACTS</text>
        <text x="1250" y="980" fill={C.tacticalAmber} fontSize="16" fontFamily="monospace">{visibleContacts.length}</text>

        {/* Alert status */}
        <text x="1450" y="960" fill={C.textLabel} fontSize="8" fontFamily="monospace">ALERT</text>
        <text x="1450" y="980" fill={pingActive ? C.hostileRed : C.sonarGreen} fontSize="14" fontFamily="monospace"
          filter={pingActive ? 'url(#sub-glow)' : undefined}>
          {pingActive ? 'NEW CONTACT' : 'NORMAL'}
        </text>

        {/* ─── Underwater particles ───────────────────────────────────── */}
        {underwaterParticles.map((p, i) => {
          const px = ((p.x + p.vx * frame) % 1920 + 1920) % 1920;
          const py = ((p.y + p.vy * frame) % 1080 + 1080) % 1080;
          return <circle key={`wp-${i}`} cx={px} cy={py} r={p.size} fill={C.waterParticle} opacity={p.opacity} />;
        })}

        {/* ─── Condensation drops on screen edges ─────────────────────── */}
        {condensation.map((drop, i) => (
          <circle key={`cond-${i}`} cx={drop.x} cy={drop.y} r={drop.r}
            fill={`rgba(${hexToRgb(C.instrumentBlue)},${drop.opacity})`} />
        ))}

        {/* ─── CRT scanlines ──────────────────────────────────────────── */}
        {Array.from({ length: 270 }, (_, i) => (
          <line key={`scan-${i}`} x1="0" y1={i * 4} x2="1920" y2={i * 4} stroke="rgba(0,0,0,0.07)" strokeWidth="1" />
        ))}

        {/* ─── Phosphor persistence glow on sonar edge ────────────────── */}
        <circle cx={sonarCx} cy={sonarCy} r={sonarR + 2} fill="none"
          stroke={C.sonarGreenGhost} strokeWidth="4" opacity={0.5 + Math.sin(t) * 0.1} />

        {/* ─── Red light mode tint ────────────────────────────────────── */}
        <rect width="1920" height="1080" fill="rgba(30,0,0,0.08)" />

        {/* ─── Vignette (claustrophobic) ──────────────────────────────── */}
        <rect width="1920" height="1080" fill="url(#sub-vignette)" />
      </svg>
    </AbsoluteFill>
  );
};

export default SubmarineCIC;
