import React, { useEffect, useRef, useState } from 'react';

interface Neuron {
  id: string;
  starName: string;
  project: string;
  status: string;
  turns: number;
  milestone: string;
  // Position in brain
  x: number;
  y: number;
  region: string;
  firePhase: number; // -1 = not firing, 0+ = firing animation phase
  lastFireTime: number;
  baseGlow: number;
}

interface Synapse {
  from: number;
  to: number;
  firePhase: number;
  particles: Array<{ t: number; speed: number }>;
}

interface StatsData {
  active_agents?: number;
  idle_agents?: number;
  total_agents_spawned?: number;
  cumulative_cost?: number;
}

const API_BASE = 'http://localhost:4040';

const REGION_COLORS: Record<string, string> = {
  frontal: '#9b59b6',   // purple
  temporal: '#3498db',   // blue
  parietal: '#2ecc71',   // green
  occipital: '#e74c3c',  // red
  cerebellum: '#f39c12', // orange
};

const REGION_POSITIONS: Record<string, { cx: number; cy: number; rx: number; ry: number }> = {
  frontal: { cx: 0.35, cy: 0.25, rx: 0.15, ry: 0.12 },
  temporal: { cx: 0.2, cy: 0.55, rx: 0.12, ry: 0.1 },
  parietal: { cx: 0.55, cy: 0.3, rx: 0.12, ry: 0.1 },
  occipital: { cx: 0.7, cy: 0.45, rx: 0.1, ry: 0.1 },
  cerebellum: { cx: 0.65, cy: 0.7, rx: 0.12, ry: 0.08 },
};

const REGIONS = Object.keys(REGION_COLORS);

function buildDemoNeurons(): Neuron[] {
  const demos = [
    { starName: 'Sirius', project: 'alpha', status: 'active', turns: 42, milestone: 'Read main.py' },
    { starName: 'Vega', project: 'alpha', status: 'active', turns: 18, milestone: 'Bash git status' },
    { starName: 'Rigel', project: 'beta', status: 'idle', turns: 30, milestone: 'Edit config.ts' },
    { starName: 'Arcturus', project: 'gamma', status: 'error', turns: 5, milestone: 'ERROR: crash' },
    { starName: 'Capella', project: 'beta', status: 'active', turns: 22, milestone: 'Grep patterns' },
    { starName: 'Betelgeuse', project: 'delta', status: 'done', turns: 50, milestone: 'Complete' },
    { starName: 'Deneb', project: 'gamma', status: 'active', turns: 35, milestone: 'Write output' },
    { starName: 'Altair', project: 'delta', status: 'active', turns: 15, milestone: 'Bash npm test' },
    { starName: 'Pollux', project: 'epsilon', status: 'active', turns: 28, milestone: 'Read schema' },
    { starName: 'Antares', project: 'epsilon', status: 'idle', turns: 8, milestone: 'Waiting' },
  ];
  return demos.map((d, i) => {
    const region = REGIONS[i % REGIONS.length];
    const rp = REGION_POSITIONS[region];
    return {
      id: `demo-${i}`,
      starName: d.starName,
      project: d.project,
      status: d.status,
      turns: d.turns,
      milestone: d.milestone,
      x: rp.cx + (Math.random() - 0.5) * rp.rx * 2,
      y: rp.cy + (Math.random() - 0.5) * rp.ry * 2,
      region,
      firePhase: -1,
      lastFireTime: 0,
      baseGlow: 0.3 + Math.random() * 0.3,
    };
  });
}

