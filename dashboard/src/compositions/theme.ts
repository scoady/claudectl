export const colors = {
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
  blue: '#60a5fa',
  bg: '#0a0a1a',
  bgDeep: '#050510',
  surface0: '#1e1e2e',
  surface1: '#2a2a3e',
  surface2: '#35354e',
  muted: '#4a4a5e',
  mutedLight: '#6a6a7e',
  text: '#e2e8f0',
  textDim: '#94a3b8',
  textMuted: '#64748b',
  working: '#fbbf24',
  idle: '#67e8f9',
  done: '#34d399',
  error: '#fb7185',
  chart: ['#67e8f9', '#c084fc', '#fbbf24', '#34d399', '#fb7185', '#818cf8'],
};

export function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '255, 255, 255';
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
}
