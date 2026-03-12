import React, { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../services/api';

interface FlightEntry {
  id: string;
  flightNumber: string; // star name as flight code
  destination: string; // project name
  status: 'ON TIME' | 'BOARDING' | 'IN FLIGHT' | 'LANDED' | 'DELAYED';
  statusColor: string;
  aircraftType: string; // model mapped to aircraft
  fuel: string; // cost
  distance: string; // turns
  gate: string;
  time: string;
  rawStatus: string;
}

const AMBER = '#ffbf00';
const GREEN = '#00ff41';
const RED = '#ff3333';
const BOARD_BG = '#0c0c0c';
const ROW_BG = '#111111';
const ROW_ALT = '#0a0a0a';
const BORDER = 'rgba(255,191,0,0.12)';

const MODEL_TO_AIRCRAFT: Record<string, string> = {
  'claude-opus-4-20250514': 'A380',
  'claude-sonnet-4-20250514': 'B737',
  'claude-haiku-3-20250307': 'CRJ9',
  'opus': 'A380',
  'sonnet': 'B737',
  'haiku': 'CRJ9',
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: 'IN FLIGHT', color: GREEN },
  idle: { label: 'ON TIME', color: AMBER },
  done: { label: 'LANDED', color: '#6e7681' },
  error: { label: 'DELAYED', color: RED },
};

const GATE_LETTERS = 'ABCDEFGH';

/**
 * FlightBoardPanel - Airport departures/arrivals split-flap display.
 * Amber monospace text on black background with flip animations.
 */
