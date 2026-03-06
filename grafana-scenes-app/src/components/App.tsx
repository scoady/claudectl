import React, { useState } from 'react';
import { css } from '@emotion/css';
import { AppRootProps } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { EmbeddedScene } from '@grafana/scenes';
import { getAgentOverviewScene } from '../scenes/agentScene';
import { getCostExplorerScene } from '../scenes/costScene';
import { getConstellationScene } from '../scenes/constellationScene';
import { getSteampunkTraceScene } from '../scenes/steampunkTraceScene';
import { getActivityFeedScene } from '../scenes/activityFeedScene';
import { getTaskProgressScene } from '../scenes/taskProgressScene';
import { getOrbitalTrackerScene } from '../scenes/orbitalTrackerScene';
import { getATCRadarScene } from '../scenes/atcRadarScene';
import { getFlightBoardScene } from '../scenes/flightBoardScene';
import { getMissionControlScene } from '../scenes/missionControlScene';

const tabs = [
  { id: 'overview', label: 'Agent Overview', getScene: getAgentOverviewScene },
  { id: 'costs', label: 'Cost Explorer', getScene: getCostExplorerScene },
  { id: 'constellation', label: 'Live Constellation', getScene: getConstellationScene },
  { id: 'steampunk', label: 'Steampunk Trace', getScene: getSteampunkTraceScene },
  { id: 'activity', label: 'Activity Feed', getScene: getActivityFeedScene },
  { id: 'progress', label: 'Task Progress', getScene: getTaskProgressScene },
  { id: 'orbital', label: 'Orbital Tracker', getScene: getOrbitalTrackerScene },
  { id: 'atc-radar', label: 'ATC Radar', getScene: getATCRadarScene },
  { id: 'flight-board', label: 'Flight Board', getScene: getFlightBoardScene },
  { id: 'mission-control', label: 'Mission Control', getScene: getMissionControlScene },
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
  const [scenes] = useState<EmbeddedScene[]>(() => tabs.map((t) => t.getScene()));
  const scene = scenes[activeTab];

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
        <scene.Component model={scene} />
      </div>
    </div>
  );
}
