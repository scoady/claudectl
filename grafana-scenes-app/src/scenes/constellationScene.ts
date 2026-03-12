import {
  EmbeddedScene,
  SceneFlexLayout,
  SceneFlexItem,
  SceneQueryRunner,
  VizPanel,
  SceneReactObject,
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
import { ConstellationPanel } from '../components/ConstellationPanel';

/**
 * Live Constellation Scene
 *
 * Shows agent status as a constellation visualization.
 * Uses a custom React component for the main constellation view,
 * plus standard panels for supporting data.
 *
 * Layout:
 * Row 1: Custom constellation canvas (full width)
 * Row 2: Agent table + project breakdown
 */
export function getConstellationScene(): EmbeddedScene {
  // --- Health data for constellation ---
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
          { selector: 'total_agents_spawned', text: 'Total', type: 'number' },
          { selector: 'cumulative_cost', text: 'Cost', type: 'number' },
        ],
      }),
    ],
  });

  // --- Summary for the constellation component ---
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

  // --- Model breakdown ---
  const modelQuery = new SceneQueryRunner({
    datasource: getInfinityDatasource(),
    queries: [
      infinityJsonQuery({
        refId: 'models',
        url: '/api/metrics/models',
        columns: [
          { selector: 'model', text: 'Model', type: 'string' },
          { selector: 'count', text: 'Agents', type: 'number' },
          { selector: 'total_turns', text: 'Turns', type: 'number' },
          { selector: 'estimated_cost', text: 'Cost', type: 'number' },
        ],
      }),
    ],
  });

  // --- Agent activity for sparkline context ---
  const agentActivityQuery = new SceneQueryRunner({
    datasource: getInfinityDatasource(),
    queries: [
      infinityTimeSeriesQuery({
        refId: 'agents',
        url: '/api/metrics/agents',
        columns: [
          { selector: 'time', text: 'Time', type: 'timestamp' },
          { selector: 'active', text: 'Active', type: 'number' },
          { selector: 'idle', text: 'Idle', type: 'number' },
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
        // Row 1: Constellation visualization (custom React component)
        new SceneFlexItem({
          minHeight: 400,
          body: new SceneReactObject({
            component: ConstellationPanel,
            props: {},
          }),
        }),
        // Row 2: Stats row
        new SceneFlexLayout({
          direction: 'row',
          children: [
            new SceneFlexItem({
              minWidth: 200,
              body: new VizPanel({
                title: 'Active Agents',
                pluginId: 'stat',
                $data: healthQuery,
                options: {
                  reduceOptions: {
                    values: false,
                    calcs: ['lastNotNull'],
                    fields: '/^Active$/',
                  },
                  colorMode: 'value',
                  graphMode: 'none',
                },
                fieldConfig: {
                  defaults: {
                    color: { mode: 'fixed', fixedColor: '#7B61FF' },
                  },
                  overrides: [],
                },
              }),
            }),
            new SceneFlexItem({
              minWidth: 200,
              body: new VizPanel({
                title: 'Idle Agents',
                pluginId: 'stat',
                $data: healthQuery.clone(),
                options: {
                  reduceOptions: {
                    values: false,
                    calcs: ['lastNotNull'],
                    fields: '/^Idle$/',
                  },
                  colorMode: 'value',
                  graphMode: 'none',
                },
                fieldConfig: {
                  defaults: {
                    color: { mode: 'fixed', fixedColor: '#00D4AA' },
                  },
                  overrides: [],
                },
              }),
            }),
            new SceneFlexItem({
              minWidth: 200,
              body: new VizPanel({
                title: 'Error Agents',
                pluginId: 'stat',
                $data: healthQuery.clone(),
                options: {
                  reduceOptions: {
                    values: false,
                    calcs: ['lastNotNull'],
                    fields: '/^Errors$/',
                  },
                  colorMode: 'value',
                  graphMode: 'none',
                },
                fieldConfig: {
                  defaults: {
                    color: { mode: 'fixed', fixedColor: '#FF6B6B' },
                    thresholds: {
                      mode: 'absolute' as any,
                      steps: [
                        { value: -Infinity, color: 'green' },
                        { value: 1, color: 'red' },
                      ],
                    },
                  },
                  overrides: [],
                },
              }),
            }),
          ],
        }),
        // Row 3: Model table + Activity sparkline
        new SceneFlexLayout({
          direction: 'row',
          children: [
            new SceneFlexItem({
              minHeight: 200,
              body: new VizPanel({
                title: 'Models in Use',
                pluginId: 'table',
                $data: modelQuery,
                fieldConfig: {
                  defaults: {},
                  overrides: [
                    {
                      matcher: { id: 'byName', options: 'Cost' },
                      properties: [
                        { id: 'unit', value: 'currencyUSD' },
                        { id: 'decimals', value: 3 },
                      ],
                    },
                  ],
                },
                options: {
                  showHeader: true,
                },
              }),
            }),
            new SceneFlexItem({
              minHeight: 200,
              body: new VizPanel({
                title: 'Agent Activity',
                pluginId: 'timeseries',
                $data: agentActivityQuery,
                fieldConfig: {
                  defaults: {
                    custom: {
                      lineWidth: 2,
                      fillOpacity: 20,
                      spanNulls: true,
                    },
                  },
                  overrides: [
                    {
                      matcher: { id: 'byName', options: 'Active' },
                      properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: '#7B61FF' } }],
                    },
                    {
                      matcher: { id: 'byName', options: 'Idle' },
                      properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: '#00D4AA' } }],
                    },
                  ],
                },
                options: {
                  legend: { displayMode: 'list', placement: 'bottom' },
                },
              }),
            }),
          ],
        }),
      ],
    }),
  });
}
