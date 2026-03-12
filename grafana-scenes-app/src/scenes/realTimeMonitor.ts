import {
  SceneAppPage,
  EmbeddedScene,
  SceneFlexLayout,
  SceneFlexItem,
  SceneCSSGridLayout,
  SceneQueryRunner,
  SceneVariableSet,
  SceneTimeRange,
  SceneRefreshPicker,
  SceneTimePicker,
  VizPanel,
  PanelBuilders,
  CustomVariable,
  VariableValueSelectors,
} from '@grafana/scenes';
import { ThresholdsMode, FieldColorModeId } from '@grafana/data';
import { PLUGIN_BASE_URL } from '../constants';
import {
  getInfinityDatasource,
  getInfinityDsVariable,
  infinityJsonQuery,
  infinityTimeSeriesQuery,
} from './shared';

/**
 * Real-Time Monitor Scene
 *
 * Live monitoring with 5-second auto-refresh, stat panels with thresholds,
 * time series with live tail behavior, and alert-style annotations on errors.
 */

// --- Variables ---

function getMonitorVariables() {
  return new SceneVariableSet({
    variables: [
      getInfinityDsVariable(),
      new CustomVariable({
        name: 'severity',
        label: 'Min Severity',
        query: 'all , error , warning , info',
        value: 'all',
        text: 'all',
      }),
    ],
  });
}

// --- Data Queries ---

function liveStatsQuery(): SceneQueryRunner {
  return new SceneQueryRunner({
    datasource: getInfinityDatasource(),
    queries: [
      infinityJsonQuery({
        refId: 'liveStats',
        url: 'http://localhost:4040/api/stats',
        columns: [
          { selector: 'active_agents', text: 'Active Agents', type: 'number' },
          { selector: 'total_agents', text: 'Total Spawned', type: 'number' },
          { selector: 'projects_count', text: 'Projects', type: 'number' },
          { selector: 'error_count', text: 'Errors', type: 'number' },
          { selector: 'avg_response_time_ms', text: 'Avg Response (ms)', type: 'number' },
          { selector: 'queue_depth', text: 'Queue Depth', type: 'number' },
        ],
      }),
    ],
  });
}

function agentTimeseriesQuery(): SceneQueryRunner {
  return new SceneQueryRunner({
    datasource: getInfinityDatasource(),
    queries: [
      infinityTimeSeriesQuery({
        refId: 'agentTimeseries',
        url: 'http://localhost:4040/api/metrics/timeseries?interval=5s',
        columns: [
          { selector: 'timestamp', text: 'Time', type: 'timestamp' },
          { selector: 'active_agents', text: 'Active Agents', type: 'number' },
          { selector: 'total_cost', text: 'Cost', type: 'number' },
          { selector: 'tokens_per_second', text: 'Tokens/s', type: 'number' },
        ],
      }),
    ],
  });
}

function errorEventsQuery(): SceneQueryRunner {
  return new SceneQueryRunner({
    datasource: getInfinityDatasource(),
    queries: [
      infinityJsonQuery({
        refId: 'errors',
        url: 'http://localhost:4040/api/events?type=error&limit=50',
        columns: [
          { selector: 'timestamp', text: 'Time', type: 'timestamp' },
          { selector: 'agent_id', text: 'Agent', type: 'string' },
          { selector: 'project', text: 'Project', type: 'string' },
          { selector: 'message', text: 'Error Message', type: 'string' },
          { selector: 'severity', text: 'Severity', type: 'string' },
        ],
      }),
    ],
  });
}

function projectBreakdownQuery(): SceneQueryRunner {
  return new SceneQueryRunner({
    datasource: getInfinityDatasource(),
    queries: [
      infinityJsonQuery({
        refId: 'projectBreakdown',
        url: 'http://localhost:4040/api/metrics/projects',
        columns: [
          { selector: 'name', text: 'Project', type: 'string' },
          { selector: 'active_agents', text: 'Active', type: 'number' },
          { selector: 'total_cost', text: 'Cost', type: 'number' },
          { selector: 'error_count', text: 'Errors', type: 'number' },
        ],
      }),
    ],
  });
}

// --- Stat Panels (top row) ---

function buildActiveAgentsLiveStat(): VizPanel {
  return PanelBuilders.stat()
    .setTitle('Active Agents')
    .setData(liveStatsQuery())
    .setOption('reduceOptions', { calcs: ['lastNotNull'], fields: '/Active Agents/' })
    .setOption('graphMode', 'area')
    .setOption('colorMode', 'background')
    .setOption('textMode', 'value_and_name')
    .setThresholds({
      mode: ThresholdsMode.Absolute,
      steps: [
        { value: -Infinity, color: 'green' },
        { value: 5, color: 'yellow' },
        { value: 10, color: 'red' },
      ],
    })
    .build();
}

