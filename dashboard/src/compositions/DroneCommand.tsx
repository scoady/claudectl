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

// ── Color palette ─────────────────────────────────────────────────────────────

const C = {
  bg: '#0a0c0e',
  panelBg: '#0e1114',
  panelBorder: '#1a2028',
  flirGreen: '#00ff44',
  hudGreen: '#33ff88',
  crosshairRed: '#ff2200',
  waypointBlue: '#4488ff',
  terrainAmber: '#cc8800',
  classWhite: '#e0e0e0',
  textDim: '#556060',
  gridLine: '#0d1a0d',
  rec: '#ff0000',
  signalGood: '#00ff44',
  signalWarn: '#ccaa00',
  signalBad: '#ff2200',
};

const MONO = "'Source Code Pro', Consolas, monospace";
const COND = "'Roboto Condensed', 'Arial Narrow', sans-serif";

// ── Comms messages ────────────────────────────────────────────────────────────

const COMMS = [
  { t: '14:28:44Z', from: 'OVERWATCH', msg: 'TASKORD received. ISR sweep AO ANVIL.' },
  { t: '14:29:12Z', from: 'REAPER-1', msg: 'Tally one MAM bearing 247. Tracking.' },
  { t: '14:30:01Z', from: 'TALON-6', msg: 'No friendlies in AO ANVIL. Confirm.' },
  { t: '14:31:15Z', from: 'REAPER-1', msg: 'Request engagement TGT-001. 9-line follows.' },
  { t: '14:31:42Z', from: 'OVERLORD', msg: 'Stand by. JA review in progress.' },
  { t: '14:32:30Z', from: 'OVERLORD', msg: 'Cleared hot when ready. ROE WEAPONS TIGHT.' },
  { t: '14:33:05Z', from: 'REAPER-1', msg: 'Contact classified. MISSION COMPLETE.' },
];

// ── Waypoint data ─────────────────────────────────────────────────────────────

const WAYPOINTS = [
  { x: 80, y: 60, id: 'WP1' }, { x: 160, y: 100, id: 'WP2' },
  { x: 280, y: 80, id: 'WP3' }, { x: 350, y: 160, id: 'WP4' },
  { x: 420, y: 120, id: 'WP5' }, { x: 480, y: 200, id: 'WP6' },
];

// ── Component ─────────────────────────────────────────────────────────────────

