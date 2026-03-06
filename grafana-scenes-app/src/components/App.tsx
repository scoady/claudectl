import React from 'react';
import { css } from '@emotion/css';
import { AppRootProps } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { EmbeddedScene } from '@grafana/scenes';
import { Route, Routes, Link, useLocation, Navigate } from 'react-router-dom';
import { getAgentOverviewScene } from '../scenes/agentScene';
import { getCostExplorerScene } from '../scenes/costScene';
import { getControlCenterScene } from '../scenes/controlCenterScene';
import { getTemplateScene } from '../scenes/templateScene';
import { PLUGIN_BASE_URL } from '../constants';

// ---------------------------------------------------------------------------
// Route / tab definitions
// ---------------------------------------------------------------------------

interface TabDef {
  id: string;
  label: string;
  /** Path segment appended to PLUGIN_BASE_URL (empty string = root) */
  path: string;
  getScene?: () => EmbeddedScene;
  /** If set, render a placeholder instead of a scene */
  placeholder?: string;
}

const tabs: TabDef[] = [
  { id: 'overview',       label: 'Mission Control',  path: '',          getScene: getAgentOverviewScene },
  { id: 'control-center', label: 'Control Center',   path: 'control',   getScene: getControlCenterScene },
  { id: 'costs',          label: 'Cost Explorer',    path: 'costs',     getScene: getCostExplorerScene },
  { id: 'templates',      label: 'Template Library', path: 'templates', getScene: getTemplateScene },
  { id: 'viz',            label: 'Viz Gallery',      path: 'viz',       placeholder: 'Visualization Gallery' },
];

// ---------------------------------------------------------------------------
// Module-level scene cache -- scenes are expensive, create once and reuse
// ---------------------------------------------------------------------------

const sceneCache: Record<string, EmbeddedScene> = {};

function getOrCreateScene(tab: TabDef): EmbeddedScene | null {
  if (!tab.getScene) return null;
  if (!sceneCache[tab.id]) {
    try {
      sceneCache[tab.id] = tab.getScene();
    } catch (err) {
      console.error(`Failed to create scene for tab "${tab.label}":`, err);
      return null;
    }
  }
  return sceneCache[tab.id];
}

// ---------------------------------------------------------------------------
// Scene renderer component
// ---------------------------------------------------------------------------

function SceneRoute({ tab }: { tab: TabDef }) {
  const styles = useStyles2(getStyles);

  if (tab.placeholder) {
    return (
      <div className={styles.placeholder}>
        <div className={styles.placeholderIcon}>&#9733;</div>
        <h2 className={styles.placeholderTitle}>{tab.placeholder}</h2>
        <p className={styles.placeholderText}>Coming Soon</p>
      </div>
    );
  }

  const scene = getOrCreateScene(tab);
  if (!scene) {
    return <div style={{ color: '#ff4466', padding: 20 }}>Failed to load this tab.</div>;
  }

  return <scene.Component model={scene} />;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const getStyles = () => ({
  wrapper: css`
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  `,
  nav: css`
    display: flex;
    gap: 0;
    background: rgba(13, 17, 28, 0.85);
    border-bottom: 1px solid rgba(0, 212, 255, 0.12);
    padding: 0 16px;
    backdrop-filter: blur(8px);
  `,
  tab: css`
    position: relative;
    padding: 10px 18px;
    cursor: pointer;
    color: rgba(204, 204, 220, 0.55);
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.3px;
    text-decoration: none;
    transition: color 0.2s ease, background 0.2s ease;
    border-bottom: 2px solid transparent;
    user-select: none;

    &:hover {
      color: rgba(204, 204, 220, 0.9);
      background: rgba(0, 212, 255, 0.04);
    }
  `,
  tabActive: css`
    color: #00d4ff;
    border-bottom-color: #00d4ff;
    text-shadow: 0 0 8px rgba(0, 212, 255, 0.4);

    &::after {
      content: '';
      position: absolute;
      bottom: -1px;
      left: 20%;
      right: 20%;
      height: 1px;
      background: radial-gradient(ellipse, rgba(0, 212, 255, 0.6), transparent);
    }
  `,
  content: css`
    flex: 1;
    overflow: auto;
    padding: 16px;
  `,
  placeholder: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 400px;
    color: rgba(204, 204, 220, 0.5);
  `,
  placeholderIcon: css`
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.3;
    color: #00d4ff;
  `,
  placeholderTitle: css`
    font-size: 20px;
    font-weight: 600;
    color: rgba(204, 204, 220, 0.7);
    margin: 0 0 8px 0;
  `,
  placeholderText: css`
    font-size: 14px;
    color: rgba(204, 204, 220, 0.4);
    margin: 0;
  `,
});

// ---------------------------------------------------------------------------
// Determine active tab from current URL
// ---------------------------------------------------------------------------

function useActiveTabId(): string {
  const { pathname } = useLocation();

  // Strip plugin base URL to get the relative segment
  const relative = pathname.startsWith(PLUGIN_BASE_URL)
    ? pathname.slice(PLUGIN_BASE_URL.length)
    : pathname;

  // Normalize: strip leading/trailing slashes
  const segment = relative.replace(/^\/+|\/+$/g, '');

  for (const tab of tabs) {
    if (tab.path === segment) return tab.id;
  }

  return 'overview';
}

// ---------------------------------------------------------------------------
// App root component
//
// Grafana's app plugin framework renders setRootPage components inside
// a <Route path="/a/:pluginId/*"> so our <Routes> uses paths relative
// to that mount point.
// ---------------------------------------------------------------------------

export function App(_props: AppRootProps) {
  const styles = useStyles2(getStyles);
  const activeTabId = useActiveTabId();

  return (
    <div className={styles.wrapper}>
      {/* Navigation bar */}
      <nav className={styles.nav}>
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            to={`${PLUGIN_BASE_URL}${tab.path ? '/' + tab.path : ''}`}
            className={`${styles.tab} ${tab.id === activeTabId ? styles.tabActive : ''}`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {/* Routed content */}
      <div className={styles.content}>
        <Routes>
          <Route index element={<SceneRoute tab={tabs[0]} />} />
          {tabs.slice(1).map((tab) => (
            <Route
              key={tab.id}
              path={tab.path}
              element={<SceneRoute tab={tab} />}
            />
          ))}
          {/* Unknown sub-paths redirect to Mission Control */}
          <Route path="*" element={<Navigate to={PLUGIN_BASE_URL} replace />} />
        </Routes>
      </div>
    </div>
  );
}