function buildErrorCountStat(): VizPanel {
  return PanelBuilders.stat()
    .setTitle('Errors (Last Hour)')
    .setData(liveStatsQuery())
    .setOption('reduceOptions', { calcs: ['lastNotNull'], fields: '/Errors/' })
    .setOption('graphMode', 'area')
    .setOption('colorMode', 'background')
    .setThresholds({
      mode: ThresholdsMode.Absolute,
      steps: [
        { value: -Infinity, color: 'green' },
        { value: 1, color: 'yellow' },
        { value: 5, color: 'red' },
      ],
    })
    .build();
}

function buildResponseTimeStat(): VizPanel {
  return PanelBuilders.stat()
    .setTitle('Avg Response Time')
    .setData(liveStatsQuery())
    .setOption('reduceOptions', { calcs: ['lastNotNull'], fields: '/Avg Response/' })
    .setOption('graphMode', 'area')
    .setOption('colorMode', 'value')
    .setUnit('ms')
    .setThresholds({
      mode: ThresholdsMode.Absolute,
      steps: [
        { value: -Infinity, color: 'green' },
        { value: 2000, color: 'yellow' },
        { value: 5000, color: 'red' },
      ],
    })
    .build();
}

function buildQueueDepthStat(): VizPanel {
  return PanelBuilders.stat()
    .setTitle('Queue Depth')
    .setData(liveStatsQuery())
    .setOption('reduceOptions', { calcs: ['lastNotNull'], fields: '/Queue Depth/' })
    .setOption('graphMode', 'area')
    .setOption('colorMode', 'background')
    .setThresholds({
      mode: ThresholdsMode.Absolute,
      steps: [
        { value: -Infinity, color: 'green' },
        { value: 3, color: 'yellow' },
        { value: 8, color: 'red' },
      ],
    })
    .build();
}

function buildTotalSpawnedStat(): VizPanel {
  return PanelBuilders.stat()
    .setTitle('Total Spawned')
    .setData(liveStatsQuery())
    .setOption('reduceOptions', { calcs: ['lastNotNull'], fields: '/Total Spawned/' })
    .setOption('graphMode', 'none')
    .setOption('colorMode', 'value')
    .build();
}

function buildProjectsStat(): VizPanel {
  return PanelBuilders.stat()
    .setTitle('Active Projects')
    .setData(liveStatsQuery())
    .setOption('reduceOptions', { calcs: ['lastNotNull'], fields: '/Projects/' })
    .setOption('graphMode', 'none')
    .setOption('colorMode', 'value')
    .build();
}

// --- Time Series Panels ---

function buildAgentCountTimeseries(): VizPanel {
  return PanelBuilders.timeseries()
    .setTitle('Active Agents (Live)')
    .setData(agentTimeseriesQuery())
    .setOption('legend', { showLegend: true, displayMode: 'list', placement: 'bottom' })
    .setOption('tooltip', { mode: 'crosshair', sort: 'desc' })
    .setCustomFieldConfig('fillOpacity', 20)
    .setCustomFieldConfig('lineWidth', 2)
    .setCustomFieldConfig('lineInterpolation', 'smooth')
    .setCustomFieldConfig('spanNulls', true)
    .setCustomFieldConfig('showPoints', 'auto')
    .setCustomFieldConfig('pointSize', 6)
    .setThresholds({
      mode: ThresholdsMode.Absolute,
      steps: [
        { value: -Infinity, color: 'green' },
        { value: 5, color: 'yellow' },
        { value: 10, color: 'red' },
      ],
    })
    .setCustomFieldConfig('thresholdsStyle', { mode: 'line+area' })
    .build();
}

function buildTokenThroughputTimeseries(): VizPanel {
  return PanelBuilders.timeseries()
    .setTitle('Token Throughput')
    .setData(agentTimeseriesQuery())
    .setOption('legend', { showLegend: false })
    .setOption('tooltip', { mode: 'single' })
    .setUnit('locale')
    .setCustomFieldConfig('fillOpacity', 30)
    .setCustomFieldConfig('lineWidth', 2)
    .setCustomFieldConfig('lineInterpolation', 'smooth')
    .setCustomFieldConfig('gradientMode', 'opacity')
    .setOverrides((b) =>
      b
        .matchFieldsWithName('Tokens/s')
        .overrideColor({ mode: FieldColorModeId.Fixed, fixedColor: 'purple' })
    )
    .build();
}

