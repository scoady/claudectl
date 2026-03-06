import React, { useEffect, useRef, useState } from 'react';

interface F1Driver {
  id: string;
  starName: string;
  project: string;
  status: string;
  turns: number;
  cost: number;
  model: string;
  elapsed: string;
  // Track position
  trackPos: number; // 0-1 around the track
  targetSpeed: number;
  inPit: boolean;
  lapCount: number;
  tireWear: number; // 0-1
}

interface StatsData {
  active_agents?: number;
  idle_agents?: number;
  total_agents_spawned?: number;
  cumulative_cost?: number;
}

const API_BASE = 'http://host.docker.internal:4040';

const TEAM_COLORS: Record<string, string> = {
  0: '#e10600', // Ferrari red
  1: '#00d2be', // Mercedes teal
  2: '#0600ef', // Red Bull blue
  3: '#ff8700', // McLaren orange
  4: '#006f62', // Aston Martin green
  5: '#2b4562', // AlphaTauri navy
  6: '#b6babd', // Haas grey
  7: '#ff69b4', // Alpine pink
  8: '#900000', // Alfa Romeo maroon
  9: '#ffffff', // Williams white
};

const CARBON_PATTERN_SIZE = 4;

function buildDemoDrivers(): F1Driver[] {
  const demos = [
    { starName: 'Sirius', project: 'alpha', status: 'active', turns: 42, model: 'opus', elapsed: '12m' },
    { starName: 'Vega', project: 'alpha', status: 'active', turns: 18, model: 'sonnet', elapsed: '6m' },
    { starName: 'Rigel', project: 'beta', status: 'idle', turns: 30, model: 'opus', elapsed: '20m' },
    { starName: 'Arcturus', project: 'alpha', status: 'error', turns: 5, model: 'sonnet', elapsed: '2m' },
    { starName: 'Capella', project: 'beta', status: 'active', turns: 22, model: 'opus', elapsed: '8m' },
    { starName: 'Betelgeuse', project: 'gamma', status: 'done', turns: 50, model: 'haiku', elapsed: '30m' },
    { starName: 'Deneb', project: 'gamma', status: 'active', turns: 35, model: 'opus', elapsed: '15m' },
    { starName: 'Altair', project: 'beta', status: 'active', turns: 15, model: 'sonnet', elapsed: '5m' },
  ];
  return demos.map((d, i) => ({
    id: `demo-${i}`,
    starName: d.starName,
    project: d.project,
    status: d.status,
    turns: d.turns,
    cost: Math.random() * 0.5,
    model: d.model,
    elapsed: d.elapsed,
    trackPos: Math.random(),
    targetSpeed: d.status === 'active' ? 0.002 + Math.random() * 0.003 : 0,
    inPit: d.status === 'idle',
    lapCount: d.turns,
    tireWear: Math.min(1, (parseInt(d.elapsed) || 5) / 40),
  }));
}

// Track shape: a proper circuit with chicanes
function getTrackPoint(t: number, cx: number, cy: number, rx: number, ry: number): { x: number; y: number } {
  // Modified oval with chicanes
  const angle = t * Math.PI * 2;
  let x = cx + Math.cos(angle) * rx;
  let y = cy + Math.sin(angle) * ry;

  // Add chicane perturbations
  if (t > 0.1 && t < 0.2) {
    x += Math.sin((t - 0.1) * Math.PI * 10) * rx * 0.12;
    y += Math.sin((t - 0.1) * Math.PI * 10) * ry * 0.08;
  }
  if (t > 0.55 && t < 0.65) {
    x += Math.sin((t - 0.55) * Math.PI * 10) * rx * 0.1;
    y -= Math.cos((t - 0.55) * Math.PI * 10) * ry * 0.06;
  }
  if (t > 0.8 && t < 0.9) {
    y += Math.sin((t - 0.8) * Math.PI * 10) * ry * 0.08;
  }

  return { x, y };
}

function getPitPoint(t: number, cx: number, cy: number, rx: number, ry: number): { x: number; y: number } {
  // Pit lane runs inside the main straight
  const pitX = cx - rx + t * rx * 1.2;
  const pitY = cy + ry * 0.5;
  return { x: pitX, y: pitY };
}

