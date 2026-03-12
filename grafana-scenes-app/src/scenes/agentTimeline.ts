import {
  SceneAppPage,
  SceneAppPageLike,
  SceneRouteMatch,
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
  TextBoxVariable,
  VariableValueSelectors,
} from '@grafana/scenes';
import { ThresholdsMode, FieldColorModeId } from '@grafana/data';
import { PLUGIN_BASE_URL } from '../constants';
import {
  getDefaultTimeRange,
  getTimeControls,
  getInfinityDatasource,
  getInfinityDsVariable,
  infinityJsonQuery,
} from './shared';

/**
 * Agent Timeline Scene
 *
 * Shows agent lifecycle events as a state timeline, with each agent as a row.
 * Includes project and status filters plus drill-down to individual agent detail.
 */

// --- Variables ---

function getTimelineVariables() {
  return new SceneVariableSet({
    variables: [
      getInfinityDsVariable(),
      new CustomVariable({
        name: 'project',
        label: 'Project',
        query: 'All , claude-manager , agent-reports , helm-platform , kind-infra',
        value: 'All',
        text: 'All',
      }),
      new CustomVariable({
        name: 'status',
        label: 'Status',
        query: 'All , running , done , error , pending',
        value: 'All',
        text: 'All',
      }),
      new TextBoxVariable({
        name: 'search',
        label: 'Search',
        value: '',
      }),
    ],
  });
}

// --- Data Queries ---

function getAgentListQuery(): SceneQueryRunner {
  return new SceneQueryRunner({
    datasource: getInfinityDatasource(),
    queries: [
      infinityJsonQuery({
        refId: 'agents',
        url: 'http://localhost:4040/api/agents',
        columns: [
          { selector: 'session_id', text: 'Agent ID', type: 'string' },
          { selector: 'project', text: 'Project', type: 'string' },
          { selector: 'status', text: 'Status', type: 'string' },
          { selector: 'created_at', text: 'Start Time', type: 'timestamp' },
          { selector: 'finished_at', text: 'End Time', type: 'timestamp' },
          { selector: 'task', text: 'Task', type: 'string' },
          { selector: 'model', text: 'Model', type: 'string' },
        ],
      }),
    ],
  });
}

function getStatsQuery(): SceneQueryRunner {
  return new SceneQueryRunner({
    datasource: getInfinityDatasource(),
    queries: [
      infinityJsonQuery({
        refId: 'stats',
        url: 'http://localhost:4040/api/stats',
        columns: [
          { selector: 'active_agents', text: 'Active', type: 'number' },
          { selector: 'total_agents', text: 'Total', type: 'number' },
          { selector: 'projects_count', text: 'Projects', type: 'number' },
        ],
      }),
    ],
  });
}

function getAgentMilestonesQuery(agentId: string): SceneQueryRunner {
  return new SceneQueryRunner({
    datasource: getInfinityDatasource(),
    queries: [
      infinityJsonQuery({
        refId: 'milestones',
        url: `http://localhost:4040/api/agents/${agentId}/milestones`,
        columns: [
          { selector: 'timestamp', text: 'Time', type: 'timestamp' },
          { selector: 'label', text: 'Milestone', type: 'string' },
          { selector: 'tool', text: 'Tool', type: 'string' },
        ],
      }),
    ],
  });
}

// --- Panels ---

function buildStateTimelinePanel(): VizPanel {
  return new VizPanel({
    pluginId: 'state-timeline',
    title: 'Agent Lifecycle Timeline',
    $data: getAgentListQuery(),
    fieldConfig: {
      defaults: {
        color: { mode: FieldColorModeId.ContinuousBlPu },
        custom: { fillOpacity: 80, lineWidth: 0 },
        mappings: [
          { type: 1, options: { running: { color: 'green', text: 'Running' } } },
          { type: 1, options: { done: { color: 'blue', text: 'Done' } } },
          { type: 1, options: { error: { color: 'red', text: 'Error' } } },
          { type: 1, options: { pending: { color: 'yellow', text: 'Pending' } } },
        ],
      },
      overrides: [],
    },
    options: {
      showValue: 'auto',
      rowHeight: 0.85,
      mergeValues: true,
      alignValue: 'left',
      tooltip: { mode: 'single' },
      legend: { showLegend: true, displayMode: 'list', placement: 'bottom' },
    },
  });
}

