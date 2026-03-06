import {
  SceneAppPage,
  EmbeddedScene,
  SceneFlexLayout,
  SceneFlexItem,
  SceneCSSGridLayout,
  SceneQueryRunner,
  SceneVariableSet,
  SceneTimeRange,
  PanelBuilders,
  CustomVariable,
  VariableValueSelectors,
} from '@grafana/scenes';
import { ThresholdsMode, FieldColorModeId } from '@grafana/data';
import { PLUGIN_BASE_URL } from '../constants';
import {
  getTimeControls,
  getInfinityDatasource,
  infinityJsonQuery,
  infinityTimeSeriesQuery,
} from './shared';

/**
 * Project Comparison Scene
 *
 * Side-by-side comparison of two projects with matching metric panels.
 * Uses variables for project selection and queries /api/metrics/projects.
 */

// --- Variables ---

function getComparisonVariables() {
  return new SceneVariableSet({
    variables: [
      new CustomVariable({
        name: 'projectA',
        label: 'Project A',
        query: 'claude-manager , agent-reports , helm-platform , kind-infra',
        value: 'claude-manager',
        text: 'claude-manager',
      }),
      new CustomVariable({
        name: 'projectB',
        label: 'Project B',
        query: 'claude-manager , agent-reports , helm-platform , kind-infra',
        value: 'agent-reports',
        text: 'agent-reports',
      }),
    ],
  });
}

// --- Data Queries ---

function projectMetricsQuery(projectVar: string): SceneQueryRunner {
  return new SceneQueryRunner({
    datasource: getInfinityDatasource(),
    queries: [
      infinityJsonQuery({
        refId: `metrics_${projectVar}`,
        url: `http://localhost:4040/api/metrics/projects/\${${projectVar}}`,
        columns: [
          { selector: 'agent_count', text: 'Agent Count', type: 'number' },
          { selector: 'active_agents', text: 'Active Agents', type: 'number' },
          { selector: 'total_cost', text: 'Total Cost', type: 'number' },
          { selector: 'task_completion_rate', text: 'Completion Rate', type: 'number' },
          { selector: 'avg_duration_seconds', text: 'Avg Duration', type: 'number' },
          { selector: 'error_rate', text: 'Error Rate', type: 'number' },
        ],
      }),
    ],
  });
}

function projectTimeseriesQuery(projectVar: string): SceneQueryRunner {
  return new SceneQueryRunner({
    datasource: getInfinityDatasource(),
    queries: [
      infinityTimeSeriesQuery({
        refId: `timeseries_${projectVar}`,
        url: `http://localhost:4040/api/metrics/projects/\${${projectVar}}/timeseries`,
        columns: [
          { selector: 'timestamp', text: 'Time', type: 'timestamp' },
          { selector: 'agent_count', text: 'Agents', type: 'number' },
          { selector: 'cost', text: 'Cost', type: 'number' },
        ],
      }),
    ],
  });
}

// --- Panel Builders for a single project column ---