export function F1TelemetryPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const driversRef = useRef<F1Driver[]>([]);
  const [stats, setStats] = useState<StatsData>({});
  const [drivers, setDrivers] = useState<F1Driver[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [agentsResp, statsResp] = await Promise.all([
          fetch(`${API_BASE}/api/agents`),
          fetch(`${API_BASE}/api/stats`),
        ]);
        if (agentsResp.ok) {
          const raw: any[] = await agentsResp.json();
          const ds: F1Driver[] = raw.map((a, i) => {
            const existing = driversRef.current.find(d => d.id === (a.session_id || `a-${i}`));
            const elapsed = parseMinutes(a.elapsed);
            return {
              id: a.session_id || `a-${i}`,
              starName: a.star_name || `AGT${i}`,
              project: a.project || 'unknown',
              status: a.status || 'idle',
              turns: a.turns || 0,
              cost: a.estimated_cost || 0,
              model: a.model || 'unknown',
              elapsed: a.elapsed || '0m',
              trackPos: existing?.trackPos ?? Math.random(),
              targetSpeed: a.status === 'active' ? 0.002 + Math.random() * 0.003 : 0,
              inPit: a.status === 'idle',
              lapCount: a.turns || 0,
              tireWear: Math.min(1, elapsed / 40),
            };
          });
          driversRef.current = ds;
          setDrivers(ds);
        }
        if (statsResp.ok) setStats(await statsResp.json());
      } catch {
        if (driversRef.current.length === 0) {
          const demo = buildDemoDrivers();
          driversRef.current = demo;
          setDrivers(demo);
          setStats({ active_agents: 5, idle_agents: 1, total_agents_spawned: 8, cumulative_cost: 2.34 });
        }
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Animation
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
    // Smoke particles for errors
    const smokeParticles: Array<{ x: number; y: number; vx: number; vy: number; age: number; maxAge: number }> = [];

    function render() {
      if (!ctx || !canvas) return;
      const w = W / 2;
      const h = H / 2;
      frame++;

      // Split layout: track top 60%, leaderboard bottom 40%
      const trackH = h * 0.58;
      const lbTop = trackH;
      const lbH = h - trackH;

      // Track area dimensions
      const trackCx = w * 0.38;
      const trackCy = trackH * 0.5;
      const trackRx = Math.min(w * 0.28, trackH * 0.6);
      const trackRy = trackRx * 0.55;

      // --- Carbon fiber background ---
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, w, h);
      // Carbon fiber texture
      ctx.globalAlpha = 0.06;
      for (let px = 0; px < w; px += CARBON_PATTERN_SIZE * 2) {
        for (let py = 0; py < h; py += CARBON_PATTERN_SIZE * 2) {
          ctx.fillStyle = ((px / CARBON_PATTERN_SIZE + py / CARBON_PATTERN_SIZE) % 2 === 0) ? '#333' : '#222';
          ctx.fillRect(px, py, CARBON_PATTERN_SIZE, CARBON_PATTERN_SIZE);
        }
      }
      ctx.globalAlpha = 1;

      // --- Track outline ---
      // Kerb stripes border
      ctx.strokeStyle = '#e10600';
      ctx.lineWidth = 8;
      ctx.beginPath();
      for (let t = 0; t <= 1; t += 0.005) {
        const p = getTrackPoint(t, trackCx, trackCy, trackRx, trackRy);
        t === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.stroke();

      // White track
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let t = 0; t <= 1; t += 0.005) {
        const p = getTrackPoint(t, trackCx, trackCy, trackRx, trackRy);
        t === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.stroke();

      // Track surface (dark grey)
      ctx.strokeStyle = 'rgba(60,60,60,0.6)';
      ctx.lineWidth = 20;
      ctx.beginPath();
      for (let t = 0; t <= 1; t += 0.005) {
        const p = getTrackPoint(t, trackCx, trackCy, trackRx, trackRy);
        t === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.stroke();

      // Red/white kerb at start/finish
      const sfp = getTrackPoint(0, trackCx, trackCy, trackRx, trackRy);
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = k % 2 === 0 ? '#e10600' : '#ffffff';
        ctx.fillRect(sfp.x - 3 + k * 4, sfp.y - 12, 4, 24);
      }

      // DRS zones
      const drsZones = [[0.2, 0.3], [0.7, 0.8]];
      for (const [start, end] of drsZones) {
        ctx.strokeStyle = `rgba(0, 255, 0, ${0.2 + Math.sin(frame * 0.05) * 0.1})`;
        ctx.lineWidth = 3;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        for (let t = start; t <= end; t += 0.005) {
          const p = getTrackPoint(t, trackCx, trackCy, trackRx + 15, trackRy + 10);
          t === start ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // DRS label
        const mid = (start + end) / 2;
        const mp = getTrackPoint(mid, trackCx, trackCy, trackRx + 25, trackRy + 18);
        ctx.fillStyle = 'rgba(0,255,0,0.5)';
        ctx.font = 'bold 7px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('DRS', mp.x, mp.y);
      }

      // Pit lane
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 10;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      for (let t = 0; t <= 1; t += 0.02) {
        const p = getPitPoint(t, trackCx, trackCy, trackRx, trackRy);
        t === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      // Pit label
      const pitMid = getPitPoint(0.5, trackCx, trackCy, trackRx, trackRy);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PIT LANE', pitMid.x, pitMid.y + 16);

      // --- Driver dots on track ---
      const allDrivers = driversRef.current;
      for (let di = 0; di < allDrivers.length; di++) {
        const d = allDrivers[di];
        const teamColor = TEAM_COLORS[di % 10] || '#fff';

        // Move driver around track
        if (d.status === 'active') {
          d.trackPos = (d.trackPos + d.targetSpeed) % 1;
        } else if (d.status === 'done') {
          // Slow to a stop at finish
          d.targetSpeed *= 0.98;
          d.trackPos = (d.trackPos + d.targetSpeed) % 1;
        }

        let px: number, py: number;
        if (d.inPit) {
          const pitPos = (di * 0.15 + 0.1) % 1;
          const pp = getPitPoint(pitPos, trackCx, trackCy, trackRx, trackRy);
          px = pp.x;
          py = pp.y;
        } else {
          const tp = getTrackPoint(d.trackPos, trackCx, trackCy, trackRx, trackRy);
          px = tp.x;
          py = tp.y;
        }

        // Error: smoke/fire
        if (d.status === 'error') {
          if (frame % 3 === 0) {
            smokeParticles.push({
              x: px + (Math.random() - 0.5) * 6,
              y: py + (Math.random() - 0.5) * 6,
              vx: (Math.random() - 0.5) * 0.5,
              vy: -0.5 - Math.random() * 1,
              age: 0,
              maxAge: 30 + Math.random() * 20,
            });
          }
        }

        // Done: checkered flag
        if (d.status === 'done') {
          ctx.save();
          ctx.translate(px, py - 12);
          for (let fx = 0; fx < 3; fx++) {
            for (let fy = 0; fy < 3; fy++) {
              ctx.fillStyle = (fx + fy) % 2 === 0 ? '#fff' : '#000';
              ctx.fillRect(fx * 3 - 4, fy * 3 - 4, 3, 3);
            }
          }
          ctx.restore();
        }

        // Driver dot with glow
        ctx.save();
        const glow = ctx.createRadialGradient(px, py, 0, px, py, 10);
        glow.addColorStop(0, teamColor + 'aa');
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(px, py, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = teamColor;
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();

        // Position number
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 7px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(di + 1), px, py);
        ctx.restore();
      }

      // --- Smoke particles ---
      for (let i = smokeParticles.length - 1; i >= 0; i--) {
        const sp = smokeParticles[i];
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.age++;
        if (sp.age > sp.maxAge) { smokeParticles.splice(i, 1); continue; }
        const alpha = 1 - sp.age / sp.maxAge;
        const size = 2 + sp.age * 0.15;
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillStyle = sp.age < sp.maxAge * 0.3 ? '#ff4400' : '#666';
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // --- Gauges area (right side) ---
      const gaugeX = w * 0.75;
      const gaugeY1 = trackH * 0.25;
      const gaugeY2 = trackH * 0.65;
      const gaugeR = Math.min(w * 0.1, trackH * 0.18);

      // RPM Tachometer
      drawGauge(ctx, gaugeX, gaugeY1, gaugeR, 'RPM', stats.active_agents ?? 0, 20, '#e10600', frame);
      // Speed gauge
      drawGauge(ctx, gaugeX, gaugeY2, gaugeR, 'AGENTS', allDrivers.length, 20, '#00d2be', frame);

      // --- Leaderboard ---
      ctx.fillStyle = 'rgba(20,20,20,0.95)';
      ctx.fillRect(0, lbTop, w, lbH);
      // Kerb stripe
      for (let k = 0; k < w; k += 12) {
        ctx.fillStyle = Math.floor(k / 12) % 2 === 0 ? '#e10600' : '#ffffff';
        ctx.fillRect(k, lbTop, 6, 3);
      }

      // Header
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'left';
      const cols = [12, 40, 130, 220, 290, 360, 420];
      const headers = ['POS', 'DRIVER', 'TEAM', 'GAP', 'LAPS', 'TYRE', 'STATUS'];
      const headerY = lbTop + 18;
      headers.forEach((hdr, i) => {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText(hdr, cols[i], headerY);
      });

      // Sort by turns desc for position
      const sorted = [...allDrivers].sort((a, b) => b.turns - a.turns);
      const leader = sorted[0]?.turns || 0;

      sorted.forEach((d, i) => {
        const rowY = headerY + 16 + i * 14;
        if (rowY > h - 5) return;
        const teamColor = TEAM_COLORS[allDrivers.indexOf(d) % 10] || '#fff';

        // Position
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText(String(i + 1), cols[0], rowY);

        // Driver name
        ctx.fillStyle = teamColor;
        ctx.font = 'bold 9px sans-serif';
        ctx.fillText(d.starName.toUpperCase(), cols[1], rowY);

        // Team (project)
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.font = '8px sans-serif';
        ctx.fillText(d.project.slice(0, 12), cols[2], rowY);

        // Gap
        const gap = i === 0 ? 'LEADER' : `+${leader - d.turns}`;
        ctx.fillStyle = i === 0 ? '#ffd700' : 'rgba(255,255,255,0.5)';
        ctx.font = '8px monospace';
        ctx.fillText(gap, cols[3], rowY);

        // Laps
        ctx.fillStyle = '#fff';
        ctx.fillText(String(d.turns), cols[4], rowY);

        // Tire wear indicator
        const tw = d.tireWear;
        const tireColor = tw < 0.3 ? '#00ff41' : tw < 0.6 ? '#ffbf00' : '#ff2222';
        ctx.fillStyle = tireColor;
        ctx.fillRect(cols[5], rowY - 6, 20 * (1 - tw), 5);
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.strokeRect(cols[5], rowY - 6, 20, 5);

        // Status
        const statusText = d.status === 'active' ? 'RACING' : d.status === 'idle' ? 'PIT' :
          d.status === 'done' ? 'FINISH' : 'DNF';
        ctx.fillStyle = d.status === 'error' ? '#ff2222' : d.status === 'done' ? '#ffd700' :
          d.status === 'active' ? '#00ff41' : '#ffbf00';
        ctx.font = 'bold 8px sans-serif';
        ctx.fillText(statusText, cols[6], rowY);
      });

      // --- Race info overlay ---
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`LAP ${Math.floor(frame / 60)} / ${'\u221E'}`, w - 12, 16);

      animRef.current = requestAnimationFrame(render);
    }

    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    animRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
    };
  }, [drivers]);

  return (
    <div style={{
      width: '100%', height: '100%', minHeight: 450, position: 'relative',
      background: '#1a1a1a', borderRadius: 4, overflow: 'hidden',
      fontFamily: "'Titillium Web', 'Arial Narrow', sans-serif",
    }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

      <div style={{
        position: 'absolute', top: 8, left: 12, zIndex: 2,
      }}>
        <div style={{
          fontSize: 14, fontWeight: 900, color: '#e10600',
          letterSpacing: '0.2em',
          textShadow: '0 0 10px rgba(225,6,0,0.5)',
        }}>
          F1 TELEMETRY
        </div>
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', fontWeight: 700 }}>
          AGENT GRAND PRIX
        </div>
      </div>
    </div>
  );
}

