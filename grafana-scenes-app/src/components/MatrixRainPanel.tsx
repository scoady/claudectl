import React, { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../services/api';

interface AgentColumn {
  id: string;
  starName: string;
  project: string;
  status: string;
  turns: number;
  milestone: string;
  colX: number;
  chars: MatrixChar[];
  speed: number;
  depth: number; // 0=far, 1=close — affects brightness/size
}

interface MatrixChar {
  char: string;
  y: number;
  brightness: number;
  age: number;
}

interface StatsData {
  active_agents?: number;
  idle_agents?: number;
  total_agents_spawned?: number;
  cumulative_cost?: number;
  error_agents?: number;
}

const KATAKANA = '\u30A0\u30A1\u30A2\u30A3\u30A4\u30A5\u30A6\u30A7\u30A8\u30A9\u30AA\u30AB\u30AC\u30AD\u30AE\u30AF\u30B0\u30B1\u30B2\u30B3\u30B4\u30B5\u30B6\u30B7\u30B8\u30B9\u30BA\u30BB\u30BC\u30BD\u30BE\u30BF\u30C0\u30C1\u30C2\u30C3\u30C4\u30C5\u30C6\u30C7\u30C8\u30C9\u30CA\u30CB\u30CC\u30CD\u30CE\u30CF\u30D0\u30D1\u30D2\u30D3\u30D4\u30D5\u30D6\u30D7\u30D8\u30D9\u30DA\u30DB\u30DC\u30DD\u30DE\u30DF';
const LATIN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const NUMS = '0123456789';
const CHARSET = KATAKANA + LATIN + NUMS;

function randomChar(): string {
  return CHARSET[Math.floor(Math.random() * CHARSET.length)];
}

function buildDemoAgents(): AgentColumn[] {
  const demos = [
    { starName: 'Sirius', project: 'alpha', status: 'active', turns: 42, milestone: 'Read main.py' },
    { starName: 'Vega', project: 'alpha', status: 'active', turns: 18, milestone: 'Bash git status' },
    { starName: 'Rigel', project: 'beta', status: 'idle', turns: 30, milestone: 'Edit config.ts' },
    { starName: 'Arcturus', project: 'alpha', status: 'error', turns: 5, milestone: 'ERROR: timeout' },
    { starName: 'Capella', project: 'beta', status: 'active', turns: 22, milestone: 'Grep patterns' },
    { starName: 'Betelgeuse', project: 'gamma', status: 'done', turns: 50, milestone: 'Task complete' },
    { starName: 'Deneb', project: 'gamma', status: 'active', turns: 35, milestone: 'Write output.json' },
    { starName: 'Altair', project: 'beta', status: 'active', turns: 15, milestone: 'Read schema.sql' },
    { starName: 'Pollux', project: 'delta', status: 'active', turns: 28, milestone: 'Bash npm test' },
    { starName: 'Antares', project: 'delta', status: 'idle', turns: 8, milestone: 'Waiting...' },
  ];
  return demos.map((d, i) => ({
    id: `demo-${i}`,
    starName: d.starName,
    project: d.project,
    status: d.status,
    turns: d.turns,
    milestone: d.milestone,
    colX: 0,
    chars: [],
    speed: 1 + Math.random() * 2,
    depth: Math.random(),
  }));
}

/**
 * MatrixRainPanel - Full Matrix digital rain where each column is an agent.
 * CRT phosphor glow, depth-of-field, bullet-time slowmo, error scatter.
 */
export function MatrixRainPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const agentsRef = useRef<AgentColumn[]>([]);
  const statsRef = useRef<StatsData>({});
  const [stats, setStats] = useState<StatsData>({});
  const bulletTimeRef = useRef<number>(0);
  const completionBurstsRef = useRef<Array<{ x: number; y: number; age: number; color: string }>>([]);
  const bgColumnsRef = useRef<Array<{ x: number; chars: Array<{ char: string; y: number; speed: number; brightness: number }> }>>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [agentsResp, statsResp] = await Promise.all([
          fetch(`${API_BASE}/api/agents`),
          fetch(`${API_BASE}/api/stats`),
        ]);
        if (agentsResp.ok) {
          const raw: any[] = await agentsResp.json();
          const cols: AgentColumn[] = raw.map((a, i) => {
            const existing = agentsRef.current.find(c => c.id === (a.session_id || `a-${i}`));
            return {
              id: a.session_id || `a-${i}`,
              starName: a.star_name || `AGT${i}`,
              project: a.project || 'unknown',
              status: a.status || 'idle',
              turns: a.turns || 0,
              milestone: a.milestone || '',
              colX: existing?.colX ?? 0,
              chars: existing?.chars ?? [],
              speed: a.status === 'active' ? 1.5 + Math.random() * 2 : 0.5 + Math.random(),
              depth: existing?.depth ?? Math.random(),
            };
          });
          agentsRef.current = cols;
        }
        if (statsResp.ok) {
          const s = await statsResp.json();
          statsRef.current = s;
          setStats(s);
        }
      } catch {
        if (agentsRef.current.length === 0) {
          agentsRef.current = buildDemoAgents();
          statsRef.current = { active_agents: 6, idle_agents: 2, total_agents_spawned: 12, error_agents: 1, cumulative_cost: 3.45 };
          setStats(statsRef.current);
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

      // Initialize background columns
      const bgCols: typeof bgColumnsRef.current = [];
      const charW = 14;
      const numCols = Math.floor(rect.width / charW);
      for (let c = 0; c < numCols; c++) {
        const chars: typeof bgCols[0]['chars'] = [];
        const numChars = 5 + Math.floor(Math.random() * 20);
        const startY = Math.random() * rect.height;
        for (let j = 0; j < numChars; j++) {
          chars.push({
            char: randomChar(),
            y: startY + j * 16,
            speed: 0.5 + Math.random() * 1.5,
            brightness: Math.random() * 0.3,
          });
        }
        bgCols.push({ x: c * charW + charW / 2, chars });
      }
      bgColumnsRef.current = bgCols;
    };
    resize();

    let frame = 0;

    // Assign column positions to agents
    function layoutAgentColumns(w: number) {
      const agents = agentsRef.current;
      if (agents.length === 0) return;
      const spacing = w / (agents.length + 1);
      agents.forEach((a, i) => {
        if (a.colX === 0) a.colX = spacing * (i + 1);
      });
    }

    function render() {
      if (!ctx || !canvas) return;
      const w = W / 2;
      const h = H / 2;
      frame++;

      // Bullet time: slow-mo every 600 frames for 60 frames
      const inBulletTime = bulletTimeRef.current > 0;
      if (frame % 600 === 0 && !inBulletTime) bulletTimeRef.current = 90;
      if (bulletTimeRef.current > 0) bulletTimeRef.current--;
      const timeMul = inBulletTime ? 0.15 : 1;

      // Activity-based rain speed
      const activeCount = statsRef.current.active_agents || 1;
      const activityMul = 0.5 + Math.min(activeCount / 5, 2);

      // Black background with slight persistence (trail effect)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      ctx.fillRect(0, 0, w, h);

      // Every 30th frame, full clear to prevent buildup
      if (frame % 30 === 0) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, 0, w, h);
      }

      // --- Background rain columns (ambient) ---
      for (const col of bgColumnsRef.current) {
        for (const ch of col.chars) {
          ch.y += ch.speed * timeMul * activityMul;
          if (ch.y > h + 20) {
            ch.y = -20;
            ch.char = randomChar();
          }
          // Randomly change character
          if (Math.random() < 0.02) ch.char = randomChar();

          ctx.globalAlpha = ch.brightness;
          ctx.fillStyle = '#00ff41';
          ctx.font = '12px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(ch.char, col.x, ch.y);
        }
      }
      ctx.globalAlpha = 1;

      // --- Agent columns ---
      layoutAgentColumns(w);
      const agents = agentsRef.current;

      for (const agent of agents) {
        const charSize = 12 + agent.depth * 6; // depth affects size
        const baseBrightness = 0.3 + agent.depth * 0.7; // depth affects brightness
        const isError = agent.status === 'error';
        const isDone = agent.status === 'done';
        const isActive = agent.status === 'active';

        // Add new characters at top
        if (frame % Math.max(1, Math.floor(3 / (agent.speed * timeMul * activityMul))) === 0) {
          // Encode milestone text into the rain
          const milestoneChars = agent.milestone.split('');
          const usesMilestone = Math.random() < 0.3 && milestoneChars.length > 0;
          const charToUse = usesMilestone
            ? milestoneChars[Math.floor(Math.random() * milestoneChars.length)]
            : randomChar();

          agent.chars.push({
            char: charToUse,
            y: -10,
            brightness: 1.0,
            age: 0,
          });
        }

        // Base color
        let baseColor = '#00ff41';
        if (isError) baseColor = '#ff2222';
        if (isDone) baseColor = '#ffd700';

        // Update and draw characters
        for (let i = agent.chars.length - 1; i >= 0; i--) {
          const ch = agent.chars[i];
          ch.y += agent.speed * timeMul * activityMul * 1.5;
          ch.age++;
          ch.brightness = Math.max(0, 1 - ch.age * 0.008);

          // Error: scatter characters sideways
          const scatterX = isError ? (Math.random() - 0.5) * ch.age * 0.3 : 0;

          if (ch.y > h + 20 || ch.brightness <= 0) {
            agent.chars.splice(i, 1);
            continue;
          }

          // Randomly mutate character
          if (Math.random() < 0.03) ch.char = randomChar();

          const alpha = ch.brightness * baseBrightness;
          const px = agent.colX + scatterX;

          // Phosphor glow
          if (ch.brightness > 0.6) {
            ctx.globalAlpha = alpha * 0.3;
            ctx.shadowColor = baseColor;
            ctx.shadowBlur = 15;
            ctx.fillStyle = baseColor;
            ctx.font = `${charSize}px monospace`;
            ctx.textAlign = 'center';
            ctx.fillText(ch.char, px, ch.y);
            ctx.shadowBlur = 0;
          }

          // Main character
          ctx.globalAlpha = alpha;
          ctx.fillStyle = baseColor;
          ctx.font = `bold ${charSize}px monospace`;
          ctx.textAlign = 'center';
          ctx.fillText(ch.char, px, ch.y);

          // Lead character is bright white
          if (i === agent.chars.length - 1) {
            ctx.globalAlpha = Math.min(1, alpha * 1.5);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(ch.char, px, ch.y);
          }
        }
        ctx.globalAlpha = 1;

        // Star name flash — periodically show the name in bright white
        if (frame % 180 < 15) {
          const nameY = h * 0.3 + Math.sin(frame * 0.01 + agents.indexOf(agent)) * h * 0.2;
          ctx.save();
          ctx.globalAlpha = 1 - (frame % 180) / 15;
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = '#ffffff';
          ctx.shadowBlur = 20;
          ctx.font = `bold ${14 + agent.depth * 4}px monospace`;
          ctx.textAlign = 'center';
          ctx.fillText(agent.starName.toUpperCase(), agent.colX, nameY);
          ctx.shadowBlur = 0;
          ctx.restore();
        }

        // Done burst
        if (isDone && agent.chars.length > 0 && frame % 120 < 5) {
          for (let b = 0; b < 8; b++) {
            completionBurstsRef.current.push({
              x: agent.colX + (Math.random() - 0.5) * 40,
              y: h * 0.5 + (Math.random() - 0.5) * 100,
              age: 0,
              color: '#ffd700',
            });
          }
        }
      }

      // --- Completion bursts ---
      for (let i = completionBurstsRef.current.length - 1; i >= 0; i--) {
        const b = completionBurstsRef.current[i];
        b.age++;
        if (b.age > 40) { completionBurstsRef.current.splice(i, 1); continue; }
        const alpha = 1 - b.age / 40;
        const size = 2 + b.age * 0.3;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(b.x, b.y - b.age * 0.5, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;

      // --- Bullet time indicator ---
      if (inBulletTime) {
        ctx.save();
        ctx.globalAlpha = 0.5 + Math.sin(frame * 0.1) * 0.3;
        ctx.fillStyle = '#00ff41';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('[ BULLET TIME ]', w / 2, 30);
        ctx.restore();
      }

      // --- CRT scan lines ---
      ctx.globalAlpha = 0.04;
      for (let y = 0; y < h; y += 2) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, y, w, 1);
      }
      ctx.globalAlpha = 1;

      // --- Screen edge vignette ---
      const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
      vg.addColorStop(0, 'transparent');
      vg.addColorStop(1, 'rgba(0,0,0,0.6)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);

      // --- CRT curvature border glow ---
      ctx.strokeStyle = 'rgba(0,255,65,0.08)';
      ctx.lineWidth = 2;
      ctx.strokeRect(4, 4, w - 8, h - 8);

      animRef.current = requestAnimationFrame(render);
    }

    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    animRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
    };
  }, []);

  const s = stats;

  return (
    <div style={{
      width: '100%', height: '100%', minHeight: 400, position: 'relative',
      background: '#000', borderRadius: 4, overflow: 'hidden',
      fontFamily: "'JetBrains Mono', 'Courier New', monospace",
    }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

      {/* HUD overlay */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 2,
        background: 'rgba(0,0,0,0.7)',
        borderTop: '1px solid rgba(0,255,65,0.2)',
        padding: '6px 14px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: 10, letterSpacing: '0.08em', color: '#00ff41',
      }}>
        <span>AGENTS: {s.total_agents_spawned ?? 0}</span>
        <span style={{ color: '#00ff41' }}>ACTIVE: {s.active_agents ?? 0}</span>
        <span style={{ color: '#ffd700' }}>IDLE: {s.idle_agents ?? 0}</span>
        <span style={{ color: (s.error_agents ?? 0) > 0 ? '#ff2222' : '#00ff41' }}>
          ERRORS: {s.error_agents ?? 0}
        </span>
        <span>COST: ${(s.cumulative_cost ?? 0).toFixed(2)}</span>
      </div>

      {/* Title */}
      <div style={{
        position: 'absolute', top: 8, left: 12, zIndex: 2,
      }}>
        <div style={{
          fontSize: 12, fontWeight: 700, color: '#00ff41',
          letterSpacing: '0.15em',
          textShadow: '0 0 10px rgba(0,255,65,0.6)',
        }}>
          THE MATRIX
        </div>
        <div style={{ fontSize: 8, color: 'rgba(0,255,65,0.4)', letterSpacing: '0.06em' }}>
          AGENT NEURAL INTERFACE
        </div>
      </div>
    </div>
  );
}
