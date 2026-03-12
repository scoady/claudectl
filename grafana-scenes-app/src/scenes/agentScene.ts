import {
  EmbeddedScene,
  SceneFlexLayout,
  SceneFlexItem,
  SceneQueryRunner,
  VizPanel,
  PanelBuilders,
  SceneDataTransformer,
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

/**
 * Agent Overview Scene
 *
 * Layout:
 * Row 1: Stat panels — Active | Idle | Total Spawned | Total Turns | Cost
 * Row 2: Time series — Agent activity over time (active/idle/done/error)
 * Row 3: Tables — Model breakdown | Project agent counts
 */
export function getAgentOverviewScene(): EmbeddedScene {
  // --- Summary stats data source ---
  const summaryQuery = new SceneQueryRunner({
    datasource: getInfinityDatasource(),
    queries: [
      infinityJsonQuery({
        refId: 'summary',
        url: '/api/metrics/summary',
        columns: [
          { selector: 'active_agents', text: 'Active', type: 'number' },
          { selector: 'idle_agents', text: 'Idle', type: 'number' },
          { selector: 'total_agents_spawned', text: 'Total Spawned', type: 'number' },
          { selector: 'total_turns', text: 'Turns', type: 'number' },
          { selector: 'cumulative_cost', text: 'Cost', type: 'number' },
          { selector: 'uptime', text: 'Uptime', type: 'string' },
          { selector: 'active_ws_connections', text: 'WS Connections', type: 'number' },
        ],
      }),
    ],
  });

  // --- Agent activity time series ---
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
          { selector: 'done', text: 'Done', type: 'number' },
          { selector: 'error', text: 'Error', type: 'number' },
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
          { selector: 'count', text: 'Agent Count', type: 'number' },
          { selector: 'total_turns', text: 'Turns', type: 'number' },
          { selector: 'estimated_cost', text: 'Cost (USD)', type: 'number' },
        ],
      }),
    ],
  });

  // --- Health data ---
  const healthQuery = new SceneQueryRunner({
    datasource: getInfinityDatasource(),
    queries: [
      infinityJsonQuery({
        refId: 'health',
        url: '/api/metrics/health',
        columns: [
          { selector: 'uptime', text: 'Uptime', type: 'string' },
          { selector: 'total_agents_spawned', text: 'Total Spawned', type: 'number' },
          { selector: 'active_agents', text: 'Active', type: 'number' },
          { selector: 'idle_agents', text: 'Idle', type: 'number' },
          { selector: 'error_agents', text: 'Errors', type: 'number' },
          { selector: 'cumulative_cost', text: 'Cost', type: 'number' },
          { selector: 'snapshot_count', text: 'Snapshots', type: 'number' },
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
        // Row 1: Stat panels
        new SceneFlexLayout({
          direction: 'row',
          children: [
            new SceneFlexItem({
              minWidth: 150,
              body: new VizPanel({
                title: 'Active Agents',
                pluginId: 'stat',
                $data: summaryQuery,
                fieldConfig: {
                  defaults: {
                    color: { mode: 'fixed', fixedColor: '#7B61FF' },
                    thresholds: {
                      mode: 'absolute' as any,
                      steps: [
                        { value: -Infinity, color: 'green' },
                        { value: 3, color: 'yellow' },
                        { value: 5, color: 'red' },
                      ],
                    },
                  },
                  overrides: [
                    {
                      matcher: { id: 'byName', options: 'Active' },
                      properties: [],
                    },
                  ],
                },
                options: {
                  reduceOptions: {
                    values: false,
                    calcs: ['lastNotNull'],
                    fields: '/^Active$/',
                  },
                  colorMode: 'background',
                  graphMode: 'none',
                  textMode: 'value',
                },
              }),
            }),
            new SceneFlexItem({
              minWidth: 150,
              body: new VizPanel({
                title: 'Idle Agents',
                pluginId: 'stat',
                $data: summaryQuery.clone(),
                options: {
                  reduceOptions: {
                    values: false,
                    calcs: ['lastNotNull'],
                    fields: '/^Idle$/',
                  },
                  colorMode: 'background',
                  graphMode: 'none',
                  textMode: 'value',
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
              minWidth: 150,
              body: new VizPanel({
                title: 'Total Spawned',
                pluginId: 'stat',
                $data: summaryQuery.clone(),
                options: {
                  reduceOptions: {
                    values: false,
                    calcs: ['lastNotNull'],
                    fields: '/^Total Spawned$/',
                  },
                  colorMode: 'background',
                  graphMode: 'none',
                  textMode: 'value',
                },
                fieldConfig: {
                  defaults: {
                    color: { mode: 'fixed', fixedColor: '#3498db' },
                  },
                  overrides: [],
                },
              }),
            }),
            new SceneFlexItem({
              minWidth: 150,
              body: new VizPanel({
                title: 'Total Turns',
                pluginId: 'stat',
                $data: summaryQuery.clone(),
                options: {
                  reduceOptions: {
                    values: false,
                    calcs: ['lastNotNull'],
                    fields: '/^Turns$/',
                  },
                  colorMode: 'background',
                  graphMode: 'none',
                  textMode: 'value',
                },
                fieldConfig: {
                  defaults: {
                    color: { mode: 'fixed', fixedColor: '#e67e22' },
                  },
                  overrides: [],
                },
              }),
            }),
            new SceneFlexItem({
              minWidth: 150,
              body: new VizPanel({
                title: 'Cumulative Cost',
                pluginId: 'stat',
                $data: summaryQuery.clone(),
                options: {
                  reduceOptions: {
                    values: false,
                    calcs: ['lastNotNull'],
                    fields: '/^Cost$/',
                  },
                  colorMode: 'background',
                  graphMode: 'none',
                  textMode: 'value',
                },
                fieldConfig: {
                  defaults: {
                    color: { mode: 'fixed', fixedColor: '#FF6B6B' },
                    unit: 'currencyUSD',
                    decimals: 3,
                  },
                  overrides: [],
                },
              }),
            }),
            new SceneFlexItem({
              minWidth: 150,
              body: new VizPanel({
                title: 'Uptime',
                pluginId: 'stat',
                $data: summaryQuery.clone(),
                options: {
                  reduceOptions: {
                    values: false,
                    calcs: ['lastNotNull'],
                    fields: '/^Uptime$/',
                  },
                  colorMode: 'background',
                  graphMode: 'none',
                  textMode: 'value',
                },
                fieldConfig: {
                  defaults: {
                    color: { mode: 'fixed', fixedColor: '#2ecc71' },
                  },
                  overrides: [],
                },
              }),
            }),
          ],
        }),
        // Row 2: Agent activity time series
        new SceneFlexItem({
          minHeight: 300,
          body: new VizPanel({
            title: 'Agent Activity Over Time',
            pluginId: 'timeseries',
            $data: agentActivityQuery,
            fieldConfig: {
              defaults: {
                custom: {
                  lineWidth: 2,
                  fillOpacity: 15,
                  pointSize: 5,
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
                {
                  matcher: { id: 'byName', options: 'Done' },
                  properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: '#3498db' } }],
                },
                {
                  matcher: { id: 'byName', options: 'Error' },
                  properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: '#FF6B6B' } }],
                },
              ],
            },
            options: {
              legend: { displayMode: 'list', placement: 'bottom' },
              tooltip: { mode: 'multi', sort: 'desc' },
            },
          }),
        }),
        // Row 3: Model breakdown table + task activity
        new SceneFlexLayout({
          direction: 'row',
          children: [
            new SceneFlexItem({
              minHeight: 200,
              body: new VizPanel({
                title: 'Model Breakdown',
                pluginId: 'table',
                $data: modelQuery,
                fieldConfig: {
                  defaults: {},
                  overrides: [
                    {
                      matcher: { id: 'byName', options: 'Cost (USD)' },
                      properties: [
                        { id: 'unit', value: 'currencyUSD' },
                        { id: 'decimals', value: 3 },
                      ],
                    },
                  ],
                },
                options: {
                  showHeader: true,
                  sortBy: [{ displayName: 'Agent Count', desc: true }],
                },
              }),
            }),
            new SceneFlexItem({
              minHeight: 200,
              body: new VizPanel({
                title: 'Model Cost Distribution',
                pluginId: 'piechart',
                $data: modelQuery.clone(),
                fieldConfig: {
                  defaults: {},
                  overrides: [],
                },
                options: {
                  reduceOptions: {
                    values: true,
                    calcs: [],
                    fields: '/^Cost \\(USD\\)$/',
                  },
                  legend: { displayMode: 'list', placement: 'right' },
                  pieType: 'donut',
                },
              }),
            }),
          ],
        }),
      ],
    }),
  });
}
