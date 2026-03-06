import React, { useEffect, useRef, useState } from 'react';

interface ProgressItem {
  label: string;
  value: number;
  max: number;
  color: string;
}

const API_BASE = 'http://host.docker.internal:4040';

function getColorForPct(pct: number): string {
  if (pct >= 90) return '#4ade80';
  if (pct >= 50) return '#67e8f9';
  if (pct >= 25) return '#fbbf24';
  return '#f87171';
}

/**
 * TaskProgressPanel - Animated progress bars showing task completion
 * across projects. Bars animate in with counting effects and neon glows.
 */
export function TaskProgressPanel() {
  const [items, setItems] = useState<ProgressItem[]>([]);
  const [animatedValues, setAnimatedValues] = useState<number[]>([]);
  const [title, setTitle] = useState('Agent Task Completion');
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const particlesRef = useRef<Array<{
    x: number; y: number; vx: number; vy: number;
    life: number; color: string; size: number;
  }>>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [projResp, statsResp] = await Promise.all([
          fetch(`${API_BASE}/api/projects`),
          fetch(`${API_BASE}/api/stats`),
        ]);

        const progressItems: ProgressItem[] = [];

        if (projResp.ok) {
          const projects: any[] = await projResp.json();

          // For each project, try to get task counts
          for (const project of projects.slice(0, 8)) {
            const name = project.name || project;
            try {
              const taskResp = await fetch(`${API_BASE}/api/projects/${name}/tasks`);
              if (taskResp.ok) {
                const tasks: any[] = await taskResp.json();
                const total = tasks.length;
                const done = tasks.filter((t: any) => t.status === 'done' || t.status === 'complete' || t.done).length;
                if (total > 0) {
                  const pct = Math.round((done / total) * 100);
                  progressItems.push({
                    label: name,
                    value: pct,
                    max: 100,
                    color: getColorForPct(pct),
                  });
                }
              }
            } catch { /* skip */ }
          }
        }

        if (statsResp.ok) {
          const stats = await statsResp.json();
          const activeAgents = stats.active_agents ?? 0;
          const totalAgents = stats.total_agents_spawned ?? 1;
          const utilization = totalAgents > 0 ? Math.round((activeAgents / Math.max(totalAgents, 1)) * 100) : 0;
          progressItems.push({
            label: 'Agent Utilization',
            value: Math.min(utilization, 100),
            max: 100,
            color: getColorForPct(utilization),
          });
        }

        if (progressItems.length === 0) {
          buildDemoItems();
        } else {
          setTitle('Project Task Completion');
          setItems(progressItems);
        }
      } catch {
        buildDemoItems();
      }
    };

    function buildDemoItems() {
      setItems([
        { label: 'Infrastructure', value: 100, max: 100, color: '#4ade80' },
        { label: 'Backend API', value: 85, max: 100, color: '#4ade80' },
        { label: 'Frontend UI', value: 62, max: 100, color: '#67e8f9' },
        { label: 'CI/CD Pipeline', value: 100, max: 100, color: '#4ade80' },
        { label: 'Documentation', value: 40, max: 100, color: '#fbbf24' },
        { label: 'Testing', value: 25, max: 100, color: '#fbbf24' },
        { label: 'Deployment', value: 15, max: 100, color: '#f87171' },
        { label: 'Overall', value: 61, max: 100, color: '#67e8f9' },
      ]);
    }

    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  // Animate values counting up
  useEffect(() => {
    if (items.length === 0) return;

    const targets = items.map(item => Math.min(100, Math.max(0, (item.value / item.max) * 100)));
    setAnimatedValues(new Array(items.length).fill(0));

    const startTime = performance.now();
    const duration = 1200;

    function tick(now: number) {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setAnimatedValues(targets.map(t => t * eased));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [items]);

  // Particle effects on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width * 2;
      canvas.height = rect.height * 2;
      ctx.setTransform(2, 0, 0, 2, 0, 0);
    };
    resize();

    const W = () => canvas.width / 2;
    const H = () => canvas.height / 2;
    const particles = particlesRef.current;

    let frame = 0;
    function animate() {
      if (!ctx) return;
      ctx.clearRect(0, 0, W(), H());
      frame++;

      // Emit particles from progress bar ends
      if (frame % 8 === 0 && items.length > 0) {
        const idx = Math.floor(Math.random() * items.length);
        const pct = (items[idx].value / items[idx].max) * 100;
        if (pct > 0) {
          const barY = 80 + idx * (H() - 100) / Math.max(items.length, 1);
          const barX = (pct / 100) * W() * 0.85 + W() * 0.05;
          particles.push({
            x: barX, y: barY,
            vx: (Math.random() - 0.3) * 1.5,
            vy: (Math.random() - 0.5) * 1,
            life: 1, color: items[idx].color, size: 1 + Math.random() * 2,
          });
        }
      }

      // Ambient sparkle
      if (frame % 15 === 0) {
        particles.push({
          x: Math.random() * W(), y: Math.random() * H(),
          vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.5,
          life: 1, color: '#67e8f9', size: 0.5 + Math.random(),
        });
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.015;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        ctx.globalAlpha = p.life * 0.6;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      if (particles.length > 100) particles.splice(0, particles.length - 100);

      animRef.current = requestAnimationFrame(animate);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
    };
  }, [items]);

  return (
    <div ref={containerRef} style={{
      position: 'relative', width: '100%', height: '100%', minHeight: 350,
      background: '#0d1117', borderRadius: 4, overflow: 'hidden',
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      padding: '16px 20px', boxSizing: 'border-box',
      display: 'flex', flexDirection: 'column',
    }}>
      <style>{`
        @keyframes tp-slide-in {
          from { opacity: 0; transform: translateX(-12px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes tp-shimmer {
          0% { left: -100%; }
          100% { left: 200%; }
        }
        .tp-track { position: relative; overflow: hidden; }
        .tp-track::after {
          content: '';
          position: absolute; top: 0; left: -100%; width: 100%; height: 100%;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%);
          animation: tp-shimmer 3s ease-in-out infinite;
        }
      `}</style>

      <canvas ref={canvasRef} style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 1,
      }} />

      {/* Title */}
      <div style={{
        fontSize: 13, fontWeight: 700, letterSpacing: '-0.02em',
        color: '#8b949e', textTransform: 'uppercase', marginBottom: 16,
        position: 'relative', zIndex: 2,
      }}>
        <span style={{ textShadow: '0 0 10px rgba(103,232,249,0.3)' }}>{title}</span>
      </div>

      {/* Progress items */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 14,
        flex: 1, justifyContent: 'center',
        position: 'relative', zIndex: 2,
      }}>
        {items.map((item, i) => {
          const pct = animatedValues[i] ?? 0;
          return (
            <div key={i} style={{
              opacity: 0, animation: `tp-slide-in 0.4s ease forwards`,
              animationDelay: `${i * 80}ms`,
            }}>
              {/* Label row */}
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'baseline', marginBottom: 5,
              }}>
                <span style={{ fontSize: 13, color: '#e6edf3' }}>{item.label}</span>
                <span style={{ fontSize: 12, color: '#8b949e', fontVariantNumeric: 'tabular-nums' }}>
                  {Math.round(pct)}%
                </span>
              </div>

              {/* Track */}
              <div className="tp-track" style={{
                height: 6, background: 'rgba(48,54,61,0.8)',
                borderRadius: 99, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', width: `${pct}%`, borderRadius: 99,
                  background: item.color,
                  boxShadow: `0 0 8px ${item.color}80, 0 0 16px ${item.color}40`,
                  transition: 'width 0.1s linear',
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Overall summary at bottom */}
      {items.length > 0 && (
        <div style={{
          marginTop: 16, paddingTop: 12,
          borderTop: '1px solid rgba(103,232,249,0.08)',
          display: 'flex', justifyContent: 'space-between',
          fontSize: 10, color: '#6e7681',
          position: 'relative', zIndex: 2,
        }}>
          <span>{items.length} categories tracked</span>
          <span>
            {items.filter(i => i.value >= i.max * 0.9).length} / {items.length} near complete
          </span>
        </div>
      )}
    </div>
  );
}