export const DroneCommand: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const rng = useMemo(() => seededRandom(7742), []);

  // Static noise data for FLIR
  const noiseGrid = useMemo(() => {
    const r = seededRandom(1001);
    return Array.from({ length: 120 }, () =>
      Array.from({ length: 80 }, () => r())
    );
  }, []);

  // Terrain features for map
  const terrainDots = useMemo(() => {
    const r = seededRandom(2002);
    return Array.from({ length: 60 }, () => ({
      x: r() * 530, y: r() * 280, size: 1 + r() * 3, opacity: 0.1 + r() * 0.3,
    }));
  }, []);

  // Agent markers on map
  const agents = useMemo(() => {
    const r = seededRandom(3003);
    return Array.from({ length: 4 }, (_, i) => ({
      baseX: 80 + r() * 400, baseY: 40 + r() * 200,
      label: `AGT-${i + 1}`, color: [C.flirGreen, C.waypointBlue, C.terrainAmber, C.crosshairRed][i],
    }));
  }, []);

  // Stars for background
  const bgStars = useMemo(() => {
    const r = seededRandom(4004);
    return Array.from({ length: 40 }, () => ({
      x: r() * 1920, y: r() * 1080, s: 0.5 + r() * 1.5, o: 0.05 + r() * 0.15,
    }));
  }, []);

  // ── Derived animations ────────────────────────────────────────────────────

  const fadeIn = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: 'clamp' });
  const missionTime = Math.floor(frame / fps);
  const missionMins = Math.floor(missionTime / 60);
  const missionSecs = missionTime % 60;
  const met = `${String(missionMins).padStart(2, '0')}:${String(missionSecs).padStart(2, '0')}`;

  // Crosshair tracking
  const crossX = interpolate(frame, [0, 80, 160, 300], [200, 340, 360, 360], {
    extrapolateRight: 'clamp', easing: Easing.inOut(Easing.ease),
  });
  const crossY = interpolate(frame, [0, 80, 160, 300], [260, 300, 310, 310], {
    extrapolateRight: 'clamp', easing: Easing.inOut(Easing.ease),
  });

  // Targeting box lock at frame 80
  const lockProgress = interpolate(frame, [60, 90], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const boxSize = interpolate(lockProgress, [0, 1], [80, 44]);
  const boxOpacity = interpolate(frame, [50, 60], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  // Drone position on map
  const droneMapX = interpolate(frame, [0, 300], [80, 480], { extrapolateRight: 'clamp' });
  const droneMapY = interpolate(frame, [0, 150, 300], [60, 200, 120], { extrapolateRight: 'clamp' });

  // Attitude (bank angle)
  const bankAngle = Math.sin(frame * 0.03) * 8;
  const pitchAngle = Math.sin(frame * 0.02) * 3;

  // Airspeed / altitude
  const airspeed = 120 + Math.sin(frame * 0.04) * 8;
  const altitude = 18500 + Math.sin(frame * 0.025) * 200;
  const heading = (270 + frame * 0.3) % 360;
  const vsi = Math.sin(frame * 0.05) * 150;

  // Signal strength
  const signalBase = 0.85 + Math.sin(frame * 0.07) * 0.1;
  const signalJitter = Math.sin(frame * 1.3) * 0.05;
  const signal = Math.max(0.1, Math.min(1, signalBase + signalJitter));

  // Contact identified at frame 160
  const contactSpring = spring({ frame: frame - 160, fps, config: { damping: 12, stiffness: 100 } });
  const contactVisible = frame >= 160 ? contactSpring : 0;

  // Mission complete at 220
  const missionComplete = frame >= 220;

  // ROE status
  const roeStatus = frame < 160 ? 'WEAPONS HOLD' : frame < 220 ? 'WEAPONS TIGHT' : 'STANDBY';
  const roeColor = frame < 160 ? C.terrainAmber : frame < 220 ? C.signalWarn : C.hudGreen;

  // Fuel decreasing
  const fuel = interpolate(frame, [0, 300], [87, 62], { extrapolateRight: 'clamp' });

  // Visible comms
  const visibleComms = COMMS.filter((_, i) => frame > 30 + i * 35);

  // REC blink
  const recBlink = Math.sin(frame * 0.3) > 0;

  // Panel dimensions
  const flirW = 750;
  const flirH = 1080;
  const rightX = flirW + 4;
  const rightW = 1920 - rightX;
  const mapH = 540;
  const instrY = mapH + 4;
  const instrH = 1080 - instrY;
  const instrHalfW = rightW / 2;

  // Theme accent for bloom
  const cyanRgb = hexToRgb(colors.cyan);

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <svg viewBox="0 0 1920 1080" style={{ width: '100%', height: '100%', opacity: fadeIn }}>
        <defs>
          <filter id="dc-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="dc-bloom">
            <feGaussianBlur stdDeviation="6" result="bloom" />
            <feMerge><feMergeNode in="bloom" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <clipPath id="flir-clip"><rect x={0} y={0} width={flirW} height={flirH} /></clipPath>
          <clipPath id="map-clip"><rect x={rightX} y={0} width={rightW} height={mapH} /></clipPath>
        </defs>

        {/* Background stars */}
        {bgStars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.s} fill={C.hudGreen} opacity={s.o * (0.5 + 0.5 * Math.sin(frame * 0.02 + i))} />
        ))}

        {/* ── LEFT: FLIR SENSOR FEED ─────────────────────────────────── */}
        <g clipPath="url(#flir-clip)">
          {/* Dark ground */}
          <rect x={0} y={0} width={flirW} height={flirH} fill="#040804" />

          {/* FLIR noise texture */}
          {noiseGrid.map((row, ri) =>
            ri % 3 === 0 ? row.filter((_, ci) => ci % 3 === 0).map((v, ci) => (
              <rect key={`n${ri}-${ci}`} x={ci * 28} y={ri * 14} width={28} height={14}
                fill={C.flirGreen} opacity={v * 0.04 + Math.sin(frame * 0.1 + ri + ci) * 0.01} />
            )) : null
          )}

          {/* Targeting grid */}
          {Array.from({ length: 15 }, (_, i) => (
            <line key={`gv${i}`} x1={i * 50} y1={0} x2={i * 50} y2={flirH}
              stroke={C.gridLine} strokeWidth={0.5} opacity={0.4} />
          ))}
          {Array.from({ length: 22 }, (_, i) => (
            <line key={`gh${i}`} x1={0} y1={i * 50} x2={flirW} y2={i * 50}
              stroke={C.gridLine} strokeWidth={0.5} opacity={0.4} />
          ))}

          {/* FLIR "hot" shapes — agents as heat signatures */}
          {agents.map((_a, i) => {
            const ax = 100 + i * 150 + Math.sin(frame * 0.02 + i * 2) * 20;
            const ay = 400 + Math.cos(frame * 0.015 + i * 3) * 30;
            return (
              <g key={`hs${i}`} filter="url(#dc-bloom)">
                <ellipse cx={ax} cy={ay} rx={12} ry={8} fill={C.flirGreen} opacity={0.6 + Math.sin(frame * 0.05 + i) * 0.2} />
                <ellipse cx={ax} cy={ay} rx={6} ry={4} fill="#88ffaa" opacity={0.8} />
              </g>
            );
          })}

          {/* Crosshair reticle */}
          <g filter="url(#dc-glow)">
            <line x1={crossX - 40} y1={crossY} x2={crossX - 12} y2={crossY} stroke={C.hudGreen} strokeWidth={1.5} />
            <line x1={crossX + 12} y1={crossY} x2={crossX + 40} y2={crossY} stroke={C.hudGreen} strokeWidth={1.5} />
            <line x1={crossX} y1={crossY - 40} x2={crossX} y2={crossY - 12} stroke={C.hudGreen} strokeWidth={1.5} />
            <line x1={crossX} y1={crossY + 12} x2={crossX} y2={crossY + 40} stroke={C.hudGreen} strokeWidth={1.5} />
            <circle cx={crossX} cy={crossY} r={20} stroke={C.hudGreen} strokeWidth={1} fill="none" />
            <circle cx={crossX} cy={crossY} r={2} fill={C.hudGreen} />
          </g>

          {/* Targeting box */}
          {boxOpacity > 0 && (
            <rect x={crossX - boxSize / 2} y={crossY - boxSize / 2} width={boxSize} height={boxSize}
              stroke={lockProgress > 0.9 ? C.crosshairRed : C.hudGreen} strokeWidth={lockProgress > 0.9 ? 2 : 1}
              fill="none" opacity={boxOpacity} strokeDasharray={lockProgress > 0.9 ? 'none' : '4 2'} />
          )}

          {/* Contact identified overlay */}
          {contactVisible > 0 && (
            <g opacity={contactVisible}>
              <rect x={crossX - 60} y={crossY - 60} width={120} height={18} fill="rgba(255,34,0,0.15)" />
              <text x={crossX} y={crossY - 47} textAnchor="middle" fill={C.crosshairRed}
                fontFamily={COND} fontSize={11} fontWeight={700}>CONTACT IDENTIFIED</text>
              <text x={crossX} y={crossY + 70} textAnchor="middle" fill={C.classWhite}
                fontFamily={MONO} fontSize={9}>CLASS: AGENT-ACTIVE | CONF: 94.2%</text>
            </g>
          )}

          {/* HUD overlay text */}
          <text x={15} y={25} fill={C.hudGreen} fontFamily={MONO} fontSize={10} opacity={0.8}>
            HDG {heading.toFixed(0).padStart(3, '0')}T | ALT {altitude.toFixed(0)} MSL
          </text>
          <text x={15} y={42} fill={C.hudGreen} fontFamily={MONO} fontSize={10} opacity={0.8}>
            GS {airspeed.toFixed(0)} KTS | ZOOM x{lockProgress > 0.9 ? '16' : '12'}
          </text>
          <text x={15} y={flirH - 30} fill={C.hudGreen} fontFamily={MONO} fontSize={9} opacity={0.7}>
            LAT 33.4152N | LON 044.3661E
          </text>
          <text x={15} y={flirH - 15} fill={C.hudGreen} fontFamily={MONO} fontSize={9} opacity={0.7}>
            SLANT RNG: 4.2 NM | SENSOR: WHOT IR
          </text>

          {/* Laser designation indicator */}
          {lockProgress > 0.9 && (
            <text x={flirW - 15} y={flirH - 15} textAnchor="end" fill={C.crosshairRed}
              fontFamily={MONO} fontSize={10} fontWeight={700} opacity={0.6 + Math.sin(frame * 0.15) * 0.3}>
              LASE ACTIVE
            </text>
          )}

          {/* REC indicator */}
          <g>
            {recBlink && <circle cx={flirW - 60} cy={20} r={4} fill={C.rec} />}
            <text x={flirW - 48} y={24} fill={C.rec} fontFamily={MONO} fontSize={10} fontWeight={700} opacity={0.9}>
              REC
            </text>
            <text x={flirW - 15} y={24} textAnchor="end" fill={C.rec} fontFamily={MONO} fontSize={9} opacity={0.7}>
              {met}
            </text>
          </g>

          {/* Scan line effect */}
          {(() => {
            const scanY = (frame * 4) % flirH;
            return <line x1={0} y1={scanY} x2={flirW} y2={scanY} stroke={C.hudGreen} strokeWidth={1} opacity={0.06} />;
          })()}

          {/* Interlace artifacts */}
          {Array.from({ length: 54 }, (_, i) => (
            <line key={`il${i}`} x1={0} y1={i * 20} x2={flirW} y2={i * 20}
              stroke={C.flirGreen} strokeWidth={0.3} opacity={0.03} />
          ))}
        </g>

        {/* Panel border */}
        <line x1={flirW} y1={0} x2={flirW} y2={1080} stroke={C.panelBorder} strokeWidth={2} />

        {/* ── RIGHT-TOP: TACTICAL MAP ────────────────────────────────── */}
        <g clipPath="url(#map-clip)">
          <rect x={rightX} y={0} width={rightW} height={mapH} fill={C.panelBg} />

          {/* Map grid */}
          {Array.from({ length: 12 }, (_, i) => (
            <line key={`mg${i}`} x1={rightX + i * 50 + 30} y1={0} x2={rightX + i * 50 + 30} y2={mapH}
              stroke={C.panelBorder} strokeWidth={0.5} opacity={0.4} />
          ))}
          {Array.from({ length: 6 }, (_, i) => (
            <line key={`mgh${i}`} x1={rightX} y1={i * 50 + 30} x2={rightX + rightW} y2={i * 50 + 30}
              stroke={C.panelBorder} strokeWidth={0.5} opacity={0.4} />
          ))}

          {/* Terrain dots */}
          {terrainDots.map((d, i) => (
            <circle key={`td${i}`} cx={rightX + 30 + d.x} cy={30 + d.y} r={d.size}
              fill={C.terrainAmber} opacity={d.opacity} />
          ))}

          {/* Threat zone */}
          <ellipse cx={rightX + 320} cy={180} rx={80} ry={60} fill="rgba(255,34,0,0.06)" stroke={C.crosshairRed}
            strokeWidth={0.8} strokeDasharray="6 3" opacity={0.5} />
          <text x={rightX + 320} y={185} textAnchor="middle" fill={C.crosshairRed} fontFamily={MONO} fontSize={8} opacity={0.5}>
            THREAT ZONE
          </text>

          {/* Communication range circle */}
          <circle cx={rightX + droneMapX - 50} cy={droneMapY + 20} r={120} fill="none"
            stroke={C.waypointBlue} strokeWidth={0.6} strokeDasharray="4 4" opacity={0.3} />

          {/* Waypoint route */}
          {WAYPOINTS.map((wp, i) => {
            const nx = WAYPOINTS[i + 1];
            return (
              <g key={`wp${i}`}>
                {nx && <line x1={rightX + 30 + wp.x} y1={30 + wp.y} x2={rightX + 30 + nx.x} y2={30 + nx.y}
                  stroke={C.waypointBlue} strokeWidth={1} opacity={0.6} strokeDasharray="3 2" />}
                <circle cx={rightX + 30 + wp.x} cy={30 + wp.y} r={4} fill="none"
                  stroke={C.waypointBlue} strokeWidth={1} opacity={0.8} />
                <text x={rightX + 30 + wp.x} y={30 + wp.y - 8} textAnchor="middle"
                  fill={C.waypointBlue} fontFamily={MONO} fontSize={7} opacity={0.7}>{wp.id}</text>
              </g>
            );
          })}

          {/* Drone trail */}
          {Array.from({ length: 20 }, (_, i) => {
            const trailF = Math.max(0, frame - i * 4);
            const tx = interpolate(trailF, [0, 300], [80, 480], { extrapolateRight: 'clamp' });
            const ty = interpolate(trailF, [0, 150, 300], [60, 200, 120], { extrapolateRight: 'clamp' });
            return <circle key={`tr${i}`} cx={rightX + 30 + tx} cy={30 + ty} r={1} fill={C.hudGreen} opacity={0.4 - i * 0.02} />;
          })}

          {/* Drone icon */}
          <g transform={`translate(${rightX + 30 + droneMapX}, ${30 + droneMapY}) rotate(${heading - 270})`}>
            <polygon points="0,-8 5,6 -5,6" fill={C.hudGreen} opacity={0.9} />
            <line x1={0} y1={-8} x2={0} y2={-16} stroke={C.hudGreen} strokeWidth={1} opacity={0.6} />
          </g>

          {/* Agent markers */}
          {agents.map((a, i) => {
            const mx = a.baseX + Math.sin(frame * 0.01 + i * 2) * 15;
            const my = a.baseY + Math.cos(frame * 0.012 + i * 3) * 10;
            return (
              <g key={`am${i}`}>
                <rect x={rightX + 30 + mx - 4} y={30 + my - 4} width={8} height={8}
                  fill={a.color} opacity={0.7} transform={`rotate(45, ${rightX + 30 + mx}, ${30 + my})`} />
                <text x={rightX + 30 + mx} y={30 + my + 16} textAnchor="middle"
                  fill={a.color} fontFamily={MONO} fontSize={7} opacity={0.6}>{a.label}</text>
              </g>
            );
          })}

          {/* North arrow */}
          <g transform={`translate(${rightX + rightW - 40}, 35)`}>
            <polygon points="0,-15 5,0 -5,0" fill={C.classWhite} opacity={0.5} />
            <text x={0} y={-18} textAnchor="middle" fill={C.classWhite} fontFamily={COND} fontSize={9} fontWeight={700} opacity={0.6}>N</text>
          </g>

          {/* Scale bar */}
          <line x1={rightX + 30} y1={mapH - 25} x2={rightX + 130} y2={mapH - 25}
            stroke={C.classWhite} strokeWidth={1} opacity={0.5} />
          <text x={rightX + 80} y={mapH - 14} textAnchor="middle" fill={C.classWhite}
            fontFamily={MONO} fontSize={7} opacity={0.5}>5 KM</text>

          {/* Map title */}
          <text x={rightX + 15} y={18} fill={C.hudGreen} fontFamily={COND} fontSize={11} fontWeight={700} opacity={0.7}>
            TACTICAL MAP — AO ANVIL
          </text>
        </g>

        {/* Map / instruments divider */}
        <line x1={rightX} y1={mapH} x2={1920} y2={mapH} stroke={C.panelBorder} strokeWidth={2} />

        {/* ── RIGHT-BOTTOM-LEFT: FLIGHT INSTRUMENTS ──────────────────── */}
        <g>
          <rect x={rightX} y={instrY} width={instrHalfW} height={instrH} fill={C.panelBg} />

          {/* Panel label */}
          <text x={rightX + 15} y={instrY + 20} fill={C.hudGreen} fontFamily={COND} fontSize={10} fontWeight={700} opacity={0.6}>
            FLIGHT INSTRUMENTS
          </text>

          {/* Artificial Horizon */}
          {(() => {
            const ahCx = rightX + instrHalfW / 2;
            const ahCy = instrY + 120;
            const ahR = 70;
            return (
              <g>
                <circle cx={ahCx} cy={ahCy} r={ahR} fill="#0a1a0a" stroke={C.panelBorder} strokeWidth={1.5} />
                <g transform={`rotate(${bankAngle}, ${ahCx}, ${ahCy})`}>
                  {/* Sky / ground split */}
                  <clipPath id="ah-clip"><circle cx={ahCx} cy={ahCy} r={ahR - 2} /></clipPath>
                  <g clipPath="url(#ah-clip)">
                    <rect x={ahCx - ahR} y={ahCy - ahR + pitchAngle * 3} width={ahR * 2} height={ahR}
                      fill="rgba(0,100,0,0.15)" />
                    <rect x={ahCx - ahR} y={ahCy + pitchAngle * 3} width={ahR * 2} height={ahR}
                      fill="rgba(100,60,0,0.15)" />
                    <line x1={ahCx - ahR} y1={ahCy + pitchAngle * 3} x2={ahCx + ahR} y2={ahCy + pitchAngle * 3}
                      stroke={C.hudGreen} strokeWidth={1} />
                  </g>
                </g>
                {/* Center mark */}
                <line x1={ahCx - 20} y1={ahCy} x2={ahCx - 8} y2={ahCy} stroke={C.hudGreen} strokeWidth={2} />
                <line x1={ahCx + 8} y1={ahCy} x2={ahCx + 20} y2={ahCy} stroke={C.hudGreen} strokeWidth={2} />
                <circle cx={ahCx} cy={ahCy} r={2} fill={C.hudGreen} />
                {/* Bank marks */}
                {[-30, -15, 0, 15, 30].map(deg => (
                  <line key={`bm${deg}`}
                    x1={ahCx + Math.sin(deg * Math.PI / 180) * (ahR - 8)}
                    y1={ahCy - Math.cos(deg * Math.PI / 180) * (ahR - 8)}
                    x2={ahCx + Math.sin(deg * Math.PI / 180) * (ahR - 2)}
                    y2={ahCy - Math.cos(deg * Math.PI / 180) * (ahR - 2)}
                    stroke={C.hudGreen} strokeWidth={1} opacity={0.6} />
                ))}
              </g>
            );
          })()}

          {/* Airspeed tape (left) */}
          <rect x={rightX + 15} y={instrY + 210} width={50} height={200} fill="rgba(0,0,0,0.4)" stroke={C.panelBorder} strokeWidth={0.5} />
          <text x={rightX + 40} y={instrY + 205} textAnchor="middle" fill={C.hudGreen} fontFamily={MONO} fontSize={8} opacity={0.6}>KTAS</text>
          {Array.from({ length: 9 }, (_, i) => {
            const spd = Math.round(airspeed / 5) * 5 - 20 + i * 5;
            const yOff = instrY + 310 - (spd - (airspeed - 20)) * 4;
            return yOff > instrY + 210 && yOff < instrY + 410 ? (
              <g key={`as${i}`}>
                <line x1={rightX + 55} y1={yOff} x2={rightX + 65} y2={yOff} stroke={C.hudGreen} strokeWidth={0.5} opacity={0.5} />
                <text x={rightX + 40} y={yOff + 3} textAnchor="middle" fill={C.hudGreen} fontFamily={MONO} fontSize={8} opacity={0.7}>
                  {spd}
                </text>
              </g>
            ) : null;
          })}
          <rect x={rightX + 20} y={instrY + 305} width={40} height={14} fill="rgba(0,255,68,0.1)" stroke={C.hudGreen} strokeWidth={1} />
          <text x={rightX + 40} y={instrY + 315} textAnchor="middle" fill={C.hudGreen} fontFamily={MONO} fontSize={10} fontWeight={700}>
            {airspeed.toFixed(0)}
          </text>

          {/* Altitude tape (right) */}
          <rect x={rightX + instrHalfW - 65} y={instrY + 210} width={50} height={200} fill="rgba(0,0,0,0.4)" stroke={C.panelBorder} strokeWidth={0.5} />
          <text x={rightX + instrHalfW - 40} y={instrY + 205} textAnchor="middle" fill={C.hudGreen} fontFamily={MONO} fontSize={8} opacity={0.6}>ALT</text>
          {Array.from({ length: 9 }, (_, i) => {
            const alt = Math.round(altitude / 200) * 200 - 800 + i * 200;
            const yOff = instrY + 310 - (alt - (altitude - 800)) * 0.1;
            return yOff > instrY + 210 && yOff < instrY + 410 ? (
              <g key={`al${i}`}>
                <text x={rightX + instrHalfW - 40} y={yOff + 3} textAnchor="middle" fill={C.hudGreen} fontFamily={MONO} fontSize={8} opacity={0.7}>
                  {(alt / 1000).toFixed(1)}
                </text>
              </g>
            ) : null;
          })}
          <rect x={rightX + instrHalfW - 60} y={instrY + 305} width={40} height={14} fill="rgba(0,255,68,0.1)" stroke={C.hudGreen} strokeWidth={1} />
          <text x={rightX + instrHalfW - 40} y={instrY + 315} textAnchor="middle" fill={C.hudGreen} fontFamily={MONO} fontSize={10} fontWeight={700}>
            {(altitude / 1000).toFixed(1)}
          </text>

          {/* Heading bar */}
          <rect x={rightX + 80} y={instrY + 430} width={instrHalfW - 160} height={24} fill="rgba(0,0,0,0.4)" stroke={C.panelBorder} strokeWidth={0.5} />
          <text x={rightX + instrHalfW / 2} y={instrY + 425} textAnchor="middle" fill={C.hudGreen} fontFamily={MONO} fontSize={8} opacity={0.6}>HDG</text>
          {Array.from({ length: 7 }, (_, i) => {
            const h = Math.round(heading / 10) * 10 - 30 + i * 10;
            const xOff = rightX + 80 + ((i - 3) * 30) + (instrHalfW - 160) / 2;
            return (
              <text key={`hd${i}`} x={xOff} y={instrY + 447} textAnchor="middle" fill={C.hudGreen}
                fontFamily={MONO} fontSize={8} opacity={i === 3 ? 1 : 0.5}>{((h % 360) + 360) % 360}</text>
            );
          })}

          {/* VSI */}
          <text x={rightX + instrHalfW / 2} y={instrY + 480} textAnchor="middle" fill={C.hudGreen}
            fontFamily={MONO} fontSize={9} opacity={0.7}>VSI: {vsi > 0 ? '+' : ''}{vsi.toFixed(0)} FPM</text>
        </g>

        {/* Instruments / systems divider */}
        <line x1={rightX + instrHalfW} y1={instrY} x2={rightX + instrHalfW} y2={1080} stroke={C.panelBorder} strokeWidth={1} />

        {/* ── RIGHT-BOTTOM-RIGHT: SYSTEMS / COMMS ────────────────────── */}
        <g>
          <rect x={rightX + instrHalfW} y={instrY} width={instrHalfW} height={instrH} fill={C.panelBg} />

          {/* Panel label */}
          <text x={rightX + instrHalfW + 15} y={instrY + 20} fill={C.hudGreen} fontFamily={COND} fontSize={10} fontWeight={700} opacity={0.6}>
            SYSTEMS / COMMS
          </text>

          {/* Fuel status */}
          <text x={rightX + instrHalfW + 15} y={instrY + 45} fill={C.textDim} fontFamily={MONO} fontSize={9}>FUEL</text>
          <rect x={rightX + instrHalfW + 60} y={instrY + 36} width={120} height={10} fill="rgba(0,0,0,0.3)" stroke={C.panelBorder} strokeWidth={0.5} />
          <rect x={rightX + instrHalfW + 61} y={instrY + 37} width={118 * fuel / 100} height={8}
            fill={fuel > 50 ? C.signalGood : fuel > 25 ? C.signalWarn : C.signalBad} opacity={0.7} />
          <text x={rightX + instrHalfW + 190} y={instrY + 45} fill={C.hudGreen} fontFamily={MONO} fontSize={9}>{fuel.toFixed(0)}%</text>

          {/* Signal strength */}
          <text x={rightX + instrHalfW + 15} y={instrY + 68} fill={C.textDim} fontFamily={MONO} fontSize={9}>DATALINK</text>
          {Array.from({ length: 5 }, (_, i) => {
            const barH = 4 + i * 3;
            const on = signal > (i + 1) * 0.18;
            return <rect key={`sig${i}`} x={rightX + instrHalfW + 80 + i * 12} y={instrY + 68 - barH}
              width={8} height={barH} fill={on ? (signal > 0.6 ? C.signalGood : C.signalWarn) : C.panelBorder} opacity={on ? 0.8 : 0.3} />;
          })}
          <text x={rightX + instrHalfW + 150} y={instrY + 68} fill={C.hudGreen} fontFamily={MONO} fontSize={8}>
            {(signal * 100).toFixed(0)}%
          </text>

          {/* Sensor mode */}
          <text x={rightX + instrHalfW + 15} y={instrY + 90} fill={C.textDim} fontFamily={MONO} fontSize={9}>SENSOR</text>
          {['EO', 'IR', 'SAR'].map((mode, i) => {
            const active = mode === 'IR';
            return (
              <g key={mode}>
                <rect x={rightX + instrHalfW + 70 + i * 45} y={instrY + 78} width={38} height={14}
                  fill={active ? 'rgba(0,255,68,0.15)' : 'none'} stroke={active ? C.hudGreen : C.panelBorder} strokeWidth={0.5} />
                <text x={rightX + instrHalfW + 89 + i * 45} y={instrY + 89} textAnchor="middle"
                  fill={active ? C.hudGreen : C.textDim} fontFamily={MONO} fontSize={9} fontWeight={active ? 700 : 400}>{mode}</text>
              </g>
            );
          })}

          {/* MET */}
          <text x={rightX + instrHalfW + 15} y={instrY + 115} fill={C.textDim} fontFamily={MONO} fontSize={9}>MET</text>
          <text x={rightX + instrHalfW + 60} y={instrY + 115} fill={C.hudGreen} fontFamily={MONO} fontSize={11} fontWeight={700}>
            {met}
          </text>

          {/* ROE status */}
          <text x={rightX + instrHalfW + 15} y={instrY + 140} fill={C.textDim} fontFamily={MONO} fontSize={9}>ROE</text>
          <text x={rightX + instrHalfW + 60} y={instrY + 140} fill={roeColor} fontFamily={MONO} fontSize={10} fontWeight={700}>
            {roeStatus}
          </text>

          {/* Mission complete flash */}
          {missionComplete && (
            <g opacity={0.6 + Math.sin(frame * 0.1) * 0.3}>
              <rect x={rightX + instrHalfW + 10} y={instrY + 150} width={instrHalfW - 20} height={22}
                fill={`rgba(${hexToRgb(colors.green)}, 0.1)`} stroke={colors.green} strokeWidth={1} />
              <text x={rightX + instrHalfW + instrHalfW / 2} y={instrY + 165} textAnchor="middle"
                fill={colors.green} fontFamily={COND} fontSize={12} fontWeight={700}>MISSION COMPLETE</text>
            </g>
          )}

          {/* Comms log */}
          <text x={rightX + instrHalfW + 15} y={instrY + 195} fill={C.hudGreen} fontFamily={COND} fontSize={9} fontWeight={700} opacity={0.6}>
            COMMS LOG
          </text>
          <line x1={rightX + instrHalfW + 15} y1={instrY + 200} x2={rightX + instrHalfW + instrHalfW - 15} y2={instrY + 200}
            stroke={C.panelBorder} strokeWidth={0.5} />
          {visibleComms.slice(-6).map((c, i) => (
            <g key={`cm${i}`}>
              <text x={rightX + instrHalfW + 15} y={instrY + 216 + i * 22} fill={C.textDim}
                fontFamily={MONO} fontSize={7}>{c.t}</text>
              <text x={rightX + instrHalfW + 15} y={instrY + 226 + i * 22} fill={C.hudGreen}
                fontFamily={MONO} fontSize={8}>
                {c.from}: {c.msg.length > 38 ? c.msg.slice(0, 38) + '...' : c.msg}
              </text>
            </g>
          ))}
        </g>

        {/* ── Global scanline + vignette ─────────────────────────────── */}
        <rect x={0} y={0} width={1920} height={1080} fill="url(#dc-vignette)" opacity={0.3} />
        <defs>
          <radialGradient id="dc-vignette" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="100%" stopColor="#000000" />
          </radialGradient>
        </defs>

        {/* Theme accent glow line at top */}
        <line x1={0} y1={0} x2={1920} y2={0} stroke={`rgba(${cyanRgb}, 0.15)`} strokeWidth={2} />

        {/* Use rng to suppress unused warning */}
        <circle cx={-100} cy={-100} r={rng() * 0} fill="none" />
      </svg>
    </AbsoluteFill>
  );
};

export default DroneCommand;
