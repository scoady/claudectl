import React, { useState } from 'react';
import { css } from '@emotion/css';
import { AppRootProps } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { EmbeddedScene } from '@grafana/scenes';
import { getAgentOverviewScene } from '../scenes/agentScene';
import { getCostExplorerScene } from '../scenes/costScene';
import { getControlCenterScene } from '../scenes/controlCenterScene';

const tabs = [
  { id: 'overview', label: 'Agent Overview', getScene: getAgentOverviewScene },
  { id: 'control-center', label: 'Control Center', getScene: getControlCenterScene },
  { id: 'costs', label: 'Cost Explorer', getScene: getCostExplorerScene },
] as const;

const getStyles = () => ({
  wrapper: css`
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  `,
  tabs: css`
    display: flex;
    gap: 0;
    border-bottom: 1px solid rgba(204, 204, 220, 0.15);
    padding: 0 16px;
  `,
  tab: css`
    padding: 8px 16px;
    cursor: pointer;
    color: rgba(204, 204, 220, 0.65);
    border-bottom: 2px solid transparent;
    transition: all 0.2s;
    font-size: 13px;
    &:hover {
      color: rgba(204, 204, 220, 0.9);
    }
  `,
  tabActive: css`
    color: #6e9fff;
    border-bottom-color: #6e9fff;
  `,
  content: css`
    flex: 1;
    overflow: auto;
    padding: 16px;
  `,
});

export function App(_props: AppRootProps) {
  const styles = useStyles2(getStyles);
  const [activeTab, setActiveTab] = useState(0);
  const scenesRef = React.useRef<Record<number, EmbeddedScene>>({});

  // Lazy scene construction — only build when tab is first activated
  if (!scenesRef.current[activeTab]) {
    try {
      scenesRef.current[activeTab] = tabs[activeTab].getScene();
    } catch (err) {
      console.error(`Failed to create scene for tab "${tabs[activeTab].label}":`, err);
    }
  }
  const scene = scenesRef.current[activeTab];

  return (
    <div className={styles.wrapper}>
      <div className={styles.tabs}>
        {tabs.map((t, i) => (
          <div
            key={t.id}
            className={`${styles.tab} ${i === activeTab ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(i)}
          >
            {t.label}
          </div>
        ))}
      </div>
      <div className={styles.content}>
        {scene ? (
          <scene.Component model={scene} />
        ) : (
          <div style={{ color: '#ff4466', padding: 20 }}>Failed to load this tab.</div>
        )}
      </div>
    </div>
  );
}
