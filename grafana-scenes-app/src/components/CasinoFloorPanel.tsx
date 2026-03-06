import React, { useEffect, useRef, useState } from 'react';

interface SlotAgent {
  id: string;
  starName: string;
  project: string;
  status: string;
  turns: number;
  model: string;
  cost: number;
  // Slot machine state
  reelPhase: number; // -1 = stopped, 0+ = spinning
  reelValues: [number, number, number];
  tiltFlash: number;
  jackpot: boolean;
  x: number;
  y: number;
}

interface StatsData {
  active_agents?: number;
  idle_agents?: number;
  total_agents_spawned?: number;
  cumulative_cost?: number;
}

const API_BASE = 'http://host.docker.internal:4040';

const NEON_PINK = '#ff1493';
const NEON_YELLOW = '#ffd700';
const NEON_CYAN = '#00ffff';
const NEON_GREEN = '#00ff41';
const NEON_RED = '#ff2222';
const CASINO_PURPLE = '#6a0dad';
const CARPET_COLORS = ['#8B0000', '#006400', '#00008B', '#8B8000', '#4B0082'];

// Reel symbols
const REEL_ICONS = ['7', '\u2605', '\u2666', '\u2663', '\u2660', '\u2665', '$', '\u265B', '\u2740'];

function buildDemoSlots(): SlotAgent[] {
  const demos = [
    { starName: 'Sirius', project: 'alpha', status: 'active', turns: 42, model: 'opus' },
    { starName: 'Vega', project: 'alpha', status: 'active', turns: 18, model: 'sonnet' },
    { starName: 'Rigel', project: 'beta', status: 'idle', turns: 30, model: 'opus' },
    { starName: 'Arcturus', project: 'alpha', status: 'error', turns: 5, model: 'sonnet' },
    { starName: 'Capella', project: 'beta', status: 'active', turns: 22, model: 'opus' },
    { starName: 'Betelgeuse', project: 'gamma', status: 'done', turns: 50, model: 'haiku' },
    { starName: 'Deneb', project: 'gamma', status: 'active', turns: 35, model: 'opus' },
    { starName: 'Altair', project: 'beta', status: 'done', turns: 48, model: 'sonnet' },
    { starName: 'Pollux', project: 'delta', status: 'active', turns: 28, model: 'opus' },
    { starName: 'Antares', project: 'delta', status: 'idle', turns: 8, model: 'haiku' },
  ];
  return demos.map((d, i) => ({
    id: `demo-${i}`,
    starName: d.starName,
    project: d.project,
    status: d.status,
    turns: d.turns,
    model: d.model,
    cost: Math.random() * 0.5,
    reelPhase: d.status === 'active' ? Math.floor(Math.random() * 100) : -1,
    reelValues: [Math.floor(Math.random() * REEL_ICONS.length), Math.floor(Math.random() * REEL_ICONS.length), Math.floor(Math.random() * REEL_ICONS.length)],
    tiltFlash: 0,
    jackpot: d.turns >= 40,
    x: 0,
    y: 0,
  }));
}

