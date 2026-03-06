import React from 'react';
import { css } from '@emotion/css';
import { colors, fonts, anim, glassmorphism } from '../styles/theme';

/**
 * LayoutStudioPanel — Placeholder
 *
 * Manage layout presets: save, browse, and apply widget arrangements to projects.
 * Full implementation TBD.
 */

const styles = {
  root: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    padding: 48px 24px;
    animation: ${anim.fadeIn} 0.5s ease-out;
  `,
  card: css`
    ${glassmorphism};
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 48px 64px;
    gap: 16px;
    max-width: 420px;
  `,
  icon: css`
    font-size: 48px;
    opacity: 0.35;
    color: ${colors.primary};
    filter: drop-shadow(0 0 12px ${colors.primaryGlow});
  `,
  title: css`
    font-size: 22px;
    font-weight: 700;
    color: ${colors.textBright};
    margin: 0;
    font-family: ${fonts.system};
    letter-spacing: -0.3px;
  `,
  subtitle: css`
    font-size: 14px;
    color: ${colors.textMuted};
    margin: 0;
    text-align: center;
    line-height: 1.5;
    font-family: ${fonts.system};
  `,
  badge: css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    padding: 4px 14px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    background: ${colors.primaryMuted};
    color: ${colors.primaryDim};
    border: 1px solid ${colors.primaryBorder};
    font-family: ${fonts.mono};
  `,
};

export function LayoutStudioPanel() {
  return (
    <div className={styles.root}>
      <div className={styles.card}>
        <div className={styles.icon}>{'\u2B2A'}</div>
        <h2 className={styles.title}>Layout Studio</h2>
        <p className={styles.subtitle}>
          Save, browse, and apply widget layout presets across your projects.
        </p>
        <span className={styles.badge}>Coming Soon</span>
      </div>
    </div>
  );
}
