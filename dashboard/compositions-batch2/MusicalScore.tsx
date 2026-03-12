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

interface MusicalNote {
  id: string;
  label: string;
  sublabel: string;
  staff: 'treble' | 'bass';
  /** Vertical position: line/space index from bottom of staff (0=bottom line, 8=top line) */
  staffPos: number;
  /** Horizontal measure position (beat within the score, 0-based) */
  beat: number;
  noteType: 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth';
  color: string;
  fermata?: boolean;
  accent?: boolean;
  dynamic?: string;
  rehearsalMark?: string;
}

interface MusicalPhrase {
  from: string;
  to: string;
  type: 'slur' | 'tie' | 'beam' | 'crescendo';
  color: string;
}

// ── Musical Score ───────────────────────────────────────────────────────────

export const MusicalScore: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // ── Layout constants ─────────────────────────────────────────────────────

  const marginLeft = 130;
  const marginRight = 60;
  const scoreWidth = width - marginLeft - marginRight;
  const staffSpacing = 10; // between lines
  const trebleTop = height * 0.28;
  const bassTop = trebleTop + staffSpacing * 4 + 70;
  const totalBeats = 32; // 8 measures of 4/4
  const beatWidth = scoreWidth / totalBeats;

  // ── Parchment foxing spots ───────────────────────────────────────────────

  const foxingSpots = useMemo(() => {
    const rng = seededRandom(55);
    return Array.from({ length: 60 }, () => ({
      x: rng() * width,
      y: rng() * height,
      r: rng() * 15 + 5,
      opacity: rng() * 0.04 + 0.01,
    }));
  }, [width, height]);

  // ── Helper: beat → x coordinate ──────────────────────────────────────────

  const beatToX = (beat: number): number => marginLeft + beat * beatWidth;

  // ── Helper: staff position → y coordinate ────────────────────────────────

  const staffPosToY = (staff: 'treble' | 'bass', pos: number): number => {
    const baseY = staff === 'treble' ? trebleTop : bassTop;
    // pos 0 = bottom line, each step = half a staffSpacing
    return baseY + staffSpacing * 4 - pos * (staffSpacing / 2);
  };

  // ── Playhead position ────────────────────────────────────────────────────

  const playheadBeat = interpolate(frame, [10, 150], [0, totalBeats], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const playheadX = beatToX(playheadBeat);

  // ── Note definitions ─────────────────────────────────────────────────────

  const notes: MusicalNote[] = [
    // TREBLE CLEF
    {
      id: 'api', label: 'API Gateway', sublabel: 'sfz',
      staff: 'treble', staffPos: 10, beat: 1,
      noteType: 'quarter', color: colors.blue,
      accent: true, dynamic: 'ff', rehearsalMark: 'A',
    },
    {
      id: 'operator', label: 'c9-operator', sublabel: 'fermata',
      staff: 'treble', staffPos: 4, beat: 5,
      noteType: 'whole', color: colors.cyan,
      fermata: true, dynamic: 'mf', rehearsalMark: 'B',
    },
    {
      id: 'hub1', label: 'Hub', sublabel: 'broadcast run',
      staff: 'treble', staffPos: 7, beat: 12,
      noteType: 'eighth', color: colors.green,
    },
    {
      id: 'hub2', label: 'Hub', sublabel: '',
      staff: 'treble', staffPos: 8, beat: 13,
      noteType: 'eighth', color: colors.green,
    },
    {
      id: 'hub3', label: 'Hub', sublabel: '',
      staff: 'treble', staffPos: 6, beat: 14,
      noteType: 'eighth', color: colors.green,
    },
    {
      id: 'hub4', label: 'Hub', sublabel: '',
      staff: 'treble', staffPos: 9, beat: 15,
      noteType: 'eighth', color: colors.green,
      rehearsalMark: 'C',
    },
    {
      id: 'dashboard1', label: 'Dashboard', sublabel: 'chord',
      staff: 'treble', staffPos: 4, beat: 28,
      noteType: 'half', color: colors.textDim,
    },
    {
      id: 'dashboard2', label: '', sublabel: '',
      staff: 'treble', staffPos: 7, beat: 28,
      noteType: 'half', color: colors.textDim,
    },
    {
      id: 'dashboard3', label: '', sublabel: '',
      staff: 'treble', staffPos: 10, beat: 28,
      noteType: 'half', color: colors.textDim,
      dynamic: 'fff',
    },

    // BASS CLEF
    {
      id: 'broker1', label: 'Broker', sublabel: 'walking bass',
      staff: 'bass', staffPos: 6, beat: 9,
      noteType: 'quarter', color: colors.purple,
    },
    {
      id: 'broker2', label: '', sublabel: '',
      staff: 'bass', staffPos: 5, beat: 10,
      noteType: 'quarter', color: colors.purple,
    },
    {
      id: 'broker3', label: '', sublabel: '',
      staff: 'bass', staffPos: 4, beat: 11,
      noteType: 'quarter', color: colors.purple,
    },
    {
      id: 'broker4', label: '', sublabel: '',
      staff: 'bass', staffPos: 3, beat: 12,
      noteType: 'quarter', color: colors.purple,
    },
    {
      id: 'agent1', label: 'Agent \u03b1', sublabel: '',
      staff: 'bass', staffPos: 7, beat: 18,
      noteType: 'sixteenth', color: colors.amber,
    },
    {
      id: 'agent2', label: 'Agent \u03b2', sublabel: '',
      staff: 'bass', staffPos: 6, beat: 19,
      noteType: 'sixteenth', color: colors.amber,
    },
    {
      id: 'agent3', label: 'Agent \u03b3', sublabel: '',
      staff: 'bass', staffPos: 8, beat: 20,
      noteType: 'sixteenth', color: colors.amber,
    },
    {
      id: 'agent4', label: 'Agent \u03b4', sublabel: 'spawned',
      staff: 'bass', staffPos: 5, beat: 21,
      noteType: 'sixteenth', color: colors.rose,
      dynamic: 'fp',
    },
    {
      id: 'projects1', label: 'Projects', sublabel: 'sustained',
      staff: 'bass', staffPos: 2, beat: 2,
      noteType: 'whole', color: colors.textDim,
    },
    {
      id: 'projects2', label: '', sublabel: '',
      staff: 'bass', staffPos: 2, beat: 6,
      noteType: 'whole', color: colors.textDim,
    },
  ];

  const noteMap = Object.fromEntries(notes.map((n) => [n.id, n]));

  // ── Phrases (connections rendered as musical notation) ────────────────────

  const phrases: MusicalPhrase[] = [
    { from: 'api', to: 'operator', type: 'slur', color: colors.blue },
    { from: 'operator', to: 'hub1', type: 'slur', color: colors.green },
    { from: 'hub1', to: 'hub2', type: 'beam', color: colors.green },
    { from: 'hub2', to: 'hub3', type: 'beam', color: colors.green },
    { from: 'hub3', to: 'hub4', type: 'beam', color: colors.green },
    { from: 'hub4', to: 'dashboard1', type: 'slur', color: colors.textDim },
    { from: 'broker1', to: 'broker2', type: 'slur', color: colors.purple },
    { from: 'broker2', to: 'broker3', type: 'slur', color: colors.purple },
    { from: 'broker3', to: 'broker4', type: 'slur', color: colors.purple },
    { from: 'agent1', to: 'agent2', type: 'beam', color: colors.amber },
    { from: 'agent2', to: 'agent3', type: 'beam', color: colors.amber },
    { from: 'agent3', to: 'agent4', type: 'beam', color: colors.amber },
    { from: 'projects1', to: 'projects2', type: 'tie', color: colors.textDim },
    { from: 'broker4', to: 'agent1', type: 'crescendo', color: colors.amber },
  ];

  // ── Render: staff lines ──────────────────────────────────────────────────

  const renderStaff = (baseY: number, clefType: 'treble' | 'bass') => {
    const staffFade = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
    return (
      <g opacity={staffFade}>
        {/* Five staff lines */}
        {Array.from({ length: 5 }, (_, i) => (
          <line
            key={`staff-${clefType}-${i}`}
            x1={marginLeft - 10}
            y1={baseY + i * staffSpacing}
            x2={width - marginRight + 10}
            y2={baseY + i * staffSpacing}
            stroke="#5c4a3a"
            strokeWidth={0.8}
            opacity={0.6}
          />
        ))}
        {/* Clef symbol */}
        <text
          x={marginLeft - 5}
          y={baseY + (clefType === 'treble' ? staffSpacing * 3.2 : staffSpacing * 1.8)}
          fontSize={clefType === 'treble' ? 52 : 36}
          fill="#5c4a3a"
          fontFamily="serif"
          opacity={0.7}
        >
          {clefType === 'treble' ? '\ud834\udd1e' : '\ud834\udd22'}
        </text>
        {/* Key signature: D major — 2 sharps (F# and C#) */}
        {clefType === 'treble' && (
          <g>
            <text x={marginLeft + 25} y={baseY + staffSpacing * 0.5 + 4} fontSize={16} fill="#5c4a3a" fontFamily="serif" opacity={0.6}>
              {'#'}
            </text>
            <text x={marginLeft + 35} y={baseY + staffSpacing * 1.5 + 4} fontSize={16} fill="#5c4a3a" fontFamily="serif" opacity={0.6}>
              {'#'}
            </text>
          </g>
        )}
        {clefType === 'bass' && (
          <g>
            <text x={marginLeft + 25} y={baseY + staffSpacing * 1 + 4} fontSize={16} fill="#5c4a3a" fontFamily="serif" opacity={0.6}>
              {'#'}
            </text>
            <text x={marginLeft + 35} y={baseY + staffSpacing * 2 + 4} fontSize={16} fill="#5c4a3a" fontFamily="serif" opacity={0.6}>
              {'#'}
            </text>
          </g>
        )}
        {/* Time signature: 4/4 */}
        {clefType === 'treble' && (
          <g>
            <text
              x={marginLeft + 50} y={baseY + staffSpacing * 1.5 + 2}
              fontSize={20} fill="#5c4a3a" fontFamily="serif" fontWeight={700} opacity={0.7}
            >
              4
            </text>
            <text
              x={marginLeft + 50} y={baseY + staffSpacing * 3.5 + 2}
              fontSize={20} fill="#5c4a3a" fontFamily="serif" fontWeight={700} opacity={0.7}
            >
              4
            </text>
          </g>
        )}
      </g>
    );
  };

  // ── Render: bar lines ────────────────────────────────────────────────────

  const renderBarlines = () => {
    const barlineFade = interpolate(frame, [5, 20], [0, 1], { extrapolateRight: 'clamp' });
    const measures = 8;
    const beatsPerMeasure = 4;
    return (
      <g opacity={barlineFade * 0.5}>
        {Array.from({ length: measures + 1 }, (_, mi) => {
          const beat = mi * beatsPerMeasure;
          const bx = beatToX(beat);
          const isLast = mi === measures;
          const isFirst = mi === 0;
          return (
            <g key={`bar-${mi}`}>
              {/* Bar line through both staves */}
              <line
                x1={bx} y1={trebleTop}
                x2={bx} y2={bassTop + staffSpacing * 4}
                stroke="#5c4a3a"
                strokeWidth={isLast ? 2.5 : isFirst ? 1.5 : 0.8}
                opacity={isLast ? 0.8 : 0.5}
              />
              {/* Double bar at end */}
              {isLast && (
                <line
                  x1={bx - 5} y1={trebleTop}
                  x2={bx - 5} y2={bassTop + staffSpacing * 4}
                  stroke="#5c4a3a" strokeWidth={0.8} opacity={0.5}
                />
              )}
              {/* Measure number */}
              {!isFirst && !isLast && (
                <text
                  x={bx + 4} y={trebleTop - 12}
                  fill="#5c4a3a" fontSize={8}
                  fontFamily="'IBM Plex Mono', monospace"
                  opacity={0.4}
                >
                  {mi + 1}
                </text>
              )}
            </g>
          );
        })}
        {/* Grand staff brace */}
        <path
          d={`M ${marginLeft - 15} ${trebleTop} C ${marginLeft - 35} ${(trebleTop + bassTop + staffSpacing * 4) / 2 - 20}, ${marginLeft - 35} ${(trebleTop + bassTop + staffSpacing * 4) / 2 + 20}, ${marginLeft - 15} ${bassTop + staffSpacing * 4}`}
          fill="none" stroke="#5c4a3a" strokeWidth={2.5} opacity={0.5}
        />
        <circle
          cx={marginLeft - 25}
          cy={(trebleTop + bassTop + staffSpacing * 4) / 2}
          r={2}
          fill="#5c4a3a"
          opacity={0.4}
        />
      </g>
    );
  };

  // ── Render: note ─────────────────────────────────────────────────────────

  const renderNote = (note: MusicalNote) => {
    const nx = beatToX(note.beat);
    const ny = staffPosToY(note.staff, note.staffPos);

    // Is this note "played" (playhead has passed it)?
    const isPlayed = playheadBeat >= note.beat;
    const isActive = Math.abs(playheadBeat - note.beat) < 1.5;

    // Fermata pause effect: slow playhead near operator
    const baseOpacity = isPlayed ? 1 : 0.25;
    const glowAmount = isActive ? 1 : 0;

    // Spring for active glow
    const activeSpring = spring({
      frame: isActive ? frame : 0,
      fps,
      config: { damping: 20, stiffness: 120 },
    });

    // Note head dimensions
    const noteW = 7;
    const noteH = 5;
    const isFilled = note.noteType !== 'whole' && note.noteType !== 'half';
    const hasStem = note.noteType !== 'whole';
    const stemUp = note.staffPos < 5;

    // Ledger lines if note is above/below staff
    const ledgerLines: number[] = [];
    const baseStaffTop = note.staff === 'treble' ? trebleTop : bassTop;
    if (note.staffPos > 8) {
      for (let lp = 10; lp <= note.staffPos; lp += 2) {
        ledgerLines.push(baseStaffTop - (lp - 8) * (staffSpacing / 2));
      }
    }
    if (note.staffPos < 0) {
      for (let lp = -2; lp >= note.staffPos; lp -= 2) {
        ledgerLines.push(baseStaffTop + staffSpacing * 4 - lp * (staffSpacing / 2));
      }
    }

    // Flag count for eighth/sixteenth
    const flagCount = note.noteType === 'sixteenth' ? 2 : note.noteType === 'eighth' ? 1 : 0;

    return (
      <g key={note.id} opacity={baseOpacity}>
        {/* Ledger lines */}
        {ledgerLines.map((ly, li) => (
          <line
            key={`ledger-${note.id}-${li}`}
            x1={nx - 10} y1={ly}
            x2={nx + 10} y2={ly}
            stroke="#5c4a3a" strokeWidth={0.8} opacity={0.5}
          />
        ))}

        {/* Active glow ring */}
        {isActive && (
          <circle
            cx={nx} cy={ny}
            r={12 + activeSpring * 8}
            fill={`rgba(${hexToRgb(note.color)}, ${glowAmount * 0.15})`}
            stroke={note.color}
            strokeWidth={1}
            opacity={glowAmount * 0.5}
          />
        )}

        {/* Sound wave emanation */}
        {isActive && (
          <g>
            {Array.from({ length: 3 }, (_, wi) => {
              const waveR = 15 + wi * 12 + activeSpring * 10;
              const waveOpacity = interpolate(activeSpring, [0, 1], [0.3, 0], { extrapolateRight: 'clamp' });
              return (
                <circle
                  key={`wave-${note.id}-${wi}`}
                  cx={nx} cy={ny - 20 - wi * 8}
                  r={waveR}
                  fill="none"
                  stroke={note.color}
                  strokeWidth={0.5}
                  opacity={waveOpacity * (1 - wi * 0.3)}
                />
              );
            })}
          </g>
        )}

        {/* Note head */}
        <ellipse
          cx={nx} cy={ny}
          rx={noteW} ry={noteH}
          fill={isFilled ? (isPlayed ? note.color : '#5c4a3a') : 'none'}
          stroke={isPlayed ? note.color : '#5c4a3a'}
          strokeWidth={1.5}
          transform={`rotate(-15, ${nx}, ${ny})`}
        />

        {/* Stem */}
        {hasStem && (
          <line
            x1={stemUp ? nx + noteW - 1 : nx - noteW + 1}
            y1={ny}
            x2={stemUp ? nx + noteW - 1 : nx - noteW + 1}
            y2={stemUp ? ny - 30 : ny + 30}
            stroke={isPlayed ? note.color : '#5c4a3a'}
            strokeWidth={1.2}
          />
        )}

        {/* Flags */}
        {flagCount > 0 && (
          <g>
            {Array.from({ length: flagCount }, (_, fi) => {
              const stemX = stemUp ? nx + noteW - 1 : nx - noteW + 1;
              const stemEndY = stemUp ? ny - 30 : ny + 30;
              const flagDir = stemUp ? 1 : -1;
              const flagY = stemEndY + fi * 6 * flagDir;
              return (
                <path
                  key={`flag-${note.id}-${fi}`}
                  d={`M ${stemX} ${flagY} Q ${stemX + 12 * (stemUp ? 1 : -1)} ${flagY + 8 * flagDir} ${stemX + 6} ${flagY + 14 * flagDir}`}
                  fill="none"
                  stroke={isPlayed ? note.color : '#5c4a3a'}
                  strokeWidth={1.2}
                />
              );
            })}
          </g>
        )}

        {/* Fermata */}
        {note.fermata && (
          <g>
            <path
              d={`M ${nx - 10} ${ny - 42} Q ${nx} ${ny - 56} ${nx + 10} ${ny - 42}`}
              fill="none"
              stroke={isPlayed ? note.color : '#5c4a3a'}
              strokeWidth={1.5}
            />
            <circle
              cx={nx} cy={ny - 42}
              r={1.5}
              fill={isPlayed ? note.color : '#5c4a3a'}
            />
          </g>
        )}

        {/* Accent mark */}
        {note.accent && (
          <text
            x={nx} y={ny - (stemUp ? 38 : -32)}
            textAnchor="middle"
            fill={isPlayed ? note.color : '#5c4a3a'}
            fontSize={16} fontWeight={700}
          >
            {'>'}
          </text>
        )}

        {/* Dynamic marking */}
        {note.dynamic && (
          <text
            x={nx}
            y={(note.staff === 'treble' ? trebleTop : bassTop) + staffSpacing * 4 + 22}
            textAnchor="middle"
            fill={isPlayed ? note.color : '#7a6a5a'}
            fontSize={12}
            fontFamily="serif"
            fontStyle="italic"
            fontWeight={700}
            opacity={isPlayed ? 0.8 : 0.4}
          >
            {note.dynamic}
          </text>
        )}

        {/* Rehearsal mark */}
        {note.rehearsalMark && (
          <g>
            <rect
              x={nx - 8} y={trebleTop - 35}
              width={16} height={16}
              rx={2}
              fill="none"
              stroke="#5c4a3a"
              strokeWidth={1.5}
              opacity={0.6}
            />
            <text
              x={nx} y={trebleTop - 22}
              textAnchor="middle"
              fill={isPlayed ? note.color : '#5c4a3a'}
              fontSize={12}
              fontFamily="serif"
              fontWeight={700}
              opacity={0.7}
            >
              {note.rehearsalMark}
            </text>
          </g>
        )}

        {/* Component label (below bass staff or above treble staff) */}
        {note.label && (
          <text
            x={nx}
            y={note.staff === 'bass'
              ? bassTop + staffSpacing * 4 + 40
              : trebleTop - 45}
            textAnchor="middle"
            fill={isPlayed ? note.color : '#7a6a5a'}
            fontSize={9}
            fontFamily="'Outfit', 'DM Sans', sans-serif"
            fontWeight={600}
            letterSpacing={0.5}
            opacity={isPlayed ? 0.8 : 0.3}
          >
            {note.label}
          </text>
        )}
        {note.sublabel && (
          <text
            x={nx}
            y={note.staff === 'bass'
              ? bassTop + staffSpacing * 4 + 52
              : trebleTop - 55}
            textAnchor="middle"
            fill={colors.textMuted}
            fontSize={7}
            fontFamily="'IBM Plex Mono', monospace"
            fontStyle="italic"
            opacity={isPlayed ? 0.6 : 0.2}
          >
            {note.sublabel}
          </text>
        )}
      </g>
    );
  };

  // ── Render: phrases (slurs, ties, beams, crescendos) ─────────────────────

  const renderPhrase = (phrase: MusicalPhrase, i: number) => {
    const fromN = noteMap[phrase.from];
    const toN = noteMap[phrase.to];
    if (!fromN || !toN) return null;

    const fx = beatToX(fromN.beat);
    const fy = staffPosToY(fromN.staff, fromN.staffPos);
    const tx = beatToX(toN.beat);
    const ty = staffPosToY(toN.staff, toN.staffPos);

    const midBeat = (fromN.beat + toN.beat) / 2;
    const isPlayed = playheadBeat >= midBeat;
    const phraseOpacity = isPlayed ? 0.6 : 0.2;

    if (phrase.type === 'slur' || phrase.type === 'tie') {
      const curveDir = fromN.staffPos > 4 ? -1 : 1;
      const curveAmount = Math.abs(tx - fx) * 0.3;
      const my = Math.min(fy, ty) + curveDir * curveAmount;
      return (
        <path
          key={`phrase-${i}`}
          d={`M ${fx} ${fy} Q ${(fx + tx) / 2} ${my} ${tx} ${ty}`}
          fill="none"
          stroke={isPlayed ? phrase.color : '#5c4a3a'}
          strokeWidth={phrase.type === 'tie' ? 1.5 : 1}
          opacity={phraseOpacity}
          strokeDasharray={phrase.type === 'tie' ? 'none' : 'none'}
        />
      );
    }

    if (phrase.type === 'beam') {
      // Beam connects stems
      const stemUp = fromN.staffPos < 5;
      const beamY1 = stemUp ? fy - 30 : fy + 30;
      const beamY2 = stemUp ? ty - 30 : ty + 30;
      const stemX1 = stemUp ? fx + 6 : fx - 6;
      const stemX2 = stemUp ? tx + 6 : tx - 6;

      // Double beam for sixteenth notes
      const isDouble = fromN.noteType === 'sixteenth' || toN.noteType === 'sixteenth';

      return (
        <g key={`phrase-${i}`} opacity={phraseOpacity}>
          <line
            x1={stemX1} y1={beamY1}
            x2={stemX2} y2={beamY2}
            stroke={isPlayed ? phrase.color : '#5c4a3a'}
            strokeWidth={3}
          />
          {isDouble && (
            <line
              x1={stemX1} y1={beamY1 + (stemUp ? 5 : -5)}
              x2={stemX2} y2={beamY2 + (stemUp ? 5 : -5)}
              stroke={isPlayed ? phrase.color : '#5c4a3a'}
              strokeWidth={3}
            />
          )}
        </g>
      );
    }

    if (phrase.type === 'crescendo') {
      const hairpinY = (fromN.staff === 'bass' ? bassTop : trebleTop) + staffSpacing * 4 + 18;
      return (
        <g key={`phrase-${i}`} opacity={phraseOpacity}>
          <line x1={fx} y1={hairpinY} x2={tx} y2={hairpinY - 5} stroke={isPlayed ? phrase.color : '#5c4a3a'} strokeWidth={1} />
          <line x1={fx} y1={hairpinY} x2={tx} y2={hairpinY + 5} stroke={isPlayed ? phrase.color : '#5c4a3a'} strokeWidth={1} />
        </g>
      );
    }

    return null;
  };

  // ── Title and tempo ──────────────────────────────────────────────────────

  const titleFade = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });

  // ── Playhead (vertical sweeping line) ────────────────────────────────────

  const playheadOpacity = interpolate(frame, [8, 15], [0, 0.8], { extrapolateRight: 'clamp' });

  // ── Fermata pause: slow the visual intensity near the operator ───────────

  const nearOperator = Math.abs(playheadBeat - 5) < 2;
  const fermataGlow = nearOperator
    ? interpolate(Math.abs(playheadBeat - 5), [0, 2], [1, 0], { extrapolateRight: 'clamp' })
    : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: '#f5eed6' }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <filter id="msGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="playheadGlow" x="-200%" y="-10%" width="500%" height="120%">
            <feGaussianBlur stdDeviation="12" result="glow" />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Parchment texture gradient */}
          <radialGradient id="parchmentBg" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#f5eed6" />
            <stop offset="100%" stopColor="#e8dfc0" />
          </radialGradient>
        </defs>

        {/* Background */}
        <rect width={width} height={height} fill="url(#parchmentBg)" />

        {/* Foxing spots (aged paper effect) */}
        {foxingSpots.map((spot, i) => (
          <circle
            key={`fox-${i}`}
            cx={spot.x} cy={spot.y}
            r={spot.r}
            fill="#b8a070"
            opacity={spot.opacity}
          />
        ))}

        {/* Edge darkening */}
        <rect
          width={width} height={height}
          fill="none" stroke="#8a7a5a" strokeWidth={30} opacity={0.06}
        />

        {/* Title block */}
        <g opacity={titleFade}>
          {/* Title */}
          <text
            x={width / 2} y={42}
            textAnchor="middle"
            fill="#3a2a1a"
            fontSize={24}
            fontFamily="'Georgia', 'Times New Roman', serif"
            fontStyle="italic"
            fontWeight={700}
          >
            c9-operator
          </text>
          <text
            x={width / 2} y={60}
            textAnchor="middle"
            fill="#6a5a4a"
            fontSize={12}
            fontFamily="'Georgia', 'Times New Roman', serif"
          >
            Op. 1
          </text>

          {/* Tempo marking — top left */}
          <text
            x={marginLeft} y={trebleTop - 60}
            fill="#3a2a1a"
            fontSize={11}
            fontFamily="'Georgia', 'Times New Roman', serif"
            fontStyle="italic"
            fontWeight={700}
          >
            {'Allegro operativo  \u2669= 120'}
          </text>

          {/* Composer credit — top right */}
          <text
            x={width - marginRight} y={42}
            textAnchor="end"
            fill="#6a5a4a"
            fontSize={10}
            fontFamily="'Georgia', 'Times New Roman', serif"
            fontStyle="italic"
          >
            arr. for Agent Orchestra
          </text>
        </g>

        {/* Staff lines */}
        {renderStaff(trebleTop, 'treble')}
        {renderStaff(bassTop, 'bass')}

        {/* Bar lines */}
        {renderBarlines()}

        {/* Musical phrases (slurs, ties, beams) */}
        {phrases.map(renderPhrase)}

        {/* Notes */}
        {notes.map(renderNote)}

        {/* Rests in empty measures — quarter rests scattered */}
        {[24, 25, 26, 27].map((restBeat) => {
          const rx = beatToX(restBeat);
          const ry = staffPosToY('bass', 4);
          const restPlayed = playheadBeat >= restBeat;
          return (
            <text
              key={`rest-${restBeat}`}
              x={rx} y={ry + 4}
              textAnchor="middle"
              fill={restPlayed ? '#3a2a1a' : '#b8a888'}
              fontSize={20}
              fontFamily="serif"
              opacity={restPlayed ? 0.6 : 0.25}
            >
              {'\ud834\udd3d'}
            </text>
          );
        })}

        {/* Playhead — sweeping vertical line */}
        <g opacity={playheadOpacity}>
          {/* Glow behind playhead */}
          <line
            x1={playheadX} y1={trebleTop - 20}
            x2={playheadX} y2={bassTop + staffSpacing * 4 + 20}
            stroke={colors.cyan}
            strokeWidth={8}
            opacity={0.1}
            filter="url(#playheadGlow)"
          />
          {/* Main playhead line */}
          <line
            x1={playheadX} y1={trebleTop - 15}
            x2={playheadX} y2={bassTop + staffSpacing * 4 + 15}
            stroke={colors.cyan}
            strokeWidth={1.5}
            opacity={0.7}
          />
          {/* Playhead arrow at top */}
          <polygon
            points={`${playheadX - 5},${trebleTop - 20} ${playheadX + 5},${trebleTop - 20} ${playheadX},${trebleTop - 12}`}
            fill={colors.cyan}
            opacity={0.6}
          />
        </g>

        {/* Fermata glow overlay on operator note */}
        {fermataGlow > 0 && (
          <g>
            <circle
              cx={beatToX(5)} cy={staffPosToY('treble', 4)}
              r={25 + fermataGlow * 15}
              fill={`rgba(${hexToRgb(colors.cyan)}, ${fermataGlow * 0.12})`}
              stroke={colors.cyan}
              strokeWidth={1}
              opacity={fermataGlow * 0.4}
              filter="url(#msGlow)"
            />
            {/* "Fermata hold" text */}
            <text
              x={beatToX(5)} y={staffPosToY('treble', 4) + 50}
              textAnchor="middle"
              fill={colors.cyan}
              fontSize={8}
              fontFamily="'IBM Plex Mono', monospace"
              fontStyle="italic"
              opacity={fermataGlow * 0.6}
            >
              ~ fermata hold ~
            </text>
          </g>
        )}

        {/* Agent spawn ripple — when playhead hits agent section */}
        {playheadBeat >= 18 && playheadBeat <= 22 && (
          <g>
            {[18, 19, 20, 21].map((aBeat) => {
              const aDelay = (playheadBeat - aBeat);
              if (aDelay < 0 || aDelay > 1.5) return null;
              const ax = beatToX(aBeat);
              const noteForBeat = notes.find((n) => n.beat === aBeat && n.staff === 'bass');
              if (!noteForBeat) return null;
              const ay = staffPosToY('bass', noteForBeat.staffPos);
              const ripple = aDelay / 1.5;
              return (
                <circle
                  key={`ripple-${aBeat}`}
                  cx={ax} cy={ay}
                  r={5 + ripple * 25}
                  fill="none"
                  stroke={noteForBeat.color}
                  strokeWidth={1.5 - ripple}
                  opacity={(1 - ripple) * 0.5}
                />
              );
            })}
          </g>
        )}

        {/* Staff labels */}
        <g opacity={titleFade}>
          <text
            x={30} y={trebleTop + staffSpacing * 2 + 4}
            fill="#6a5a4a"
            fontSize={9}
            fontFamily="'IBM Plex Mono', monospace"
            opacity={0.5}
          >
            Control
          </text>
          <text
            x={30} y={trebleTop + staffSpacing * 2 + 14}
            fill="#6a5a4a"
            fontSize={9}
            fontFamily="'IBM Plex Mono', monospace"
            opacity={0.5}
          >
            Plane
          </text>
          <text
            x={30} y={bassTop + staffSpacing * 2 + 4}
            fill="#6a5a4a"
            fontSize={9}
            fontFamily="'IBM Plex Mono', monospace"
            opacity={0.5}
          >
            Data
          </text>
          <text
            x={30} y={bassTop + staffSpacing * 2 + 14}
            fill="#6a5a4a"
            fontSize={9}
            fontFamily="'IBM Plex Mono', monospace"
            opacity={0.5}
          >
            Plane
          </text>
        </g>

        {/* Legend — bottom right */}
        <g opacity={titleFade} transform={`translate(${width - 200}, ${height - 100})`}>
          {[
            { color: colors.blue, label: 'API Gateway (sfz)' },
            { color: colors.cyan, label: 'c9-operator (fermata)' },
            { color: colors.green, label: 'Hub (eighth-note run)' },
            { color: colors.purple, label: 'Broker (walking bass)' },
            { color: colors.amber, label: 'Agents (sixteenth flurry)' },
            { color: colors.rose, label: 'Agent \u03b4 (spawned)' },
          ].map((item, i) => (
            <g key={`leg-${i}`} transform={`translate(0, ${i * 14})`}>
              <circle cx={6} cy={0} r={3} fill={item.color} opacity={0.7} />
              <text x={14} y={3} fill="#6a5a4a" fontSize={8} fontFamily="'IBM Plex Mono', monospace">
                {item.label}
              </text>
            </g>
          ))}
        </g>

        {/* Footer / subtitle */}
        <g opacity={titleFade}>
          <text
            x={width / 2} y={height - 20}
            textAnchor="middle"
            fill="#8a7a5a"
            fontSize={10}
            fontFamily="'IBM Plex Mono', monospace"
            letterSpacing={2}
          >
            EVENT-DRIVEN AGENT ORCHESTRATION
          </text>
        </g>
      </svg>
    </AbsoluteFill>
  );
};

export default MusicalScore;
