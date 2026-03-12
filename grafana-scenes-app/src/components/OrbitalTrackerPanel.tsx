import React, { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../services/api';

interface AgentOrbit {
  id: string;
  name: string;
  project: string;
  status: string;
  angle: number;
  orbitIndex: number;
  turns: number;
  model: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: '#67e8f9',
  idle: '#4ade80',
  done: '#6e7681',
  error: '#f87171',
};

/**
 * OrbitalTrackerPanel - Animated orbital visualization showing agents
 * orbiting around project "planets". Inspired by the ISS Orbital Tracker
 * widget, adapted to visualize agent-project relationships as an orrery.
 */
export function OrbitalTrackerPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [agents, setAgents] = useState<AgentOrbit[]>([]);
  const [stats, setStats] = useState({ active: 0, idle: 0, total: 0, cost: '0.00' });
  const animRef = useRef<number>(0);
  const starsRef = useRef<Array<{ x: number; y: number; s: number; b: number }>>([]);
  const particlesRef = useRef<Array<{
    x: number; y: number; vx: number; vy: number; life: number; color: string;
  }>>([]);

  // Generate background stars once
  useEffect(() => {
    const stars: typeof starsRef.current = [];
    for (let i = 0; i < 150; i++) {
      stars.push({
        x: Math.random(), y: Math.random(),
        s: Math.random() * 1.8 + 0.3,
        b: Math.random(),
      });
    }
    starsRef.current = stars;
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [agentsResp, statsResp] = await Promise.all([
          fetch(`${API_BASE}/api/agents`),
          fetch(`${API_BASE}/api/stats`),
        ]);

        if (agentsResp.ok) {
          const raw: any[] = await agentsResp.json();
          const orbits: AgentOrbit[] = raw.map((a, i) => ({
            id: a.session_id || `agent-${i}`,
            name: a.star_name || a.session_id?.slice(0, 8) || `Agent ${i}`,
            project: a.project || 'unknown',
            status: a.status || 'idle',
            angle: (i / Math.max(raw.length, 1)) * Math.PI * 2 + Math.random() * 0.5,
            orbitIndex: i,
            turns: a.turns || 0,
            model: a.model || '',
          }));
          setAgents(orbits);
        }

        if (statsResp.ok) {
          const s = await statsResp.json();
          setStats({
            active: s.active_agents ?? 0,
            idle: s.idle_agents ?? 0,
            total: s.total_agents_spawned ?? 0,
            cost: (s.cumulative_cost ?? 0).toFixed(2),
          });
        }
      } catch {
        // Demo data
        const demoAgents: AgentOrbit[] = [
          { id: '1', name: 'Sirius', project: 'alpha', status: 'active', angle: 0, orbitIndex: 0, turns: 42, model: 'opus' },
          { id: '2', name: 'Vega', project: 'alpha', status: 'active', angle: 2, orbitIndex: 1, turns: 18, model: 'sonnet' },
          { id: '3', name: 'Rigel', project: 'beta', status: 'idle', angle: 1, orbitIndex: 2, turns: 30, model: 'opus' },
          { id: '4', name: 'Arcturus', project: 'alpha', status: 'error', angle: 4, orbitIndex: 3, turns: 5, model: 'sonnet' },
          { id: '5', name: 'Capella', project: 'beta', status: 'active', angle: 3.5, orbitIndex: 4, turns: 22, model: 'opus' },
          { id: '6', name: 'Betelgeuse', project: 'gamma', status: 'idle', angle: 5, orbitIndex: 5, turns: 10, model: 'haiku' },
        ];
        setAgents(demoAgents);
        setStats({ active: 3, idle: 2, total: 6, cost: '1.45' });
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

    const stars = starsRef.current;
    const particles = particlesRef.current;

    function drawEarth(cx: number, cy: number, r: number) {
      // Central "core" planet
      const grd = ctx!.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
      grd.addColorStop(0, '#1a3a5c');
      grd.addColorStop(0.4, '#0e2d4c');
      grd.addColorStop(0.7, '#0a1f36');
      grd.addColorStop(1, '#061218');
      ctx!.beginPath();
      ctx!.arc(cx, cy, r, 0, Math.PI * 2);
      ctx!.fillStyle = grd;
      ctx!.fill();

      // Atmosphere glow
      const atm = ctx!.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.3);
      atm.addColorStop(0, 'rgba(103,232,249,0.12)');
      atm.addColorStop(0.5, 'rgba(103,232,249,0.04)');
      atm.addColorStop(1, 'transparent');
      ctx!.beginPath();
      ctx!.arc(cx, cy, r * 1.3, 0, Math.PI * 2);
      ctx!.fillStyle = atm;
      ctx!.fill();

      // Abstract land masses
      ctx!.save();
      ctx!.beginPath();
      ctx!.arc(cx, cy, r, 0, Math.PI * 2);
      ctx!.clip();
      ctx!.globalAlpha = 0.2;
      ctx!.fillStyle = '#2d5a4f';
      const t = Date.now() * 0.00003;
      for (let i = 0; i < 4; i++) {
        const lx = cx + Math.cos(t + i * 1.3) * r * 0.5;
        const ly = cy + Math.sin(t * 0.7 + i * 1.8) * r * 0.4;
        ctx!.beginPath();
        ctx!.ellipse(lx, ly, r * 0.35, r * 0.2, i * 0.8, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.restore();

      // Label
      ctx!.fillStyle = 'rgba(103,232,249,0.6)';
      ctx!.font = '11px monospace';
      ctx!.textAlign = 'center';
      ctx!.fillText('ORCHESTRATOR', cx, cy + r + 18);
    }

    function drawAgent(x: number, y: number, agent: AgentOrbit) {
      const color = STATUS_COLORS[agent.status] || STATUS_COLORS.idle;
      const scale = agent.status === 'active' ? 1.2 : 0.9;
      const size = 4 * scale;

      // Glow
      const glow = ctx!.createRadialGradient(x, y, 0, x, y, size * 4);
      glow.addColorStop(0, color + '60');
      glow.addColorStop(1, color + '00');
      ctx!.fillStyle = glow;
      ctx!.beginPath();
      ctx!.arc(x, y, size * 4, 0, Math.PI * 2);
      ctx!.fill();

      // Body
      ctx!.fillStyle = color;
      ctx!.beginPath();
      ctx!.arc(x, y, size, 0, Math.PI * 2);
      ctx!.fill();

      // Core
      ctx!.fillStyle = '#ffffff';
      ctx!.globalAlpha = 0.7;
      ctx!.beginPath();
      ctx!.arc(x, y, size * 0.3, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.globalAlpha = 1;

      // Name label
      ctx!.fillStyle = '#aab';
      ctx!.font = '9px monospace';
      ctx!.textAlign = 'center';
      ctx!.fillText(agent.name, x, y + size * 2 + 10);

      // Emit particle trail
      if (agent.status === 'active' && Math.random() < 0.3) {
        particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 1.2,
          vy: (Math.random() - 0.5) * 1.2,
          life: 1,
          color,
        });
      }
    }

    let frame = 0;
    function render() {
      if (!ctx) return;
      const w = W / 2;
      const h = H / 2;

      ctx.clearRect(0, 0, w, h);

      // Background
      ctx.fillStyle = '#0a0e14';
      ctx.fillRect(0, 0, w, h);

      // Stars
      const t = Date.now() * 0.001;
      for (const s of stars) {
        ctx.globalAlpha = 0.3 + Math.sin(t + s.b * 10) * 0.3;
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      const cx = w / 2;
      const cy = h * 0.45;
      const coreR = Math.min(w, h) * 0.08;

      // Group agents by project to create orbital rings
      const projects = new Map<string, AgentOrbit[]>();
      for (const a of agents) {
        if (!projects.has(a.project)) projects.set(a.project, []);
        projects.get(a.project)!.push(a);
      }

      const projectList = Array.from(projects.keys());

      // Draw orbital paths
      projectList.forEach((project, pi) => {
        const orbitR = coreR * 2.5 + pi * (Math.min(w, h) * 0.1 + 10);
        const tilt = 0.35 + pi * 0.05;

        ctx.save();
        ctx.strokeStyle = `rgba(103,232,249,${0.06 + pi * 0.01})`;
        ctx.lineWidth = 0.8;
        ctx.setLineDash([4, 8]);
        ctx.beginPath();
        ctx.ellipse(cx, cy, orbitR, orbitR * tilt, -0.15 + pi * 0.1, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // Project label on orbit
        const labelAngle = -Math.PI / 2 + pi * 0.3;
        const lx = cx + Math.cos(labelAngle) * orbitR;
        const ly = cy + Math.sin(labelAngle) * orbitR * tilt;
        ctx.fillStyle = 'rgba(167,139,250,0.5)';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(project, lx, ly - 12);
      });

      // Draw core planet
      drawEarth(cx, cy, coreR);

      // Draw agents on their orbits
      frame++;
      const speed = 0.005;
      for (const [project, projectAgents] of projects) {
        const pi = projectList.indexOf(project);
        const orbitR = coreR * 2.5 + pi * (Math.min(w, h) * 0.1 + 10);
        const tilt = 0.35 + pi * 0.05;
        const rotation = -0.15 + pi * 0.1;

        for (let ai = 0; ai < projectAgents.length; ai++) {
          const agent = projectAgents[ai];
          const baseAngle = (ai / projectAgents.length) * Math.PI * 2;
          const currentAngle = baseAngle + frame * speed * (agent.status === 'active' ? 1.5 : 0.5);

          const ax = cx + Math.cos(currentAngle + rotation) * orbitR;
          const ay = cy + Math.sin(currentAngle + rotation) * orbitR * tilt;

          drawAgent(ax, ay, agent);
        }
      }

      // Draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        ctx.globalAlpha = p.life * 0.5;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (particles.length > 80) particles.splice(0, 20);

      // Shooting star easter egg
      if (frame % 400 === 0) {
        const sx = Math.random() * w;
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx + 60, 50);
        ctx.stroke();
      }

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

  return (
    <div style={{
      width: '100%', height: '100%', minHeight: 380, position: 'relative',
      background: '#0a0e14', borderRadius: 4, overflow: 'hidden',
    }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />

      {/* Top-left overlay */}
      <div style={{
        position: 'absolute', top: 10, left: 14, zIndex: 2,
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        <div style={{
          fontSize: 11, color: '#67e8f9', letterSpacing: '0.08em',
          textShadow: '0 0 8px rgba(103,232,249,0.4)',
        }}>AGENT ORBITAL TRACKER</div>
        <div style={{ fontSize: 9, color: '#6e7681', marginTop: 2 }}>
          {agents.length} agents across {new Set(agents.map(a => a.project)).size} projects
        </div>
      </div>

      {/* Telemetry row */}
      <div style={{
        position: 'absolute', bottom: 28, left: 0, right: 0,
        display: 'flex', justifyContent: 'space-around', padding: '0 10px', zIndex: 2,
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        {[
          { val: stats.active.toString(), label: 'ACTIVE' },
          { val: stats.idle.toString(), label: 'IDLE' },
          { val: stats.total.toString(), label: 'TOTAL' },
          { val: `$${stats.cost}`, label: 'COST' },
        ].map((item, i) => (
          <div key={i} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
          }}>
            <span style={{
              fontSize: 14, fontWeight: 700, color: '#e6edf3',
              textShadow: '0 0 6px rgba(103,232,249,0.2)',
            }}>{item.val}</span>
            <span style={{ fontSize: 8, color: '#6e7681', letterSpacing: '0.1em' }}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* Status indicator */}
      <div style={{
        position: 'absolute', bottom: 8, left: 0, right: 0, textAlign: 'center', zIndex: 2,
        fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
      }}>
        <span style={{
          display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
          background: stats.active > 0 ? '#4ade80' : '#fbbf24',
          boxShadow: stats.active > 0 ? '0 0 8px #4ade80' : '0 0 8px #fbbf24',
          marginRight: 4, verticalAlign: 'middle',
          animation: 'orbital-pulse 2s ease-in-out infinite',
        }} />
        <span style={{ color: '#6e7681' }}>STATUS:</span>{' '}
        <span style={{ color: stats.active > 0 ? '#4ade80' : '#fbbf24' }}>
          {stats.active > 0 ? 'AGENTS ACTIVE' : 'STANDBY'}
        </span>
      </div>

      <style>{`
        @keyframes orbital-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
