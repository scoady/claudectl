import React, { useEffect, useRef, useState } from 'react';

interface SubmarineAgent {
  id: string;
  starName: string;
  project: string;
  status: string;
  turns: number;
  cost: number;
  model: string;
  // Sonar position
  angle: number;
  dist: number;
  depth: number; // cost = depth
  targetAngle: number;
  targetDist: number;
  wakeTrail: Array<{ x: number; y: number; age: number }>;
}

interface StatsData {
  active_agents?: number;
  idle_agents?: number;
  total_agents_spawned?: number;
  cumulative_cost?: number;
}

const API_BASE = 'http://localhost:4040';

const SONAR_CYAN = '#00e5ff';
const SONAR_GREEN = '#00ff88';
const DEEP_BG = '#020810';
const ABYSS_BLUE = '#041428';

function buildDemoSubs(): SubmarineAgent[] {
  const demos = [
    { starName: 'Nautilus', project: 'alpha', status: 'active', turns: 42, cost: 1.2, model: 'opus' },
    { starName: 'Triton', project: 'alpha', status: 'active', turns: 18, cost: 0.5, model: 'sonnet' },
    { starName: 'Kraken', project: 'beta', status: 'idle', turns: 30, cost: 0.8, model: 'opus' },
    { starName: 'Leviathan', project: 'alpha', status: 'error', turns: 5, cost: 2.5, model: 'sonnet' },
    { starName: 'Poseidon', project: 'beta', status: 'active', turns: 22, cost: 0.6, model: 'opus' },
    { starName: 'Abyss', project: 'gamma', status: 'done', turns: 50, cost: 1.8, model: 'haiku' },
    { starName: 'Mariana', project: 'gamma', status: 'active', turns: 35, cost: 1.0, model: 'opus' },
    { starName: 'Hydra', project: 'beta', status: 'active', turns: 15, cost: 0.3, model: 'sonnet' },
  ];
  return demos.map((d, i) => ({
    id: `demo-${i}`,
    starName: d.starName,
    project: d.project,
    status: d.status,
    turns: d.turns,
    cost: d.cost,
    model: d.model,
    angle: (i / demos.length) * Math.PI * 2,
    dist: 0.2 + Math.random() * 0.6,
    depth: d.cost,
    targetAngle: (i / demos.length) * Math.PI * 2 + (Math.random() - 0.5) * 0.5,
    targetDist: 0.2 + Math.random() * 0.5,
    wakeTrail: [],
  }));
}