export function FlightBoardPanel() {
  const [flights, setFlights] = useState<FlightEntry[]>([]);
  const [boardType, setBoardType] = useState<'departures' | 'arrivals'>('departures');
  const [lastUpdate, setLastUpdate] = useState('--:--');
  const prevFlightsRef = useRef<Map<string, string>>(new Map());
  const [flipping, setFlipping] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/agents`);
        if (!resp.ok) throw new Error('fail');
        const raw: any[] = await resp.json();
        buildFlights(raw);
      } catch {
        buildFlights(buildDemoData());
      }
      setLastUpdate(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }));
    };

    function buildFlights(agents: any[]) {
      const prev = prevFlightsRef.current;
      const newFlipping = new Set<string>();

      const entries: FlightEntry[] = agents.map((a, i) => {
        const status = a.status || 'idle';
        const mapped = STATUS_MAP[status] || STATUS_MAP.idle;
        const model = a.model || '';
        const shortModel = Object.keys(MODEL_TO_AIRCRAFT).find(k => model.includes(k)) || model;
        const aircraft = MODEL_TO_AIRCRAFT[shortModel] || 'B737';
        const callsign = (a.star_name || `AGT${i}`).toUpperCase();
        const id = a.session_id || `a-${i}`;

        // Detect status change for flip animation
        if (prev.has(id) && prev.get(id) !== status) {
          newFlipping.add(id);
        }
        prev.set(id, status);

        return {
          id,
          flightNumber: `CL${callsign.slice(0, 3)}${String(i + 100).slice(-2)}`,
          destination: (a.project || 'UNKNOWN').toUpperCase(),
          status: mapped.label as FlightEntry['status'],
          statusColor: mapped.color,
          aircraftType: aircraft,
          fuel: `$${(a.estimated_cost || 0).toFixed(2)}`,
          distance: `${a.turns || 0}nm`,
          gate: `${GATE_LETTERS[i % GATE_LETTERS.length]}${Math.floor(Math.random() * 20 + 1)}`,
          time: formatTime(a.elapsed),
          rawStatus: status,
        };
      });

      setFlipping(newFlipping);
      setFlights(entries);

      // Clear flip animation after delay
      if (newFlipping.size > 0) {
        setTimeout(() => setFlipping(new Set()), 600);
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, []);

  const departures = flights.filter(f => f.rawStatus !== 'done');
  const arrivals = flights.filter(f => f.rawStatus === 'done' || f.rawStatus === 'idle');
  const displayFlights = boardType === 'departures' ? departures : arrivals;

  return (
    <div style={{
      width: '100%', height: '100%', minHeight: 350, position: 'relative',
      background: BOARD_BG, borderRadius: 4, overflow: 'hidden',
      fontFamily: "'JetBrains Mono', 'Courier New', monospace",
    }}>
      <style>{`
        @keyframes fb-flip-in {
          0% { transform: rotateX(90deg); opacity: 0; }
          100% { transform: rotateX(0); opacity: 1; }
        }
        @keyframes fb-flip-out {
          0% { transform: rotateX(0); opacity: 1; }
          50% { transform: rotateX(-90deg); opacity: 0; }
          100% { transform: rotateX(0); opacity: 1; }
        }
        @keyframes fb-scan { from { top: -2px; } to { top: 100%; } }
        @keyframes fb-glow-pulse { 0%,100% { text-shadow: 0 0 4px currentColor; } 50% { text-shadow: 0 0 12px currentColor; } }
        .fb-row { transition: background 0.3s ease; }
        .fb-row:hover { background: rgba(255,191,0,0.04) !important; }
        .fb-flip { animation: fb-flip-out 0.5s ease-in-out; perspective: 200px; }
        .fb-scroll::-webkit-scrollbar { width: 3px; }
        .fb-scroll::-webkit-scrollbar-track { background: transparent; }
        .fb-scroll::-webkit-scrollbar-thumb { background: rgba(255,191,0,0.15); border-radius: 2px; }
      `}</style>

      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 16px 8px',
        borderBottom: `1px solid ${BORDER}`,
        background: 'rgba(255,191,0,0.02)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Board type toggle */}
          <div style={{ display: 'flex', gap: 0 }}>
            {(['departures', 'arrivals'] as const).map(type => (
              <button
                key={type}
                onClick={() => setBoardType(type)}
                style={{
                  background: boardType === type ? 'rgba(255,191,0,0.15)' : 'transparent',
                  border: `1px solid ${boardType === type ? AMBER : 'rgba(255,191,0,0.2)'}`,
                  color: boardType === type ? AMBER : 'rgba(255,191,0,0.4)',
                  padding: '3px 12px',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  borderRadius: type === 'departures' ? '3px 0 0 3px' : '0 3px 3px 0',
                  textTransform: 'uppercase',
                  transition: 'all 0.2s',
                }}
              >
                {type}
              </button>
            ))}
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: AMBER, letterSpacing: '0.08em' }}>
            {boardType === 'departures' ? 'DEPARTURES' : 'ARRIVALS'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 9, color: 'rgba(255,191,0,0.4)' }}>
          <span>UPDATED {lastUpdate}</span>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: GREEN,
            boxShadow: `0 0 6px ${GREEN}`, display: 'inline-block',
            animation: 'fb-glow-pulse 2s ease-in-out infinite',
          }} />
        </div>
      </div>

      {/* Column headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '80px 1fr 100px 70px 60px 60px 60px',
        padding: '6px 16px',
        borderBottom: `1px solid ${BORDER}`,
        fontSize: 8,
        fontWeight: 700,
        color: 'rgba(255,191,0,0.35)',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
      }}>
        <span>FLIGHT</span>
        <span>{boardType === 'departures' ? 'DESTINATION' : 'ORIGIN'}</span>
        <span>STATUS</span>
        <span>A/C TYPE</span>
        <span>FUEL</span>
        <span>DIST</span>
        <span>TIME</span>
      </div>

      {/* Flight rows */}
      <div className="fb-scroll" style={{
        overflowY: 'auto', maxHeight: 'calc(100% - 72px)',
        position: 'relative',
      }}>
        {/* Scan line effect */}
        <div style={{
          position: 'absolute', left: 0, right: 0, height: 2, zIndex: 5,
          background: `linear-gradient(90deg, transparent, ${AMBER}40, transparent)`,
          animation: 'fb-scan 4s linear infinite',
          pointerEvents: 'none',
        }} />

        {displayFlights.length === 0 ? (
          <div style={{
            padding: '40px 0', textAlign: 'center',
            fontSize: 11, color: 'rgba(255,191,0,0.3)',
          }}>
            NO {boardType === 'departures' ? 'DEPARTURES' : 'ARRIVALS'} SCHEDULED
          </div>
        ) : (
          displayFlights.map((flight, i) => (
            <div
              key={flight.id}
              className={`fb-row ${flipping.has(flight.id) ? 'fb-flip' : ''}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '80px 1fr 100px 70px 60px 60px 60px',
                padding: '7px 16px',
                background: i % 2 === 0 ? ROW_BG : ROW_ALT,
                borderBottom: `1px solid rgba(255,191,0,0.04)`,
                fontSize: 11,
                alignItems: 'center',
                animationDelay: `${i * 40}ms`,
              }}
            >
              {/* Flight number */}
              <span style={{
                color: AMBER, fontWeight: 700, letterSpacing: '0.04em',
              }}>
                {flight.flightNumber}
              </span>

              {/* Destination/Origin */}
              <span style={{ color: '#e6edf3', fontWeight: 500 }}>
                {flight.destination}
              </span>

              {/* Status with indicator dot */}
              <span style={{
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: flight.statusColor,
                  boxShadow: `0 0 4px ${flight.statusColor}`,
                  flexShrink: 0,
                }} />
                <span style={{
                  color: flight.statusColor,
                  fontWeight: 600,
                  fontSize: 9,
                  letterSpacing: '0.06em',
                }}>
                  {flight.status}
                </span>
              </span>

              {/* Aircraft type */}
              <span style={{ color: 'rgba(255,191,0,0.5)', fontSize: 10 }}>
                {flight.aircraftType}
              </span>

              {/* Fuel (cost) */}
              <span style={{ color: 'rgba(0,229,255,0.6)', fontSize: 10 }}>
                {flight.fuel}
              </span>

              {/* Distance (turns) */}
              <span style={{ color: 'rgba(255,191,0,0.5)', fontSize: 10 }}>
                {flight.distance}
              </span>

              {/* Time */}
              <span style={{ color: 'rgba(255,191,0,0.4)', fontSize: 10 }}>
                {flight.time}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Bottom summary bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'rgba(0,0,0,0.85)',
        borderTop: `1px solid ${BORDER}`,
        padding: '4px 16px',
        display: 'flex', justifyContent: 'space-between',
        fontSize: 8, color: 'rgba(255,191,0,0.3)', letterSpacing: '0.08em',
      }}>
        <span>{flights.length} TOTAL FLIGHTS</span>
        <span>{flights.filter(f => f.rawStatus === 'active').length} IN FLIGHT</span>
        <span>{flights.filter(f => f.rawStatus === 'done').length} LANDED</span>
        <span>{flights.filter(f => f.rawStatus === 'error').length} DELAYED</span>
      </div>
    </div>
  );
}