function buildProjectColumn(projectVar: string, label: string): SceneFlexLayout {
  return new SceneFlexLayout({
    direction: 'column',
    children: [
      // Header stat
      new SceneFlexItem({
        height: 80,
        body: PanelBuilders.stat()
          .setTitle(label)
          .setData(projectMetricsQuery(projectVar))
          .setOption('textMode', 'name')
          .setOption('colorMode', 'background')
          .setOption('graphMode', 'none')
          .build(),
      }),
      // Stat row: agent count, cost, completion rate
      new SceneFlexItem({
        height: 120,
        body: new SceneCSSGridLayout({
          templateColumns: 'repeat(3, 1fr)',
          autoRows: '100px',
          children: [
            PanelBuilders.stat()
              .setTitle('Agent Count')
              .setData(projectMetricsQuery(projectVar))
              .setOption('reduceOptions', { calcs: ['lastNotNull'], fields: '/Agent Count/' })
              .setOption('graphMode', 'area')
              .setOption('colorMode', 'background')
              .setThresholds({
                mode: ThresholdsMode.Absolute,
                steps: [
                  { value: -Infinity, color: 'blue' },
                  { value: 3, color: 'green' },
                  { value: 8, color: 'yellow' },
                  { value: 15, color: 'red' },
                ],
              })
              .build(),
            PanelBuilders.stat()
              .setTitle('Total Cost')
              .setData(projectMetricsQuery(projectVar))
              .setOption('reduceOptions', { calcs: ['lastNotNull'], fields: '/Total Cost/' })
              .setOption('colorMode', 'value')
              .setUnit('currencyUSD')
              .setDecimals(2)
              .build(),
            PanelBuilders.stat()
              .setTitle('Completion Rate')
              .setData(projectMetricsQuery(projectVar))
              .setOption('reduceOptions', { calcs: ['lastNotNull'], fields: '/Completion Rate/' })
              .setOption('colorMode', 'background')
              .setUnit('percentunit')
              .setThresholds({
                mode: ThresholdsMode.Absolute,
                steps: [
                  { value: -Infinity, color: 'red' },
                  { value: 0.5, color: 'yellow' },
                  { value: 0.8, color: 'green' },
                ],
              })
              .build(),
          ],
        }),
      }),
      // Gauges: avg duration and error rate
      new SceneFlexItem({
        height: 160,
        body: new SceneCSSGridLayout({
          templateColumns: 'repeat(2, 1fr)',
          autoRows: '140px',
          children: [
            PanelBuilders.gauge()
              .setTitle('Avg Duration')
              .setData(projectMetricsQuery(projectVar))
              .setOption('reduceOptions', { calcs: ['lastNotNull'], fields: '/Avg Duration/' })
              .setUnit('s')
              .setMin(0)
              .setMax(600)
              .setThresholds({
                mode: ThresholdsMode.Absolute,
                steps: [
                  { value: -Infinity, color: 'green' },
                  { value: 120, color: 'yellow' },
                  { value: 300, color: 'red' },
                ],
              })
              .build(),
            PanelBuilders.gauge()
              .setTitle('Error Rate')
              .setData(projectMetricsQuery(projectVar))
              .setOption('reduceOptions', { calcs: ['lastNotNull'], fields: '/Error Rate/' })
              .setUnit('percentunit')
              .setMin(0)
              .setMax(1)
              .setThresholds({
                mode: ThresholdsMode.Absolute,
                steps: [
                  { value: -Infinity, color: 'green' },
                  { value: 0.05, color: 'yellow' },
                  { value: 0.15, color: 'red' },
                ],
              })
              .build(),
          ],
        }),
      }),
      // Time series: agent count over time
      new SceneFlexItem({
        minHeight: 200,
        body: PanelBuilders.timeseries()
          .setTitle('Agents Over Time')
          .setData(projectTimeseriesQuery(projectVar))
          .setOption('legend', { showLegend: true, displayMode: 'list', placement: 'bottom' })
          .setOption('tooltip', { mode: 'single' })
          .setCustomFieldConfig('fillOpacity', 15)
          .setCustomFieldConfig('lineWidth', 2)
          .setCustomFieldConfig('lineInterpolation', 'smooth')
          .setCustomFieldConfig('spanNulls', true)
          .build(),
      }),
      // Time series: cost over time
      new SceneFlexItem({
        minHeight: 200,
        body: PanelBuilders.timeseries()
          .setTitle('Cost Over Time')
          .setData(projectTimeseriesQuery(projectVar))
          .setOption('legend', { showLegend: false })
          .setUnit('currencyUSD')
          .setDecimals(2)
          .setCustomFieldConfig('fillOpacity', 25)
          .setCustomFieldConfig('lineWidth', 2)
          .setCustomFieldConfig('gradientMode', 'scheme')
          .setThresholds({
            mode: ThresholdsMode.Absolute,
            steps: [
              { value: -Infinity, color: 'green' },
              { value: 5, color: 'yellow' },
              { value: 20, color: 'red' },
            ],
          })
          .build(),
      }),
    ],
  });
}

// --- Scene Assembly ---

function getComparisonScene(): EmbeddedScene {
  return new EmbeddedScene({
    $timeRange: new SceneTimeRange({ from: 'now-24h', to: 'now' }),
    $variables: getComparisonVariables(),
    controls: [
      new VariableValueSelectors({}),
      ...getTimeControls(),
    ],
    body: new SceneFlexLayout({
      direction: 'row',
      children: [
        new SceneFlexItem({
          body: buildProjectColumn('projectA', 'Project A: ${projectA}'),
        }),
        new SceneFlexItem({
          body: buildProjectColumn('projectB', 'Project B: ${projectB}'),
        }),
      ],
    }),
  });
}

// --- Exported Page ---

export function getProjectComparisonPage(): SceneAppPage {
  return new SceneAppPage({
    title: 'Project Comparison',
    subTitle: 'Side-by-side metrics comparison between two managed projects',
    url: `${PLUGIN_BASE_URL}/compare`,
    getScene: getComparisonScene,
  });
}