function buildCostTimeseries(): VizPanel {
  return PanelBuilders.timeseries()
    .setTitle('Cumulative Cost')
    .setData(agentTimeseriesQuery())
    .setOption('legend', { showLegend: false })
    .setUnit('currencyUSD')
    .setDecimals(2)
    .setCustomFieldConfig('fillOpacity', 10)
    .setCustomFieldConfig('lineWidth', 2)
    .setCustomFieldConfig('lineInterpolation', 'stepAfter')
    .setCustomFieldConfig('gradientMode', 'scheme')
    .setThresholds({
      mode: ThresholdsMode.Absolute,
      steps: [
        { value: -Infinity, color: 'green' },
        { value: 10, color: 'yellow' },
        { value: 50, color: 'red' },
      ],
    })
    .build();
}

// --- Project Breakdown ---

function buildProjectBarChart(): VizPanel {
  return new VizPanel({
    pluginId: 'barchart',
    title: 'Active Agents by Project',
    $data: projectBreakdownQuery(),
    fieldConfig: {
      defaults: {
        color: { mode: FieldColorModeId.PaletteClassic },
        custom: {
          fillOpacity: 80,
          gradientMode: 'hue',
          axisBorderShow: false,
        },
      },
      overrides: [],
    },
    options: {
      orientation: 'horizontal',
      showValue: 'always',
      groupWidth: 0.75,
      barWidth: 0.5,
      stacking: 'none',
      legend: { showLegend: true, displayMode: 'list', placement: 'bottom' },
      tooltip: { mode: 'single' },
      xTickLabelRotation: 0,
    },
  });
}

// --- Error Log Panel ---

function buildErrorLogPanel(): VizPanel {
  return PanelBuilders.table()
    .setTitle('Recent Errors & Alerts')
    .setData(errorEventsQuery())
    .setOption('showHeader', true)
    .setOption('sortBy', [{ displayName: 'Time', desc: true }])
    .setOverrides((b) =>
      b
        .matchFieldsWithName('Severity')
        .overrideCustomFieldConfig('displayMode', 'color-background-solid')
    )
    .build();
}

// --- Scene Assembly ---

function getMonitorScene(): EmbeddedScene {
  return new EmbeddedScene({
    $timeRange: new SceneTimeRange({ from: 'now-30m', to: 'now' }),
    $variables: getMonitorVariables(),
    controls: [
      new VariableValueSelectors({}),
      new SceneTimePicker({ isOnCanvas: true }),
      new SceneRefreshPicker({
        intervals: ['5s', '10s', '15s', '30s', '1m'],
        refresh: '5s',
        isOnCanvas: true,
      }),
    ],
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        // Row 1: Live stat panels (6 across)
        new SceneFlexItem({
          height: 120,
          body: new SceneCSSGridLayout({
            templateColumns: 'repeat(6, 1fr)',
            autoRows: '100px',
            children: [
              buildActiveAgentsLiveStat(),
              buildErrorCountStat(),
              buildResponseTimeStat(),
              buildQueueDepthStat(),
              buildTotalSpawnedStat(),
              buildProjectsStat(),
            ],
          }),
        }),
        // Row 2: Time series panels (3 across)
        new SceneFlexItem({
          height: 280,
          body: new SceneFlexLayout({
            direction: 'row',
            children: [
              new SceneFlexItem({ body: buildAgentCountTimeseries() }),
              new SceneFlexItem({ body: buildTokenThroughputTimeseries() }),
              new SceneFlexItem({ body: buildCostTimeseries() }),
            ],
          }),
        }),
        // Row 3: bar chart + error log
        new SceneFlexItem({
          minHeight: 280,
          body: new SceneFlexLayout({
            direction: 'row',
            children: [
              new SceneFlexItem({
                width: '40%',
                body: buildProjectBarChart(),
              }),
              new SceneFlexItem({
                body: buildErrorLogPanel(),
              }),
            ],
          }),
        }),
      ],
    }),
  });
}

// --- Exported Page ---

export function getRealTimeMonitorPage(): SceneAppPage {
  return new SceneAppPage({
    title: 'Real-Time Monitor',
    subTitle: 'Live agent activity with 5-second refresh, thresholds, and alert tracking',
    url: `${PLUGIN_BASE_URL}/monitor`,
    getScene: getMonitorScene,
  });
}
