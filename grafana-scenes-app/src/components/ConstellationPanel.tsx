import React, { useEffect, useRef, useState } from 'react';

interface AgentStar {
  id: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  label: string;
  project: string;
  status: 'active' | 'idle' | 'done' | 'error';
  vx: number;
  vy: number;
}

interface ConstellationData {
  active_agents: number;
  idle_agents: number;
  total_agents_spawned: number;
  model_breakdown: Record<string, number>;
  project_agent_counts: Record<string, number>;
}

const STATUS_COLORS: Record<string, string> = {
  active: '#7B61FF',
  idle: '#00D4AA',
  done: '#3498db',
  error: '#FF6B6B',
};

const STAR_NAMES = [
  'Sirius', 'Canopus', 'Arcturus', 'Vega', 'Capella',
  'Rigel', 'Betelgeuse', 'Aldebaran', 'Spica', 'Antares',
  'Pollux', 'Deneb', 'Regulus', 'Altair', 'Fomalhaut',
  'Bellatrix', 'Alnilam', 'Mintaka', 'Castor', 'Mira',
];

/**
 * ConstellationPanel - A custom React component that renders
 * agent status as an animated constellation star map.
 *
 * This fetches data directly from the claude-manager API since
 * SceneReactObject doesn't pass data context easily.
 */
