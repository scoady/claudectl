import {
  EmbeddedScene,
  SceneFlexLayout,
  SceneFlexItem,
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

/**
 * Cost Explorer Scene
 *
 * Layout:
 * Row 1: Stat panels — Total Cost | Cost/Hour estimate
 * Row 2: Time series — Cumulative + incremental cost over time
 * Row 3: Model cost table + pie chart
 */
export function getCostExplorerScene(): EmbeddedScene {
  // --- Summary for stat panels ---
  const summaryQuery = new SceneQueryRunner({
    datasource: getInfinityDatasource(),
    queries: [
      infinityJsonQuery({
        refId: 'summary',
        url: '/api/metrics/summary',
        columns: [
          { selector: 'cumulative_cost', text: 'Total Cost', type: 'number' },
          { selector: 'total_agents_spawned', text: 'Agents Spawned', type: 'number' },
          { selector: 'total_turns', text: 'Total Turns', type: 'number' },
          { selector: 'active_agents', text: 'Active Agents', type: 'number' },
        ],
      }),
    ],
  });

  // --- Cost over time ---
  const costTimeQuery = new SceneQueryRunner({
    datasource: getInfinityDatasource(),
    queries: [
      infinityTimeSeriesQuery({
        refId: 'costs',
        url: '/api/metrics/costs',
        columns: [
          { selector: 'time', text: 'Time', type: 'timestamp' },
          { selector: 'cumulative', text: 'Cumulative Cost', type: 'number' },
          { selector: 'incremental', text: 'Incremental Cost', type: 'number' },
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
          { selector: 'estimated_cost', text: 'Estimated Cost', type: 'number' },
        ],
      }),
    ],
  });

  // --- Task throughput ---
  const taskQuery = new SceneQueryRunner({
    datasource: getInfinityDatasource(),
    queries: [
      infinityTimeSeriesQuery({
        refId: 'tasks',
        url: '/api/metrics/tasks',
        columns: [
          { selector: 'time', text: 'Time', type: 'timestamp' },
          { selector: 'started', text: 'Started', type: 'number' },
          { selector: 'completed', text: 'Completed', type: 'number' },
          { selector: 'failed', text: 'Failed', type: 'number' },
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
        // Row 1: Cost stat panels
        new SceneFlexLayout({
          direction: 'row',
          children: [
            new SceneFlexItem({
              minWidth: 200,
              body: new VizPanel({
                title: 'Total Cost',
                pluginId: 'stat',
                $data: summaryQuery,
                options: {
                  reduceOptions: {
                    values: false,
                    calcs: ['lastNotNull'],
                    fields: '/^Total Cost$/',
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
              minWidth: 200,
              body: new VizPanel({
                title: 'Active Agents',
                pluginId: 'stat',
                $data: summaryQuery.clone(),
                options: {
                  reduceOptions: {
                    values: false,
                    calcs: ['lastNotNull'],
                    fields: '/^Active Agents$/',
                  },
                  colorMode: 'background',
                  graphMode: 'none',
                  textMode: 'value',
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
                title: 'Agents Spawned',
                pluginId: 'stat',
                $data: summaryQuery.clone(),
                options: {
                  reduceOptions: {
                    values: false,
                    calcs: ['lastNotNull'],
                    fields: '/^Agents Spawned$/',
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
              minWidth: 200,
              body: new VizPanel({
                title: 'Total Turns',
                pluginId: 'stat',
                $data: summaryQuery.clone(),
                options: {
                  reduceOptions: {
                    values: false,
                    calcs: ['lastNotNull'],
                    fields: '/^Total Turns$/',
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
          ],
        }),
        // Row 2: Cost time series
        new SceneFlexItem({
          minHeight: 300,
          body: new VizPanel({
            title: 'Cost Over Time',
            pluginId: 'timeseries',
            $data: costTimeQuery,
            fieldConfig: {
              defaults: {
                custom: {
                  lineWidth: 2,
                  fillOpacity: 20,
                  pointSize: 4,
                  spanNulls: true,
                },
                unit: 'currencyUSD',
                decimals: 3,
              },
              overrides: [
                {
                  matcher: { id: 'byName', options: 'Cumulative Cost' },
                  properties: [
                    { id: 'color', value: { mode: 'fixed', fixedColor: '#FF6B6B' } },
                    { id: 'custom.lineWidth', value: 3 },
                  ],
                },
                {
                  matcher: { id: 'byName', options: 'Incremental Cost' },
                  properties: [
                    { id: 'color', value: { mode: 'fixed', fixedColor: '#7B61FF' } },
                    { id: 'custom.drawStyle', value: 'bars' },
                    { id: 'custom.fillOpacity', value: 60 },
                  ],
                },
              ],
            },
            options: {
              legend: { displayMode: 'list', placement: 'bottom' },
              tooltip: { mode: 'multi', sort: 'desc' },
            },
          }),
        }),
        // Row 3: Model breakdown + Task throughput
        new SceneFlexLayout({
          direction: 'row',
          children: [
            new SceneFlexItem({
              minHeight: 250,
              body: new VizPanel({
                title: 'Cost by Model',
                pluginId: 'barchart',
                $data: modelQuery,
                fieldConfig: {
                  defaults: {
                    unit: 'currencyUSD',
                    decimals: 3,
                    color: { mode: 'palette-classic' },
                  },
                  overrides: [],
                },
                options: {
                  orientation: 'horizontal',
                  xField: 'Model',
                  barWidth: 0.6,
                  legend: { displayMode: 'list', placement: 'bottom' },
                },
              }),
            }),
            new SceneFlexItem({
              minHeight: 250,
              body: new VizPanel({
                title: 'Task Throughput',
                pluginId: 'timeseries',
                $data: taskQuery,
                fieldConfig: {
                  defaults: {
                    custom: {
                      lineWidth: 2,
                      fillOpacity: 10,
                      spanNulls: true,
                    },
                  },
                  overrides: [
                    {
                      matcher: { id: 'byName', options: 'Started' },
                      properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: '#3498db' } }],
                    },
                    {
                      matcher: { id: 'byName', options: 'Completed' },
                      properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: '#2ecc71' } }],
                    },
                    {
                      matcher: { id: 'byName', options: 'Failed' },
                      properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: '#e74c3c' } }],
                    },
                  ],
                },
                options: {
                  legend: { displayMode: 'list', placement: 'bottom' },
                  tooltip: { mode: 'multi', sort: 'desc' },
                },
              }),
            }),
          ],
        }),
      ],
    }),
  });
}