export function DeepSeaSonarPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const subsRef = useRef<SubmarineAgent[]>([]);
  const [stats, setStats] = useState<StatsData>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [agentsResp, statsResp] = await Promise.all([
          fetch(`${API_BASE}/api/agents`),
          fetch(`${API_BASE}/api/stats`),
        ]);
        if (agentsResp.ok) {
          const raw: any[] = await agentsResp.json();
          const subs: SubmarineAgent[] = raw.map((a, i) => {
            const existing = subsRef.current.find(s => s.id === (a.session_id || `a-${i}`));
            return {
              id: a.session_id || `a-${i}`,
              starName: a.star_name || `SUB${i}`,
              project: a.project || 'unknown',
              status: a.status || 'idle',
              turns: a.turns || 0,
              cost: a.estimated_cost || 0,
              model: a.model || '',
              angle: existing?.angle ?? Math.random() * Math.PI * 2,
              dist: existing?.dist ?? (0.2 + Math.random() * 0.5),
              depth: a.estimated_cost || 0,
              targetAngle: existing?.targetAngle ?? Math.random() * Math.PI * 2,
              targetDist: a.status === 'done' ? 0.1 : (0.2 + Math.random() * 0.55),
              wakeTrail: existing?.wakeTrail ?? [],
            };
          });
          subsRef.current = subs;
        }
        if (statsResp.ok) setStats(await statsResp.json());
      } catch {
        if (subsRef.current.length === 0) {
          subsRef.current = buildDemoSubs();
          setStats({ active_agents: 5, idle_agents: 1, total_agents_spawned: 8, cumulative_cost: 8.7 });
        }
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

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
    let pingPhase = 0;
    const pingRings: Array<{ r: number; age: number; maxAge: number }> = [];
    const biolumParticles: Array<{ x: number; y: number; vx: number; vy: number; r: number; pulse: number; hue: number }> = [];
    const bubbles: Array<{ x: number; y: number; vy: number; r: number; age: number }> = [];
    const torpedoes: Array<{ x: number; y: number; tx: number; ty: number; age: number; trail: Array<{ x: number; y: number }> }> = [];

    // Initialize bioluminescent particles
    for (let i = 0; i < 40; i++) {
      biolumParticles.push({
        x: Math.random(), y: Math.random(),
        vx: (Math.random() - 0.5) * 0.0003,
        vy: (Math.random() - 0.5) * 0.0002 - 0.0001,
        r: 1 + Math.random() * 3,
        pulse: Math.random() * Math.PI * 2,
        hue: 160 + Math.random() * 60,
      });
    }

    // Hydrophone wave data
    const hydroData: number[] = new Array(200).fill(0);

    function render() {
      if (!ctx || !canvas) return;
      const w = W / 2;
      const h = H / 2;
      frame++;

      // Sonar center
      const sonarCx = w * 0.45;
      const sonarCy = h * 0.48;
      const sonarR = Math.min(w * 0.32, h * 0.38);

      // --- Deep ocean gradient background ---
      const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, '#020a18');
      bgGrad.addColorStop(0.3, '#031020');
      bgGrad.addColorStop(0.6, ABYSS_BLUE);
      bgGrad.addColorStop(1, '#010408');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Depth layers (horizontal bands with slight opacity)
      for (let layer = 0; layer < 5; layer++) {
        const ly = h * (layer / 5);
        ctx.fillStyle = `rgba(0,20,40,${0.02 + layer * 0.01})`;
        ctx.fillRect(0, ly, w, h / 5);
      }

      // --- Bioluminescent particles ---
      for (const p of biolumParticles) {
        p.x += p.vx;
        p.y += p.vy;
        p.pulse += 0.02;
        if (p.x < -0.05) p.x = 1.05;
        if (p.x > 1.05) p.x = -0.05;
        if (p.y < -0.05) p.y = 1.05;
        if (p.y > 1.05) p.y = -0.05;

        const brightness = 0.3 + Math.sin(p.pulse) * 0.3;
        const px = p.x * w;
        const py = p.y * h;
        const glow = ctx.createRadialGradient(px, py, 0, px, py, p.r * 4);
        glow.addColorStop(0, `hsla(${p.hue}, 100%, 70%, ${brightness * 0.4})`);
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(px, py, p.r * 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `hsla(${p.hue}, 100%, 80%, ${brightness})`;
        ctx.beginPath();
        ctx.arc(px, py, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // --- Sonar display ---
      // Dark circle background
      const sonarBg = ctx.createRadialGradient(sonarCx, sonarCy, 0, sonarCx, sonarCy, sonarR);
      sonarBg.addColorStop(0, 'rgba(0,10,20,0.8)');
      sonarBg.addColorStop(1, 'rgba(0,5,10,0.9)');
      ctx.fillStyle = sonarBg;
      ctx.beginPath();
      ctx.arc(sonarCx, sonarCy, sonarR, 0, Math.PI * 2);
      ctx.fill();

      // Range rings
      for (let i = 1; i <= 4; i++) {
        const rr = (i / 4) * sonarR;
        ctx.strokeStyle = `rgba(0,229,255,${0.06 + (i === 4 ? 0.06 : 0)})`;
        ctx.lineWidth = i === 4 ? 1.2 : 0.5;
        ctx.beginPath();
        ctx.arc(sonarCx, sonarCy, rr, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Cross hairs
      ctx.strokeStyle = 'rgba(0,229,255,0.06)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(sonarCx - sonarR, sonarCy);
      ctx.lineTo(sonarCx + sonarR, sonarCy);
      ctx.moveTo(sonarCx, sonarCy - sonarR);
      ctx.lineTo(sonarCx, sonarCy + sonarR);
      ctx.stroke();

      // --- Ping rings ---
      pingPhase++;
      if (pingPhase % 120 === 0) {
        pingRings.push({ r: 0, age: 0, maxAge: 100 });
      }
      for (let i = pingRings.length - 1; i >= 0; i--) {
        const ring = pingRings[i];
        ring.r += sonarR / ring.maxAge;
        ring.age++;
        if (ring.age > ring.maxAge) { pingRings.splice(i, 1); continue; }
        const alpha = (1 - ring.age / ring.maxAge) * 0.5;
        ctx.strokeStyle = `rgba(0,229,255,${alpha})`;
        ctx.lineWidth = 2 - ring.age / ring.maxAge;
        ctx.beginPath();
        ctx.arc(sonarCx, sonarCy, ring.r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // --- Sweep line (like sonar) ---
      const sweepAngle = (frame * 0.015) % (Math.PI * 2);
      for (let s = 0; s < 15; s++) {
        const trailAngle = sweepAngle - (s / 15) * 0.6;
        const alpha = (1 - s / 15) * 0.15;
        ctx.strokeStyle = `rgba(0,229,255,${alpha})`;
        ctx.lineWidth = 1.5 - s * 0.08;
        ctx.beginPath();
        ctx.moveTo(sonarCx, sonarCy);
        ctx.lineTo(sonarCx + Math.cos(trailAngle) * sonarR, sonarCy + Math.sin(trailAngle) * sonarR);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(0,229,255,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sonarCx, sonarCy);
      ctx.lineTo(sonarCx + Math.cos(sweepAngle) * sonarR, sonarCy + Math.sin(sweepAngle) * sonarR);
      ctx.stroke();

      // --- Submarine agents ---
      const subs = subsRef.current;
      for (const sub of subs) {
        // Interpolate position
        sub.angle += (sub.targetAngle - sub.angle) * 0.003;
        sub.dist += (sub.targetDist - sub.dist) * 0.005;
        if (sub.status === 'active') {
          sub.angle += 0.0008;
          sub.targetAngle += 0.0008;
        }

        const sx = sonarCx + Math.cos(sub.angle) * sub.dist * sonarR;
        const sy = sonarCy + Math.sin(sub.angle) * sub.dist * sonarR;

        // Check if ping hit this sub
        const hitByPing = pingRings.some(ring => {
          const subR = Math.sqrt((sx - sonarCx) ** 2 + (sy - sonarCy) ** 2);
          return Math.abs(ring.r - subR) < 8;
        });

        // Wake trail for active subs
        if (sub.status === 'active' && frame % 4 === 0) {
          sub.wakeTrail.push({ x: sx, y: sy, age: 0 });
          if (sub.wakeTrail.length > 20) sub.wakeTrail.shift();
        }
        for (let ti = sub.wakeTrail.length - 1; ti >= 0; ti--) {
          const wk = sub.wakeTrail[ti];
          wk.age++;
          if (wk.age > 60) { sub.wakeTrail.splice(ti, 1); continue; }
          const alpha = (1 - wk.age / 60) * 0.15;
          ctx.fillStyle = `rgba(0,229,255,${alpha})`;
          ctx.beginPath();
          ctx.arc(wk.x, wk.y, 2, 0, Math.PI * 2);
          ctx.fill();
        }

        // Bubbles from active subs
        if (sub.status === 'active' && frame % 12 === 0) {
          bubbles.push({
            x: sx + (Math.random() - 0.5) * 8,
            y: sy,
            vy: -0.3 - Math.random() * 0.5,
            r: 1 + Math.random() * 2,
            age: 0,
          });
        }

        // Flash when ping hits
        if (hitByPing) {
          const flashGlow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 15);
          flashGlow.addColorStop(0, 'rgba(0,229,255,0.6)');
          flashGlow.addColorStop(1, 'transparent');
          ctx.fillStyle = flashGlow;
          ctx.beginPath();
          ctx.arc(sx, sy, 15, 0, Math.PI * 2);
          ctx.fill();
        }

        // Submarine icon (simplified)
        const subColor = sub.status === 'error' ? '#ff3333' :
          sub.status === 'done' ? '#ffd700' :
            sub.status === 'active' ? SONAR_CYAN : 'rgba(0,229,255,0.4)';

        // Sub body
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(sub.angle);
        ctx.fillStyle = subColor;
        // Hull
        ctx.beginPath();
        ctx.ellipse(0, 0, 8, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        // Conning tower
        ctx.fillRect(-1, -5, 3, 3);
        // Periscope
        ctx.strokeStyle = subColor;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(1, -5);
        ctx.lineTo(1, -8);
        ctx.stroke();
        ctx.restore();

        // Error: red warning pulse
        if (sub.status === 'error' && Math.sin(frame * 0.1) > 0) {
          ctx.save();
          ctx.globalAlpha = 0.4;
          ctx.strokeStyle = '#ff3333';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(sx, sy, 12 + Math.sin(frame * 0.15) * 3, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // Label
        ctx.fillStyle = subColor;
        ctx.globalAlpha = 0.8;
        ctx.font = '7px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(sub.starName.toUpperCase(), sx, sy + 14);
        ctx.fillStyle = 'rgba(0,229,255,0.4)';
        ctx.font = '6px monospace';
        ctx.fillText(`D:${sub.depth.toFixed(1)}`, sx, sy + 22);
        ctx.globalAlpha = 1;
      }

      // --- Bubbles ---
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        b.y += b.vy;
        b.x += (Math.random() - 0.5) * 0.3;
        b.age++;
        if (b.age > 80) { bubbles.splice(i, 1); continue; }
        const alpha = (1 - b.age / 80) * 0.3;
        ctx.strokeStyle = `rgba(100,200,255,${alpha})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // --- Torpedoes (new agent dispatch) ---
      for (let i = torpedoes.length - 1; i >= 0; i--) {
        const torp = torpedoes[i];
        torp.age++;
        const dx = torp.tx - torp.x;
        const dy = torp.ty - torp.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 5 || torp.age > 120) {
          // Explosion
          ctx.save();
          const expGlow = ctx.createRadialGradient(torp.x, torp.y, 0, torp.x, torp.y, 20);
          expGlow.addColorStop(0, 'rgba(255,200,0,0.8)');
          expGlow.addColorStop(0.5, 'rgba(255,100,0,0.3)');
          expGlow.addColorStop(1, 'transparent');
          ctx.fillStyle = expGlow;
          ctx.beginPath();
          ctx.arc(torp.x, torp.y, 20, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          torpedoes.splice(i, 1);
          continue;
        }
        torp.x += (dx / dist) * 2;
        torp.y += (dy / dist) * 2;
        torp.trail.push({ x: torp.x, y: torp.y });
        if (torp.trail.length > 15) torp.trail.shift();

        // Trail
        for (let t = 0; t < torp.trail.length; t++) {
          const alpha = (t / torp.trail.length) * 0.5;
          ctx.fillStyle = `rgba(255,200,0,${alpha})`;
          ctx.beginPath();
          ctx.arc(torp.trail[t].x, torp.trail[t].y, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }

        // Torpedo head
        ctx.fillStyle = '#ff6600';
        ctx.beginPath();
        ctx.arc(torp.x, torp.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Spawn torpedo occasionally
      if (frame % 300 === 0 && subs.length > 0) {
        const target = subs[Math.floor(Math.random() * subs.length)];
        const tx = sonarCx + Math.cos(target.angle) * target.dist * sonarR;
        const ty = sonarCy + Math.sin(target.angle) * target.dist * sonarR;
        torpedoes.push({
          x: sonarCx, y: sonarCy + sonarR + 20,
          tx, ty, age: 0, trail: [],
        });
      }

      // --- Pressure gauge (left) ---
      const pgX = 20;
      const pgTop = h * 0.15;
      const pgH = h * 0.6;
      const totalCost = stats.cumulative_cost ?? subs.reduce((s, sub) => s + sub.cost, 0);
      const pressure = Math.min(1, totalCost / 10);

      ctx.strokeStyle = 'rgba(0,229,255,0.2)';
      ctx.lineWidth = 1;
      ctx.strokeRect(pgX, pgTop, 14, pgH);
      // Fill
      const pgFillH = pgH * pressure;
      const pgGrad = ctx.createLinearGradient(0, pgTop + pgH - pgFillH, 0, pgTop + pgH);
      pgGrad.addColorStop(0, 'rgba(0,229,255,0.3)');
      pgGrad.addColorStop(1, 'rgba(0,100,200,0.6)');
      ctx.fillStyle = pgGrad;
      ctx.fillRect(pgX + 1, pgTop + pgH - pgFillH, 12, pgFillH);
      // Label
      ctx.save();
      ctx.translate(pgX + 7, pgTop - 8);
      ctx.fillStyle = 'rgba(0,229,255,0.5)';
      ctx.font = '7px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PRESSURE', 0, 0);
      ctx.restore();
      // Ticks
      for (let i = 0; i <= 5; i++) {
        const ty = pgTop + (i / 5) * pgH;
        ctx.strokeStyle = 'rgba(0,229,255,0.15)';
        ctx.beginPath();
        ctx.moveTo(pgX + 14, ty);
        ctx.lineTo(pgX + 20, ty);
        ctx.stroke();
      }

      // --- Depth meter (right) ---
      const dmX = w - 34;
      const dmTop = h * 0.15;
      const dmH = h * 0.6;
      const maxDepth = Math.max(...subs.map(s => s.depth), 1);

      ctx.strokeStyle = 'rgba(0,229,255,0.2)';
      ctx.lineWidth = 1;
      ctx.strokeRect(dmX, dmTop, 14, dmH);
      // Depth fill
      const depthFill = Math.min(1, maxDepth / 5) * dmH;
      const dmGrad = ctx.createLinearGradient(0, dmTop, 0, dmTop + depthFill);
      dmGrad.addColorStop(0, 'rgba(0,50,100,0.3)');
      dmGrad.addColorStop(1, 'rgba(0,20,60,0.8)');
      ctx.fillStyle = dmGrad;
      ctx.fillRect(dmX + 1, dmTop, 12, depthFill);

      // Crushing depth warning
      if (maxDepth > 3) {
        ctx.fillStyle = `rgba(255,0,0,${0.3 + Math.sin(frame * 0.08) * 0.2})`;
        const warnY = dmTop + dmH * 0.8;
        ctx.fillRect(dmX - 5, warnY, 24, dmH * 0.2 + 5);
        ctx.fillStyle = '#ff3333';
        ctx.font = 'bold 5px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('CRUSH', dmX + 7, warnY + 8);
        ctx.fillText('DEPTH', dmX + 7, warnY + 15);
      }

      ctx.fillStyle = 'rgba(0,229,255,0.5)';
      ctx.font = '7px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('DEPTH', dmX + 7, dmTop - 8);

      // --- Hydrophone visualization (top) ---
      // Update wave data
      const activity = (stats.active_agents ?? subs.filter(s => s.status === 'active').length);
      hydroData.push(Math.sin(frame * 0.1) * activity * 3 + (Math.random() - 0.5) * activity * 5);
      if (hydroData.length > 200) hydroData.shift();

      const hydroY = 20;
      const hydroH = 25;
      ctx.strokeStyle = SONAR_GREEN;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < hydroData.length; i++) {
        const hx = (i / hydroData.length) * w;
        const hy = hydroY + hydroH / 2 + hydroData[i] * 0.5;
        i === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy);
      }
      ctx.stroke();

      // Hydrophone glow
      ctx.save();
      ctx.shadowColor = SONAR_GREEN;
      ctx.shadowBlur = 5;
      ctx.strokeStyle = `rgba(0,255,136,0.3)`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < hydroData.length; i++) {
        const hx = (i / hydroData.length) * w;
        const hy = hydroY + hydroH / 2 + hydroData[i] * 0.5;
        i === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy);
      }
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = 'rgba(0,255,136,0.3)';
      ctx.font = '7px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('HYDROPHONE', 8, 12);

      // --- Outer sonar ring ---
      ctx.strokeStyle = 'rgba(0,229,255,0.15)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sonarCx, sonarCy, sonarR + 3, 0, Math.PI * 2);
      ctx.stroke();

      // --- CRT / underwater distortion ---
      ctx.globalAlpha = 0.02;
      for (let y = 0; y < h; y += 3) {
        ctx.fillStyle = '#001020';
        ctx.fillRect(0, y, w, 1);
      }
      ctx.globalAlpha = 1;

      // --- Deep vignette ---
      const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.7);
      vig.addColorStop(0, 'transparent');
      vig.addColorStop(1, 'rgba(0,0,8,0.65)');
      ctx.fillStyle = vig;
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
  }, [stats]);

  return (
    <div style={{
      width: '100%', height: '100%', minHeight: 450, position: 'relative',
      background: DEEP_BG, borderRadius: 4, overflow: 'hidden',
      fontFamily: "'JetBrains Mono', 'Courier New', monospace",
    }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

      <div style={{
        position: 'absolute', top: 50, left: 12, zIndex: 2,
      }}>
        <div style={{
          fontSize: 12, fontWeight: 700, color: SONAR_CYAN,
          letterSpacing: '0.15em',
          textShadow: `0 0 10px rgba(0,229,255,0.5)`,
        }}>
          DEEP SONAR
        </div>
        <div style={{ fontSize: 8, color: 'rgba(0,229,255,0.4)', letterSpacing: '0.06em' }}>
          SUBMARINE WARFARE GRID
        </div>
      </div>

      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 2,
        background: 'rgba(0,8,16,0.85)',
        borderTop: '1px solid rgba(0,229,255,0.15)',
        padding: '5px 14px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: 9, letterSpacing: '0.06em',
      }}>
        <span style={{ color: SONAR_CYAN }}>{subsRef.current.length} VESSELS</span>
        <span style={{ color: SONAR_GREEN }}>{stats.active_agents ?? 0} ACTIVE</span>
        <span style={{ color: '#ffbf00' }}>{stats.idle_agents ?? 0} SILENT RUN</span>
        <span style={{ color: '#ff3333' }}>DEPTH: {(stats.cumulative_cost ?? 0).toFixed(1)}m</span>
      </div>
    </div>
  );
}
