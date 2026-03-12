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
  infinityTimeSeriesQuery,
} from './shared';
import { ActivityFeedPanel } from '../components/ActivityFeedPanel';

/**
 * Activity Feed Scene
 *
 * A retro CRT terminal-style live activity log showing agent events,
 * milestones, and system status as scrolling terminal output.
 *
 * Layout:
 * Row 1: CRT terminal activity feed (full width)
 * Row 2: Health stat panels + activity timeline
 */
export function getActivityFeedScene(): EmbeddedScene {
  const healthQuery = new SceneQueryRunner({
    datasource: getInfinityDatasource(),
    queries: [
      infinityJsonQuery({
        refId: 'health',
        url: '/api/metrics/health',
        columns: [
          { selector: 'active_agents', text: 'Active', type: 'number' },
          { selector: 'idle_agents', text: 'Idle', type: 'number' },
          { selector: 'error_agents', text: 'Errors', type: 'number' },
          { selector: 'total_agents_spawned', text: 'Total Spawned', type: 'number' },
          { selector: 'cumulative_cost', text: 'Cost', type: 'number' },
        ],
      }),
    ],
  });

  const activityQuery = new SceneQueryRunner({
    datasource: getInfinityDatasource(),
    queries: [
      infinityTimeSeriesQuery({
        refId: 'activity',
        url: '/api/metrics/agents',
        columns: [
          { selector: 'time', text: 'Time', type: 'timestamp' },
          { selector: 'active', text: 'Active', type: 'number' },
          { selector: 'idle', text: 'Idle', type: 'number' },
          { selector: 'errors', text: 'Errors', type: 'number' },
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
        // Row 1: CRT terminal feed
        new SceneFlexItem({
          minHeight: 400,
          body: new SceneReactObject({
            component: ActivityFeedPanel,
            props: {},
          }),
        }),
        // Row 2: Stats + activity sparkline
        new SceneFlexLayout({
          direction: 'row',
          children: [
            new SceneFlexItem({
              minWidth: 180,
              body: new VizPanel({
                title: 'Total Spawned',
                pluginId: 'stat',
                $data: healthQuery,
                options: {
                  reduceOptions: { values: false, calcs: ['lastNotNull'], fields: '/^Total Spawned$/' },
                  colorMode: 'value',
                  graphMode: 'none',
                },
                fieldConfig: {
                  defaults: { color: { mode: 'fixed', fixedColor: '#a78bfa' } },
                  overrides: [],
                },
              }),
            }),
            new SceneFlexItem({
              minWidth: 180,
              body: new VizPanel({
                title: 'Cumulative Cost',
                pluginId: 'stat',
                $data: healthQuery.clone(),
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
              minHeight: 150,
              body: new VizPanel({
                title: 'Agent Activity Over Time',
                pluginId: 'timeseries',
                $data: activityQuery,
                fieldConfig: {
                  defaults: {
                    custom: { lineWidth: 2, fillOpacity: 15, spanNulls: true },
                  },
                  overrides: [
                    { matcher: { id: 'byName', options: 'Active' }, properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: '#67e8f9' } }] },
                    { matcher: { id: 'byName', options: 'Idle' }, properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: '#4ade80' } }] },
                    { matcher: { id: 'byName', options: 'Errors' }, properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: '#f87171' } }] },
                  ],
                },
                options: { legend: { displayMode: 'list', placement: 'bottom' } },
              }),
            }),
          ],
        }),
      ],
    }),
  });
}
