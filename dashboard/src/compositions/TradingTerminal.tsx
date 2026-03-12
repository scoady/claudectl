import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  spring,
  useVideoConfig,
  Easing,
} from 'remotion';
import { colors, hexToRgb } from './theme';

// ── Deterministic random ─────────────────────────────────────────────────────

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ── Color palette (Bloomberg-inspired) ───────────────────────────────────────

const C = {
  bg: '#1a1a1a',
  panelBg: '#141414',
  panelBorder: '#2a2a2a',
  orange: '#ff8800',
  orangeDim: '#ff9922',
  bidGreen: '#00cc44',
  askRed: '#ff2244',
  bidBlue: '#3388ff',
  askRedBright: '#ff4466',
  volPurple: '#8844cc',
  textPrimary: '#dddddd',
  textSecondary: '#888888',
  textMuted: '#444444',
  gridLine: '#222222',
  profitGreen: '#00cc44',
  lossRed: '#ff2244',
  heatHigh: '#ff2200',
  heatNeutral: '#333333',
};

const MONO = "'Consolas', 'Source Code Pro', monospace";
const SANS = "'Inter', 'Roboto', sans-serif";

// ── Data types ───────────────────────────────────────────────────────────────

interface Candle {
  o: number; h: number; l: number; c: number; v: number;
}

function generateCandles(rng: () => number, count: number): Candle[] {
  const candles: Candle[] = [];
  let price = 4820;
  for (let i = 0; i < count; i++) {
    const dir = rng() > 0.46 ? 1 : -1;
    const move = rng() * 6 + 0.5;
    const o = price;
    const c = o + dir * move;
    const h = Math.max(o, c) + rng() * 4;
    const l = Math.min(o, c) - rng() * 4;
    const v = 40 + rng() * 160;
    candles.push({ o, h, l, c, v });
    price = c;
  }
  return candles;
}

// ── Static data ──────────────────────────────────────────────────────────────

const POSITIONS = [
  { sym: 'ALPHA-1', qty: 500, avg: 4832.10 },
  { sym: 'BETA-2', qty: -200, avg: 4855.40 },
  { sym: 'GAMMA-3', qty: 350, avg: 4818.90 },
  { sym: 'DELTA-4', qty: -150, avg: 4840.00 },
  { sym: 'OMEGA-5', qty: 800, avg: 4810.50 },
];

const HEADLINES = [
  { src: 'AGENT', text: 'ALPHA-1 completes sprint 4 — velocity up 23%', breaking: true },
  { src: 'SYSTEM', text: 'Cluster autoscaler provisions 3 new nodes', breaking: false },
  { src: 'MARKET', text: 'Task throughput hits 120-day high across all agents', breaking: true },
  { src: 'AGENT', text: 'GAMMA-3 resolves critical path dependency on auth module', breaking: false },
  { src: 'SYSTEM', text: 'Memory pressure easing — GC pause times normalizing', breaking: false },
  { src: 'MARKET', text: 'BREAKING: Portfolio rebalance triggered — risk limits adjusted', breaking: true },
];

const CORRELATION = [
  [1.00, 0.72, -0.31, 0.45],
  [0.72, 1.00, -0.18, 0.60],
  [-0.31, -0.18, 1.00, -0.52],
  [0.45, 0.60, -0.52, 1.00],
];
const CORR_LABELS = ['ALPH', 'BETA', 'GAMM', 'DELT'];

// ── Component ─────────────────────────────────────────────────────────────────

