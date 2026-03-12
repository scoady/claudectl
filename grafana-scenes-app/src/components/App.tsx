import React, { useState } from 'react';
import { css } from '@emotion/css';
import { AppRootProps } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { EmbeddedScene } from '@grafana/scenes';
import { getAgentOverviewScene } from '../scenes/agentScene';
import { getCostExplorerScene } from '../scenes/costScene';
import { getControlCenterScene } from '../scenes/controlCenterScene';
import { getMissionControlScene } from '../scenes/missionControlScene';
import { getProjectBrowserScene } from '../scenes/projectBrowserScene';
import { getWidgetStudioScene } from '../scenes/widgetStudioScene';
import { getLayoutStudioScene } from '../scenes/layoutStudioScene';
import { getTraceExplorerScene } from '../scenes/traceExplorerScene';
import { getAgentTracesScene } from '../scenes/agentTracesScene';

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

type TabId = 'mission-control' | 'projects' | 'observability' | 'agent-traces' | 'widget-studio' | 'layout-studio';

interface TabDef {
  id: TabId;
  label: string;
  getScene?: () => EmbeddedScene;
  placeholder?: string;
}

const tabs: TabDef[] = [
  { id: 'mission-control', label: 'Mission Control',  getScene: getMissionControlScene },
  { id: 'projects',        label: 'Projects',         getScene: getProjectBrowserScene },
  { id: 'observability',   label: 'Observability',    getScene: getTraceExplorerScene },
  { id: 'agent-traces',    label: 'Agent Traces',     getScene: getAgentTracesScene },
  { id: 'widget-studio',   label: 'Widget Studio',    getScene: getWidgetStudioScene },
  { id: 'layout-studio',   label: 'Layout Studio',    getScene: getLayoutStudioScene },
];

// ---------------------------------------------------------------------------
// Module-level scene cache
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
// Tab content renderer
// ---------------------------------------------------------------------------

function TabContent({ tab, selectedProject, onSelectProject }: {
  tab: TabDef;
  selectedProject: string | null;
  onSelectProject: (name: string | null) => void;
}) {
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

  // Project detail drill-in: when on 'projects' tab and a project is selected,
  // render ProjectDetailPanel instead of ProjectBrowserPanel.
  // ProjectDetailPanel is built by another agent and imported dynamically.
  if (tab.id === 'projects' && selectedProject) {
    // Lazy-load ProjectDetailPanel — it may not exist yet (another agent builds it).
    // Wrap in try/catch so we degrade gracefully.
    try {
      const { ProjectDetailPanel } = require('./ProjectDetailPanel');
      return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <button
            className={styles.backButton}
            onClick={() => onSelectProject(null)}
          >
            &#8592; Back to Projects
          </button>
          <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
            <ProjectDetailPanel projectName={selectedProject} />
          </div>
        </div>
      );
    } catch {
      return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <button
            className={styles.backButton}
            onClick={() => onSelectProject(null)}
          >
            &#8592; Back to Projects
          </button>
          <div className={styles.placeholder}>
            <div className={styles.placeholderIcon}>&#9733;</div>
            <h2 className={styles.placeholderTitle}>Project Detail — {selectedProject}</h2>
            <p className={styles.placeholderText}>Panel not yet available</p>
          </div>
        </div>
      );
    }
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
    border: none;
    border-bottom: 2px solid transparent;
    background: none;
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
  backButton: css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(0, 212, 255, 0.15);
    border-radius: 6px;
    color: #00d4ff;
    font-size: 13px;
    font-weight: 500;
    padding: 6px 14px;
    margin-bottom: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    align-self: flex-start;

    &:hover {
      background: rgba(0, 212, 255, 0.08);
      border-color: rgba(0, 212, 255, 0.3);
    }
  `,
});

// ---------------------------------------------------------------------------
// App root — simple useState tab switching (no react-router dependency)
// ---------------------------------------------------------------------------

export function App(_props: AppRootProps) {
  const styles = useStyles2(getStyles);
  const [activeTabId, setActiveTabId] = useState<TabId>('mission-control');
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  // Expose project selection globally so ProjectBrowserPanel can call it
  // (it lives inside a Scene and cannot receive props directly).
  React.useEffect(() => {
    (window as any).__c9s_selectProject = (name: string) => {
      setSelectedProject(name);
    };
    return () => {
      delete (window as any).__c9s_selectProject;
    };
  }, []);

  const handleTabClick = (tabId: TabId) => {
    setActiveTabId(tabId);
    // Clear project selection when switching away from projects tab
    if (tabId !== 'projects') {
      setSelectedProject(null);
    }
  };

  return (
    <div className={styles.wrapper}>
      <nav className={styles.nav}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tab} ${tab.id === activeTabId ? styles.tabActive : ''}`}
            onClick={() => handleTabClick(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className={styles.content}>
        <TabContent
          tab={activeTab}
          selectedProject={selectedProject}
          onSelectProject={setSelectedProject}
        />
      </div>
    </div>
  );
}