export function ConstellationPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stars, setStars] = useState<AgentStar[]>([]);
  const [bgStars, setBgStars] = useState<Array<{ x: number; y: number; r: number; brightness: number }>>([]);
  const animFrameRef = useRef<number>(0);
  const dataRef = useRef<ConstellationData | null>(null);

  // Fetch data from the API
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Use relative URL - Grafana proxy will handle it, or go direct
        const resp = await fetch('/api/datasources/proxy/uid/P54F6429051492C34/api/metrics/summary');
        if (resp.ok) {
          dataRef.current = await resp.json();
          generateStars(dataRef.current!);
        }
      } catch {
        // Fallback: try direct API if proxy fails
        try {
          const resp = await fetch('http://grafana.localhost/api/datasources/proxy/uid/P54F6429051492C34/api/metrics/summary');
          if (resp.ok) {
            dataRef.current = await resp.json();
            generateStars(dataRef.current!);
          }
        } catch {
          // Generate demo stars if API unavailable
          generateDemoStars();
        }
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Generate background stars once
  useEffect(() => {
    const bg: typeof bgStars = [];
    for (let i = 0; i < 200; i++) {
      bg.push({
        x: Math.random(),
        y: Math.random(),
        r: Math.random() * 1.5 + 0.3,
        brightness: Math.random() * 0.6 + 0.2,
      });
    }
    setBgStars(bg);
  }, []);

  function generateStars(data: ConstellationData) {
    const newStars: AgentStar[] = [];
    let idx = 0;

    for (const [project, count] of Object.entries(data.project_agent_counts || {})) {
      const cx = 0.2 + Math.random() * 0.6;
      const cy = 0.2 + Math.random() * 0.6;

      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const dist = 0.08 + Math.random() * 0.12;
        const isActive = i < data.active_agents / Object.keys(data.project_agent_counts).length;
        const status = isActive ? 'active' : 'idle';

        newStars.push({
          id: `${project}-${i}`,
          x: cx + Math.cos(angle) * dist,
          y: cy + Math.sin(angle) * dist,
          radius: isActive ? 6 : 4,
          color: STATUS_COLORS[status],
          label: STAR_NAMES[idx % STAR_NAMES.length],
          project,
          status,
          vx: (Math.random() - 0.5) * 0.0002,
          vy: (Math.random() - 0.5) * 0.0002,
        });
        idx++;
      }
    }

    setStars(newStars);
  }

  function generateDemoStars() {
    const demo: AgentStar[] = [];
    const projects = ['project-alpha', 'project-beta'];
    let idx = 0;
    for (const project of projects) {
      const cx = 0.3 + projects.indexOf(project) * 0.4;
      const cy = 0.5;
      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2;
        demo.push({
          id: `${project}-${i}`,
          x: cx + Math.cos(angle) * 0.1,
          y: cy + Math.sin(angle) * 0.1,
          radius: 5,
          color: i === 0 ? STATUS_COLORS.active : STATUS_COLORS.idle,
          label: STAR_NAMES[idx % STAR_NAMES.length],
          project,
          status: i === 0 ? 'active' : 'idle',
          vx: (Math.random() - 0.5) * 0.0002,
          vy: (Math.random() - 0.5) * 0.0002,
        });
        idx++;
      }
    }
    setStars(demo);
  }

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;

    function render() {
      if (!canvas || !ctx) return;

      const w = canvas.width;
      const h = canvas.height;

      // Clear with dark background
      ctx.fillStyle = '#0d1117';
      ctx.fillRect(0, 0, w, h);

      // Draw background stars
      for (const s of bgStars) {
        const twinkle = 0.5 + Math.sin(frame * 0.02 + s.x * 100) * 0.3;
        ctx.globalAlpha = s.brightness * twinkle;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Draw grid
      ctx.strokeStyle = 'rgba(123, 97, 255, 0.05)';
      ctx.lineWidth = 0.5;
      const gridSize = 40;
      for (let x = 0; x < w; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Draw constellation lines between stars in same project
      const projectGroups: Record<string, AgentStar[]> = {};
      for (const star of stars) {
        if (!projectGroups[star.project]) projectGroups[star.project] = [];
        projectGroups[star.project].push(star);
      }

      for (const group of Object.values(projectGroups)) {
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            const a = group[i];
            const b = group[j];
            const shimmer = 0.15 + Math.sin(frame * 0.03 + i + j) * 0.05;
            ctx.strokeStyle = `rgba(123, 97, 255, ${shimmer})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x * w, a.y * h);
            ctx.lineTo(b.x * w, b.y * h);
            ctx.stroke();
          }
        }
      }

      // Draw agent stars
      for (const star of stars) {
        const sx = star.x * w;
        const sy = star.y * h;
        const pulse = star.status === 'active'
          ? 1 + Math.sin(frame * 0.05) * 0.3
          : 1;

        // Outer glow
        const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, star.radius * 4 * pulse);
        grad.addColorStop(0, star.color + '40');
        grad.addColorStop(1, star.color + '00');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(sx, sy, star.radius * 4 * pulse, 0, Math.PI * 2);
        ctx.fill();

        // Star body
        ctx.fillStyle = star.color;
        ctx.beginPath();
        ctx.arc(sx, sy, star.radius * pulse, 0, Math.PI * 2);
        ctx.fill();

        // Inner bright core
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(sx, sy, star.radius * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Label
        ctx.fillStyle = '#aab';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(star.label, sx, sy + star.radius * 2 + 12);

        // Subtle movement
        star.x += star.vx;
        star.y += star.vy;
        // Bounce off edges
        if (star.x < 0.05 || star.x > 0.95) star.vx *= -1;
        if (star.y < 0.05 || star.y > 0.95) star.vy *= -1;
      }

      // Draw project labels
      for (const [project, group] of Object.entries(projectGroups)) {
        if (group.length === 0) continue;
        const cx = group.reduce((s, g) => s + g.x, 0) / group.length * w;
        const cy = group.reduce((s, g) => s + g.y, 0) / group.length * h;
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(project, cx, cy - 30);
      }

      // Shooting star easter egg (occasional)
      if (frame % 300 === 0) {
        const sx = Math.random() * w;
        const sy = 0;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + 80, sy + 60);
        ctx.stroke();
      }

      frame++;
      animFrameRef.current = requestAnimationFrame(render);
    }

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
    });
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    }

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      resizeObserver.disconnect();
    };
  }, [stars, bgStars]);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 350, position: 'relative', background: '#0d1117', borderRadius: 4 }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
      <div style={{
        position: 'absolute',
        top: 8,
        left: 12,
        color: '#7B61FF',
        fontFamily: 'monospace',
        fontSize: 14,
        fontWeight: 'bold',
        textShadow: '0 0 10px rgba(123,97,255,0.5)',
      }}>
        Agent Constellation
      </div>
      <div style={{
        position: 'absolute',
        top: 8,
        right: 12,
        display: 'flex',
        gap: 12,
        fontFamily: 'monospace',
        fontSize: 11,
      }}>
        <span style={{ color: STATUS_COLORS.active }}>&#9679; Active</span>
        <span style={{ color: STATUS_COLORS.idle }}>&#9679; Idle</span>
        <span style={{ color: STATUS_COLORS.error }}>&#9679; Error</span>
      </div>
    </div>
  );
}