function drawGauge(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number,
  label: string, value: number, max: number, color: string, frame: number) {
  // Background arc
  const startAngle = Math.PI * 0.75;
  const endAngle = Math.PI * 2.25;

  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, endAngle);
  ctx.stroke();

  // Value arc
  const valAngle = startAngle + (Math.min(value, max) / max) * (endAngle - startAngle);
  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, valAngle);
  ctx.stroke();

  // Glow
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r, startAngle, valAngle);
  ctx.stroke();
  ctx.restore();

  // Tick marks
  for (let i = 0; i <= 10; i++) {
    const a = startAngle + (i / 10) * (endAngle - startAngle);
    const inner = r - 8;
    const outer = r - 3;
    ctx.strokeStyle = i > 7 ? '#e10600' : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = i % 5 === 0 ? 1.5 : 0.5;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    ctx.lineTo(cx + Math.cos(a) * outer, cy + Math.sin(a) * outer);
    ctx.stroke();
  }

  // Needle
  const needleAngle = valAngle;
  ctx.save();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(needleAngle) * (r - 10), cy + Math.sin(needleAngle) * (r - 10));
  ctx.stroke();
  ctx.restore();

  // Center dot
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();

  // Value text
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.floor(r * 0.35)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(String(value), cx, cy + r * 0.55);

  // Label
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `bold ${Math.floor(r * 0.2)}px sans-serif`;
  ctx.fillText(label, cx, cy + r * 0.75);
}

function parseMinutes(elapsed?: string): number {
  if (!elapsed) return 0;
  const m = elapsed.match(/(\d+)m/);
  if (m) return parseInt(m[1]) || 0;
  const hr = elapsed.match(/(\d+)h/);
  if (hr) return (parseInt(hr[1]) || 0) * 60;
  return 0;
}
