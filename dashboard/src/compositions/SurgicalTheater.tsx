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

// ── Clinical color palette ───────────────────────────────────────────────────

const C = {
  bg: '#0a0e14',
  panelBg: '#0e1318',
  panelBorder: '#2a3040',
  ecgGreen: '#00ff88',
  spo2Cyan: '#00ccff',
  bpRed: '#ff4444',
  respYellow: '#ffcc00',
  anesthPurple: '#cc66ff',
  tempWhite: '#e8e8e8',
  textPrimary: '#e0e8f0',
  textSecondary: '#8899aa',
  textMuted: '#3d4f5f',
  gridLine: '#152025',
  alarmRed: '#ff1744',
  nominalGreen: '#00e676',
};

const MONO = "'SF Mono', 'JetBrains Mono', monospace";
const SANS = "'Inter', 'Helvetica Neue', sans-serif";

// ── Waveform generators ──────────────────────────────────────────────────────

function ecgSample(t: number): number {
  const p = t % 1;
  if (p < 0.10) return Math.sin(p * Math.PI / 0.10) * 0.12;
  if (p < 0.14) return 0;
  if (p < 0.16) return -(p - 0.14) / 0.02 * 0.15;
  if (p < 0.20) return -0.15 + (p - 0.16) / 0.04 * 1.15;
  if (p < 0.24) return 1.0 - (p - 0.20) / 0.04 * 1.35;
  if (p < 0.28) return -0.35 + (p - 0.24) / 0.04 * 0.35;
  if (p < 0.44) return Math.sin((p - 0.28) * Math.PI / 0.16) * 0.2;
  return 0;
}

function spo2Sample(t: number): number {
  const p = t % 1;
  if (p < 0.15) return Math.sin(p * Math.PI / 0.15) * 0.85;
  if (p < 0.30) return 0.85 - (p - 0.15) / 0.15 * 0.4;
  if (p < 0.35) return 0.45 + Math.sin((p - 0.30) * Math.PI / 0.05) * 0.1;
  if (p < 0.85) return 0.45 - (p - 0.35) / 0.50 * 0.45;
  return 0;
}

function bpSample(t: number): number {
  const p = t % 1;
  if (p < 0.08) return Math.sin(p * Math.PI / 0.08) * 1.0;
  if (p < 0.20) return 1.0 - (p - 0.08) / 0.12 * 0.5;
  if (p < 0.28) return 0.5 + Math.sin((p - 0.20) * Math.PI / 0.08) * 0.15;
  if (p < 0.80) return 0.5 - (p - 0.28) / 0.52 * 0.5;
  return 0;
}

function capnoSample(t: number): number {
  const p = t % 1;
  if (p < 0.05) return p / 0.05 * 0.85;
  if (p < 0.45) return 0.85 + (p - 0.05) / 0.40 * 0.15;
  if (p < 0.50) return 1.0 - (p - 0.45) / 0.05 * 1.0;
  return 0;
}

