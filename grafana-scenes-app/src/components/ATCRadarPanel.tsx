import React, { useEffect, useRef, useState } from 'react';

interface AgentBlip {
  id: string;
  callsign: string;
  project: string;
  status: string;
  model: string;
  turns: number;
  cost: number;
  // Position on radar (polar: angle + distance from center)
  angle: number;
  dist: number;
  targetAngle: number;
  targetDist: number;
  // Derived from status
  altitude: number; // turns = altitude in hundreds of feet
  speed: number; // turns per minute
}

interface StatsData {
  active_agents?: number;
  idle_agents?: number;
  total_agents_spawned?: number;
  cumulative_cost?: number;
}

const API_BASE = 'http://host.docker.internal:4040';

const ATC_GREEN = '#00ff41';
const ATC_GREEN_DIM = 'rgba(0,255,65,0.15)';
const ATC_GREEN_MED = 'rgba(0,255,65,0.4)';
const ATC_AMBER = '#ffbf00';
const ATC_RED = '#ff3333';
const ATC_CYAN = '#00e5ff';
const ATC_BG = '#0a100a';

const STATUS_TO_AVIATION: Record<string, string> = {
  active: 'CLIMBING',
  idle: 'CRUISING',
  done: 'LANDED',
  error: 'MAYDAY',
};

const STATUS_COLORS: Record<string, string> = {
  active: ATC_GREEN,
  idle: ATC_CYAN,
  done: '#6e7681',
  error: ATC_RED,
};

/**
 * ATCRadarPanel - Full radar display showing agents as aircraft blips.
 * Rotating sweep line, phosphor glow, authentic ATC data tags.
 */