function buildActiveAgentsStat(): VizPanel {
  return PanelBuilders.stat()
    .setTitle('Active Agents')
    .setData(getStatsQuery())
    .setOption('graphMode', 'area')
    .setOption('colorMode', 'background')
    .setOption('textMode', 'auto')
    .setOption('reduceOptions', { calcs: ['lastNotNull'], fields: '/Active/' })
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

function buildTotalAgentsStat(): VizPanel {
  return PanelBuilders.stat()
    .setTitle('Total Agents')
    .setData(getStatsQuery())
    .setOption('graphMode', 'none')
    .setOption('colorMode', 'value')
    .setOption('reduceOptions', { calcs: ['lastNotNull'], fields: '/Total/' })
    .build();
}

function buildProjectCountStat(): VizPanel {
  return PanelBuilders.stat()
    .setTitle('Active Projects')
    .setData(getStatsQuery())
    .setOption('graphMode', 'none')
    .setOption('colorMode', 'value')
    .setOption('reduceOptions', { calcs: ['lastNotNull'], fields: '/Projects/' })
    .build();
}

function buildAgentTablePanel(): VizPanel {
  return PanelBuilders.table()
    .setTitle('Agent Details')
    .setData(getAgentListQuery())
    .setOption('showHeader', true)
    .setOption('sortBy', [{ displayName: 'Start Time', desc: true }])
    .setOverrides((b) =>
      b
        .matchFieldsWithName('Status')
        .overrideCustomFieldConfig('displayMode', 'color-background-solid')
    )
    .build();
}

// --- Scene Assembly ---

function getTimelineScene(): EmbeddedScene {
  return new EmbeddedScene({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    $variables: getTimelineVariables(),
    controls: [
      new VariableValueSelectors({}),
      ...getTimeControls(),
    ],
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        // Top row: stat panels
        new SceneFlexItem({
          height: 120,
          body: new SceneCSSGridLayout({
            templateColumns: 'repeat(3, 1fr)',
            autoRows: '100px',
            children: [
              buildActiveAgentsStat(),
              buildTotalAgentsStat(),
              buildProjectCountStat(),
            ],
          }),
        }),
        // Middle: state timeline
        new SceneFlexItem({
          minHeight: 300,
          body: buildStateTimelinePanel(),
        }),
        // Bottom: detailed table
        new SceneFlexItem({
          minHeight: 250,
          body: buildAgentTablePanel(),
        }),
      ],
    }),
  });
}

// --- Drilldown: Agent Detail ---

function getAgentDetailScene(agentId: string): EmbeddedScene {
  return new EmbeddedScene({
    $timeRange: new SceneTimeRange({ from: 'now-1h', to: 'now' }),
    $data: getAgentMilestonesQuery(agentId),
    controls: [
      new SceneTimePicker({ isOnCanvas: true }),
      new SceneRefreshPicker({
        intervals: ['5s', '10s', '30s'],
        refresh: '10s',
        isOnCanvas: true,
      }),
    ],
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexItem({
          height: 120,
          body: new SceneCSSGridLayout({
            templateColumns: 'repeat(2, 1fr)',
            autoRows: '100px',
            children: [
              PanelBuilders.stat()
                .setTitle('Agent ID')
                .setOption('textMode', 'name')
                .setOption('colorMode', 'background')
                .build(),
              PanelBuilders.stat()
                .setTitle('Milestones')
                .setOption('graphMode', 'area')
                .setOption('reduceOptions', { calcs: ['count'] })
                .build(),
            ],
          }),
        }),
        new SceneFlexItem({
          minHeight: 300,
          body: PanelBuilders.table()
            .setTitle(`Milestones for ${agentId}`)
            .setOption('showHeader', true)
            .setOption('sortBy', [{ displayName: 'Time', desc: true }])
            .build(),
        }),
        new SceneFlexItem({
          minHeight: 200,
          body: new VizPanel({
            pluginId: 'logs',
            title: 'Agent Stream',
            $data: new SceneQueryRunner({
              datasource: getInfinityDatasource(),
              queries: [
                infinityJsonQuery({
                  refId: 'stream',
                  url: `http://localhost:4040/api/agents/${agentId}/messages`,
                  columns: [
                    { selector: 'timestamp', text: 'Time', type: 'timestamp' },
                    { selector: 'role', text: 'Role', type: 'string' },
                    { selector: 'content', text: 'Content', type: 'string' },
                  ],
                }),
              ],
            }),
          }),
        }),
      ],
    }),
  });
}

function getAgentDrilldownPage(
  routeMatch: SceneRouteMatch<{ agentId: string }>,
  parent: SceneAppPageLike
): SceneAppPage {
  const agentId = decodeURIComponent(routeMatch.params.agentId);
  return new SceneAppPage({
    url: `${PLUGIN_BASE_URL}/agents/${encodeURIComponent(agentId)}`,
    title: `Agent: ${agentId.substring(0, 12)}...`,
    subTitle: 'Agent detail with milestones and message stream',
    getParentPage: () => parent,
    getScene: () => getAgentDetailScene(agentId),
  });
}

// --- Exported Page ---

export function getAgentTimelinePage(): SceneAppPage {
  return new SceneAppPage({
    title: 'Agent Timeline',
    subTitle: 'Lifecycle events and status tracking for all Claude agents',
    url: `${PLUGIN_BASE_URL}/agents`,
    getScene: getTimelineScene,
    drilldowns: [
      {
        routePath: `${PLUGIN_BASE_URL}/agents/:agentId`,
        getPage: getAgentDrilldownPage,
      },
    ],
  });
}
