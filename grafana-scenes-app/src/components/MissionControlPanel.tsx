import React, { useEffect, useRef, useState } from 'react';

interface MissionStats {
  active_agents: number;
  idle_agents: number;
  total_agents_spawned: number;
  cumulative_cost: number;
  error_agents: number;
  uptime: string;
  model_breakdown: Record<string, number>;
}

const API_BASE = 'http://host.docker.internal:4040';

const CYAN = '#00e5ff';
const GREEN = '#00ff41';
const AMBER = '#ffbf00';
const RED = '#ff3333';
const WHITE = '#e6edf3';
const MUTED = '#6e7681';
const BG = '#060a10';

type MissionStatus = 'NOMINAL' | 'CAUTION' | 'ABORT';

/**
 * MissionControlPanel - Rocket launch / telemetry dashboard.
 * Animated rocket launch scene with telemetry readouts.
 */
export function MissionControlPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stats, setStats] = useState<MissionStats>({
    active_agents: 0, idle_agents: 0, total_agents_spawned: 0,
    cumulative_cost: 0, error_agents: 0, uptime: '--',
    model_breakdown: {},
  });
  const animRef = useRef<number>(0);
  const statsRef = useRef(stats);
  statsRef.current = stats;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsResp, healthResp] = await Promise.all([
          fetch(`${API_BASE}/api/stats`),
          fetch(`${API_BASE}/api/stats`),
        ]);
        if (statsResp.ok) {
          const s = await statsResp.json();
          setStats({
            active_agents: s.active_agents ?? 0,
            idle_agents: s.idle_agents ?? 0,
            total_agents_spawned: s.total_agents_spawned ?? 0,
            cumulative_cost: s.cumulative_cost ?? 0,
            error_agents: s.error_agents ?? 0,
            uptime: s.uptime ?? '--',
            model_breakdown: s.model_breakdown ?? {},
          });
        }
      } catch {
        setStats({
          active_agents: 4, idle_agents: 2, total_agents_spawned: 12,
          cumulative_cost: 3.47, error_agents: 1, uptime: '2h 34m',
          model_breakdown: { opus: 6, sonnet: 4, haiku: 2 },
        });
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Rocket animation
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

    const stars: Array<{ x: number; y: number; s: number; b: number }> = [];
    for (let i = 0; i < 120; i++) {
      stars.push({ x: Math.random(), y: Math.random(), s: Math.random() * 1.5 + 0.3, b: Math.random() });
    }

    const particles: Array<{
      x: number; y: number; vx: number; vy: number;
      life: number; decay: number; size: number; color: string;
    }> = [];

    let frame = 0;
    const CYCLE = 600; // frames per launch cycle

    function render() {
      if (!ctx) return;
      const w = W / 2;
      const h = H / 2;
      frame++;

      const cycleFrame = frame % CYCLE;
      const cycleProgress = cycleFrame / CYCLE;

      // --- Background ---
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, '#050810');
      skyGrad.addColorStop(0.5, '#0a1020');
      skyGrad.addColorStop(1, '#0e1a30');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // Stars
      const t = frame * 0.01;
      for (const s of stars) {
        const twinkle = 0.3 + Math.sin(t + s.b * 15) * 0.35;
        ctx.globalAlpha = twinkle;
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.s, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // --- Ground / launch pad ---
      const groundY = h * 0.78;
      ctx.fillStyle = '#0a1520';
      ctx.fillRect(0, groundY, w, h - groundY);

      // Launch pad structure
      const padX = w * 0.5;
      const padW = 16;

      // Gantry tower
      ctx.fillStyle = '#1a2a40';
      ctx.fillRect(padX - padW * 2.5, groundY - h * 0.35, 6, h * 0.35);
      // Gantry arms
      ctx.fillStyle = '#1a2a40';
      ctx.fillRect(padX - padW * 2.5, groundY - h * 0.32, padW * 2, 3);
      ctx.fillRect(padX - padW * 2.5, groundY - h * 0.22, padW * 1.5, 3);

      // Pad base
      ctx.fillStyle = '#1e2d42';
      ctx.fillRect(padX - padW * 1.5, groundY - 4, padW * 3, 8);

      // Flame trench
      ctx.fillStyle = '#0e1825';
      ctx.fillRect(padX - padW, groundY + 2, padW * 2, 12);

      // --- Rocket ---
      let rocketY: number;
      let rocketScale: number;
      let engineOn: boolean;

      if (cycleProgress < 0.15) {
        // Pre-launch: sitting on pad
        rocketY = groundY - 4;
        rocketScale = 1;
        engineOn = cycleProgress > 0.1;
      } else if (cycleProgress < 0.7) {
        // Ascent
        const p = (cycleProgress - 0.15) / 0.55;
        const ep = easeInQuad(p);
        rocketY = groundY - 4 - ep * (h * 1.2);
        rocketScale = 1 - ep * 0.3;
        engineOn = true;
      } else {
        // Post-launch coast / reset
        const p = (cycleProgress - 0.7) / 0.3;
        rocketY = groundY - 4 - h * 1.2 - p * h * 0.3;
        rocketScale = 0.7 - p * 0.4;
        engineOn = p < 0.5;
      }

      if (rocketY > -h * 0.3) {
        drawRocket(ctx, padX, rocketY, rocketScale, engineOn, frame);
      }

      // --- Exhaust particles ---
      if (engineOn && rocketY < groundY + 20) {
        for (let i = 0; i < 4; i++) {
          const spread = rocketScale * 12;
          particles.push({
            x: padX + (Math.random() - 0.5) * spread,
            y: rocketY + 20 * rocketScale,
            vx: (Math.random() - 0.5) * 2.5,
            vy: 1.5 + Math.random() * 3,
            life: 1,
            decay: 0.01 + Math.random() * 0.02,
            size: 2 + Math.random() * 4,
            color: Math.random() < 0.5 ? AMBER : RED,
          });
        }
      }

      // Smoke from pad
      if (engineOn && cycleProgress < 0.3) {
        for (let i = 0; i < 2; i++) {
          particles.push({
            x: padX + (Math.random() - 0.5) * 30,
            y: groundY + Math.random() * 10,
            vx: (Math.random() - 0.5) * 1.5,
            vy: -0.3 - Math.random() * 0.5,
            life: 1,
            decay: 0.005 + Math.random() * 0.005,
            size: 3 + Math.random() * 6,
            color: '#94a3b8',
          });
        }
      }

      // Draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.02;
        p.vx *= 0.99;
        p.life -= p.decay;
        if (p.life <= 0) { particles.splice(i, 1); continue; }

        ctx.globalAlpha = p.life * 0.6;
        if (p.color === '#94a3b8') {
          // Smoke
          ctx.fillStyle = `rgba(148,163,184,${p.life * 0.15})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (2 - p.life), 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Fire
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
          grad.addColorStop(0, p.color);
          grad.addColorStop(0.5, `${p.color}80`);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // Limit particles
      if (particles.length > 300) particles.splice(0, 50);

      // --- Launch pad lights ---
      const lightBlink = Math.sin(frame * 0.1) > 0;
      ctx.fillStyle = lightBlink ? 'rgba(255,0,0,0.8)' : 'rgba(255,0,0,0.2)';
      ctx.beginPath();
      ctx.arc(padX - padW * 2.5, groundY - h * 0.35, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(padX + padW * 1.5, groundY - 4, 2, 0, Math.PI * 2);
      ctx.fill();

      // --- Grid overlay for tech feel ---
      ctx.strokeStyle = 'rgba(0,229,255,0.02)';
      ctx.lineWidth = 0.3;
      for (let x = 0; x < w; x += 30) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y < h; y += 30) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      // --- Scan lines ---
      ctx.globalAlpha = 0.02;
      for (let y = 0; y < h; y += 3) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, y, w, 1);
      }
      ctx.globalAlpha = 1;

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

  const missionStatus: MissionStatus =
    stats.error_agents > 2 ? 'ABORT' :
    stats.error_agents > 0 ? 'CAUTION' : 'NOMINAL';

  const statusColor = missionStatus === 'NOMINAL' ? GREEN :
    missionStatus === 'CAUTION' ? AMBER : RED;

  const modelEntries = Object.entries(stats.model_breakdown || {});

  return (
    <div style={{
      width: '100%', height: '100%', minHeight: 400, position: 'relative',
      background: BG, borderRadius: 4, overflow: 'hidden',
      fontFamily: "'JetBrains Mono', 'Courier New', monospace",
    }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />

      {/* Mission header */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2,
        background: 'rgba(6,10,16,0.8)',
        backdropFilter: 'blur(4px)',
        borderBottom: '1px solid rgba(0,229,255,0.1)',
        padding: '8px 14px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{
            fontSize: 12, fontWeight: 700, color: CYAN,
            letterSpacing: '0.15em',
            textShadow: '0 0 8px rgba(0,229,255,0.4)',
          }}>
            MISSION CONTROL
          </div>
          <div style={{ fontSize: 8, color: MUTED, letterSpacing: '0.08em', marginTop: 1 }}>
            AGENT LAUNCH OPERATIONS CENTER
          </div>
        </div>

        {/* Mission status badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: `${statusColor}10`,
          border: `1px solid ${statusColor}40`,
          borderRadius: 4,
          padding: '4px 10px',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: statusColor,
            boxShadow: `0 0 8px ${statusColor}`,
            animation: missionStatus !== 'NOMINAL' ? 'mc-blink 1s infinite' : 'mc-pulse 2s ease-in-out infinite',
          }} />
          <span style={{
            fontSize: 10, fontWeight: 700, color: statusColor,
            letterSpacing: '0.1em',
          }}>
            {missionStatus}
          </span>
        </div>
      </div>

      {/* Left telemetry panel */}
      <div style={{
        position: 'absolute', top: 48, left: 10, zIndex: 2,
        width: 130,
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        <TelemetryBlock label="ACTIVE" value={String(stats.active_agents)} color={GREEN} />
        <TelemetryBlock label="IDLE" value={String(stats.idle_agents)} color={CYAN} />
        <TelemetryBlock label="TOTAL LAUNCHED" value={String(stats.total_agents_spawned)} color={AMBER} />
        <TelemetryBlock label="ERRORS" value={String(stats.error_agents)} color={stats.error_agents > 0 ? RED : MUTED} />
      </div>

      {/* Right telemetry panel */}
      <div style={{
        position: 'absolute', top: 48, right: 10, zIndex: 2,
        width: 130,
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        <TelemetryBlock label="FUEL CONSUMED" value={`$${stats.cumulative_cost.toFixed(2)}`} color={AMBER} />
        <TelemetryBlock label="MISSION TIME" value={stats.uptime || '--'} color={CYAN} />
        {modelEntries.slice(0, 3).map(([model, count]) => (
          <TelemetryBlock
            key={model}
            label={getModelShortName(model).toUpperCase()}
            value={String(count)}
            color="rgba(167,139,250,0.8)"
          />
        ))}
      </div>

      {/* Bottom: Mission timer */}
      <div style={{
        position: 'absolute', bottom: 8, left: 0, right: 0, zIndex: 2,
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        gap: 20,
      }}>
        <MissionTimer uptime={stats.uptime} />
      </div>

      {/* Bottom left: phase indicator */}
      <div style={{
        position: 'absolute', bottom: 8, left: 12, zIndex: 2,
        fontSize: 8, color: MUTED, letterSpacing: '0.08em',
      }}>
        PHASE: {stats.active_agents > 0 ? 'POWERED FLIGHT' : 'STANDBY'}
      </div>

      {/* Bottom right: agent count */}
      <div style={{
        position: 'absolute', bottom: 8, right: 12, zIndex: 2,
        fontSize: 8, color: MUTED, letterSpacing: '0.08em',
      }}>
        {stats.total_agents_spawned} MISSIONS LAUNCHED
      </div>

      <style>{`
        @keyframes mc-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.2; } }
        @keyframes mc-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
    </div>
  );
}

