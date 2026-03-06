// ── Design System — Space / Constellation Aesthetic ─────────────────────────
// Shared design tokens, keyframe animations, and reusable style mixins.
// Uses @emotion/css (runtime className generation, no build-time setup).

import { css, keyframes } from '@emotion/css';

// ── Color Palette ────────────────────────────────────────────────────────────

export const colors = {
  // Primary accent — cyan neon
  primary: '#00ffcc',
  primaryDim: 'rgba(0, 255, 204, 0.6)',
  primaryMuted: 'rgba(0, 255, 204, 0.15)',
  primaryBorder: 'rgba(0, 255, 204, 0.25)',
  primaryGlow: 'rgba(0, 255, 204, 0.4)',

  // Danger — red
  danger: '#ff4466',
  dangerDim: 'rgba(255, 68, 102, 0.6)',
  dangerMuted: 'rgba(255, 68, 102, 0.15)',
  dangerBorder: 'rgba(255, 68, 102, 0.3)',

  // Warning — amber
  warning: '#ffaa00',
  warningDim: 'rgba(255, 170, 0, 0.6)',
  warningMuted: 'rgba(255, 170, 0, 0.15)',
  warningBorder: 'rgba(255, 170, 0, 0.3)',

  // Success — green
  success: '#22cc88',
  successMuted: 'rgba(34, 204, 136, 0.15)',

  // Neutral — purple accent (secondary)
  purple: '#aa66ff',
  purpleMuted: 'rgba(170, 102, 255, 0.15)',

  // Backgrounds — deep space
  bg: '#0d1117',
  bgRaised: '#141920',
  bgSurface: '#1a1f2e',
  bgOverlay: 'rgba(0, 0, 0, 0.6)',

  // Borders
  border: 'rgba(255, 255, 255, 0.06)',
  borderLight: 'rgba(255, 255, 255, 0.12)',
  borderFocus: 'rgba(0, 255, 204, 0.4)',

  // Text
  text: '#ccc',
  textBright: '#eee',
  textWhite: '#fff',
  textMuted: 'rgba(255, 255, 255, 0.5)',
  textDim: 'rgba(255, 255, 255, 0.25)',
  textDimmer: 'rgba(255, 255, 255, 0.15)',

  // Surfaces with alpha
  whiteA2: 'rgba(255, 255, 255, 0.02)',
  whiteA4: 'rgba(255, 255, 255, 0.04)',
  whiteA5: 'rgba(255, 255, 255, 0.05)',
  whiteA6: 'rgba(255, 255, 255, 0.06)',
  whiteA8: 'rgba(255, 255, 255, 0.08)',
  whiteA10: 'rgba(255, 255, 255, 0.1)',
} as const;

// ── Typography ───────────────────────────────────────────────────────────────

export const fonts = {
  system: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', monospace",
} as const;

// ── Keyframe Animations ──────────────────────────────────────────────────────

export const anim = {
  fadeIn: keyframes`
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  `,

  fadeInFast: keyframes`
    from { opacity: 0; }
    to   { opacity: 1; }
  `,

  pulse: keyframes`
    0%, 100% { opacity: 1; }
    50%      { opacity: 0.5; }
  `,

  slideInRight: keyframes`
    from { opacity: 0; transform: translateX(12px); }
    to   { opacity: 1; transform: translateX(0); }
  `,

  slideInLeft: keyframes`
    from { opacity: 0; transform: translateX(-12px); }
    to   { opacity: 1; transform: translateX(0); }
  `,

  slideInUp: keyframes`
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  `,

  shimmer: keyframes`
    0%   { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  `,

  scanline: keyframes`
    0%   { transform: translateY(-100%); opacity: 0; }
    10%  { opacity: 0.6; }
    90%  { opacity: 0.6; }
    100% { transform: translateY(100vh); opacity: 0; }
  `,

  glow: keyframes`
    0%, 100% { box-shadow: 0 0 8px ${colors.primaryGlow}; }
    50%      { box-shadow: 0 0 20px ${colors.primaryGlow}, 0 0 40px rgba(0, 255, 204, 0.15); }
  `,

  rotate: keyframes`
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  `,
} as const;

// ── Reusable Style Mixins ────────────────────────────────────────────────────

/** Frosted glass panel — dark background with blur and thin glowing border. */
export const glassmorphism = css`
  background: linear-gradient(
    135deg,
    rgba(20, 25, 35, 0.95),
    rgba(15, 20, 30, 0.98)
  );
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid ${colors.primaryBorder};
  border-radius: 12px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.3),
    0 0 1px rgba(0, 255, 204, 0.1);
`;

/** Subtle frosted glass — for cards and secondary panels. */
export const glassCard = css`
  background: ${colors.whiteA2};
  border: 1px solid ${colors.border};
  border-radius: 8px;
  transition: all 0.2s ease;
  &:hover {
    background: ${colors.whiteA5};
    border-color: ${colors.whiteA8};
  }
`;

/** Neon glow text — cyan with text-shadow. */
export const neonText = css`
  color: ${colors.primary};
  text-shadow: 0 0 12px ${colors.primaryGlow};
`;