export const TradingTerminal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Candle data
  const candles = useMemo(() => {
    const r = seededRandom(8833);
    return generateCandles(r, 35);
  }, []);

  // Bid/ask book data
  const bookData = useMemo(() => {
    const r = seededRandom(9944);
    const bids = Array.from({ length: 10 }, (_, i) => ({
      price: 4847.28 - i * 0.04, baseSize: 100 + r() * 1400, orders: 5 + Math.floor(r() * 40),
    }));
    const asks = Array.from({ length: 10 }, (_, i) => ({
      price: 4847.36 + i * 0.04, baseSize: 80 + r() * 1300, orders: 4 + Math.floor(r() * 38),
    }));
    return { bids, asks };
  }, []);

  // Time & sales entries
  const trades = useMemo(() => {
    const r = seededRandom(5566);
    return Array.from({ length: 30 }, () => ({
      price: 4847 + (r() - 0.5) * 2,
      size: Math.floor(10 + r() * 500),
      side: r() > 0.5 ? 'BUY' as const : 'SELL' as const,
      large: r() > 0.85,
    }));
  }, []);

  // Noise for heat map shimmer
  const heatNoise = useMemo(() => {
    const r = seededRandom(7788);
    return Array.from({ length: 16 }, () => r());
  }, []);

  // ── Derived animations ────────────────────────────────────────────────────

  const fadeIn = interpolate(frame, [0, 40], [0, 1], {
    extrapolateRight: 'clamp', easing: Easing.out(Easing.ease),
  });

  // Boot sequence
  const bootProgress = interpolate(frame, [0, 35], [0, 1], { extrapolateRight: 'clamp' });
  const bootDone = frame > 40;

  // Current candle animation
  const candleIdx = Math.min(candles.length - 1, Math.floor(interpolate(frame, [40, 280], [0, candles.length - 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })));

  // Large trade spike at frame 100
  const spikeIntensity = spring({ frame: frame - 100, fps, config: { damping: 8, stiffness: 120 } });
  const spikeActive = frame >= 100 && frame <= 130;

  // Position close at frame 180
  const closeFlash = spring({ frame: frame - 180, fps, config: { damping: 15, stiffness: 100 } });
  const positionClosed = frame >= 180;

  // Price data
  const lastPrice = candles[candleIdx]?.c ?? 4847.32;
  const priceFlash = Math.sin(frame * 0.5) > 0.3;

  // Ticker scroll position
  const tickerOffset = interpolate(frame, [0, 300], [0, -2400], { extrapolateRight: 'clamp' });

  // Spread dynamics
  const spread = spikeActive ? 0.16 : 0.08;

  // Layout
  const chartW = 760;
  const chartH = 540;
  const rightX = chartW + 4;
  const rightW = 1920 - rightX;
  const bookH = 200;
  const posH = 180;
  const tapeH = chartH - bookH - posH;
  const bottomY = chartH + 4;
  const bottomH = 1080 - bottomY;
  const newsW = 960;

  const orangeRgb = hexToRgb(C.orange);
  const greenRgb = hexToRgb(colors.green);

  return (
    <AbsoluteFill style={{ backgroundColor: C.bg }}>
      <svg viewBox="0 0 1920 1080" style={{ width: '100%', height: '100%' }}>
        <defs>
          <filter id="tt-glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="tt-bloom">
            <feGaussianBlur stdDeviation="4" result="bloom" />
            <feMerge><feMergeNode in="bloom" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <clipPath id="chart-clip"><rect x={0} y={0} width={chartW} height={chartH} /></clipPath>
          <clipPath id="news-clip"><rect x={0} y={bottomY} width={newsW} height={bottomH} /></clipPath>
        </defs>

        {/* ── Boot overlay ────────────────────────────────────────────── */}
        {!bootDone && (
          <g opacity={interpolate(frame, [35, 42], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}>
            <rect x={0} y={0} width={1920} height={1080} fill="#000000" />
            <text x={960} y={400} textAnchor="middle" fill={C.orange} fontFamily={MONO} fontSize={18} fontWeight={700}>
              TERMINAL PROFESSIONAL SERVICE
            </text>
            <text x={960} y={430} textAnchor="middle" fill={C.orange} fontFamily={MONO} fontSize={11} opacity={0.7}>
              CONNECTING TO MARKET DATA...{bootProgress > 0.6 ? ' OK' : ''}
            </text>
            {/* Progress bar */}
            <rect x={760} y={450} width={400} height={4} fill={C.panelBorder} />
            <rect x={760} y={450} width={400 * bootProgress} height={4} fill={C.orange} />
            <text x={960} y={480} textAnchor="middle" fill={C.textSecondary} fontFamily={MONO} fontSize={9}>
              {bootProgress > 0.3 ? 'LOADING POSITIONS...' : 'AUTHENTICATING...'}
              {bootProgress > 0.7 ? ' STREAMING LIVE DATA' : ''}
            </text>
          </g>
        )}

        {/* ── Main content (fades in after boot) ──────────────────────── */}
        <g opacity={fadeIn}>

          {/* ── TOP-LEFT: CANDLESTICK CHART ──────────────────────────── */}
          <g clipPath="url(#chart-clip)">
            <rect x={0} y={0} width={chartW} height={chartH} fill={C.panelBg} />

            {/* Chart header */}
            <rect x={0} y={0} width={chartW} height={24} fill="rgba(255,136,0,0.06)" />
            <text x={12} y={16} fill={C.orange} fontFamily={SANS} fontSize={11} fontWeight={700}>
              AGENT PERFORMANCE INDEX
            </text>
            <text x={chartW - 12} y={16} textAnchor="end" fill={C.textSecondary} fontFamily={MONO} fontSize={9}>
              1m | 5m | 15m | 1H | 4H | D
            </text>

            {/* Price grid */}
            {Array.from({ length: 8 }, (_, i) => {
              const gy = 40 + i * 58;
              return (
                <g key={`gy${i}`}>
                  <line x1={50} y1={gy} x2={chartW - 10} y2={gy} stroke={C.gridLine} strokeWidth={0.5} />
                  <text x={8} y={gy + 3} fill={C.textMuted} fontFamily={MONO} fontSize={8}>
                    {(4860 - i * 8).toFixed(0)}
                  </text>
                </g>
              );
            })}

            {/* Candles */}
            {candles.slice(0, candleIdx + 1).map((candle, i) => {
              const x = 60 + i * 19;
              const isUp = candle.c >= candle.o;
              const color = isUp ? C.bidGreen : C.askRed;
              const minP = 4790;
              const maxP = 4870;
              const scale = (chartH - 80) / (maxP - minP);
              const bodyTop = chartH - 40 - (Math.max(candle.o, candle.c) - minP) * scale;
              const bodyBot = chartH - 40 - (Math.min(candle.o, candle.c) - minP) * scale;
              const wickTop = chartH - 40 - (candle.h - minP) * scale;
              const wickBot = chartH - 40 - (candle.l - minP) * scale;
              const bodyH = Math.max(1, bodyBot - bodyTop);
              const vH = candle.v / 200 * 30;

              return (
                <g key={`c${i}`}>
                  <line x1={x + 4} y1={wickTop} x2={x + 4} y2={wickBot} stroke={color} strokeWidth={1} />
                  <rect x={x} y={bodyTop} width={8} height={bodyH} fill={color} stroke={color} strokeWidth={0.5}
                    opacity={isUp ? 0.9 : 0.8} />
                  <rect x={x} y={chartH - 10 - vH} width={8} height={vH}
                    fill={C.volPurple} opacity={0.3 + (spikeActive && i === candleIdx ? spikeIntensity * 0.5 : 0)} />
                </g>
              );
            })}

            {/* Moving averages */}
            {[10, 20].map((period, mi) => {
              const maColor = mi === 0 ? C.orange : C.bidBlue;
              const visible = candles.slice(0, candleIdx + 1);
              if (visible.length < period) return null;
              const points = visible.map((_, i) => {
                if (i < period - 1) return null;
                const slice = visible.slice(i - period + 1, i + 1);
                const avg = slice.reduce((s, c) => s + c.c, 0) / period;
                const x = 60 + i * 19 + 4;
                const y = chartH - 40 - (avg - 4790) / (4870 - 4790) * (chartH - 80);
                return `${x},${y}`;
              }).filter(Boolean);
              return <polyline key={`ma${mi}`} points={points.join(' ')} fill="none" stroke={maColor}
                strokeWidth={1} opacity={0.6} />;
            })}

            {/* Bollinger bands */}
            {(() => {
              const visible = candles.slice(0, candleIdx + 1);
              if (visible.length < 20) return null;
              const upper: string[] = [];
              const lower: string[] = [];
              visible.forEach((_, i) => {
                if (i < 19) return;
                const slice = visible.slice(i - 19, i + 1);
                const avg = slice.reduce((s, c) => s + c.c, 0) / 20;
                const std = Math.sqrt(slice.reduce((s, c) => s + (c.c - avg) ** 2, 0) / 20);
                const x = 60 + i * 19 + 4;
                const yU = chartH - 40 - (avg + 2 * std - 4790) / (4870 - 4790) * (chartH - 80);
                const yL = chartH - 40 - (avg - 2 * std - 4790) / (4870 - 4790) * (chartH - 80);
                upper.push(`${x},${yU}`);
                lower.push(`${x},${yL}`);
              });
              return (
                <g>
                  <polyline points={upper.join(' ')} fill="none" stroke={C.volPurple} strokeWidth={0.8} opacity={0.3} strokeDasharray="3 2" />
                  <polyline points={lower.join(' ')} fill="none" stroke={C.volPurple} strokeWidth={0.8} opacity={0.3} strokeDasharray="3 2" />
                </g>
              );
            })()}

            {/* Current price line */}
            {(() => {
              const py = chartH - 40 - (lastPrice - 4790) / (4870 - 4790) * (chartH - 80);
              return (
                <g filter="url(#tt-glow)">
                  <line x1={60} y1={py} x2={chartW - 10} y2={py} stroke={C.orange} strokeWidth={0.5}
                    strokeDasharray="4 3" opacity={0.5} />
                  <rect x={chartW - 70} y={py - 8} width={60} height={16} fill={C.orange} rx={2}
                    opacity={priceFlash ? 0.9 : 0.7} />
                  <text x={chartW - 40} y={py + 4} textAnchor="middle" fill="#000" fontFamily={MONO}
                    fontSize={9} fontWeight={700}>{lastPrice.toFixed(2)}</text>
                </g>
              );
            })()}

            {/* Spike flash overlay */}
            {spikeActive && (
              <rect x={0} y={0} width={chartW} height={chartH} fill={C.askRed}
                opacity={spikeIntensity * 0.04} />
            )}
          </g>

          {/* ── TOP-RIGHT: ORDER BOOK + POSITIONS + TAPE ─────────────── */}
          <g>
            {/* ORDER BOOK */}
            <rect x={rightX} y={0} width={rightW} height={bookH} fill={C.panelBg} />
            <rect x={rightX} y={0} width={rightW} height={20} fill="rgba(255,136,0,0.06)" />
            <text x={rightX + 12} y={14} fill={C.orange} fontFamily={SANS} fontSize={10} fontWeight={700}>ORDER BOOK — LEVEL II</text>
            <text x={rightX + rightW / 2} y={14} textAnchor="middle" fill={C.textSecondary} fontFamily={MONO} fontSize={9}>
              SPREAD: {spread.toFixed(2)}
            </text>

            {/* Bid side */}
            <text x={rightX + 12} y={36} fill={C.bidGreen} fontFamily={MONO} fontSize={8} fontWeight={700}>BID</text>
            {bookData.bids.map((b, i) => {
              const jitter = Math.sin(frame * 0.3 + i * 1.7) * 80;
              const size = Math.max(50, b.baseSize + jitter);
              const maxSize = 1600;
              const barW = (size / maxSize) * (rightW / 2 - 40);
              const y = 42 + i * 15;
              return (
                <g key={`bid${i}`}>
                  <rect x={rightX + rightW / 2 - 30 - barW} y={y} width={barW} height={12}
                    fill={C.bidGreen} opacity={i === 0 ? 0.3 : 0.15} />
                  <text x={rightX + 12} y={y + 10} fill={C.bidGreen} fontFamily={MONO} fontSize={8}>
                    {b.price.toFixed(2)}
                  </text>
                  <text x={rightX + rightW / 2 - 35} y={y + 10} textAnchor="end" fill={C.textSecondary}
                    fontFamily={MONO} fontSize={8}>{Math.floor(size)}</text>
                </g>
              );
            })}

            {/* Ask side */}
            <text x={rightX + rightW / 2 + 12} y={36} fill={C.askRed} fontFamily={MONO} fontSize={8} fontWeight={700}>ASK</text>
            {bookData.asks.map((a, i) => {
              const jitter = Math.sin(frame * 0.25 + i * 2.1) * 90;
              const size = Math.max(40, a.baseSize + jitter);
              const maxSize = 1600;
              const barW = (size / maxSize) * (rightW / 2 - 40);
              const y = 42 + i * 15;
              return (
                <g key={`ask${i}`}>
                  <rect x={rightX + rightW / 2 + 30} y={y} width={barW} height={12}
                    fill={C.askRed} opacity={i === 0 ? 0.3 : 0.15} />
                  <text x={rightX + rightW / 2 + 12} y={y + 10} fill={C.askRed} fontFamily={MONO} fontSize={8}>
                    {a.price.toFixed(2)}
                  </text>
                  <text x={rightX + rightW / 2 + 35 + barW} y={y + 10} fill={C.textSecondary}
                    fontFamily={MONO} fontSize={8}>{Math.floor(size)}</text>
                </g>
              );
            })}

            <line x1={rightX} y1={bookH} x2={rightX + rightW} y2={bookH} stroke={C.panelBorder} strokeWidth={1} />

            {/* POSITION TABLE */}
            <rect x={rightX} y={bookH} width={rightW} height={posH} fill={C.panelBg} />
            <rect x={rightX} y={bookH} width={rightW} height={20} fill="rgba(255,136,0,0.06)" />
            <text x={rightX + 12} y={bookH + 14} fill={C.orange} fontFamily={SANS} fontSize={10} fontWeight={700}>POSITIONS</text>

            {/* Column headers */}
            {['SYMBOL', 'QTY', 'AVG', 'LAST', 'P&L', 'P&L%'].map((h, i) => (
              <text key={h} x={rightX + 12 + i * (rightW / 6)} y={bookH + 36} fill={C.textMuted}
                fontFamily={MONO} fontSize={7} fontWeight={700}>{h}</text>
            ))}

            {/* Position rows */}
            {POSITIONS.map((p, i) => {
              const last = lastPrice + (i - 2) * 3;
              const pnl = (last - p.avg) * p.qty;
              const pnlPct = ((last - p.avg) / p.avg * 100);
              const isProfit = pnl > 0;
              const color = isProfit ? C.profitGreen : C.lossRed;
              const y = bookH + 50 + i * 22;
              const isClosed = positionClosed && i === 1;
              const rowOpacity = isClosed ? 0.4 : 1;
              const flashGreen = isClosed && closeFlash > 0 && closeFlash < 0.8;

              return (
                <g key={`pos${i}`} opacity={rowOpacity}>
                  {flashGreen && <rect x={rightX} y={y - 8} width={rightW} height={18}
                    fill={`rgba(${greenRgb}, 0.08)`} />}
                  <text x={rightX + 12} y={y + 4} fill={C.orangeDim} fontFamily={MONO} fontSize={9} fontWeight={700}>{p.sym}</text>
                  <text x={rightX + 12 + rightW / 6} y={y + 4} fill={C.textPrimary} fontFamily={MONO} fontSize={9}>{p.qty}</text>
                  <text x={rightX + 12 + 2 * rightW / 6} y={y + 4} fill={C.textSecondary} fontFamily={MONO} fontSize={9}>{p.avg.toFixed(2)}</text>
                  <text x={rightX + 12 + 3 * rightW / 6} y={y + 4} fill={C.textPrimary} fontFamily={MONO} fontSize={9}>{last.toFixed(2)}</text>
                  <text x={rightX + 12 + 4 * rightW / 6} y={y + 4} fill={color} fontFamily={MONO} fontSize={9} fontWeight={700}>
                    {pnl > 0 ? '+' : ''}{pnl.toFixed(0)}
                  </text>
                  <text x={rightX + 12 + 5 * rightW / 6} y={y + 4} fill={color} fontFamily={MONO} fontSize={9}>
                    {pnlPct > 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                  </text>
                </g>
              );
            })}

            {/* Total P&L */}
            {(() => {
              const totalPnl = POSITIONS.reduce((s, p, i) => {
                const last = lastPrice + (i - 2) * 3;
                return s + (last - p.avg) * p.qty;
              }, 0);
              const totalColor = totalPnl > 0 ? C.profitGreen : C.lossRed;
              return (
                <g>
                  <line x1={rightX + 12} y1={bookH + posH - 22} x2={rightX + rightW - 12} y2={bookH + posH - 22}
                    stroke={C.panelBorder} strokeWidth={0.5} />
                  <text x={rightX + 12} y={bookH + posH - 8} fill={C.textSecondary} fontFamily={MONO} fontSize={9} fontWeight={700}>TOTAL</text>
                  <text x={rightX + 12 + 4 * rightW / 6} y={bookH + posH - 8} fill={totalColor} fontFamily={MONO} fontSize={10} fontWeight={700}
                    filter="url(#tt-glow)">
                    {totalPnl > 0 ? '+' : ''}{totalPnl.toFixed(0)}
                  </text>
                </g>
              );
            })()}

            <line x1={rightX} y1={bookH + posH} x2={rightX + rightW} y2={bookH + posH} stroke={C.panelBorder} strokeWidth={1} />

            {/* TIME & SALES */}
            <rect x={rightX} y={bookH + posH} width={rightW} height={tapeH} fill={C.panelBg} />
            <rect x={rightX} y={bookH + posH} width={rightW} height={18} fill="rgba(255,136,0,0.06)" />
            <text x={rightX + 12} y={bookH + posH + 13} fill={C.orange} fontFamily={SANS} fontSize={10} fontWeight={700}>TIME & SALES</text>

            {/* Trade rows */}
            {(() => {
              const visibleIdx = Math.floor(frame / 10) % trades.length;
              const visibleTrades = trades.slice(0, Math.min(trades.length, 8)).map((_, i) => {
                const idx = (visibleIdx + i) % trades.length;
                return trades[idx];
              });
              return visibleTrades.map((t, i) => {
                const y = bookH + posH + 30 + i * 15;
                if (y > bookH + posH + tapeH - 5) return null;
                const color = t.side === 'BUY' ? C.bidGreen : C.askRed;
                const isNew = i === 0 && frame % 10 < 3;
                return (
                  <g key={`ts${i}`}>
                    {isNew && <rect x={rightX} y={y - 8} width={rightW} height={14} fill={color} opacity={0.05} />}
                    <text x={rightX + 12} y={y + 2} fill={color} fontFamily={MONO} fontSize={8}
                      fontWeight={t.large ? 700 : 400}>{t.price.toFixed(2)}</text>
                    <text x={rightX + 100} y={y + 2} fill={C.textSecondary} fontFamily={MONO} fontSize={8}
                      fontWeight={t.large ? 700 : 400}>{t.size}</text>
                    <text x={rightX + 160} y={y + 2} fill={color} fontFamily={MONO} fontSize={8}>{t.side}</text>
                    {t.large && <text x={rightX + rightW - 12} y={y + 2} textAnchor="end" fill={C.orange}
                      fontFamily={MONO} fontSize={7} fontWeight={700}>BLOCK</text>}
                  </g>
                );
              });
            })()}
          </g>

          {/* Chart / bottom divider */}
          <line x1={0} y1={chartH} x2={1920} y2={chartH} stroke={C.panelBorder} strokeWidth={2} />
          <line x1={chartW} y1={0} x2={chartW} y2={chartH} stroke={C.panelBorder} strokeWidth={2} />

          {/* ── BOTTOM-LEFT: NEWS TICKER ──────────────────────────────── */}
          <g clipPath="url(#news-clip)">
            <rect x={0} y={bottomY} width={newsW} height={bottomH} fill={C.panelBg} />
            <rect x={0} y={bottomY} width={newsW} height={20} fill="rgba(255,136,0,0.06)" />
            <text x={12} y={bottomY + 14} fill={C.orange} fontFamily={SANS} fontSize={10} fontWeight={700}>NEWS & EVENTS</text>

            {/* Scrolling headlines */}
            {HEADLINES.map((h, i) => {
              const xPos = tickerOffset + i * 420 + newsW;
              const srcColor = h.src === 'AGENT' ? C.bidBlue : h.src === 'SYSTEM' ? C.textSecondary : C.orange;
              return (
                <g key={`hl${i}`} transform={`translate(${xPos}, ${bottomY + 40})`}>
                  <rect x={-2} y={-10} width={36} height={14} fill={srcColor} opacity={0.15} rx={2} />
                  <text x={16} y={0} textAnchor="middle" fill={srcColor} fontFamily={MONO} fontSize={7} fontWeight={700}>{h.src}</text>
                  <text x={42} y={0} fill={h.breaking ? C.orange : C.textPrimary} fontFamily={MONO} fontSize={9}
                    fontWeight={h.breaking ? 700 : 400}>{h.text}</text>
                </g>
              );
            })}

            {/* Second ticker row */}
            {HEADLINES.slice().reverse().map((h, i) => {
              const xPos = tickerOffset * 0.7 + i * 380 + newsW + 200;
              return (
                <g key={`hl2${i}`} transform={`translate(${xPos}, ${bottomY + 65})`}>
                  <text x={0} y={0} fill={C.textSecondary} fontFamily={MONO} fontSize={8}>{h.text}</text>
                </g>
              );
            })}

            {/* Static recent headlines below ticker */}
            {HEADLINES.slice(0, Math.min(HEADLINES.length, Math.floor(frame / 40))).slice(-4).map((h, i) => (
              <g key={`sh${i}`}>
                <text x={12} y={bottomY + 95 + i * 18} fill={h.breaking ? C.orange : C.textSecondary}
                  fontFamily={MONO} fontSize={8}>
                  [{h.src}] {h.text}
                </text>
              </g>
            ))}
          </g>

          {/* ── BOTTOM-RIGHT: RISK DASHBOARD ─────────────────────────── */}
          <g>
            <rect x={newsW} y={bottomY} width={1920 - newsW} height={bottomH} fill={C.panelBg} />
            <rect x={newsW} y={bottomY} width={1920 - newsW} height={20} fill="rgba(255,136,0,0.06)" />
            <text x={newsW + 12} y={bottomY + 14} fill={C.orange} fontFamily={SANS} fontSize={10} fontWeight={700}>RISK DASHBOARD</text>

            {/* Correlation heat map */}
            <text x={newsW + 12} y={bottomY + 38} fill={C.textMuted} fontFamily={MONO} fontSize={8}>CORRELATION MATRIX</text>
            {CORRELATION.map((row, ri) => (
              row.map((val, ci) => {
                const cellSize = 42;
                const x = newsW + 12 + ci * (cellSize + 2);
                const y = bottomY + 44 + ri * (cellSize + 2);
                const shimmer = heatNoise[ri * 4 + ci] * Math.sin(frame * 0.03 + ri + ci) * 0.05;
                const absVal = Math.abs(val) + shimmer;
                const cellColor = val > 0.5 ? C.bidBlue : val < -0.3 ? C.heatHigh : C.heatNeutral;
                return (
                  <g key={`corr${ri}${ci}`}>
                    <rect x={x} y={y} width={cellSize} height={cellSize} fill={cellColor}
                      opacity={0.15 + absVal * 0.4} rx={2} />
                    <text x={x + cellSize / 2} y={y + cellSize / 2 + 3} textAnchor="middle"
                      fill={C.textPrimary} fontFamily={MONO} fontSize={9}>{val.toFixed(2)}</text>
                    {ri === 0 && <text x={x + cellSize / 2} y={y - 4} textAnchor="middle"
                      fill={C.textMuted} fontFamily={MONO} fontSize={7}>{CORR_LABELS[ci]}</text>}
                    {ci === 0 && <text x={x - 4} y={y + cellSize / 2 + 3} textAnchor="end"
                      fill={C.textMuted} fontFamily={MONO} fontSize={7}>{CORR_LABELS[ri]}</text>}
                  </g>
                );
              })
            ))}

            {/* VaR indicator */}
            {(() => {
              const varVal = interpolate(frame, [40, 300], [2.4, 3.1], {
                extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
                easing: Easing.inOut(Easing.ease),
              });
              return (
                <g>
                  <text x={newsW + 200} y={bottomY + 38} fill={C.textMuted} fontFamily={MONO} fontSize={8}>VALUE AT RISK (95%)</text>
                  <text x={newsW + 200} y={bottomY + 56} fill={C.lossRed} fontFamily={MONO} fontSize={16} fontWeight={700}
                    filter="url(#tt-glow)">${varVal.toFixed(2)}M</text>
                </g>
              );
            })()}

            {/* Portfolio beta */}
            <text x={newsW + 200} y={bottomY + 82} fill={C.textMuted} fontFamily={MONO} fontSize={8}>PORTFOLIO BETA</text>
            <text x={newsW + 200} y={bottomY + 98} fill={C.textPrimary} fontFamily={MONO} fontSize={14} fontWeight={700}>
              {(1.12 + Math.sin(frame * 0.02) * 0.05).toFixed(2)}
            </text>

            {/* Sharpe ratio */}
            <text x={newsW + 340} y={bottomY + 82} fill={C.textMuted} fontFamily={MONO} fontSize={8}>SHARPE RATIO</text>
            <text x={newsW + 340} y={bottomY + 98} fill={C.profitGreen} fontFamily={MONO} fontSize={14} fontWeight={700}>
              {(1.84 + Math.sin(frame * 0.015) * 0.08).toFixed(2)}
            </text>

            {/* Max drawdown */}
            <text x={newsW + 480} y={bottomY + 82} fill={C.textMuted} fontFamily={MONO} fontSize={8}>MAX DRAWDOWN</text>
            <text x={newsW + 480} y={bottomY + 98} fill={C.lossRed} fontFamily={MONO} fontSize={14} fontWeight={700}>
              -{(4.2 + Math.sin(frame * 0.01) * 0.3).toFixed(1)}%
            </text>

            {/* Risk gauge bars */}
            {[
              { label: 'EXPOSURE', val: 0.72, color: C.orange },
              { label: 'LEVERAGE', val: 0.45, color: C.bidBlue },
              { label: 'LIQUIDITY', val: 0.88, color: C.profitGreen },
            ].map((gauge, i) => {
              const barY = bottomY + 120 + i * 24;
              return (
                <g key={`rg${i}`}>
                  <text x={newsW + 200} y={barY + 10} fill={C.textMuted} fontFamily={MONO} fontSize={8}>{gauge.label}</text>
                  <rect x={newsW + 300} y={barY} width={300} height={14} fill={C.panelBorder} rx={2} />
                  <rect x={newsW + 300} y={barY} width={300 * gauge.val} height={14} fill={gauge.color} opacity={0.4} rx={2} />
                  <text x={newsW + 610} y={barY + 10} fill={C.textPrimary} fontFamily={MONO} fontSize={8}>
                    {(gauge.val * 100).toFixed(0)}%
                  </text>
                </g>
              );
            })}
          </g>

          {/* Bottom divider */}
          <line x1={newsW} y1={bottomY} x2={newsW} y2={1080} stroke={C.panelBorder} strokeWidth={1} />

          {/* ── Global effects ────────────────────────────────────────── */}

          {/* Orange top accent line */}
          <line x1={0} y1={0} x2={1920} y2={0} stroke={`rgba(${orangeRgb}, 0.3)`} strokeWidth={2} />
          <line x1={0} y1={1079} x2={1920} y2={1079} stroke={`rgba(${orangeRgb}, 0.15)`} strokeWidth={1} />

          {/* CRT horizontal banding */}
          {Array.from({ length: 6 }, (_, i) => {
            const bandY = (i * 180 + frame * 0.1) % 1080;
            return <rect key={`band${i}`} x={0} y={bandY} width={1920} height={2}
              fill={C.orange} opacity={0.012} />;
          })}

          {/* Vignette */}
          <rect x={0} y={0} width={1920} height={1080} fill="url(#tt-vignette)" opacity={0.25} />
          <defs>
            <radialGradient id="tt-vignette" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="100%" stopColor="#000000" />
            </radialGradient>
          </defs>

          {/* Market open indicator */}
          <circle cx={1900} cy={12} r={3} fill={C.profitGreen} opacity={0.5 + Math.sin(frame * 0.2) * 0.3} />
          <text x={1890} y={15} textAnchor="end" fill={C.textMuted} fontFamily={MONO} fontSize={7}>LIVE</text>
        </g>
      </svg>
    </AbsoluteFill>
  );
};

export default TradingTerminal;