/* Telemetry block sub-component */
function TelemetryBlock({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: 'rgba(6,10,16,0.75)',
      backdropFilter: 'blur(4px)',
      border: '1px solid rgba(0,229,255,0.08)',
      borderRadius: 3,
      padding: '5px 8px',
    }}>
      <div style={{
        fontSize: 7, color: MUTED, letterSpacing: '0.1em',
        marginBottom: 2,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 14, fontWeight: 700, color,
        textShadow: `0 0 6px ${color}40`,
        letterSpacing: '-0.02em',
      }}>
        {value}
      </div>
    </div>
  );
}

/* Mission timer sub-component */
function MissionTimer({ uptime }: { uptime: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(i);
  }, []);

  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;

  return (
    <div style={{
      background: 'rgba(6,10,16,0.85)',
      border: '1px solid rgba(0,229,255,0.15)',
      borderRadius: 4,
      padding: '4px 16px',
      display: 'flex', alignItems: 'center', gap: 4,
    }}>
      <span style={{ fontSize: 8, color: '#6e7681', letterSpacing: '0.08em', marginRight: 4 }}>T+</span>
      <span style={{
        fontSize: 16, fontWeight: 700, color: '#00e5ff',
        letterSpacing: '0.06em',
        textShadow: '0 0 8px rgba(0,229,255,0.3)',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
      </span>
    </div>
  );
}

/* Helpers */
function easeInQuad(t: number): number {
  return t * t;
}

function getModelShortName(model: string): string {
  if (model.includes('opus')) return 'Opus';
  if (model.includes('sonnet')) return 'Sonnet';
  if (model.includes('haiku')) return 'Haiku';
  return model.slice(0, 10);
}

function drawRocket(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, scale: number,
  engineOn: boolean, frame: number
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Rocket body
  const bodyGrad = ctx.createLinearGradient(-8, -40, 8, -40);
  bodyGrad.addColorStop(0, '#d1d5db');
  bodyGrad.addColorStop(0.3, '#f3f4f6');
  bodyGrad.addColorStop(0.7, '#f3f4f6');
  bodyGrad.addColorStop(1, '#9ca3af');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(0, -52); // nose tip
  ctx.bezierCurveTo(6, -44, 8, -30, 8, -10);
  ctx.lineTo(8, 18);
  ctx.lineTo(-8, 18);
  ctx.lineTo(-8, -10);
  ctx.bezierCurveTo(-8, -30, -6, -44, 0, -52);
  ctx.fill();

  // Nose cone accent
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.moveTo(0, -52);
  ctx.bezierCurveTo(3, -48, 5, -42, 5, -36);
  ctx.lineTo(-5, -36);
  ctx.bezierCurveTo(-5, -42, -3, -48, 0, -52);
  ctx.fill();

  // Window
  ctx.fillStyle = '#60a5fa';
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.arc(0, -28, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Body stripe
  ctx.fillStyle = '#3b82f6';
  ctx.fillRect(-8, -5, 16, 4);

  // Fins
  ctx.fillStyle = '#dc2626';
  // Left fin
  ctx.beginPath();
  ctx.moveTo(-8, 10);
  ctx.lineTo(-16, 22);
  ctx.lineTo(-14, 22);
  ctx.lineTo(-8, 18);
  ctx.fill();
  // Right fin
  ctx.beginPath();
  ctx.moveTo(8, 10);
  ctx.lineTo(16, 22);
  ctx.lineTo(14, 22);
  ctx.lineTo(8, 18);
  ctx.fill();

  // Nozzle
  ctx.fillStyle = '#4b5563';
  ctx.beginPath();
  ctx.moveTo(-5, 18);
  ctx.lineTo(-6, 24);
  ctx.lineTo(6, 24);
  ctx.lineTo(5, 18);
  ctx.fill();

  // Engine flame
  if (engineOn) {
    const flicker = 0.8 + Math.sin(frame * 0.3) * 0.2;
    const flameLen = 20 + Math.sin(frame * 0.15) * 8;

    // Outer flame
    const outerGrad = ctx.createLinearGradient(0, 24, 0, 24 + flameLen);
    outerGrad.addColorStop(0, `rgba(251,191,36,${flicker})`);
    outerGrad.addColorStop(0.4, `rgba(248,113,113,${flicker * 0.6})`);
    outerGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = outerGrad;
    ctx.beginPath();
    ctx.moveTo(-7, 24);
    ctx.quadraticCurveTo(0, 24 + flameLen * 1.2, 7, 24);
    ctx.fill();

    // Inner flame (bright core)
    const innerGrad = ctx.createLinearGradient(0, 24, 0, 24 + flameLen * 0.6);
    innerGrad.addColorStop(0, `rgba(255,255,255,${flicker * 0.9})`);
    innerGrad.addColorStop(0.5, `rgba(251,191,36,${flicker * 0.5})`);
    innerGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = innerGrad;
    ctx.beginPath();
    ctx.moveTo(-3, 24);
    ctx.quadraticCurveTo(0, 24 + flameLen * 0.8, 3, 24);
    ctx.fill();

    // Engine glow
    ctx.globalAlpha = flicker * 0.3;
    const engineGlow = ctx.createRadialGradient(0, 24, 0, 0, 24, 25);
    engineGlow.addColorStop(0, '#fbbf24');
    engineGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = engineGlow;
    ctx.beginPath();
    ctx.arc(0, 24, 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}