export function CasinoFloorPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const slotsRef = useRef<SlotAgent[]>([]);
  const [stats, setStats] = useState<StatsData>({});
  const jackpotCounterRef = useRef<number>(0);
  const coinParticlesRef = useRef<Array<{ x: number; y: number; vx: number; vy: number; age: number; r: number }>>([]);
  const rouletteAngleRef = useRef<number>(0);
  const marqueePhaseRef = useRef<number>(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [agentsResp, statsResp] = await Promise.all([
          fetch(`${API_BASE}/api/agents`),
          fetch(`${API_BASE}/api/stats`),
        ]);
        if (agentsResp.ok) {
          const raw: any[] = await agentsResp.json();
          const slots: SlotAgent[] = raw.map((a, i) => {
            const existing = slotsRef.current.find(s => s.id === (a.session_id || `a-${i}`));
            return {
              id: a.session_id || `a-${i}`,
              starName: a.star_name || `SLOT${i}`,
              project: a.project || 'unknown',
              status: a.status || 'idle',
              turns: a.turns || 0,
              model: a.model || '',
              cost: a.estimated_cost || 0,
              reelPhase: a.status === 'active' ? (existing?.reelPhase ?? 0) : -1,
              reelValues: existing?.reelValues ?? [0, 0, 0],
              tiltFlash: a.status === 'error' ? 60 : 0,
              jackpot: (a.turns || 0) >= 40,
              x: 0,
              y: 0,
            };
          });
          slotsRef.current = slots;
          // Sum turns for jackpot counter
          jackpotCounterRef.current = raw.reduce((s: number, a: any) => s + (a.turns || 0), 0);
        }
        if (statsResp.ok) setStats(await statsResp.json());
      } catch {
        if (slotsRef.current.length === 0) {
          slotsRef.current = buildDemoSlots();
          jackpotCounterRef.current = slotsRef.current.reduce((s, slot) => s + slot.turns, 0);
          setStats({ active_agents: 5, idle_agents: 2, total_agents_spawned: 10, cumulative_cost: 3.5 });
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

    function drawSlotMachine(ctx: CanvasRenderingContext2D, slot: SlotAgent, x: number, y: number, machineW: number, machineH: number) {
      const isSpinning = slot.reelPhase >= 0;
      const isError = slot.status === 'error';
      const isDone = slot.status === 'done';
      const isIdle = slot.status === 'idle';

      // Machine body
      const bodyGrad = ctx.createLinearGradient(x, y, x, y + machineH);
      bodyGrad.addColorStop(0, '#2a1a3a');
      bodyGrad.addColorStop(0.5, '#1a0a2a');
      bodyGrad.addColorStop(1, '#0a0018');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.roundRect(x, y, machineW, machineH, 4);
      ctx.fill();

      // Gold trim
      ctx.strokeStyle = isError ? NEON_RED : (isDone && slot.jackpot ? NEON_YELLOW : '#8B7536');
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(x, y, machineW, machineH, 4);
      ctx.stroke();

      // Machine name plate
      ctx.fillStyle = NEON_CYAN;
      ctx.font = 'bold 7px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(slot.starName.toUpperCase(), x + machineW / 2, y + 10);

      // Reel window
      const reelTop = y + 14;
      const reelH = machineH * 0.4;
      const reelW = machineW - 8;
      const reelX = x + 4;

      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(reelX, reelTop, reelW, reelH);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(reelX, reelTop, reelW, reelH);

      // Three reels
      const singleReelW = reelW / 3;
      for (let r = 0; r < 3; r++) {
        const rx = reelX + r * singleReelW;

        // Reel divider
        if (r > 0) {
          ctx.strokeStyle = '#333';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(rx, reelTop);
          ctx.lineTo(rx, reelTop + reelH);
          ctx.stroke();
        }

        let displayIcon: string;
        if (isSpinning) {
          // Spinning blur effect
          const spinOffset = (frame * 3 + r * 7) % (REEL_ICONS.length * 10);
          const idx = Math.floor(spinOffset / 10) % REEL_ICONS.length;
          displayIcon = REEL_ICONS[idx];
          // Show blur with multiple faded symbols
          ctx.globalAlpha = 0.15;
          ctx.fillStyle = '#fff';
          ctx.font = `bold ${reelH * 0.4}px monospace`;
          ctx.textAlign = 'center';
          for (let blur = -2; blur <= 2; blur++) {
            if (blur === 0) continue;
            const blurIdx = (idx + blur + REEL_ICONS.length) % REEL_ICONS.length;
            ctx.fillText(REEL_ICONS[blurIdx], rx + singleReelW / 2, reelTop + reelH / 2 + 5 + blur * reelH * 0.3);
          }
          ctx.globalAlpha = 1;
        } else {
          displayIcon = REEL_ICONS[slot.reelValues[r]];
        }

        // Main reel symbol
        ctx.fillStyle = isDone && slot.jackpot ? NEON_YELLOW : '#fff';
        ctx.font = `bold ${reelH * 0.5}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(displayIcon, rx + singleReelW / 2, reelTop + reelH / 2 + reelH * 0.15);
      }

      // TILT for errors
      if (isError) {
        ctx.save();
        ctx.globalAlpha = Math.sin(frame * 0.15) > 0 ? 0.9 : 0.3;
        ctx.fillStyle = NEON_RED;
        ctx.font = `bold ${reelH * 0.35}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('TILT', x + machineW / 2, reelTop + reelH / 2 + 5);
        ctx.restore();
      }

      // JACKPOT for high-turn completions
      if (isDone && slot.jackpot) {
        ctx.save();
        const jFlash = 0.6 + Math.sin(frame * 0.1) * 0.4;
        ctx.globalAlpha = jFlash;
        ctx.fillStyle = NEON_YELLOW;
        ctx.shadowColor = NEON_YELLOW;
        ctx.shadowBlur = 10;
        ctx.font = `bold 7px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('JACKPOT!', x + machineW / 2, reelTop - 4);
        ctx.restore();
      }

      // Chip stack (height = turns)
      const chipHeight = Math.min(machineH * 0.25, slot.turns * 0.8);
      const chipX = x + machineW / 2;
      const chipY = y + machineH - 4;
      if (chipHeight > 2) {
        const chipColors = [NEON_RED, '#228B22', '#1E90FF', '#8B008B', NEON_YELLOW];
        const numChips = Math.min(Math.ceil(chipHeight / 3), 12);
        for (let c = 0; c < numChips; c++) {
          ctx.fillStyle = chipColors[c % chipColors.length];
          ctx.beginPath();
          ctx.ellipse(chipX, chipY - c * 2.5, machineW * 0.2, 2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.3)';
          ctx.lineWidth = 0.3;
          ctx.stroke();
        }
      }

      // Turns count
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '6px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${slot.turns} turns`, x + machineW / 2, y + machineH - 2);

      // Status light
      const statusColor = slot.status === 'active' ? NEON_GREEN :
        slot.status === 'done' ? NEON_YELLOW :
          slot.status === 'error' ? NEON_RED : '#666';
      ctx.fillStyle = statusColor;
      ctx.shadowColor = statusColor;
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(x + machineW - 5, y + 5, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Update spinning
      if (isSpinning) {
        slot.reelPhase++;
        // Randomize reel values while spinning
        if (frame % 2 === 0) {
          slot.reelValues = [
            Math.floor(Math.random() * REEL_ICONS.length),
            Math.floor(Math.random() * REEL_ICONS.length),
            Math.floor(Math.random() * REEL_ICONS.length),
          ];
        }
      }

      // Coin spill for done agents
      if (isDone && frame % 20 === 0 && slot.jackpot) {
        for (let c = 0; c < 3; c++) {
          coinParticlesRef.current.push({
            x: x + machineW / 2 + (Math.random() - 0.5) * 20,
            y: y + machineH * 0.6,
            vx: (Math.random() - 0.5) * 2,
            vy: -2 - Math.random() * 3,
            age: 0,
            r: 2 + Math.random() * 2,
          });
        }
      }
    }

    function render() {
      if (!ctx || !canvas) return;
      const w = W / 2;
      const h = H / 2;
      frame++;
      marqueePhaseRef.current = (marqueePhaseRef.current + 0.05) % (Math.PI * 2);

      // --- Casino carpet background ---
      ctx.fillStyle = '#1a0a0a';
      ctx.fillRect(0, 0, w, h);
      // Iconic ugly casino carpet pattern
      const patSize = 20;
      for (let px = 0; px < w; px += patSize) {
        for (let py = 0; py < h; py += patSize) {
          const ci = (Math.floor(px / patSize) + Math.floor(py / patSize)) % CARPET_COLORS.length;
          ctx.globalAlpha = 0.06;
          ctx.fillStyle = CARPET_COLORS[ci];
          // Diamond pattern
          ctx.beginPath();
          ctx.moveTo(px + patSize / 2, py);
          ctx.lineTo(px + patSize, py + patSize / 2);
          ctx.lineTo(px + patSize / 2, py + patSize);
          ctx.lineTo(px, py + patSize / 2);
          ctx.closePath();
          ctx.fill();
          // Small circle
          ctx.beginPath();
          ctx.arc(px + patSize / 2, py + patSize / 2, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // --- Marquee lights border ---
      const marqueeSpacing = 12;
      const numLights = Math.floor((w + h) * 2 / marqueeSpacing);
      for (let i = 0; i < numLights; i++) {
        let lx: number, ly: number;
        const perim = i * marqueeSpacing;
        if (perim < w) { lx = perim; ly = 0; }
        else if (perim < w + h) { lx = w; ly = perim - w; }
        else if (perim < w * 2 + h) { lx = w - (perim - w - h); ly = h; }
        else { lx = 0; ly = h - (perim - w * 2 - h); }

        const on = Math.sin(marqueePhaseRef.current + i * 0.5) > 0;
        ctx.fillStyle = on ? NEON_YELLOW : 'rgba(255,215,0,0.1)';
        if (on) {
          ctx.shadowColor = NEON_YELLOW;
          ctx.shadowBlur = 4;
        }
        ctx.beginPath();
        ctx.arc(lx, ly, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // --- Giant jackpot counter ---
      jackpotCounterRef.current += 0.3; // Slow count up
      const jackpotVal = Math.floor(jackpotCounterRef.current);
      const counterY = 30;

      // Counter background
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.beginPath();
      ctx.roundRect(w / 2 - 120, counterY - 18, 240, 32, 6);
      ctx.fill();
      ctx.strokeStyle = NEON_YELLOW;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(w / 2 - 120, counterY - 18, 240, 32, 6);
      ctx.stroke();

      // Jackpot text
      ctx.save();
      ctx.shadowColor = NEON_YELLOW;
      ctx.shadowBlur = 15;
      ctx.fillStyle = NEON_YELLOW;
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('CUMULATIVE JACKPOT', w / 2, counterY - 6);
      ctx.font = 'bold 16px monospace';
      ctx.fillText(String(jackpotVal).padStart(6, '0'), w / 2, counterY + 12);
      ctx.restore();

      // --- Neon signs ---
      drawNeonText(ctx, 'LUCKY 7', 50, 25, NEON_PINK, 10, frame);
      drawNeonText(ctx, 'BIG WINNER', w - 70, 25, NEON_GREEN, 9, frame + 50);

      // Model neon signs
      const models = ['OPUS', 'SONNET', 'HAIKU'];
      models.forEach((m, i) => {
        drawNeonText(ctx, m, 40 + i * 60, h - 18, NEON_CYAN, 7, frame + i * 30);
      });

      // --- Slot machines grid ---
      const slots = slotsRef.current;
      const topMargin = 50;
      const bottomMargin = 25;
      const availH = h - topMargin - bottomMargin;
      const availW = w - 20;

      // Calculate grid
      const cols = Math.max(2, Math.min(6, Math.ceil(Math.sqrt(slots.length))));
      const rows = Math.ceil(slots.length / cols);
      const machineW = Math.min(70, availW / cols - 8);
      const machineH = Math.min(100, availH / rows - 8);

      const gridW = cols * (machineW + 8);
      const gridH = rows * (machineH + 8);
      const startX = (w - gridW) / 2 + 4;
      const startY = topMargin + (availH - gridH) / 2 + 4;

      for (let si = 0; si < slots.length; si++) {
        const row = Math.floor(si / cols);
        const col = si % cols;
        const mx = startX + col * (machineW + 8);
        const my = startY + row * (machineH + 8);
        slots[si].x = mx;
        slots[si].y = my;
        drawSlotMachine(ctx, slots[si], mx, my, machineW, machineH);
      }

      // --- Roulette wheel (bottom-right corner) ---
      const rouletteR = Math.min(35, w * 0.06);
      const rouletteCx = w - rouletteR - 15;
      const rouletteCy = h - rouletteR - 25;
      rouletteAngleRef.current += 0.02;

      // Wheel
      ctx.save();
      ctx.translate(rouletteCx, rouletteCy);
      ctx.rotate(rouletteAngleRef.current);
      const rouletteSlots = 18;
      for (let rs = 0; rs < rouletteSlots; rs++) {
        const a1 = (rs / rouletteSlots) * Math.PI * 2;
        const a2 = ((rs + 1) / rouletteSlots) * Math.PI * 2;
        ctx.fillStyle = rs % 2 === 0 ? '#c0392b' : '#111';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, rouletteR, a1, a2);
        ctx.closePath();
        ctx.fill();
      }
      // Center
      ctx.fillStyle = '#228B22';
      ctx.beginPath();
      ctx.arc(0, 0, rouletteR * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Roulette border
      ctx.strokeStyle = NEON_YELLOW;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(rouletteCx, rouletteCy, rouletteR + 2, 0, Math.PI * 2);
      ctx.stroke();

      // Ball
      const ballAngle = -rouletteAngleRef.current * 0.7 + frame * 0.01;
      const ballR = rouletteR * 0.85;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(rouletteCx + Math.cos(ballAngle) * ballR, rouletteCy + Math.sin(ballAngle) * ballR, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(255,215,0,0.4)';
      ctx.font = '6px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('ROULETTE', rouletteCx, rouletteCy + rouletteR + 14);

      // --- Coin particles ---
      for (let i = coinParticlesRef.current.length - 1; i >= 0; i--) {
        const coin = coinParticlesRef.current[i];
        coin.x += coin.vx;
        coin.y += coin.vy;
        coin.vy += 0.12; // gravity
        coin.age++;
        if (coin.age > 60) { coinParticlesRef.current.splice(i, 1); continue; }

        const alpha = 1 - coin.age / 60;
        ctx.save();
        ctx.globalAlpha = alpha;
        // Gold coin
        const coinGrad = ctx.createRadialGradient(coin.x, coin.y, 0, coin.x, coin.y, coin.r);
        coinGrad.addColorStop(0, '#ffd700');
        coinGrad.addColorStop(0.7, '#daa520');
        coinGrad.addColorStop(1, '#b8860b');
        ctx.fillStyle = coinGrad;
        ctx.beginPath();
        ctx.arc(coin.x, coin.y, coin.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 0.3;
        ctx.stroke();
        // $ on coin
        ctx.fillStyle = '#8B6914';
        ctx.font = `bold ${coin.r}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', coin.x, coin.y);
        ctx.restore();
      }

      // --- Ambient neon reflections ---
      ctx.globalAlpha = 0.03;
      const neonReflect = ctx.createLinearGradient(0, 0, w, 0);
      neonReflect.addColorStop(0, NEON_PINK);
      neonReflect.addColorStop(0.3, NEON_CYAN);
      neonReflect.addColorStop(0.6, NEON_YELLOW);
      neonReflect.addColorStop(1, NEON_GREEN);
      ctx.fillStyle = neonReflect;
      ctx.fillRect(0, 0, w, h);
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
  }, [stats]);

  return (
    <div style={{
      width: '100%', height: '100%', minHeight: 450, position: 'relative',
      background: '#1a0a0a', borderRadius: 4, overflow: 'hidden',
      fontFamily: "'JetBrains Mono', 'Courier New', monospace",
    }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

      <div style={{
        position: 'absolute', top: 5, left: 12, zIndex: 2,
      }}>
        <div style={{
          fontSize: 13, fontWeight: 900, color: NEON_YELLOW,
          letterSpacing: '0.2em',
          textShadow: `0 0 10px rgba(255,215,0,0.6), 0 0 20px rgba(255,215,0,0.3)`,
        }}>
          CASINO FLOOR
        </div>
      </div>
    </div>
  );
}

function drawNeonText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number,
  color: string, size: number, phase: number) {
  const flicker = 0.5 + Math.sin(phase * 0.03) * 0.3 + Math.sin(phase * 0.07) * 0.2;
  ctx.save();
  ctx.globalAlpha = Math.max(0.2, flicker);
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
  // Double render for extra glow
  ctx.shadowBlur = 15;
  ctx.globalAlpha = Math.max(0.1, flicker * 0.3);
  ctx.fillText(text, x, y);
  ctx.restore();
}
