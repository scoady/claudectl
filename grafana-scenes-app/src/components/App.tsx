import React, { useMemo } from 'react';
import { AppRootProps } from '@grafana/data';
import { SceneApp, SceneAppPage } from '@grafana/scenes';
import { PLUGIN_BASE_URL, PLUGIN_ID } from '../constants';
import { getAgentOverviewScene } from '../scenes/agentScene';
import { getCostExplorerScene } from '../scenes/costScene';
import { getConstellationScene } from '../scenes/constellationScene';

export function App(props: AppRootProps) {
  const scene = useMemo(() => {
    return new SceneApp({
      pages: [
        new SceneAppPage({
          title: 'Agent Overview',
          subTitle: 'Real-time agent monitoring and metrics',
          url: `${PLUGIN_BASE_URL}/overview`,
          getScene: () => getAgentOverviewScene(),
        }),
        new SceneAppPage({
          title: 'Cost Explorer',
          subTitle: 'Cost tracking and model usage breakdown',
          url: `${PLUGIN_BASE_URL}/costs`,
          getScene: () => getCostExplorerScene(),
        }),
        new SceneAppPage({
          title: 'Live Constellation',
          subTitle: 'Agent constellation visualization',
          url: `${PLUGIN_BASE_URL}/constellation`,
          getScene: () => getConstellationScene(),
        }),
      ],
    });
  }, []);

  return <scene.Component model={scene} />;
}