export function NeuralNetworkPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const neuronsRef = useRef<Neuron[]>([]);
  const synapsesRef = useRef<Synapse[]>([]);
  const [stats, setStats] = useState<StatsData>({});
  const eegDataRef = useRef<number[]>(new Array(300).fill(0));
  const thoughtBubblesRef = useRef<Array<{ x: number; y: number; text: string; age: number; maxAge: number }>>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [agentsResp, statsResp] = await Promise.all([
          fetch(`${API_BASE}/api/agents`),
          fetch(`${API_BASE}/api/stats`),
        ]);
        if (agentsResp.ok) {
          const raw: any[] = await agentsResp.json();
          const projects = [...new Set(raw.map(a => a.project || 'unknown'))];
          const neurons: Neuron[] = raw.map((a, i) => {
            const existing = neuronsRef.current.find(n => n.id === (a.session_id || `a-${i}`));
            const projIdx = projects.indexOf(a.project || 'unknown');
            const region = REGIONS[projIdx % REGIONS.length];
            const rp = REGION_POSITIONS[region];
            return {
              id: a.session_id || `a-${i}`,
              starName: a.star_name || `N${i}`,
              project: a.project || 'unknown',
              status: a.status || 'idle',
              turns: a.turns || 0,
              milestone: a.milestone || '',
              x: existing?.x ?? (rp.cx + (Math.random() - 0.5) * rp.rx * 2),
              y: existing?.y ?? (rp.cy + (Math.random() - 0.5) * rp.ry * 2),
              region,
              firePhase: existing?.firePhase ?? -1,
              lastFireTime: existing?.lastFireTime ?? 0,
              baseGlow: existing?.baseGlow ?? (0.3 + Math.random() * 0.3),
            };
          });
          neuronsRef.current = neurons;
          buildSynapses(neurons);
        }
        if (statsResp.ok) setStats(await statsResp.json());
      } catch {
        if (neuronsRef.current.length === 0) {
          const demo = buildDemoNeurons();
          neuronsRef.current = demo;
          buildSynapses(demo);
          setStats({ active_agents: 6, idle_agents: 2, total_agents_spawned: 10, cumulative_cost: 4.5 });
        }
      }
    };

    function buildSynapses(neurons: Neuron[]) {
      const synapses: Synapse[] = [];
      for (let i = 0; i < neurons.length; i++) {
        for (let j = i + 1; j < neurons.length; j++) {
          // Connect neurons in same region, and some cross-region
          if (neurons[i].region === neurons[j].region || Math.random() < 0.15) {
            synapses.push({ from: i, to: j, firePhase: -1, particles: [] });
          }
        }
      }
      synapsesRef.current = synapses;
    }

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

    function render() {
      if (!ctx || !canvas) return;
      const w = W / 2;
      const h = H / 2;
      frame++;

      const eegH = 35;
      const brainTop = eegH + 5;
      const brainH = h - brainTop;

      // --- Background: dark MRI scan texture ---
      const bgGrad = ctx.createRadialGradient(w * 0.45, h * 0.5, 0, w * 0.45, h * 0.5, Math.max(w, h) * 0.7);
      bgGrad.addColorStop(0, '#0a0a1a');
      bgGrad.addColorStop(0.5, '#060612');
      bgGrad.addColorStop(1, '#020208');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Subtle brain scan texture lines
      ctx.globalAlpha = 0.02;
      for (let y = 0; y < h; y += 8) {
        const offset = Math.sin(y * 0.05 + frame * 0.01) * 5;
        ctx.strokeStyle = '#334';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y + offset);
        ctx.lineTo(w, y + offset);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // --- Brain outline ---
      ctx.save();
      ctx.translate(w * 0.45, brainTop + brainH * 0.48);
      const brainScale = Math.min(w * 0.35, brainH * 0.42);

      // Brain shape (stylized left hemisphere)
      ctx.strokeStyle = 'rgba(100,100,160,0.15)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      // Approximate brain outline
      ctx.moveTo(-brainScale * 0.1, -brainScale * 0.8);
      ctx.bezierCurveTo(-brainScale * 0.8, -brainScale * 0.9, -brainScale * 1.0, -brainScale * 0.2, -brainScale * 0.7, brainScale * 0.3);
      ctx.bezierCurveTo(-brainScale * 0.5, brainScale * 0.6, -brainScale * 0.2, brainScale * 0.7, 0, brainScale * 0.5);
      ctx.bezierCurveTo(brainScale * 0.3, brainScale * 0.7, brainScale * 0.6, brainScale * 0.5, brainScale * 0.7, brainScale * 0.1);
      ctx.bezierCurveTo(brainScale * 0.9, -brainScale * 0.3, brainScale * 0.7, -brainScale * 0.8, brainScale * 0.2, -brainScale * 0.85);
      ctx.bezierCurveTo(0, -brainScale * 0.9, -brainScale * 0.05, -brainScale * 0.85, -brainScale * 0.1, -brainScale * 0.8);
      ctx.stroke();

      // Brain fissures
      ctx.strokeStyle = 'rgba(100,100,160,0.08)';
      ctx.lineWidth = 1;
      // Central sulcus
      ctx.beginPath();
      ctx.moveTo(brainScale * 0.1, -brainScale * 0.8);
      ctx.quadraticCurveTo(brainScale * 0.05, -brainScale * 0.2, -brainScale * 0.1, brainScale * 0.3);
      ctx.stroke();
      // Lateral fissure
      ctx.beginPath();
      ctx.moveTo(-brainScale * 0.6, brainScale * 0.1);
      ctx.quadraticCurveTo(-brainScale * 0.2, 0, brainScale * 0.3, brainScale * 0.15);
      ctx.stroke();

      ctx.restore();

      // --- Region labels ---
      for (const [region, pos] of Object.entries(REGION_POSITIONS)) {
        const color = REGION_COLORS[region];
        ctx.fillStyle = color + '30';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(region.toUpperCase(), pos.cx * w, pos.cy * h + brainTop - pos.ry * h - 5);

        // Region zone highlight
        ctx.save();
        ctx.globalAlpha = 0.04;
        const rg = ctx.createRadialGradient(pos.cx * w, pos.cy * h + brainTop, 0, pos.cx * w, pos.cy * h + brainTop, pos.rx * w);
        rg.addColorStop(0, color);
        rg.addColorStop(1, 'transparent');
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.ellipse(pos.cx * w, pos.cy * h + brainTop, pos.rx * w, pos.ry * h, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // --- Synapses ---
      const neurons = neuronsRef.current;
      const synapses = synapsesRef.current;

      for (const syn of synapses) {
        if (syn.from >= neurons.length || syn.to >= neurons.length) continue;
        const nA = neurons[syn.from];
        const nB = neurons[syn.to];
        const ax = nA.x * w;
        const ay = nA.y * h + brainTop;
        const bx = nB.x * w;
        const by = nB.y * h + brainTop;

        // Base connection
        ctx.strokeStyle = 'rgba(100,100,160,0.06)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();

        // Fire synapse when neurons fire
        if (nA.firePhase >= 0 && nA.firePhase < 30) {
          syn.firePhase = Math.max(0, syn.firePhase);
          if (Math.random() < 0.1) {
            syn.particles.push({ t: 0, speed: 0.02 + Math.random() * 0.03 });
          }
        }

        // Synapse fire animation
        if (syn.firePhase >= 0) {
          syn.firePhase++;
          if (syn.firePhase > 60) syn.firePhase = -1;

          const alpha = Math.max(0, 0.4 - syn.firePhase * 0.006);
          const color = REGION_COLORS[nA.region] || '#7B61FF';
          ctx.strokeStyle = color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
          ctx.lineWidth = 1.5;
          ctx.shadowColor = color;
          ctx.shadowBlur = 5;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        // Neurotransmitter particles
        for (let pi = syn.particles.length - 1; pi >= 0; pi--) {
          const p = syn.particles[pi];
          p.t += p.speed;
          if (p.t > 1) { syn.particles.splice(pi, 1); continue; }
          const px = ax + (bx - ax) * p.t;
          const py = ay + (by - ay) * p.t;
          const color = REGION_COLORS[nA.region] || '#7B61FF';
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.7 * (1 - p.t);
          ctx.beginPath();
          ctx.arc(px, py, 1.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      // --- Neurons ---
      for (let ni = 0; ni < neurons.length; ni++) {
        const n = neurons[ni];
        const nx = n.x * w;
        const ny = n.y * h + brainTop;
        const color = REGION_COLORS[n.region] || '#7B61FF';

        // Trigger firing for active neurons periodically
        if (n.status === 'active' && frame - n.lastFireTime > 60 + Math.random() * 60) {
          n.firePhase = 0;
          n.lastFireTime = frame;
          // Spawn thought bubble
          if (n.milestone && Math.random() < 0.3) {
            thoughtBubblesRef.current.push({
              x: nx, y: ny - 15, text: n.milestone.slice(0, 20),
              age: 0, maxAge: 90,
            });
          }
        }

        // Update fire phase
        if (n.firePhase >= 0) {
          n.firePhase++;
          if (n.firePhase > 50) n.firePhase = -1;
        }

        const isFiring = n.firePhase >= 0 && n.firePhase < 20;
        const isError = n.status === 'error';
        const isDone = n.status === 'done';
        const isIdle = n.status === 'idle';

        // Neuron glow
        const glowR = isFiring ? 18 + Math.sin(n.firePhase * 0.3) * 5 : 8;
        const glowAlpha = isFiring ? 0.5 : n.baseGlow * 0.15;
        const glowColor = isError ? '#ff3333' : color;

        const glow = ctx.createRadialGradient(nx, ny, 0, nx, ny, glowR);
        glow.addColorStop(0, glowColor + Math.floor(glowAlpha * 255).toString(16).padStart(2, '0'));
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(nx, ny, glowR, 0, Math.PI * 2);
        ctx.fill();

        // Neuron body
        const bodyR = isFiring ? 4.5 : (isIdle ? 2.5 : 3.5);
        ctx.fillStyle = isError ? '#ff3333' : (isDone ? 'rgba(100,100,160,0.3)' : color);
        ctx.beginPath();
        ctx.arc(nx, ny, bodyR, 0, Math.PI * 2);
        ctx.fill();

        // Inner core
        if (isFiring) {
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = 1 - n.firePhase / 20;
          ctx.beginPath();
          ctx.arc(nx, ny, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        // Error sparks
        if (isError && frame % 8 < 4) {
          for (let s = 0; s < 3; s++) {
            const sparkAngle = Math.random() * Math.PI * 2;
            const sparkDist = 5 + Math.random() * 8;
            ctx.strokeStyle = '#ff3333';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(nx + Math.cos(sparkAngle) * 3, ny + Math.sin(sparkAngle) * 3);
            ctx.lineTo(nx + Math.cos(sparkAngle) * sparkDist, ny + Math.sin(sparkAngle) * sparkDist);
            ctx.stroke();
          }
        }

        // Dendrite extensions (small lines radiating from neuron)
        const dendCount = 4 + Math.floor(n.turns / 10);
        for (let d = 0; d < Math.min(dendCount, 8); d++) {
          const dAngle = (d / dendCount) * Math.PI * 2 + ni * 0.5;
          const dLen = 8 + Math.sin(frame * 0.02 + d) * 3;
          ctx.strokeStyle = color + '20';
          ctx.lineWidth = 0.3;
          ctx.beginPath();
          ctx.moveTo(nx + Math.cos(dAngle) * bodyR, ny + Math.sin(dAngle) * bodyR);
          // Branching
          const midX = nx + Math.cos(dAngle) * dLen;
          const midY = ny + Math.sin(dAngle) * dLen;
          ctx.lineTo(midX, midY);
          // Sub-branches
          ctx.lineTo(midX + Math.cos(dAngle + 0.5) * 4, midY + Math.sin(dAngle + 0.5) * 4);
          ctx.moveTo(midX, midY);
          ctx.lineTo(midX + Math.cos(dAngle - 0.5) * 4, midY + Math.sin(dAngle - 0.5) * 4);
          ctx.stroke();
        }

        // Label (only show for active/error)
        if (n.status === 'active' || n.status === 'error') {
          ctx.fillStyle = color + '80';
          ctx.font = '7px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(n.starName, nx, ny + bodyR + 12);
        }
      }

      // --- Thought bubbles ---
      for (let i = thoughtBubblesRef.current.length - 1; i >= 0; i--) {
        const tb = thoughtBubblesRef.current[i];
        tb.age++;
        tb.y -= 0.5;
        if (tb.age > tb.maxAge) { thoughtBubblesRef.current.splice(i, 1); continue; }

        const alpha = Math.min(1, (1 - tb.age / tb.maxAge) * 2);
        // Bubble background
        ctx.save();
        ctx.globalAlpha = alpha * 0.7;
        const textW = ctx.measureText(tb.text).width || 60;
        ctx.fillStyle = 'rgba(20,20,40,0.85)';
        ctx.beginPath();
        const bx = tb.x - textW / 2 - 6;
        const by = tb.y - 10;
        const bw = textW + 12;
        const bh = 16;
        ctx.roundRect(bx, by, bw, bh, 8);
        ctx.fill();
        ctx.strokeStyle = 'rgba(150,150,200,0.3)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Thought bubble tail (small circles)
        ctx.fillStyle = 'rgba(20,20,40,0.6)';
        ctx.beginPath();
        ctx.arc(tb.x, by + bh + 4, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(tb.x + 2, by + bh + 8, 1.2, 0, Math.PI * 2);
        ctx.fill();

        // Text
        ctx.fillStyle = `rgba(200,200,255,${alpha})`;
        ctx.font = '7px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(tb.text, tb.x, tb.y);
        ctx.restore();
      }

      // --- EEG brainwave across top ---
      const activity = stats.active_agents ?? neurons.filter(n => n.status === 'active').length;
      const eeg = eegDataRef.current;
      // Alpha wave + activity noise
      eeg.push(
        Math.sin(frame * 0.08) * 3 * activity +
        Math.sin(frame * 0.2) * 1.5 +
        (Math.random() - 0.5) * activity * 2
      );
      if (eeg.length > 300) eeg.shift();

      // Draw EEG
      const eegBaseline = eegH / 2;
      ctx.strokeStyle = 'rgba(200,200,255,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < eeg.length; i++) {
        const ex = (i / eeg.length) * w;
        const ey = eegBaseline + eeg[i] * 1.5;
        i === 0 ? ctx.moveTo(ex, ey) : ctx.lineTo(ex, ey);
      }
      ctx.stroke();

      // EEG glow
      ctx.save();
      ctx.shadowColor = 'rgba(200,200,255,0.3)';
      ctx.shadowBlur = 4;
      ctx.strokeStyle = 'rgba(200,200,255,0.15)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < eeg.length; i++) {
        const ex = (i / eeg.length) * w;
        const ey = eegBaseline + eeg[i] * 1.5;
        i === 0 ? ctx.moveTo(ex, ey) : ctx.lineTo(ex, ey);
      }
      ctx.stroke();
      ctx.restore();

      // EEG label
      ctx.fillStyle = 'rgba(200,200,255,0.3)';
      ctx.font = '7px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('EEG BRAINWAVE', 8, 10);

      // EEG baseline
      ctx.strokeStyle = 'rgba(200,200,255,0.08)';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(0, eegBaseline);
      ctx.lineTo(w, eegBaseline);
      ctx.stroke();
      ctx.setLineDash([]);

      // --- Vignette ---
      const vig = ctx.createRadialGradient(w * 0.45, h * 0.5, Math.min(w, h) * 0.2, w * 0.45, h * 0.5, Math.max(w, h) * 0.7);
      vig.addColorStop(0, 'transparent');
      vig.addColorStop(1, 'rgba(0,0,8,0.5)');
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
      background: '#020208', borderRadius: 4, overflow: 'hidden',
      fontFamily: "'JetBrains Mono', 'Courier New', monospace",
    }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

      <div style={{
        position: 'absolute', top: 40, right: 12, zIndex: 2,
      }}>
        <div style={{
          fontSize: 12, fontWeight: 700, color: '#9b59b6',
          letterSpacing: '0.15em',
          textShadow: '0 0 10px rgba(155,89,182,0.5)',
        }}>
          NEURAL NET
        </div>
        <div style={{ fontSize: 8, color: 'rgba(155,89,182,0.4)', letterSpacing: '0.06em' }}>
          AGENT BRAIN ACTIVITY
        </div>
      </div>

      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 2,
        background: 'rgba(5,5,15,0.85)',
        borderTop: '1px solid rgba(155,89,182,0.15)',
        padding: '5px 14px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: 9, letterSpacing: '0.06em',
      }}>
        {Object.entries(REGION_COLORS).map(([region, color]) => (
          <span key={region} style={{ color }}>
            {region.toUpperCase()}
          </span>
        ))}
      </div>
    </div>
  );
}
