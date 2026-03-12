import {
  EmbeddedScene,
  SceneFlexLayout,
  SceneFlexItem,
  SceneReactObject,
  SceneQueryRunner,
  VizPanel,
  SceneVariableSet,
} from '@grafana/scenes';
import {
  getDefaultTimeRange,
  getTimeControls,
  getInfinityDatasource,
  getInfinityDsVariable,
  infinityJsonQuery,
} from './shared';
import { OrbitalTrackerPanel } from '../components/OrbitalTrackerPanel';

/**
 * Orbital Tracker Scene
 *
 * Animated orbital visualization showing agents orbiting project "planets".
 * Agents trace elliptical paths around a central orchestrator, with
 * particle trails, atmospheric glows, and shooting star effects.
 *
 * Layout:
 * Row 1: Orbital canvas (full width, tall)
 * Row 2: Agent count per project + model stats
 */
export function getOrbitalTrackerScene(): EmbeddedScene {
  const summaryQuery = new SceneQueryRunner({
    datasource: getInfinityDatasource(),
    queries: [
      infinityJsonQuery({
        refId: 'summary',
        url: '/api/metrics/summary',
        columns: [
          { selector: 'active_agents', text: 'Active', type: 'number' },
          { selector: 'idle_agents', text: 'Idle', type: 'number' },
          { selector: 'total_agents_spawned', text: 'Total', type: 'number' },
          { selector: 'uptime', text: 'Uptime', type: 'string' },
          { selector: 'cumulative_cost', text: 'Cost', type: 'number' },
        ],
      }),
    ],
  });

  const projectAgentQuery = new SceneQueryRunner({
    datasource: getInfinityDatasource(),
    queries: [
      infinityJsonQuery({
        refId: 'projectAgents',
        url: '/api/metrics/projects',
        columns: [
          { selector: 'name', text: 'Project', type: 'string' },
          { selector: 'agent_count', text: 'Agents', type: 'number' },
          { selector: 'active_count', text: 'Active', type: 'number' },
        ],
      }),
    ],
  });

  return new EmbeddedScene({
    $timeRange: getDefaultTimeRange(),
    $variables: new SceneVariableSet({ variables: [getInfinityDsVariable()] }),
    controls: getTimeControls(),
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        // Row 1: Orbital tracker canvas
        new SceneFlexItem({
          minHeight: 450,
          body: new SceneReactObject({
            component: OrbitalTrackerPanel,
            props: {},
          }),
        }),
        // Row 2: Summary stats + project agent counts
        new SceneFlexLayout({
          direction: 'row',
          children: [
            new SceneFlexItem({
              minWidth: 200,
              body: new VizPanel({
                title: 'Uptime',
                pluginId: 'stat',
                $data: summaryQuery,
                options: {
                  reduceOptions: { values: false, calcs: ['lastNotNull'], fields: '/^Uptime$/' },
                  colorMode: 'value',
                  graphMode: 'none',
                },
                fieldConfig: {
                  defaults: { color: { mode: 'fixed', fixedColor: '#67e8f9' } },
                  overrides: [],
                },
              }),
            }),
            new SceneFlexItem({
              minWidth: 200,
              body: new VizPanel({
                title: 'Total Cost',
                pluginId: 'stat',
                $data: summaryQuery.clone(),
                options: {
                  reduceOptions: { values: false, calcs: ['lastNotNull'], fields: '/^Cost$/' },
                  colorMode: 'value',
                  graphMode: 'none',
                },
                fieldConfig: {
                  defaults: {
                    unit: 'currencyUSD',
                    decimals: 2,
                    color: { mode: 'fixed', fixedColor: '#fbbf24' },
                  },
                  overrides: [],
                },
              }),
            }),
            new SceneFlexItem({
              minHeight: 180,
              body: new VizPanel({
                title: 'Agents per Project',
                pluginId: 'barchart',
                $data: projectAgentQuery,
                options: {
                  orientation: 'horizontal',
                  barWidth: 0.6,
                  groupWidth: 0.7,
                  legend: { displayMode: 'list', placement: 'bottom' },
                },
                fieldConfig: {
                  defaults: {
                    color: { mode: 'palette-classic' },
                    custom: { fillOpacity: 70, gradientMode: 'scheme' },
                  },
                  overrides: [
                    { matcher: { id: 'byName', options: 'Active' }, properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: '#67e8f9' } }] },
                    { matcher: { id: 'byName', options: 'Agents' }, properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: '#a78bfa' } }] },
                  ],
                },
              }),
            }),
          ],
        }),
      ],
    }),
  });
}
