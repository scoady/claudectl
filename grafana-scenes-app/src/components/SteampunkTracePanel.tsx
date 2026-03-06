import React, { useEffect, useRef, useState } from 'react';

interface TraceNode {
  name: string;
  duration: string;
  offset_pct: number;
  width_pct: number;
  depth: number;
  status: 'ok' | 'warn' | 'error';
  detail: string;
}

interface AgentData {
  session_id: string;
  star_name?: string;
  status: string;
  model?: string;
  project?: string;
  turns?: number;
  estimated_cost?: number;
  elapsed?: string;
  milestone?: string;
}

const API_BASE = 'http://localhost:4040';

/**
 * SteampunkTracePanel - A steampunk-themed distributed trace waterfall
 * showing agent activity as a dependency graph with spinning cogs,
 * steam particles, and amber-tinted bar charts.
 */
export function SteampunkTracePanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodes, setNodes] = useState<TraceNode[]>([]);
  const [totalDuration, setTotalDuration] = useState('--');
  const [totalSpans, setTotalSpans] = useState('0');
  const animRef = useRef<number>(0);
  const particlesRef = useRef<Array<{
    x: number; y: number; vx: number; vy: number;
    life: number; decay: number; size: number;
    amber?: boolean; spark?: boolean;
  }>>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/agents`);
        if (!resp.ok) throw new Error('API failed');
        const agents: AgentData[] = await resp.json();
        buildTraceNodes(agents);
      } catch {
        buildDemoNodes();
      }
    };

    function buildTraceNodes(agents: AgentData[]) {
      const sorted = [...agents].sort((a, b) => {
        const order = { active: 0, idle: 1, done: 2, error: 3 };
        return (order[a.status as keyof typeof order] ?? 2) - (order[b.status as keyof typeof order] ?? 2);
      });

      const traceNodes: TraceNode[] = [];
      let maxTurns = Math.max(1, ...sorted.map(a => a.turns ?? 1));

      // Add a root span for the system
      traceNodes.push({
        name: 'Agent Orchestrator',
        duration: `${sorted.length} agents`,
        offset_pct: 0,
        width_pct: 100,
        depth: 0,
        status: sorted.some(a => a.status === 'error') ? 'error' : 'ok',
        detail: 'root span',
      });

      // Group by project
      const projects = new Map<string, AgentData[]>();
      for (const a of sorted) {
        const p = a.project || 'unknown';
        if (!projects.has(p)) projects.set(p, []);
        projects.get(p)!.push(a);
      }

      for (const [project, projectAgents] of projects) {
        traceNodes.push({
          name: project,
          duration: `${projectAgents.length} agents`,
          offset_pct: 2,
          width_pct: 96,
          depth: 1,
          status: projectAgents.some(a => a.status === 'error') ? 'error'
            : projectAgents.some(a => a.status === 'active') ? 'ok' : 'warn',
          detail: `project: ${project}`,
        });

        for (const agent of projectAgents) {
          const turns = agent.turns ?? 0;
          const width = Math.max(3, (turns / maxTurns) * 80);
          const offset = 5 + Math.random() * 10;
          traceNodes.push({
            name: agent.star_name || agent.session_id?.slice(0, 8) || 'agent',
            duration: agent.elapsed || `${turns}t`,
            offset_pct: offset,
            width_pct: width,
            depth: 2,
            status: agent.status === 'error' ? 'error'
              : agent.status === 'active' ? 'ok' : 'warn',
            detail: agent.milestone || agent.model || '',
          });
        }
      }

      setNodes(traceNodes);
      setTotalDuration(`${sorted.filter(a => a.status === 'active').length} active`);
      setTotalSpans(`${sorted.length} spans`);
    }

    function buildDemoNodes() {
      const demo: TraceNode[] = [
        { name: 'Agent Orchestrator', duration: '6 agents', offset_pct: 0, width_pct: 100, depth: 0, status: 'ok', detail: 'root span' },
        { name: 'project-alpha', duration: '3 agents', offset_pct: 2, width_pct: 96, depth: 1, status: 'ok', detail: 'project: alpha' },
        { name: 'Sirius', duration: '42t', offset_pct: 5, width_pct: 65, depth: 2, status: 'ok', detail: 'Read main.py' },
        { name: 'Vega', duration: '18t', offset_pct: 12, width_pct: 35, depth: 2, status: 'ok', detail: 'Bash git status' },
        { name: 'Arcturus', duration: '5t', offset_pct: 8, width_pct: 12, depth: 2, status: 'warn', detail: 'idle' },
        { name: 'project-beta', duration: '3 agents', offset_pct: 2, width_pct: 96, depth: 1, status: 'error', detail: 'project: beta' },
        { name: 'Rigel', duration: '30t', offset_pct: 6, width_pct: 50, depth: 2, status: 'ok', detail: 'Edit config.ts' },
        { name: 'Capella', duration: '0t', offset_pct: 4, width_pct: 5, depth: 2, status: 'error', detail: 'timeout' },
        { name: 'Betelgeuse', duration: '22t', offset_pct: 15, width_pct: 40, depth: 2, status: 'ok', detail: 'Write tests' },
      ];
      setNodes(demo);
      setTotalDuration('4 active');
      setTotalSpans('9 spans');
    }

    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  // Animation loop for particles
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

      // Spawn steam particles
      if (frame % 3 === 0) {
        particles.push({
          x: Math.random() * W(),
          y: H() + 5,
          vx: (Math.random() - 0.5) * 0.3,
          vy: -0.3 - Math.random() * 0.8,
          life: 1,
          decay: 0.003 + Math.random() * 0.006,
          size: 1 + Math.random() * 2.5,
          amber: Math.random() < 0.6,
        });
      }

      // Spawn sparks
      if (frame % 12 === 0) {
        const angle = Math.random() * Math.PI * 2;
        const cx = Math.random() * W();
        const cy = Math.random() * H() * 0.5 + H() * 0.1;
        particles.push({
          x: cx, y: cy,
          vx: Math.cos(angle) * (0.5 + Math.random()),
          vy: Math.sin(angle) * (0.5 + Math.random()),
          life: 1,
          decay: 0.02 + Math.random() * 0.02,
          size: 0.5 + Math.random() * 1.2,
          spark: true,
        });
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        if (p.spark) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(251,191,36,${p.life * 0.8})`;
          ctx.shadowColor = 'rgba(251,191,36,0.6)';
          ctx.shadowBlur = 4;
          ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          const alpha = p.life * 0.15;
          const color = p.amber ? `rgba(251,191,36,${alpha})` : `rgba(200,200,200,${alpha})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
        }
      }
      if (particles.length > 200) particles.splice(0, particles.length - 200);

      animRef.current = requestAnimationFrame(animate);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
    };
  }, []);

  // Animate bars on mount/update
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const rows = container.querySelectorAll('.sp-trace-row') as NodeListOf<HTMLElement>;
    rows.forEach((row, i) => {
      row.style.opacity = '0';
      row.style.transform = 'translateX(-8px)';
      row.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      setTimeout(() => {
        row.style.opacity = '1';
        row.style.transform = 'translateX(0)';
      }, 60 * i);
    });
  }, [nodes]);

  const cogSvg = (
    <svg className="sp-cog-icon" viewBox="0 0 24 24" width="14" height="14">
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"
        stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );

  return (
    <div ref={containerRef} style={{
      position: 'relative', width: '100%', height: '100%', minHeight: 350,
      background: '#0d1117', borderRadius: 4, overflow: 'hidden',
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    }}>
      <style>{`
        @keyframes sp-spin-cog { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes sp-spin-cog-reverse { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
        @keyframes sp-scroll-stripes { from { background-position: 0 0; } to { background-position: 24px 0; } }
        @keyframes sp-float-cog { 0%,100% { transform: rotate(0deg) scale(1); opacity:0.04; } 50% { transform: rotate(180deg) scale(1.05); opacity:0.07; } }
        .sp-cog-icon { color: #fbbf24; animation: sp-spin-cog 4s linear infinite; flex-shrink: 0; opacity: 0.7; }
        .sp-trace-row[data-status="error"] .sp-cog-icon { color: #f87171; filter: drop-shadow(0 0 4px rgba(248,113,113,0.6)); animation: sp-spin-cog 1.5s linear infinite; }
        .sp-trace-row[data-status="warn"] .sp-cog-icon { color: #fbbf24; filter: drop-shadow(0 0 3px rgba(251,191,36,0.5)); }
        .sp-bar-fill { position: absolute; inset: 0; border-radius: 3px; background: linear-gradient(90deg, rgba(251,191,36,0.35), rgba(251,191,36,0.6)); box-shadow: 0 0 8px rgba(251,191,36,0.2); overflow: hidden; }
        .sp-bar-fill::after { content: ''; position: absolute; inset: 0; background: repeating-linear-gradient(90deg, transparent, transparent 6px, rgba(255,255,255,0.04) 6px, rgba(255,255,255,0.04) 12px); animation: sp-scroll-stripes 2s linear infinite; }
        .sp-trace-row[data-status="error"] .sp-bar-fill { background: linear-gradient(90deg, rgba(248,113,113,0.4), rgba(248,113,113,0.7)); box-shadow: 0 0 12px rgba(248,113,113,0.3); }
        .sp-trace-row[data-status="warn"] .sp-bar-fill { background: linear-gradient(90deg, rgba(251,191,36,0.4), rgba(251,191,36,0.7)); box-shadow: 0 0 10px rgba(251,191,36,0.3); }
        .sp-trace-row:hover { background: rgba(251,191,36,0.04); border-radius: 4px; }
        .sp-trace-row:hover .sp-row-detail { opacity: 1; max-height: 20px; }
        .sp-waterfall::-webkit-scrollbar { width: 4px; }
        .sp-waterfall::-webkit-scrollbar-track { background: transparent; }
        .sp-waterfall::-webkit-scrollbar-thumb { background: rgba(251,191,36,0.2); border-radius: 2px; }
      `}</style>
      <canvas ref={canvasRef} style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1,
      }} />

      {/* Decorative background cogs */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {[
          { s: 80, x: 85, y: 10, sp: 20, d: 1 },
          { s: 60, x: 5, y: 70, sp: 25, d: -1 },
          { s: 100, x: 75, y: 75, sp: 30, d: 1 },
          { s: 45, x: 20, y: 15, sp: 18, d: -1 },
          { s: 55, x: 55, y: 50, sp: 22, d: 1 },
        ].map((c, i) => (
          <div key={i} style={{
            position: 'absolute', left: `${c.x}%`, top: `${c.y}%`,
            width: c.s, height: c.s, opacity: 0.035, pointerEvents: 'none',
          }}>
            <svg viewBox="0 0 100 100" width={c.s} height={c.s} style={{
              animation: `${c.d < 0 ? 'sp-spin-cog-reverse' : 'sp-spin-cog'} ${c.sp}s linear infinite`,
            }}>
              <circle cx="50" cy="50" r="20" fill="none" stroke="rgba(251,191,36,0.6)" strokeWidth="4"/>
              <circle cx="50" cy="50" r="8" fill="rgba(251,191,36,0.3)"/>
              {[0, 45, 90, 135, 180, 225, 270, 315].map(a => {
                const r = a * Math.PI / 180;
                return (
                  <line key={a}
                    x1={50 + 25 * Math.cos(r)} y1={50 + 25 * Math.sin(r)}
                    x2={50 + 38 * Math.cos(r)} y2={50 + 38 * Math.sin(r)}
                    stroke="rgba(251,191,36,0.5)" strokeWidth="6" strokeLinecap="round"
                  />
                );
              })}
            </svg>
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        padding: '10px 14px 8px', borderBottom: '1px solid rgba(251,191,36,0.1)',
        position: 'relative', zIndex: 2,
      }}>
        <div>
          <div style={{
            fontSize: 14, fontWeight: 700, color: '#fbbf24',
            letterSpacing: '-0.02em', textShadow: '0 0 12px rgba(251,191,36,0.35)',
          }}>
            Steampunk Agent Trace
          </div>
          <div style={{ fontSize: 10, color: '#8b949e', marginTop: 2 }}>
            Distributed agent activity waterfall
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{
            background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
            borderRadius: 4, padding: '2px 8px', fontSize: 11, color: '#fbbf24', fontWeight: 600,
          }}>{totalDuration}</div>
          <div style={{
            background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
            borderRadius: 4, padding: '2px 8px', fontSize: 11, color: '#fbbf24', fontWeight: 600,
          }}>{totalSpans}</div>
        </div>
      </div>

      {/* Waterfall rows */}
      <div className="sp-waterfall" style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden',
        padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 2,
        position: 'relative', zIndex: 2, maxHeight: 'calc(100% - 50px)',
      }}>
        {nodes.map((node, i) => (
          <div key={i} className="sp-trace-row" data-status={node.status} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            minHeight: 24, padding: '3px 0', position: 'relative', transition: 'background 0.2s',
          }}>
            {/* Label */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              minWidth: 140, maxWidth: 140, flexShrink: 0,
              paddingLeft: node.depth * 14,
            }}>
              <span style={{
                animation: i % 2 === 1 ? 'sp-spin-cog-reverse 4s linear infinite' : undefined,
              }}>{cogSvg}</span>
              <span style={{
                fontSize: 10, color: '#e6edf3', whiteSpace: 'nowrap',
                overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{node.name}</span>
            </div>

            {/* Bar area */}
            <div style={{ flex: 1, position: 'relative', height: 16 }}>
              <div style={{
                position: 'absolute', height: '100%', borderRadius: 3,
                display: 'flex', alignItems: 'center',
                left: `${node.offset_pct}%`,
                width: `${node.width_pct}%`,
              }}>
                <div className="sp-bar-fill" />
                <span style={{
                  position: 'relative', zIndex: 1, fontSize: 9,
                  color: '#e6edf3', paddingLeft: 4, whiteSpace: 'nowrap',
                  textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                }}>{node.duration}</span>
              </div>
            </div>

            {/* Detail on hover */}
            <div className="sp-row-detail" style={{
              fontSize: 9, color: '#6e7681', opacity: 0, maxHeight: 0,
              overflow: 'hidden', transition: 'all 0.25s ease',
              whiteSpace: 'nowrap', minWidth: 120, maxWidth: 160,
              textOverflow: 'ellipsis', textAlign: 'right',
            }}>{node.detail}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