/** Pulsing status dot. */
export const statusDot = (color: string, pulsing = false) => css`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${color};
  flex-shrink: 0;
  box-shadow: 0 0 6px ${color}80;
  ${pulsing ? `animation: ${anim.pulse} 1.5s ease-in-out infinite;` : ''}
`;

/** Compact badge — pill shape with icon dot. */
export const compactBadge = css`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  background: ${colors.whiteA5};
  border: 1px solid ${colors.whiteA8};
  white-space: nowrap;
  font-family: ${fonts.mono};
`;

/** Status badge — colored background matching status. */
export const statusBadge = (color: string) => css`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: ${color}18;
  color: ${color};
  border: 1px solid ${color}33;
`;

/** Custom scrollbar — thin, translucent. */
export const thinScrollbar = css`
  &::-webkit-scrollbar { width: 4px; height: 4px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb {
    background: ${colors.whiteA10};
    border-radius: 4px;
  }
`;

/** Input field — dark with cyan focus ring. */
export const inputField = css`
  background: ${colors.whiteA6};
  border: 1px solid ${colors.borderLight};
  border-radius: 6px;
  color: #ddd;
  padding: 8px 12px;
  font-size: 13px;
  font-family: ${fonts.system};
  outline: none;
  transition: border-color 0.2s ease;
  &:focus {
    border-color: ${colors.primary};
    box-shadow: 0 0 0 2px rgba(0, 255, 204, 0.1);
  }
  &::placeholder {
    color: ${colors.textDim};
  }
`;

/** Primary action button — cyan gradient. */
export const primaryButton = css`
  background: linear-gradient(135deg, ${colors.primary}, #00ccaa);
  color: ${colors.bg};
  border: none;
  border-radius: 6px;
  padding: 7px 18px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 20px ${colors.primaryGlow};
  }
  &:active {
    transform: translateY(0);
  }
  &:disabled {
    opacity: 0.5;
    cursor: default;
    transform: none;
    box-shadow: none;
  }
`;

/** Ghost button — transparent with border. */
export const ghostButton = css`
  background: transparent;
  border: 1px solid ${colors.borderLight};
  border-radius: 6px;
  color: ${colors.textMuted};
  padding: 7px 18px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  &:hover {
    background: ${colors.whiteA5};
    color: ${colors.textWhite};
  }
`;

/** Danger button — red accent. */
export const dangerButton = css`
  background: ${colors.dangerMuted};
  border: 1px solid ${colors.dangerBorder};
  border-radius: 6px;
  color: ${colors.danger};
  padding: 7px 18px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  &:hover {
    background: rgba(255, 68, 102, 0.25);
  }
`;

/** Modal backdrop — dark overlay with blur. */
export const modalBackdrop = css`
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${colors.bgOverlay};
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  animation: ${anim.fadeInFast} 0.2s ease;
`;

/** Terminal / code output area. */
export const terminalOutput = css`
  background: #0a0e14;
  border: 1px solid ${colors.border};
  border-radius: 6px;
  padding: 12px;
  font-family: ${fonts.mono};
  font-size: 12px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.7);
  white-space: pre-wrap;
  word-break: break-word;
  overflow-y: auto;
  ${thinScrollbar}
`;

// ── Helper Functions ─────────────────────────────────────────────────────────

/** Map agent status to a display color. */
export function statusColor(status: string): string {
  const map: Record<string, string> = {
    working: colors.primary,
    active: colors.primary,
    idle: colors.warning,
    done: '#666',
    error: colors.danger,
    stopped: '#666',
    failed: colors.danger,
  };
  return map[status] || '#666';
}

/**
 * Parse a model string into a short human-readable label.
 * "claude-opus-4-6" -> "Opus"
 * "claude-sonnet-4-20250514" -> "Sonnet"
 * "claude-3-5-haiku-20241022" -> "Haiku"
 */
export function shortModel(model: string): string {
  if (!model) {
    return '--';
  }
  const lower = model.toLowerCase();
  if (lower.includes('opus')) {
    return 'Opus';
  }
  if (lower.includes('sonnet')) {
    return 'Sonnet';
  }
  if (lower.includes('haiku')) {
    return 'Haiku';
  }
  // Fallback: capitalize first segment after "claude-"
  const match = lower.match(/claude[- ]?(.+)/);
  if (match) {
    return match[1].charAt(0).toUpperCase() + match[1].slice(1).split(/[-_]/)[0];
  }
  return model;
}

/**
 * Format a duration from a started_at ISO timestamp to a human-readable string.
 * Returns "--" if no timestamp provided.
 */
export function formatDuration(started?: string): string {
  if (!started) {
    return '--';
  }
  const ms = Date.now() - new Date(started).getTime();
  if (ms < 0) {
    return '0s';
  }
  const secs = Math.floor(ms / 1000);
  if (secs < 60) {
    return `${secs}s`;
  }
  const mins = Math.floor(secs / 60);
  if (mins < 60) {
    return `${mins}m ${secs % 60}s`;
  }
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {
    return `${hrs}h ${mins % 60}m`;
  }
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h`;
}

/**
 * Format uptime in seconds to a compact human-readable string.
 */
export function formatUptime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const mins = Math.floor(seconds / 60);
  if (mins < 60) {
    return `${mins}m ${seconds % 60}s`;
  }
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {
    return `${hrs}h ${mins % 60}m`;
  }
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h`;
}