/* Helpers */
function formatTime(elapsed?: string): string {
  if (!elapsed) return '--:--';
  // Try to parse "Xm Ys" or "Xh Ym" formats
  const h = elapsed.match(/(\d+)h/);
  const m = elapsed.match(/(\d+)m/);
  if (h) return `${h[1]}h${m ? m[1] : '00'}m`;
  if (m) return `${m[1]}m`;
  return elapsed.slice(0, 6);
}

function buildDemoData(): any[] {
  return [
    { session_id: 'd1', star_name: 'Sirius', project: 'alpha', status: 'active', model: 'opus', turns: 42, estimated_cost: 0.85, elapsed: '12m' },
    { session_id: 'd2', star_name: 'Vega', project: 'alpha', status: 'active', model: 'sonnet', turns: 18, estimated_cost: 0.22, elapsed: '5m' },
    { session_id: 'd3', star_name: 'Rigel', project: 'beta', status: 'idle', model: 'opus', turns: 30, estimated_cost: 0.65, elapsed: '8m' },
    { session_id: 'd4', star_name: 'Arcturus', project: 'alpha', status: 'error', model: 'sonnet', turns: 5, estimated_cost: 0.05, elapsed: '1m' },
    { session_id: 'd5', star_name: 'Capella', project: 'beta', status: 'active', model: 'opus', turns: 22, estimated_cost: 0.44, elapsed: '6m' },
    { session_id: 'd6', star_name: 'Betelgeuse', project: 'gamma', status: 'done', model: 'haiku', turns: 10, estimated_cost: 0.08, elapsed: '3m' },
    { session_id: 'd7', star_name: 'Deneb', project: 'gamma', status: 'active', model: 'opus', turns: 35, estimated_cost: 0.72, elapsed: '10m' },
    { session_id: 'd8', star_name: 'Altair', project: 'beta', status: 'idle', model: 'sonnet', turns: 15, estimated_cost: 0.18, elapsed: '4m' },
  ];
}
