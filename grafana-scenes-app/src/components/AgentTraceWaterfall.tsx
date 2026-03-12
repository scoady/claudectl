import React, { useEffect, useRef, useState, useCallback } from 'react';
import { API_BASE } from '../services/api';

// ── Types ────────────────────────────────────────────────────────────────────

interface SpanNode {
  id: string;
  name: string;
  label: string;        // left-side label
  duration: string;     // text inside bar
  offset_pct: number;
  width_pct: number;
  depth: number;
  status: 'ok' | 'warn' | 'error' | 'active';
  detail: string;       // shown on hover
  children?: SpanNode[];
}

interface AgentRaw {
  session_id: string;
  project_name: string;
  task: string;
  status: string;
  phase: string;
  model: string;
  started_at: string;
  turn_count: number;
  milestones: string[];
  is_controller: boolean;
  last_chunk?: string;
}

interface ToolMsg {
  type: string;
  tool_name?: string;
  tool_id?: string;
  tool_input?: Record<string, unknown>;
}

// ── Component ────────────────────────────────────────────────────────────────

export function AgentTraceWaterfall() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const [spans, setSpans] = useState<SpanNode[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, tools: 0 });
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['root']));

  const toggle = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ── Data fetch ─────────────────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const agentsResp = await fetch(`${API_BASE}/api/agents`);
        if (!agentsResp.ok) return;
        const agents: AgentRaw[] = await agentsResp.json();

        // Fetch tool calls for each agent
        const toolsBySession = new Map<string, ToolMsg[]>();
        await Promise.all(
          agents.map(async (a) => {
            try {
              const r = await fetch(`${API_BASE}/api/agents/${encodeURIComponent(a.session_id)}/messages`);
              if (r.ok) {
                const msgs: ToolMsg[] = await r.json();
                toolsBySession.set(a.session_id, msgs.filter(m => m.type === 'tool_use'));
              }
            } catch { /* ignore */ }
          })
        );

        if (!mounted) return;
        buildTree(agents, toolsBySession);
      } catch { /* ignore */ }
    }

    function buildTree(agents: AgentRaw[], toolsBySession: Map<string, ToolMsg[]>) {
      // Group agents by project
      const byProject = new Map<string, AgentRaw[]>();
      for (const a of agents) {
        const p = a.project_name || 'unknown';
        if (!byProject.has(p)) byProject.set(p, []);
        byProject.get(p)!.push(a);
      }

      let totalTools = 0;
      const tree: SpanNode[] = [];

      for (const [project, projectAgents] of byProject) {
        const projStatus = projectAgents.some(a => a.phase === 'error') ? 'error' as const
          : projectAgents.some(a => a.status === 'working') ? 'active' as const : 'ok' as const;

        const projNode: SpanNode = {
          id: `proj-${project}`,
          name: 'dispatch',
          label: project,
          duration: `${projectAgents.length} session${projectAgents.length !== 1 ? 's' : ''}`,
          offset_pct: 0,
          width_pct: 100,
          depth: 0,
          status: projStatus,
          detail: `project: ${project}`,
          children: [],
        };

        for (const agent of projectAgents) {
          const tools = toolsBySession.get(agent.session_id) || [];
          totalTools += tools.length;
          const maxTools = Math.max(1, ...Array.from(toolsBySession.values()).map(t => t.length));
          const agentWidth = Math.max(8, (Math.max(1, tools.length) / maxTools) * 85);

          const agentStatus = agent.phase === 'error' ? 'error' as const
            : agent.status === 'working' ? 'active' as const
            : agent.phase === 'idle' ? 'warn' as const : 'ok' as const;

          const agentNode: SpanNode = {
            id: `session-${agent.session_id}`,
            name: 'agent.session',
            label: agent.session_id.slice(0, 8),
            duration: agent.turn_count ? `${agent.turn_count}t · ${tools.length} tools` : `${tools.length} tools`,
            offset_pct: 2,
            width_pct: agentWidth,
            depth: 1,
            status: agentStatus,
            detail: `${agent.model} · ${agent.task?.slice(0, 80) || ''}`,
            children: [],
          };

          // Add tool spans as children
          for (let i = 0; i < tools.length; i++) {
            const t = tools[i];
            const toolName = t.tool_name || 'tool';
            const toolDesc = formatToolDesc(toolName, t.tool_input || {});
            const toolWidth = Math.max(3, (1 / Math.max(1, tools.length)) * agentWidth * 0.9);
            const toolOffset = 4 + (i / Math.max(1, tools.length)) * (agentWidth - toolWidth - 4);

            agentNode.children!.push({
              id: `tool-${agent.session_id}-${i}`,
              name: `tool.${toolName}`,
              label: toolName,
              duration: toolDesc,
              offset_pct: toolOffset,
              width_pct: toolWidth,
              depth: 2,
              status: 'ok',
              detail: JSON.stringify(t.tool_input || {}).slice(0, 120),
            });
          }

          projNode.children!.push(agentNode);
        }

        tree.push(projNode);
      }

      setSpans(tree);
      setStats({
        total: agents.length,
        active: agents.filter(a => a.status === 'working').length,
        tools: totalTools,
      });

      // Auto-expand all project nodes
      setExpanded(prev => {
        const next = new Set(prev);
        next.add('root');
        for (const p of tree) next.add(p.id);
        return next;
      });
    }

    load();
    const interval = setInterval(load, 8000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  // ── Particle animation ─────────────────────────────────────────────────────

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

      // Steam particles
      if (frame % 4 === 0) {
        particles.push({
          x: Math.random() * W(), y: H() + 5,
          vx: (Math.random() - 0.5) * 0.3, vy: -0.3 - Math.random() * 0.6,
          life: 1, decay: 0.004 + Math.random() * 0.005,
          size: 1 + Math.random() * 2, amber: Math.random() < 0.5,
        });
      }

      // Sparks near active bars
      if (frame % 8 === 0) {
        const angle = Math.random() * Math.PI * 2;
        particles.push({
          x: Math.random() * W(), y: Math.random() * H() * 0.6 + H() * 0.1,
          vx: Math.cos(angle) * 0.6, vy: Math.sin(angle) * 0.6,
          life: 1, decay: 0.025 + Math.random() * 0.02,
          size: 0.5 + Math.random(), spark: true,
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
          ctx.fillStyle = `rgba(251,191,36,${p.life * 0.7})`;
          ctx.shadowColor = 'rgba(251,191,36,0.5)';
          ctx.shadowBlur = 3;
          ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          const c = p.amber ? `rgba(251,191,36,${p.life * 0.12})` : `rgba(200,200,200,${p.life * 0.1})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = c;
          ctx.fill();
        }
      }
      if (particles.length > 150) particles.splice(0, particles.length - 150);
      animRef.current = requestAnimationFrame(animate);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    animRef.current = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(animRef.current); ro.disconnect(); };
  }, []);

  // ── Flatten tree for rendering ────────────────────────────────────────────

  function flatten(nodes: SpanNode[]): SpanNode[] {
    const result: SpanNode[] = [];
    for (const node of nodes) {
      result.push(node);
      if (node.children && expanded.has(node.id)) {
        result.push(...flatten(node.children));
      }
    }
    return result;
  }

  const flatSpans = flatten(spans);

  // ── Colors by status ──────────────────────────────────────────────────────

  function barClass(status: string) {
    switch (status) {
      case 'error': return 'spw-bar-error';
      case 'active': return 'spw-bar-active';
      case 'warn': return 'spw-bar-warn';
      default: return 'spw-bar-ok';
    }
  }

  function statusDot(status: string) {
    const colors: Record<string, string> = {
      active: '#22d3ee', ok: '#fbbf24', warn: '#fb923c', error: '#f87171',
    };
    return (
      <span style={{
        display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
        background: colors[status] || '#fbbf24', flexShrink: 0,
        boxShadow: `0 0 6px ${colors[status] || '#fbbf24'}`,
      }} />
    );
  }

  const hasChildren = (node: SpanNode) => node.children && node.children.length > 0;

  return (
    <div ref={containerRef} style={{
      position: 'relative', width: '100%',
      background: 'linear-gradient(180deg, #0a0e17 0%, #0d1117 100%)',
      borderRadius: 6, overflow: 'hidden',
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      border: '1px solid rgba(251,191,36,0.08)',
    }}>
      <style>{`
        @keyframes spw-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes spw-spin-r { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
        @keyframes spw-stripes { from { background-position: 0 0; } to { background-position: 20px 0; } }
        @keyframes spw-pulse { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
        @keyframes spw-glow { 0%,100% { box-shadow: 0 0 6px rgba(34,211,238,0.3); } 50% { box-shadow: 0 0 14px rgba(34,211,238,0.6); } }

        .spw-bar-ok {
          background: linear-gradient(90deg, rgba(251,191,36,0.3), rgba(251,191,36,0.55));
          box-shadow: 0 0 8px rgba(251,191,36,0.15);
        }
        .spw-bar-ok::after {
          content: ''; position: absolute; inset: 0;
          background: repeating-linear-gradient(90deg, transparent, transparent 5px, rgba(255,255,255,0.03) 5px, rgba(255,255,255,0.03) 10px);
          animation: spw-stripes 2s linear infinite;
        }
        .spw-bar-active {
          background: linear-gradient(90deg, rgba(34,211,238,0.35), rgba(34,211,238,0.6));
          box-shadow: 0 0 12px rgba(34,211,238,0.25);
          animation: spw-glow 2s ease-in-out infinite;
        }
        .spw-bar-active::after {
          content: ''; position: absolute; inset: 0;
          background: repeating-linear-gradient(90deg, transparent, transparent 5px, rgba(255,255,255,0.05) 5px, rgba(255,255,255,0.05) 10px);
          animation: spw-stripes 1s linear infinite;
        }
        .spw-bar-warn {
          background: linear-gradient(90deg, rgba(251,191,36,0.25), rgba(251,191,36,0.5));
          box-shadow: 0 0 6px rgba(251,191,36,0.15);
        }
        .spw-bar-error {
          background: linear-gradient(90deg, rgba(248,113,113,0.35), rgba(248,113,113,0.65));
          box-shadow: 0 0 10px rgba(248,113,113,0.25);
        }

        .spw-row { transition: background 0.15s ease; }
        .spw-row:hover { background: rgba(251,191,36,0.03) !important; }
        .spw-row:hover .spw-hover-detail { opacity: 1; }
        .spw-expand-btn { cursor: pointer; user-select: none; transition: transform 0.2s ease; }
        .spw-scroll::-webkit-scrollbar { width: 4px; }
        .spw-scroll::-webkit-scrollbar-track { background: transparent; }
        .spw-scroll::-webkit-scrollbar-thumb { background: rgba(251,191,36,0.15); border-radius: 2px; }
      `}</style>

      {/* Particle canvas */}
      <canvas ref={canvasRef} style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 1,
      }} />

      {/* Background cogs */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {[
          { s: 90, x: 88, y: 8, sp: 22, d: 1 },
          { s: 65, x: 3, y: 75, sp: 28, d: -1 },
          { s: 50, x: 45, y: 45, sp: 20, d: 1 },
        ].map((c, i) => (
          <div key={i} style={{
            position: 'absolute', left: `${c.x}%`, top: `${c.y}%`,
            width: c.s, height: c.s, opacity: 0.025,
          }}>
            <svg viewBox="0 0 100 100" width={c.s} height={c.s} style={{
              animation: `${c.d < 0 ? 'spw-spin-r' : 'spw-spin'} ${c.sp}s linear infinite`,
            }}>
              <circle cx="50" cy="50" r="20" fill="none" stroke="rgba(251,191,36,0.6)" strokeWidth="4"/>
              <circle cx="50" cy="50" r="8" fill="rgba(251,191,36,0.3)"/>
              {[0,45,90,135,180,225,270,315].map(a => {
                const r = a * Math.PI / 180;
                return <line key={a}
                  x1={50+25*Math.cos(r)} y1={50+25*Math.sin(r)}
                  x2={50+38*Math.cos(r)} y2={50+38*Math.sin(r)}
                  stroke="rgba(251,191,36,0.5)" strokeWidth="6" strokeLinecap="round"/>;
              })}
            </svg>
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 14px 8px', borderBottom: '1px solid rgba(251,191,36,0.08)',
        position: 'relative', zIndex: 2,
      }}>
        <div>
          <div style={{
            fontSize: 14, fontWeight: 700, color: '#fbbf24',
            letterSpacing: '-0.02em', textShadow: '0 0 12px rgba(251,191,36,0.3)',
          }}>
            Agent Trace Waterfall
          </div>
          <div style={{ fontSize: 10, color: '#6e7681', marginTop: 1 }}>
            dispatch &rarr; agent.session &rarr; tool.* span hierarchy
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { label: `${stats.active} active`, color: '#22d3ee' },
            { label: `${stats.total} sessions`, color: '#fbbf24' },
            { label: `${stats.tools} tools`, color: '#fb923c' },
          ].map((s, i) => (
            <div key={i} style={{
              background: `${s.color}10`, border: `1px solid ${s.color}30`,
              borderRadius: 4, padding: '2px 8px', fontSize: 10,
              color: s.color, fontWeight: 600,
            }}>{s.label}</div>
          ))}
        </div>
      </div>

      {/* Column headers */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '4px 14px',
        borderBottom: '1px solid rgba(251,191,36,0.05)',
        position: 'relative', zIndex: 2, fontSize: 9, color: '#484f58',
        textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>
        <div style={{ minWidth: 240 }}>Span</div>
        <div style={{ flex: 1 }}>Waterfall</div>
        <div style={{ minWidth: 200 }}>Detail</div>
      </div>

      {/* Waterfall rows */}
      <div className="spw-scroll" style={{
        overflowX: 'hidden', padding: '4px 8px',
        display: 'flex', flexDirection: 'column', gap: 1,
        position: 'relative', zIndex: 2,
      }}>
        {flatSpans.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#484f58', fontSize: 12 }}>
            No active agent sessions. Dispatch a task to see traces here.
          </div>
        )}
        {flatSpans.map((node, i) => (
          <div key={node.id} className="spw-row" style={{
            display: 'flex', alignItems: 'center', gap: 8,
            minHeight: 28, padding: '2px 6px', borderRadius: 3,
          }}>
            {/* Label column — wider, no truncation */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              minWidth: 240, flexShrink: 0,
              paddingLeft: node.depth * 18,
            }}>
              {hasChildren(node) ? (
                <span className="spw-expand-btn"
                  onClick={() => toggle(node.id)}
                  style={{
                    fontSize: 9, color: '#fbbf24', width: 14, textAlign: 'center',
                    transform: expanded.has(node.id) ? 'rotate(90deg)' : 'rotate(0deg)',
                    cursor: 'pointer',
                  }}>&#9654;</span>
              ) : (
                <span style={{ width: 14 }} />
              )}
              {statusDot(node.status)}
              <span style={{
                fontSize: 11, color: node.depth === 0 ? '#fbbf24' : node.depth === 1 ? '#e6edf3' : '#8b949e',
                fontWeight: node.depth === 0 ? 700 : node.depth === 1 ? 600 : 400,
                whiteSpace: 'nowrap',
              }}>{node.label}</span>
              <span style={{
                fontSize: 9, color: '#484f58', marginLeft: 3,
                whiteSpace: 'nowrap',
              }}>{node.name}</span>
            </div>

            {/* Bar column — text overflows to the right of the bar */}
            <div style={{ flex: 1, position: 'relative', height: 20 }}>
              <div style={{
                position: 'absolute', height: '100%', borderRadius: 3,
                left: `${node.offset_pct}%`, width: `${node.width_pct}%`,
              }}>
                <div className={barClass(node.status)} style={{
                  position: 'absolute', inset: 0, borderRadius: 3,
                }} />
              </div>
              {/* Duration text positioned after the bar end so it's never clipped */}
              <span style={{
                position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                left: `${Math.min(node.offset_pct + node.width_pct + 0.5, 85)}%`,
                fontSize: 10, color: '#c9d1d9', whiteSpace: 'nowrap',
                textShadow: '0 1px 4px rgba(0,0,0,0.9)',
              }}>{node.duration}</span>
            </div>

            {/* Detail column — always visible */}
            <div style={{
              fontSize: 9, color: '#6e7681',
              minWidth: 200, maxWidth: 300, whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis',
              textAlign: 'right',
            }}>{node.detail}</div>
          </div>
        ))}
        {/* Bottom padding so last row isn't flush */}
        <div style={{ height: 8 }} />
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatToolDesc(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'Read':
    case 'Write':
    case 'Edit': {
      const fp = input.file_path as string;
      return fp ? fp.split('/').pop() || fp : toolName;
    }
    case 'Bash': {
      const cmd = (input.command as string) || '';
      return cmd.length > 40 ? cmd.slice(0, 40) + '...' : cmd;
    }
    case 'Grep':
    case 'Glob': {
      const pat = (input.pattern as string) || '';
      return pat.length > 30 ? pat.slice(0, 30) + '...' : pat;
    }
    case 'Agent': {
      const desc = (input.description as string) || '';
      return desc.length > 40 ? desc.slice(0, 40) + '...' : desc;
    }
    default:
      return toolName;
  }
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; decay: number; size: number;
  amber?: boolean; spark?: boolean;
}