export function ATCRadarPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [agents, setAgents] = useState<AgentBlip[]>([]);
  const [stats, setStats] = useState<StatsData>({});
  const animRef = useRef<number>(0);
  const agentsRef = useRef<AgentBlip[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [agentsResp, statsResp] = await Promise.all([
          fetch(`${API_BASE}/api/agents`),
          fetch(`${API_BASE}/api/stats`),
        ]);

        if (agentsResp.ok) {
          const raw: any[] = await agentsResp.json();
          const blips: AgentBlip[] = raw.map((a, i) => {
            const existing = agentsRef.current.find(b => b.id === (a.session_id || `a-${i}`));
            const sectorAngle = getSectorAngle(a.project || 'unknown', raw);
            const dist = 0.3 + Math.random() * 0.5;
            return {
              id: a.session_id || `a-${i}`,
              callsign: a.star_name || a.session_id?.slice(0, 6) || `AGT${i}`,
              project: a.project || 'unknown',
              status: a.status || 'idle',
              model: a.model || '',
              turns: a.turns || 0,
              cost: a.estimated_cost || 0,
              angle: existing?.angle ?? (sectorAngle + (Math.random() - 0.5) * 0.8),
              dist: existing?.dist ?? dist,
              targetAngle: sectorAngle + (Math.random() - 0.5) * 0.6,
              targetDist: a.status === 'done' ? 0.1 : (0.25 + Math.random() * 0.55),
              altitude: (a.turns || 0) * 100,
              speed: Math.max(1, Math.floor((a.turns || 0) / Math.max(1, parseElapsedMin(a.elapsed)))),
            };
          });
          agentsRef.current = blips;
          setAgents(blips);
        }

        if (statsResp.ok) {
          setStats(await statsResp.json());
        }
      } catch {
        // Demo data
        const demo = buildDemoBlips();
        agentsRef.current = demo;
        setAgents(demo);
        setStats({ active_agents: 4, idle_agents: 2, total_agents_spawned: 8, cumulative_cost: 2.34 });
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Main animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W: number, H: number;
    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      W = canvas.width = rect.width * 2;
      H = canvas.height = rect.height * 2;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      ctx.setTransform(2, 0, 0, 2, 0, 0);
    };
    resize();

    let frame = 0;
    let sweepAngle = 0;

    // Phosphor afterglow buffer for sweep trail
    const afterglowBlips: Array<{ x: number; y: number; age: number; callsign: string }> = [];

    function render() {
      if (!ctx) return;
      const w = W / 2;
      const h = H / 2;
      const cx = w / 2;
      const cy = h / 2 - 10;
      const maxR = Math.min(cx, cy) * 0.82;

      frame++;
      sweepAngle = (sweepAngle + 0.012) % (Math.PI * 2);

      // --- Background ---
      ctx.fillStyle = ATC_BG;
      ctx.fillRect(0, 0, w, h);

      // Subtle noise texture
      if (frame % 4 === 0) {
        ctx.globalAlpha = 0.015;
        for (let i = 0; i < 60; i++) {
          const nx = Math.random() * w;
          const ny = Math.random() * h;
          ctx.fillStyle = '#00ff41';
          ctx.fillRect(nx, ny, 1, 1);
        }
        ctx.globalAlpha = 1;
      }

      // --- Range rings ---
      const ringCount = 4;
      for (let i = 1; i <= ringCount; i++) {
        const r = (i / ringCount) * maxR;
        ctx.strokeStyle = i === ringCount ? 'rgba(0,255,65,0.12)' : 'rgba(0,255,65,0.06)';
        ctx.lineWidth = i === ringCount ? 1.2 : 0.6;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();

        // Range label
        ctx.fillStyle = 'rgba(0,255,65,0.25)';
        ctx.font = '8px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`${i * 25}nm`, cx + r + 3, cy - 2);
      }

      // --- Compass lines (N/S/E/W) ---
      const compassLabels = ['N', 'E', 'S', 'W'];
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 - Math.PI / 2;
        ctx.strokeStyle = 'rgba(0,255,65,0.08)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * maxR, cy + Math.sin(a) * maxR);
        ctx.stroke();

        ctx.fillStyle = 'rgba(0,255,65,0.3)';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(compassLabels[i], cx + Math.cos(a) * (maxR + 14), cy + Math.sin(a) * (maxR + 14));
      }

      // Minor compass lines (30-degree increments)
      for (let i = 0; i < 12; i++) {
        if (i % 3 === 0) continue;
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        ctx.strokeStyle = 'rgba(0,255,65,0.04)';
        ctx.lineWidth = 0.3;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * maxR * 0.15, cy + Math.sin(a) * maxR * 0.15);
        ctx.lineTo(cx + Math.cos(a) * maxR, cy + Math.sin(a) * maxR);
        ctx.stroke();
      }

      // --- Center point ---
      ctx.fillStyle = ATC_GREEN;
      ctx.beginPath();
      ctx.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx.fill();

      // --- Sweep line with gradient trail ---
      const sweepTrailLen = 0.5; // radians of trail
      for (let s = 0; s < 20; s++) {
        const trailAngle = sweepAngle - (s / 20) * sweepTrailLen;
        const alpha = (1 - s / 20) * 0.18;
        ctx.strokeStyle = `rgba(0,255,65,${alpha})`;
        ctx.lineWidth = 1.5 - s * 0.05;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(trailAngle) * maxR, cy + Math.sin(trailAngle) * maxR);
        ctx.stroke();
      }

      // Main sweep line (brightest)
      ctx.strokeStyle = 'rgba(0,255,65,0.6)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sweepAngle) * maxR, cy + Math.sin(sweepAngle) * maxR);
      ctx.stroke();

      // Sweep glow cone
      ctx.save();
      const sweepGrad = ctx.createConicGradient(sweepAngle - 0.4, cx, cy);
      sweepGrad.addColorStop(0, 'rgba(0,255,65,0)');
      sweepGrad.addColorStop(0.06, 'rgba(0,255,65,0.04)');
      sweepGrad.addColorStop(0.065, 'rgba(0,255,65,0)');
      sweepGrad.addColorStop(1, 'rgba(0,255,65,0)');
      ctx.fillStyle = sweepGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // --- Sector labels (project names as airway sectors) ---
      const projects = [...new Set(agents.map(a => a.project))];
      projects.forEach((proj, pi) => {
        const sectorAngle = getSectorAngle(proj, agents as any[]);
        const lx = cx + Math.cos(sectorAngle) * maxR * 0.65;
        const ly = cy + Math.sin(sectorAngle) * maxR * 0.65;
        ctx.fillStyle = 'rgba(0,229,255,0.2)';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`[${proj.toUpperCase().slice(0, 8)}]`, lx, ly - 18);
      });

      // --- Afterglow fade-out blips ---
      for (let i = afterglowBlips.length - 1; i >= 0; i--) {
        const ab = afterglowBlips[i];
        ab.age++;
        if (ab.age > 120) { afterglowBlips.splice(i, 1); continue; }
        const alpha = (1 - ab.age / 120) * 0.35;
        ctx.fillStyle = `rgba(0,255,65,${alpha})`;
        ctx.beginPath();
        ctx.arc(ab.x, ab.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // --- Agent blips ---
      const blips = agentsRef.current;
      for (const blip of blips) {
        // Smooth interpolation toward target
        blip.angle += (blip.targetAngle - blip.angle) * 0.002;
        blip.dist += (blip.targetDist - blip.dist) * 0.005;

        // Active agents drift slightly
        if (blip.status === 'active') {
          blip.angle += 0.001;
          blip.targetAngle += 0.001;
        }

        const bx = cx + Math.cos(blip.angle) * blip.dist * maxR;
        const by = cy + Math.sin(blip.angle) * blip.dist * maxR;

        // Check if sweep just passed over this blip
        const blipAngleNorm = ((blip.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const sweepNorm = ((sweepAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const diff = Math.abs(blipAngleNorm - sweepNorm);
        if (diff < 0.05 || diff > Math.PI * 2 - 0.05) {
          afterglowBlips.push({ x: bx, y: by, age: 0, callsign: blip.callsign });
        }

        const color = STATUS_COLORS[blip.status] || ATC_GREEN;
        const isActive = blip.status === 'active';
        const isMayday = blip.status === 'error';

        // Blip glow
        if (isActive || isMayday) {
          const pulse = 1 + Math.sin(frame * 0.08) * 0.3;
          ctx.globalAlpha = 0.25 * pulse;
          const glow = ctx.createRadialGradient(bx, by, 0, bx, by, 12);
          glow.addColorStop(0, color);
          glow.addColorStop(1, 'transparent');
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(bx, by, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        // Aircraft blip (small filled square like real ATC)
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(blip.angle + Math.PI / 2);
        ctx.fillStyle = color;

        if (isMayday && Math.sin(frame * 0.15) > 0) {
          // Flashing for mayday
          ctx.fillStyle = ATC_RED;
        }

        // Draw small aircraft icon
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.lineTo(-2.5, 2);
        ctx.lineTo(-5, 3);
        ctx.lineTo(-2, 4);
        ctx.lineTo(0, 5);
        ctx.lineTo(2, 4);
        ctx.lineTo(5, 3);
        ctx.lineTo(2.5, 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // --- ATC Data Tag ---
        const tagX = bx + 10;
        const tagY = by - 18;

        // Tag background
        ctx.fillStyle = 'rgba(0,10,0,0.7)';
        ctx.fillRect(tagX - 2, tagY - 9, 72, 32);
        ctx.strokeStyle = 'rgba(0,255,65,0.15)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(tagX - 2, tagY - 9, 72, 32);

        // Leader line
        ctx.strokeStyle = 'rgba(0,255,65,0.3)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(tagX, tagY + 4);
        ctx.stroke();

        // Tag text: Line 1 = callsign + status
        ctx.fillStyle = color;
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(blip.callsign.toUpperCase(), tagX, tagY);

        // Tag text: Line 2 = altitude (FL) + speed
        const fl = Math.floor(blip.altitude / 100);
        ctx.fillStyle = ATC_GREEN;
        ctx.font = '7px monospace';
        ctx.fillText(`FL${String(fl).padStart(3, '0')} ${blip.speed}kt`, tagX, tagY + 10);

        // Tag text: Line 3 = aviation status
        const avStatus = STATUS_TO_AVIATION[blip.status] || 'UNK';
        ctx.fillStyle = isMayday ? ATC_RED : (blip.status === 'active' ? ATC_GREEN : 'rgba(0,255,65,0.5)');
        ctx.font = '7px monospace';
        ctx.fillText(avStatus, tagX, tagY + 20);
      }

      // --- Outer border ring ---
      ctx.strokeStyle = 'rgba(0,255,65,0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, maxR + 4, 0, Math.PI * 2);
      ctx.stroke();

      // Tick marks around outer ring
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * Math.PI * 2;
        const inner = maxR + 4;
        const outer = maxR + (i % 3 === 0 ? 10 : 6);
        ctx.strokeStyle = i % 3 === 0 ? 'rgba(0,255,65,0.25)' : 'rgba(0,255,65,0.1)';
        ctx.lineWidth = i % 3 === 0 ? 1 : 0.5;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
        ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
        ctx.stroke();

        // Bearing labels every 30 degrees
        if (i % 3 === 0) {
          const bearing = ((i / 36) * 360 + 90) % 360;
          ctx.fillStyle = 'rgba(0,255,65,0.3)';
          ctx.font = '7px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(
            String(bearing).padStart(3, '0'),
            cx + Math.cos(a) * (maxR + 18),
            cy + Math.sin(a) * (maxR + 18)
          );
        }
      }

      // --- CRT scan-line effect ---
      ctx.globalAlpha = 0.03;
      for (let y = 0; y < h; y += 3) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, y, w, 1);
      }
      ctx.globalAlpha = 1;

      // --- Vignette ---
      const vignette = ctx.createRadialGradient(cx, cy, maxR * 0.6, cx, cy, Math.max(w, h) * 0.7);
      vignette.addColorStop(0, 'transparent');
      vignette.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);

      animRef.current = requestAnimationFrame(render);
    }

    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    animRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
    };
  }, [agents]);

  const activeCount = stats.active_agents ?? 0;
  const totalSpawned = stats.total_agents_spawned ?? 0;
  const doneCount = totalSpawned - (stats.active_agents ?? 0) - (stats.idle_agents ?? 0);

  return (
    <div style={{
      width: '100%', height: '100%', minHeight: 400, position: 'relative',
      background: ATC_BG, borderRadius: 4, overflow: 'hidden',
      fontFamily: "'JetBrains Mono', 'Courier New', monospace",
    }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />

      {/* Top-left: Radar station ID */}
      <div style={{
        position: 'absolute', top: 8, left: 12, zIndex: 2,
      }}>
        <div style={{
          fontSize: 12, fontWeight: 700, color: ATC_GREEN,
          letterSpacing: '0.12em',
          textShadow: `0 0 10px rgba(0,255,65,0.5)`,
        }}>
          TRACON
        </div>
        <div style={{ fontSize: 9, color: 'rgba(0,255,65,0.4)', letterSpacing: '0.06em' }}>
          AGENT TRAFFIC CONTROL
        </div>
      </div>

      {/* Top-right: Time */}
      <div style={{
        position: 'absolute', top: 8, right: 12, zIndex: 2,
        fontSize: 10, color: ATC_GREEN, letterSpacing: '0.08em',
      }}>
        <ATCClock />
      </div>

      {/* Bottom status bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 2,
        background: 'rgba(0,10,0,0.85)',
        borderTop: '1px solid rgba(0,255,65,0.15)',
        padding: '5px 14px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: 9, letterSpacing: '0.06em',
      }}>
        <span style={{ color: ATC_GREEN }}>
          {agents.length} AIRCRAFT IN AIRSPACE
        </span>
        <span style={{ color: ATC_CYAN }}>
          {activeCount} DEPARTURES
        </span>
        <span style={{ color: ATC_AMBER }}>
          {Math.max(0, doneCount)} ARRIVALS
        </span>
        <span style={{ color: agents.some(a => a.status === 'error') ? ATC_RED : ATC_GREEN }}>
          {agents.some(a => a.status === 'error') ? 'ALERT ACTIVE' : 'ALL NOMINAL'}
        </span>
      </div>

      <style>{`
        @keyframes atc-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  );
}

/* Sub-component: live UTC clock */
function ATCClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setTime(
        `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}:${String(d.getUTCSeconds()).padStart(2, '0')}Z`
      );
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, []);
  return <span>{time}</span>;
}

/* Helpers */
function getSectorAngle(project: string, allAgents: any[]): number {
  const projects = [...new Set(allAgents.map((a: any) => a.project || 'unknown'))];
  const idx = projects.indexOf(project);
  if (idx < 0) return 0;
  return (idx / Math.max(projects.length, 1)) * Math.PI * 2 - Math.PI / 2;
}

function parseElapsedMin(elapsed?: string): number {
  if (!elapsed) return 1;
  const m = elapsed.match(/(\d+)m/);
  if (m) return parseInt(m[1]) || 1;
  const h = elapsed.match(/(\d+)h/);
  if (h) return (parseInt(h[1]) || 1) * 60;
  return 1;
}

function buildDemoBlips(): AgentBlip[] {
  const demos = [
    { callsign: 'Sirius', project: 'alpha', status: 'active', turns: 42, model: 'opus' },
    { callsign: 'Vega', project: 'alpha', status: 'active', turns: 18, model: 'sonnet' },
    { callsign: 'Rigel', project: 'beta', status: 'idle', turns: 30, model: 'opus' },
    { callsign: 'Arcturus', project: 'alpha', status: 'error', turns: 5, model: 'sonnet' },
    { callsign: 'Capella', project: 'beta', status: 'active', turns: 22, model: 'opus' },
    { callsign: 'Betelgeuse', project: 'gamma', status: 'done', turns: 10, model: 'haiku' },
    { callsign: 'Deneb', project: 'gamma', status: 'active', turns: 35, model: 'opus' },
    { callsign: 'Altair', project: 'beta', status: 'idle', turns: 15, model: 'sonnet' },
  ];
  return demos.map((d, i) => {
    const sAngle = getSectorAngle(d.project, demos as any[]);
    return {
      id: `demo-${i}`,
      callsign: d.callsign,
      project: d.project,
      status: d.status,
      model: d.model,
      turns: d.turns,
      cost: 0,
      angle: sAngle + (Math.random() - 0.5) * 0.8,
      dist: d.status === 'done' ? 0.12 : (0.25 + Math.random() * 0.5),
      targetAngle: sAngle + (Math.random() - 0.5) * 0.6,
      targetDist: d.status === 'done' ? 0.1 : (0.25 + Math.random() * 0.55),
      altitude: d.turns * 100,
      speed: d.turns,
    };
  });
}
