import {
  EmbeddedScene,
  SceneFlexLayout,
  SceneFlexItem,
  SceneReactObject,
  SceneQueryRunner,
  VizPanel,
} from '@grafana/scenes';
import {
  getDefaultTimeRange,
  getTimeControls,
  getInfinityDatasource,
  infinityJsonQuery,
  infinityTimeSeriesQuery,
} from './shared';
import { MissionControlPanel } from '../components/MissionControlPanel';

/**
 * Mission Control Scene
 *
 * Rocket launch / telemetry dashboard with animated rocket scene
 * and surrounding telemetry readouts.
 *
 * Layout:
 * Row 1: Custom mission control canvas (full width)
 * Row 2: Agent activity timeline + model breakdown
 */
export function getMissionControlScene(): EmbeddedScene {
  const healthQuery = new SceneQueryRunner({
    datasource: getInfinityDatasource(),
    queries: [
      infinityJsonQuery({
        refId: 'health',
        url: '/api/metrics/health',
        columns: [
          { selector: 'active_agents', text: 'Active Missions', type: 'number' },
          { selector: 'idle_agents', text: 'Standby', type: 'number' },
          { selector: 'error_agents', text: 'Anomalies', type: 'number' },
          { selector: 'total_agents_spawned', text: 'Total Launches', type: 'number' },
          { selector: 'cumulative_cost', text: 'Fuel Budget', type: 'number' },
        ],
      }),
    ],
  });

  const agentActivityQuery = new SceneQueryRunner({
    datasource: getInfinityDatasource(),
    queries: [
      infinityTimeSeriesQuery({
        refId: 'activity',
        url: '/api/metrics/agents',
        columns: [
          { selector: 'time', text: 'Time', type: 'timestamp' },
          { selector: 'active', text: 'Active', type: 'number' },
          { selector: 'idle', text: 'Idle', type: 'number' },
        ],
      }),
    ],
  });

  const modelQuery = new SceneQueryRunner({
    datasource: getInfinityDatasource(),
    queries: [
      infinityJsonQuery({
        refId: 'models',
        url: '/api/metrics/models',
        columns: [
          { selector: 'model', text: 'Vehicle', type: 'string' },
          { selector: 'count', text: 'Missions', type: 'number' },
          { selector: 'total_turns', text: 'Burn Time', type: 'number' },
          { selector: 'estimated_cost', text: 'Fuel Cost', type: 'number' },
        ],
      }),
    ],
  });

  return new EmbeddedScene({
    $timeRange: getDefaultTimeRange(),
    controls: getTimeControls(),
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        // Row 1: Mission control visualization
        new SceneFlexItem({
          minHeight: 420,
          body: new SceneReactObject({
            component: MissionControlPanel,
            props: {},
          }),
        }),
        // Row 2: Stats row
        new SceneFlexLayout({
          direction: 'row',
          children: [
            new SceneFlexItem({
              minWidth: 150,
              body: new VizPanel({
                title: 'Active Missions',
                pluginId: 'stat',
                $data: healthQuery,
                options: {
                  reduceOptions: { values: false, calcs: ['lastNotNull'], fields: '/^Active Missions$/' },
                  colorMode: 'value',
                  graphMode: 'none',
                },
                fieldConfig: {
                  defaults: { color: { mode: 'fixed', fixedColor: '#00ff41' } },
                  overrides: [],
                },
              }),
            }),
            new SceneFlexItem({
              minWidth: 150,
              body: new VizPanel({
                title: 'Total Launches',
                pluginId: 'stat',
                $data: healthQuery.clone(),
                options: {
                  reduceOptions: { values: false, calcs: ['lastNotNull'], fields: '/^Total Launches$/' },
                  colorMode: 'value',
                  graphMode: 'none',
                },
                fieldConfig: {
                  defaults: { color: { mode: 'fixed', fixedColor: '#ffbf00' } },
                  overrides: [],
                },
              }),
            }),
            new SceneFlexItem({
              minWidth: 150,
              body: new VizPanel({
                title: 'Fuel Budget',
                pluginId: 'stat',
                $data: healthQuery.clone(),
                options: {
                  reduceOptions: { values: false, calcs: ['lastNotNull'], fields: '/^Fuel Budget$/' },
                  colorMode: 'value',
                  graphMode: 'none',
                },
                fieldConfig: {
                  defaults: {
                    color: { mode: 'fixed', fixedColor: '#00e5ff' },
                    unit: 'currencyUSD',
                    decimals: 2,
                  },
                  overrides: [],
                },
              }),
            }),
          ],
        }),
        // Row 3: Activity chart + models table
        new SceneFlexLayout({
          direction: 'row',
          children: [
            new SceneFlexItem({
              minHeight: 200,
              body: new VizPanel({
                title: 'Mission Telemetry',
                pluginId: 'timeseries',
                $data: agentActivityQuery,
                fieldConfig: {
                  defaults: {
                    custom: { lineWidth: 2, fillOpacity: 15, spanNulls: true },
                  },
                  overrides: [
                    {
                      matcher: { id: 'byName', options: 'Active' },
                      properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: '#00ff41' } }],
                    },
                    {
                      matcher: { id: 'byName', options: 'Idle' },
                      properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: '#00e5ff' } }],
                    },
                  ],
                },
                options: { legend: { displayMode: 'list', placement: 'bottom' } },
              }),
            }),
            new SceneFlexItem({
              minHeight: 200,
              minWidth: 300,
              body: new VizPanel({
                title: 'Launch Vehicle Types',
                pluginId: 'table',
                $data: modelQuery,
                fieldConfig: {
                  defaults: {},
                  overrides: [
                    {
                      matcher: { id: 'byName', options: 'Fuel Cost' },
                      properties: [
                        { id: 'unit', value: 'currencyUSD' },
                        { id: 'decimals', value: 3 },
                      ],
                    },
                  ],
                },
                options: { showHeader: true },
              }),
            }),
          ],
        }),
      ],
    }),
  });
}