function eegSample(t: number, rng: () => number): number {
  return (Math.sin(t * 11) * 0.3 + Math.sin(t * 23) * 0.2 +
    Math.sin(t * 47) * 0.15 + (rng() - 0.5) * 0.35);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildWaveformPath(
  samples: number[], x0: number, y0: number, w: number, h: number,
  amplitude: number,
): string {
  if (samples.length < 2) return '';
  const step = w / (samples.length - 1);
  let d = `M ${x0} ${y0 + h / 2 - samples[0] * amplitude * h / 2}`;
  for (let i = 1; i < samples.length; i++) {
    d += ` L ${x0 + i * step} ${y0 + h / 2 - samples[i] * amplitude * h / 2}`;
  }
  return d;
}

// ── Medication log data ──────────────────────────────────────────────────────

interface MedEntry { frame: number; time: string; drug: string; dose: string }
const medications: MedEntry[] = [
  { frame: 10, time: '08:02', drug: 'Propofol', dose: '200mg IV' },
  { frame: 40, time: '08:05', drug: 'Fentanyl', dose: '100mcg IV' },
  { frame: 70, time: '08:08', drug: 'Rocuronium', dose: '50mg IV' },
  { frame: 120, time: '08:14', drug: 'Sevoflurane', dose: '2.0 vol%' },
  { frame: 180, time: '08:22', drug: 'Ephedrine', dose: '10mg IV' },
  { frame: 230, time: '08:30', drug: 'Neostigmine', dose: '2.5mg IV' },
];

// ── Checklist data ───────────────────────────────────────────────────────────

interface CheckItem { label: string; completeFrame: number }
const checklist: CheckItem[] = [
  { label: 'Patient ID verified', completeFrame: 15 },
  { label: 'Consent signed', completeFrame: 25 },
  { label: 'Site marked', completeFrame: 35 },
  { label: 'Airway secured', completeFrame: 50 },
  { label: 'Antibiotics given', completeFrame: 65 },
  { label: 'Instruments count', completeFrame: 90 },
  { label: 'Hemostasis confirmed', completeFrame: 220 },
  { label: 'Sponge count correct', completeFrame: 250 },
];

// ── Surgical team ────────────────────────────────────────────────────────────

interface TeamMember { role: string; name: string; color: string }
const team: TeamMember[] = [
  { role: 'Surgeon', name: 'Controller', color: C.ecgGreen },
  { role: 'Anesthesiologist', name: 'Broker', color: C.anesthPurple },
  { role: 'Nurse', name: 'Hub', color: C.spo2Cyan },
  { role: 'Perfusionist', name: 'Gateway', color: C.respYellow },
];

// ── Phase data ───────────────────────────────────────────────────────────────

interface Phase { label: string; startFrame: number }
const phases: Phase[] = [
  { label: 'PREP', startFrame: 0 },
  { label: 'OPERATION', startFrame: 60 },
  { label: 'CLOSING', startFrame: 240 },
];

function currentPhase(frame: number): string {
  let p = phases[0].label;
  for (const ph of phases) {
    if (frame >= ph.startFrame) p = ph.label;
  }
  return p;
}

// ── Component ────────────────────────────────────────────────────────────────

export const SurgicalTheater: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Alarm state: bradycardia from frame 140-200
  const isAlarm = frame >= 140 && frame < 200;
  const alarmIntensity = isAlarm
    ? interpolate(frame, [140, 150, 190, 200], [0, 1, 1, 0], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
      })
    : 0;

  // Heart rate — drops during alarm
  const heartRate = isAlarm
    ? interpolate(frame, [140, 155, 185, 200], [72, 45, 45, 72], {
        extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        easing: Easing.inOut(Easing.ease),
      })
    : 72 + Math.sin(frame * 0.03) * 3;

  // Beat cycle — ECG peaks trigger flash
  const beatPeriod = 60 / heartRate; // seconds per beat
  const beatPhase = ((frame / fps) % beatPeriod) / beatPeriod;
  const isRPeak = beatPhase > 0.16 && beatPhase < 0.22;

  // Vitals derived values
  const spo2 = isAlarm ? 94 + Math.sin(frame * 0.1) * 1 : 98 + Math.sin(frame * 0.02) * 0.5;
  const bpSys = isAlarm ? 88 + Math.sin(frame * 0.05) * 4 : 128 + Math.sin(frame * 0.04) * 6;
  const bpDia = isAlarm ? 52 + Math.sin(frame * 0.04) * 3 : 78 + Math.sin(frame * 0.03) * 4;
  const temp = 36.4 + Math.sin(frame * 0.005) * 0.2;
  const respRate = isAlarm ? 8 + Math.sin(frame * 0.06) * 1 : 14 + Math.sin(frame * 0.02) * 1;

  // Panel entrance
  const panelEnter = spring({ frame, fps, config: { damping: 14, stiffness: 50 } });

  // EEG random source
  // Waveform generation — 200 sample sliding window
  const waveformSamples = useMemo(() => {
    const sampleCount = 200;
    const ecg: number[] = [];
    const spo2W: number[] = [];
    const bp: number[] = [];
    const capno: number[] = [];
    const eeg: number[] = [];
    const rng = seededRandom(frame * 7 + 1);
    for (let i = 0; i < sampleCount; i++) {
      const tNorm = (frame / fps + (i - sampleCount) * 0.01);
      const beatT = tNorm / beatPeriod;
      ecg.push(ecgSample(beatT));
      spo2W.push(spo2Sample(beatT * 1.1));
      bp.push(bpSample(beatT));
      capno.push(capnoSample(tNorm * 0.8));
      eeg.push(eegSample(tNorm * 8, rng));
    }
    return { ecg, spo2: spo2W, bp, capno, eeg };
  }, [frame, fps, beatPeriod]);

  // Monitor refresh scanline
  const scanlineY = (frame * 4) % height;

  // Phase
  const phase = currentPhase(frame);

  // Elapsed procedure time
  const elapsedSec = Math.floor(frame / fps);
  const elapsedMin = Math.floor(elapsedSec / 60);
  const elapsedSecRem = elapsedSec % 60;
  const elapsedStr = `${String(elapsedMin).padStart(2, '0')}:${String(elapsedSecRem).padStart(2, '0')}`;

  // ── Layout constants ─────────────────────────────────────────────────────
  const leftW = width * 0.30;
  const centerW = width * 0.50;
  const rightW = width * 0.20;
  const pad = 8;

  // ── Waveform channel config ──────────────────────────────────────────────
  interface WaveChannel {
    label: string; color: string; value: string;
    hiAlarm: string; loAlarm: string;
    samples: number[]; amplitude: number;
  }
  const channels: WaveChannel[] = [
    { label: 'II ECG', color: C.ecgGreen, value: `${Math.round(heartRate)}`,
      hiAlarm: '120', loAlarm: '50', samples: waveformSamples.ecg, amplitude: 0.7 },
    { label: 'SpO2', color: C.spo2Cyan, value: `${Math.round(spo2)}%`,
      hiAlarm: '100', loAlarm: '90', samples: waveformSamples.spo2, amplitude: 0.8 },
    { label: 'ART', color: C.bpRed, value: `${Math.round(bpSys)}/${Math.round(bpDia)}`,
      hiAlarm: '180', loAlarm: '60', samples: waveformSamples.bp, amplitude: 0.7 },
    { label: 'CO2', color: C.respYellow, value: `${Math.round(respRate * 2.5)}`,
      hiAlarm: '50', loAlarm: '25', samples: waveformSamples.capno, amplitude: 0.75 },
    { label: 'BIS/EEG', color: C.anesthPurple, value: '47',
      hiAlarm: '60', loAlarm: '40', samples: waveformSamples.eeg, amplitude: 0.5 },
  ];

  const channelH = (height - 20) / channels.length;

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, fontFamily: MONO }}>

      {/* ── Monitor refresh scanline ────────────────────────────────────── */}
      <div style={{
        position: 'absolute', left: 0, top: scanlineY, width, height: 2,
        background: `linear-gradient(90deg, transparent, rgba(${hexToRgb(colors.cyan)}, 0.03), transparent)`,
        zIndex: 50, pointerEvents: 'none',
      }} />

      {/* ── Alarm border flash ──────────────────────────────────────────── */}
      {alarmIntensity > 0 && (
        <div style={{
          position: 'absolute', inset: 0,
          border: `3px solid rgba(${hexToRgb(C.alarmRed)}, ${alarmIntensity * (0.5 + 0.5 * Math.sin(frame * 0.6))})`,
          zIndex: 60, pointerEvents: 'none',
        }} />
      )}

      {/* ════════════════════════════════════════════════════════════════════
          LEFT PANEL — Patient/System Summary (30%)
          ════════════════════════════════════════════════════════════════════ */}
      <div style={{
        position: 'absolute', left: 0, top: 0, width: leftW, height,
        opacity: panelEnter, transform: `translateX(${(1 - panelEnter) * -20}px)`,
        display: 'flex', flexDirection: 'column', padding: pad,
        gap: 6,
      }}>
        {/* Patient header */}
        <div style={{
          background: C.panelBg, border: `1px solid ${C.panelBorder}`,
          borderRadius: 2, padding: '8px 12px',
        }}>
          <div style={{ color: C.textSecondary, fontSize: 10, letterSpacing: 2 }}>PATIENT</div>
          <div style={{ color: C.textPrimary, fontSize: 16, fontFamily: SANS, fontWeight: 600 }}>
            c9-operator
          </div>
          <div style={{ color: C.textMuted, fontSize: 10, marginTop: 2 }}>
            MRN: C9-OPR-2026 | DOB: 2024-01-01 | M
          </div>
        </div>

        {/* Vital signs large readout */}
        <div style={{
          background: C.panelBg, border: `1px solid ${C.panelBorder}`,
          borderRadius: 2, padding: '8px 10px', flex: 1,
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          <div style={{ color: C.textSecondary, fontSize: 9, letterSpacing: 2, marginBottom: 4 }}>
            VITAL SIGNS
          </div>

          {/* HR */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ color: C.ecgGreen, fontSize: 10, width: 36 }}>HR</span>
            <span style={{
              color: isAlarm ? C.alarmRed : C.ecgGreen, fontSize: 36, fontWeight: 700,
              textShadow: isRPeak ? `0 0 12px ${C.ecgGreen}` : 'none',
              transition: 'text-shadow 0.05s',
            }}>
              {Math.round(heartRate)}
            </span>
            <span style={{ color: C.textMuted, fontSize: 10 }}>bpm</span>
          </div>

          {/* SpO2 */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ color: C.spo2Cyan, fontSize: 10, width: 36 }}>SpO2</span>
            <span style={{
              color: isAlarm ? C.respYellow : C.spo2Cyan, fontSize: 30, fontWeight: 700,
            }}>
              {Math.round(spo2)}
            </span>
            <span style={{ color: C.textMuted, fontSize: 10 }}>%</span>
          </div>

          {/* BP */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ color: C.bpRed, fontSize: 10, width: 36 }}>BP</span>
            <span style={{ color: C.bpRed, fontSize: 26, fontWeight: 700 }}>
              {Math.round(bpSys)}/{Math.round(bpDia)}
            </span>
            <span style={{ color: C.textMuted, fontSize: 10 }}>mmHg</span>
          </div>

          {/* TEMP */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ color: C.tempWhite, fontSize: 10, width: 36 }}>TEMP</span>
            <span style={{ color: C.tempWhite, fontSize: 22, fontWeight: 600 }}>
              {temp.toFixed(1)}
            </span>
            <span style={{ color: C.textMuted, fontSize: 10 }}>C</span>
          </div>

          {/* RR */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ color: C.respYellow, fontSize: 10, width: 36 }}>RR</span>
            <span style={{ color: C.respYellow, fontSize: 22, fontWeight: 600 }}>
              {Math.round(respRate)}
            </span>
            <span style={{ color: C.textMuted, fontSize: 10 }}>/min</span>
          </div>
        </div>

        {/* Surgical team roster */}
        <div style={{
          background: C.panelBg, border: `1px solid ${C.panelBorder}`,
          borderRadius: 2, padding: '8px 10px',
        }}>
          <div style={{ color: C.textSecondary, fontSize: 9, letterSpacing: 2, marginBottom: 6 }}>
            SURGICAL TEAM
          </div>
          {team.map((m) => (
            <div key={m.role} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '3px 0', borderBottom: `1px solid ${C.panelBorder}`,
            }}>
              {/* Status LED */}
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: m.color,
                boxShadow: `0 0 4px ${m.color}`,
              }} />
              <div style={{ flex: 1 }}>
                <div style={{ color: m.color, fontSize: 10, fontWeight: 600 }}>{m.role}</div>
                <div style={{ color: C.textMuted, fontSize: 9 }}>{m.name}</div>
              </div>
              <div style={{ color: C.nominalGreen, fontSize: 8 }}>ACTIVE</div>
            </div>
          ))}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          CENTER — Waveform Monitor Stack (50%)
          ════════════════════════════════════════════════════════════════════ */}
      <svg
        viewBox={`0 0 ${centerW} ${height}`}
        style={{
          position: 'absolute', left: leftW, top: 0,
          width: centerW, height,
          opacity: panelEnter,
        }}
      >
        {/* Background grid */}
        {Array.from({ length: Math.ceil(centerW / 20) }, (_, i) => (
          <line key={`gv${i}`} x1={i * 20} y1={0} x2={i * 20} y2={height}
            stroke={C.gridLine} strokeWidth={i % 5 === 0 ? 0.6 : 0.3} />
        ))}
        {Array.from({ length: Math.ceil(height / 20) }, (_, i) => (
          <line key={`gh${i}`} x1={0} y1={i * 20} x2={centerW} y2={i * 20}
            stroke={C.gridLine} strokeWidth={i % 5 === 0 ? 0.6 : 0.3} />
        ))}

        {/* Channel waveforms */}
        {channels.map((ch, idx) => {
          const cy = idx * channelH;
          const waveY = cy + 20;
          const waveH = channelH - 30;
          const path = buildWaveformPath(ch.samples, 60, waveY, centerW - 80, waveH, ch.amplitude);

          // Channel alarm highlight
          const chAlarm = idx === 0 && isAlarm;

          return (
            <g key={ch.label}>
              {/* Channel divider */}
              {idx > 0 && (
                <line x1={0} y1={cy} x2={centerW} y2={cy}
                  stroke={C.panelBorder} strokeWidth={0.5} />
              )}

              {/* Channel label */}
              <text x={4} y={cy + 14} fill={ch.color} fontSize={10}
                fontFamily={MONO} fontWeight={600}>
                {ch.label}
              </text>

              {/* Alarm limits */}
              <text x={centerW - 30} y={cy + 14} fill={C.textMuted} fontSize={8}
                fontFamily={MONO} textAnchor="end">
                {ch.hiAlarm}
              </text>
              <text x={centerW - 30} y={cy + channelH - 4} fill={C.textMuted} fontSize={8}
                fontFamily={MONO} textAnchor="end">
                {ch.loAlarm}
              </text>

              {/* Current value */}
              <text x={centerW - 6} y={cy + channelH / 2 + 8} fill={chAlarm ? C.alarmRed : ch.color}
                fontSize={22} fontFamily={MONO} fontWeight={700} textAnchor="end">
                {ch.value}
              </text>

              {/* Waveform glow (afterglow trail) */}
              <path d={path} fill="none" stroke={ch.color} strokeWidth={3}
                opacity={0.15} filter="url(#waveGlow)" />

              {/* Waveform main trace */}
              <path d={path} fill="none" stroke={ch.color}
                strokeWidth={chAlarm ? 2.0 : 1.4}
                opacity={chAlarm ? (0.7 + 0.3 * Math.sin(frame * 0.5)) : 0.9} />

              {/* R-peak flash for ECG */}
              {idx === 0 && isRPeak && (
                <circle cx={centerW - 80} cy={waveY + waveH * 0.2}
                  r={4} fill={C.ecgGreen} opacity={0.6}>
                </circle>
              )}

              {/* Alarm text overlay */}
              {chAlarm && (
                <text x={centerW / 2} y={cy + channelH / 2}
                  fill={C.alarmRed} fontSize={14} fontFamily={SANS} fontWeight={700}
                  textAnchor="middle"
                  opacity={0.5 + 0.5 * Math.sin(frame * 0.8)}>
                  BRADYCARDIA
                </text>
              )}
            </g>
          );
        })}

        {/* SVG filter for waveform glow */}
        <defs>
          <filter id="waveGlow">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>
      </svg>

      {/* ════════════════════════════════════════════════════════════════════
          RIGHT PANEL — Procedure/Tasks (20%)
          ════════════════════════════════════════════════════════════════════ */}
      <div style={{
        position: 'absolute', right: 0, top: 0, width: rightW, height,
        opacity: panelEnter, transform: `translateX(${(1 - panelEnter) * 20}px)`,
        display: 'flex', flexDirection: 'column', padding: pad,
        gap: 6,
      }}>
        {/* Phase indicator */}
        <div style={{
          background: C.panelBg, border: `1px solid ${C.panelBorder}`,
          borderRadius: 2, padding: '8px 10px',
        }}>
          <div style={{ color: C.textSecondary, fontSize: 9, letterSpacing: 2 }}>
            PROCEDURE PHASE
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
            {phases.map((ph) => {
              const active = phase === ph.label;
              return (
                <div key={ph.label} style={{
                  flex: 1, textAlign: 'center', padding: '4px 2px',
                  background: active ? `rgba(${hexToRgb(C.ecgGreen)}, 0.15)` : 'transparent',
                  border: `1px solid ${active ? C.ecgGreen : C.panelBorder}`,
                  borderRadius: 2,
                }}>
                  <span style={{
                    color: active ? C.ecgGreen : C.textMuted,
                    fontSize: 8, fontWeight: active ? 700 : 400,
                  }}>
                    {ph.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Elapsed time */}
        <div style={{
          background: C.panelBg, border: `1px solid ${C.panelBorder}`,
          borderRadius: 2, padding: '8px 10px', textAlign: 'center',
        }}>
          <div style={{ color: C.textSecondary, fontSize: 9, letterSpacing: 2 }}>
            ELAPSED
          </div>
          <div style={{ color: C.textPrimary, fontSize: 28, fontWeight: 700, marginTop: 2 }}>
            {elapsedStr}
          </div>
        </div>

        {/* Surgical checklist */}
        <div style={{
          background: C.panelBg, border: `1px solid ${C.panelBorder}`,
          borderRadius: 2, padding: '8px 10px', flex: 1, overflow: 'hidden',
        }}>
          <div style={{ color: C.textSecondary, fontSize: 9, letterSpacing: 2, marginBottom: 6 }}>
            SURGICAL CHECKLIST
          </div>
          {checklist.map((item) => {
            const done = frame >= item.completeFrame;
            const justDone = frame >= item.completeFrame && frame < item.completeFrame + 10;
            return (
              <div key={item.label} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '3px 0', fontSize: 10,
                opacity: done ? 1 : 0.5,
              }}>
                <div style={{
                  width: 10, height: 10, borderRadius: 2,
                  border: `1px solid ${done ? C.nominalGreen : C.textMuted}`,
                  background: done ? `rgba(${hexToRgb(C.nominalGreen)}, 0.2)` : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: justDone ? `0 0 6px ${C.nominalGreen}` : 'none',
                }}>
                  {done && (
                    <svg width={7} height={7} viewBox="0 0 10 10">
                      <path d="M2 5 L4 7 L8 3" stroke={C.nominalGreen} strokeWidth={2}
                        fill="none" />
                    </svg>
                  )}
                </div>
                <span style={{
                  color: done ? C.textPrimary : C.textMuted,
                  textDecoration: done ? 'none' : 'none',
                }}>
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Medication log */}
        <div style={{
          background: C.panelBg, border: `1px solid ${C.panelBorder}`,
          borderRadius: 2, padding: '8px 10px', flex: 1, overflow: 'hidden',
        }}>
          <div style={{ color: C.textSecondary, fontSize: 9, letterSpacing: 2, marginBottom: 6 }}>
            MEDICATION LOG
          </div>
          {medications.filter(m => frame >= m.frame).map((m) => {
            const isNew = frame >= m.frame && frame < m.frame + 15;
            return (
              <div key={m.drug} style={{
                padding: '2px 0', fontSize: 9, borderBottom: `1px solid ${C.panelBorder}`,
                opacity: isNew
                  ? interpolate(frame, [m.frame, m.frame + 8], [0, 1], {
                      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
                    })
                  : 1,
              }}>
                <span style={{ color: C.textMuted }}>{m.time}</span>
                <span style={{ color: C.anesthPurple, marginLeft: 6 }}>{m.drug}</span>
                <span style={{ color: C.textSecondary, marginLeft: 4 }}>{m.dose}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Alarm overlay text ──────────────────────────────────────────── */}
      {isAlarm && (
        <div style={{
          position: 'absolute', left: leftW, top: 4, width: centerW,
          textAlign: 'center', zIndex: 55, pointerEvents: 'none',
        }}>
          <span style={{
            color: C.alarmRed, fontSize: 14, fontFamily: SANS, fontWeight: 700,
            letterSpacing: 3,
            opacity: 0.5 + 0.5 * Math.sin(frame * 0.6),
            textShadow: `0 0 8px ${C.alarmRed}`,
          }}>
            ALARM — HR LOW
          </span>
        </div>
      )}

      {/* ── Beep indicator (visual) ─────────────────────────────────────── */}
      {isRPeak && (
        <div style={{
          position: 'absolute', left: leftW + 4, top: 4,
          width: 8, height: 8, borderRadius: '50%',
          background: C.ecgGreen,
          boxShadow: `0 0 6px ${C.ecgGreen}`,
          zIndex: 55,
        }} />
      )}

      {/* ── Phosphor glow overlay ───────────────────────────────────────── */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 40,
        background: `radial-gradient(ellipse at 55% 50%, rgba(${hexToRgb(C.ecgGreen)}, 0.015) 0%, transparent 70%)`,
      }} />

      {/* ── Number flash effect on value changes ────────────────────────── */}
      {frame % 30 === 0 && (
        <div style={{
          position: 'absolute', left: 0, top: 0, width: leftW, height,
          background: `rgba(${hexToRgb(colors.cyan)}, 0.01)`,
          pointerEvents: 'none', zIndex: 45,
        }} />
      )}

    </AbsoluteFill>
  );
};

export default SurgicalTheater;
