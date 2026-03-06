// c9s Constellation Theme
// Matches the space/astronomy aesthetic of the agent management platform

export const colors = {
  // Primary accent palette
  cyan: '#67e8f9',
  cyanDim: '#22d3ee',
  cyanMuted: '#164e63',
  purple: '#c084fc',
  purpleDim: '#a855f7',
  purpleMuted: '#3b0764',
  amber: '#fbbf24',
  amberDim: '#f59e0b',
  amberMuted: '#78350f',
  green: '#34d399',
  greenDim: '#10b981',
  greenMuted: '#064e3b',
  rose: '#fb7185',
  roseDim: '#f43f5e',
  roseMuted: '#4c0519',

  // Surface layers (deep space)
  bg: '#0a0a1a',
  bgDeep: '#050510',
  surface0: '#1e1e2e',
  surface1: '#2a2a3e',
  surface2: '#35354e',
  muted: '#4a4a5e',
  mutedLight: '#6a6a7e',

  // Text
  text: '#e2e8f0',
  textDim: '#94a3b8',
  textMuted: '#64748b',

  // Status colors for agents
  working: '#fbbf24',
  idle: '#67e8f9',
  done: '#34d399',
  error: '#fb7185',

  // Chart palette
  chart: ['#67e8f9', '#c084fc', '#fbbf24', '#34d399', '#fb7185', '#818cf8'],
};

export const gradients = {
  deepSpace: 'linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 50%, #0a1a2e 100%)',
  nebula: 'radial-gradient(ellipse at 30% 20%, rgba(192, 132, 252, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(103, 232, 249, 0.1) 0%, transparent 50%)',
  frostedGlass: 'linear-gradient(135deg, rgba(30, 30, 46, 0.8), rgba(42, 42, 62, 0.6))',
  amberGlow: 'radial-gradient(circle, rgba(251, 191, 36, 0.3) 0%, transparent 70%)',
  cyanGlow: 'radial-gradient(circle, rgba(103, 232, 249, 0.3) 0%, transparent 70%)',
  roseGlow: 'radial-gradient(circle, rgba(251, 113, 133, 0.3) 0%, transparent 70%)',
};

export const shadows = {
  glow: (color: string, intensity = 0.5) =>
    `0 0 20px rgba(${hexToRgb(color)}, ${intensity}), 0 0 60px rgba(${hexToRgb(color)}, ${intensity * 0.3})`,
  soft: '0 4px 24px rgba(0, 0, 0, 0.4)',
  inset: 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
};

export const fonts = {
  mono: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '255, 255, 255';
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
}

export { hexToRgb };
