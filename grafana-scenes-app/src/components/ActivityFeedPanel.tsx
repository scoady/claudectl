import React, { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../services/api';

interface LogLine {
  ts: string;
  src: string;
  level: 'info' | 'warn' | 'error' | 'debug' | 'success';
  msg: string;
}

const LEVEL_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  info: { color: '#67e8f9', bg: 'rgba(103,232,249,0.1)', border: 'rgba(103,232,249,0.15)' },
  warn: { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.15)' },
  error: { color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.18)' },
  debug: { color: '#6e7681', bg: 'rgba(71,85,105,0.15)', border: 'rgba(71,85,105,0.2)' },
  success: { color: '#4ade80', bg: 'rgba(74,222,128,0.1)', border: 'rgba(74,222,128,0.15)' },
};

/**
 * ActivityFeedPanel - A retro CRT terminal-style live activity log
 * that shows agent milestones and system events as scrolling log lines.
 */
export function ActivityFeedPanel() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<LogLine[]>([]);
  const [cursorChar, setCursorChar] = useState('\u2588');
  const animRef = useRef<number>(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [agentsResp, statsResp, projectsResp] = await Promise.all([
          fetch(`${API_BASE}/api/agents`),
          fetch(`${API_BASE}/api/stats`),
          fetch(`${API_BASE}/api/projects`),
        ]);

        const newLines: LogLine[] = [];
        const now = new Date();
        const ts = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

        if (statsResp.ok) {
          const stats = await statsResp.json();
          newLines.push({
            ts, src: '[system]', level: 'info',
            msg: `Stats: ${stats.active_agents ?? 0} active, ${stats.total_agents_spawned ?? 0} spawned, $${(stats.cumulative_cost ?? 0).toFixed(2)} total cost`,
          });
        }

        if (projectsResp.ok) {
          const projects: any[] = await projectsResp.json();
          newLines.push({
            ts, src: '[projects]', level: 'info',
            msg: `${projects.length} managed projects loaded`,
          });
        }

        if (agentsResp.ok) {
          const agents: any[] = await agentsResp.json();
          const active = agents.filter(a => a.status === 'active');
          const idle = agents.filter(a => a.status === 'idle');
          const errors = agents.filter(a => a.status === 'error');

          if (active.length > 0) {
            for (const a of active.slice(0, 5)) {
              newLines.push({
                ts, src: `[${a.star_name || a.session_id?.slice(0, 8) || 'agent'}]`,
                level: 'success',
                msg: `Active on ${a.project || 'unknown'}: ${a.milestone || `${a.turns || 0} turns`}`,
              });
            }
            if (active.length > 5) {
              newLines.push({ ts, src: '[agents]', level: 'info', msg: `... and ${active.length - 5} more active agents` });
            }
          }

          if (idle.length > 0) {
            newLines.push({
              ts, src: '[agents]', level: 'debug',
              msg: `${idle.length} agents idle, awaiting dispatch`,
            });
          }

          if (errors.length > 0) {
            for (const a of errors.slice(0, 3)) {
              newLines.push({
                ts, src: `[${a.star_name || 'agent'}]`,
                level: 'error',
                msg: `Error on ${a.project || 'unknown'}: ${a.error || 'process terminated'}`,
              });
            }
          }

          if (agents.length === 0) {
            newLines.push({ ts, src: '[agents]', level: 'warn', msg: 'No agents running -- listening for dispatches' });
          }
        }

        newLines.push({ ts, src: '[grafana]', level: 'debug', msg: 'Poll cycle complete -- next in 10s' });

        setLines(prev => {
          const updated = [...prev, ...newLines];
          return updated.slice(-50); // Keep last 50 lines
        });
      } catch {
        const now = new Date();
        const ts = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        setLines(prev => [...prev, {
          ts, src: '[system]', level: 'warn',
          msg: 'Unable to reach API -- retrying in 10s',
        }].slice(-50));
      }
    };

    // Initial demo lines
    const now = new Date();
    const ts = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    setLines([
      { ts, src: '[system]', level: 'info', msg: 'Grafana Scenes agent monitor initialized' },
      { ts, src: '[grafana]', level: 'info', msg: 'Connecting to claude-manager API...' },
    ]);

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      setTimeout(() => { el.scrollTop = el.scrollHeight; }, 100);
    }
  }, [lines]);

  // CRT flicker
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const flicker = () => {
      body.style.opacity = (0.97 + Math.random() * 0.03).toString();
      animRef.current = requestAnimationFrame(flicker);
    };
    flicker();
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  // Cursor animation
  useEffect(() => {
    const chars = '\u2588\u2593\u2592\u2591';
    let ci = 0;
    const interval = setInterval(() => {
      ci = (ci + 1) % chars.length;
      setCursorChar(chars[ci]);
    }, 400);
    return () => clearInterval(interval);
  }, []);

  // Random glitch effect
  useEffect(() => {
    const interval = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      const lineEls = el.querySelectorAll('.af-log-line') as NodeListOf<HTMLElement>;
      if (lineEls.length === 0) return;
      const line = lineEls[Math.floor(Math.random() * lineEls.length)];
      line.style.transform = `translateX(${(Math.random() - 0.5) * 3}px)`;
      line.style.textShadow = `${Math.random() * 2}px 0 #67e8f9, ${-Math.random() * 2}px 0 #f87171`;
      setTimeout(() => {
        line.style.transform = '';
        line.style.textShadow = '';
      }, 80);
    }, 2500 + Math.random() * 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%', minHeight: 350,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      background: '#0a0e14', borderRadius: 4,
    }}>
      <style>{`
        @keyframes af-pulse-glow {
          0%,100% { box-shadow: 0 0 4px #4ade80; opacity: 1; }
          50% { box-shadow: 0 0 12px #4ade80, 0 0 20px rgba(74,222,128,0.3); opacity: 0.7; }
        }
        @keyframes af-scanline-scroll {
          0% { background-position: 0 0; }
          100% { background-position: 0 200px; }
        }
        @keyframes af-line-appear {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes af-blink-cursor {
          0%,100% { opacity: 1; } 50% { opacity: 0; }
        }
        @keyframes af-glow-breathe {
          0%,100% { opacity: 0.5; } 50% { opacity: 1; }
        }
        @keyframes af-error-flash {
          0%,100% { border-color: rgba(248,113,113,0.18); }
          50% { border-color: rgba(248,113,113,0.45); box-shadow: 0 0 6px rgba(248,113,113,0.15); }
        }
        .af-scroll::-webkit-scrollbar { width: 3px; }
        .af-scroll::-webkit-scrollbar-thumb { background: rgba(103,232,249,0.2); border-radius: 3px; }
        .af-log-line { transition: transform 0.08s, text-shadow 0.08s; }
        .af-log-line:hover { background: rgba(103,232,249,0.04); border-radius: 2px; }
      `}</style>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', padding: '8px 12px',
        background: 'rgba(14,21,37,0.9)', borderBottom: '1px solid rgba(103,232,249,0.08)',
        flexShrink: 0, gap: 10,
      }}>
        <div style={{ display: 'flex', gap: 5 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#f87171', boxShadow: '0 0 6px rgba(248,113,113,0.5)', display: 'inline-block' }} />
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#fbbf24', boxShadow: '0 0 6px rgba(251,191,36,0.5)', display: 'inline-block' }} />
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px rgba(74,222,128,0.5)', display: 'inline-block' }} />
        </div>
        <div style={{
          flex: 1, textAlign: 'center', fontSize: 10, fontWeight: 700,
          letterSpacing: '0.15em', color: '#8b949e', textTransform: 'uppercase',
        }}>AGENT ACTIVITY FEED</div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 9, fontWeight: 600, color: '#4ade80', letterSpacing: '0.1em',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%', background: '#4ade80',
            animation: 'af-pulse-glow 1.5s ease-in-out infinite', display: 'inline-block',
          }} />
          LIVE
        </div>
      </div>

      {/* Body */}
      <div ref={bodyRef} style={{
        flex: 1, position: 'relative', overflow: 'hidden', padding: 0,
      }}>
        {/* Scanlines */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)',
          animation: 'af-scanline-scroll 8s linear infinite',
        }} />

        {/* Scroll area */}
        <div ref={scrollRef} className="af-scroll" style={{
          padding: '10px 12px 4px', display: 'flex', flexDirection: 'column', gap: 2,
          overflowY: 'auto', maxHeight: 'calc(100% - 30px)',
        }}>
          {lines.map((line, i) => {
            const ls = LEVEL_STYLES[line.level] || LEVEL_STYLES.info;
            return (
              <div key={i} className="af-log-line" style={{
                display: 'flex', alignItems: 'baseline', gap: 6,
                fontSize: 10.5, lineHeight: 1.65, whiteSpace: 'nowrap',
                animation: `af-line-appear 0.4s ease-out both`,
                animationDelay: `${(i % 10) * 0.04}s`,
              }}>
                <span style={{ color: '#6e7681', fontSize: 9.5, flexShrink: 0 }}>{line.ts}</span>
                <span style={{ color: '#a78bfa', fontSize: 9.5, flexShrink: 0, minWidth: 36 }}>{line.src}</span>
                <span style={{
                  fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                  padding: '1px 5px', borderRadius: 3, flexShrink: 0, letterSpacing: '0.05em',
                  color: ls.color, background: ls.bg, border: `1px solid ${ls.border}`,
                  animation: line.level === 'error' ? 'af-error-flash 2s ease-in-out infinite' : undefined,
                }}>{line.level}</span>
                <span style={{ color: '#e6edf3', overflow: 'hidden', textOverflow: 'ellipsis' }}>{line.msg}</span>
              </div>
            );
          })}
        </div>

        {/* Prompt */}
        <div style={{
          padding: '4px 12px 10px', display: 'flex', alignItems: 'center',
          fontSize: 11, flexShrink: 0,
        }}>
          <span style={{ color: '#4ade80', fontWeight: 600 }}>grafana@agents</span>
          <span style={{ color: '#6e7681' }}>:</span>
          <span style={{ color: '#67e8f9', fontWeight: 600 }}>~</span>
          <span style={{ color: '#8b949e', margin: '0 6px 0 1px' }}>$</span>
          <span style={{ color: '#67e8f9', animation: 'af-blink-cursor 1s step-end infinite', fontSize: 12 }}>{cursorChar}</span>
        </div>
      </div>

      {/* Bottom glow */}
      <div style={{
        position: 'absolute', bottom: -40, left: '50%', transform: 'translateX(-50%)',
        width: '80%', height: 80, pointerEvents: 'none',
        background: 'radial-gradient(ellipse, rgba(103,232,249,0.06) 0%, transparent 70%)',
        animation: 'af-glow-breathe 4s ease-in-out infinite',
      }} />
    </div>
  );
}
