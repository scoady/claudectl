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
} from './shared';
import { SteampunkTracePanel } from '../components/SteampunkTracePanel';

/**
 * Steampunk Agent Trace Scene
 *
 * Shows agent activity as a steampunk-themed dependency waterfall
 * with spinning cogs, steam particles, and amber-tinted trace bars.
 *
 * Layout:
 * Row 1: Custom steampunk trace canvas (full width, tall)
 * Row 2: Agent details table + model breakdown pie
 */
export function getSteampunkTraceScene(): EmbeddedScene {
  const agentQuery = new SceneQueryRunner({
    datasource: getInfinityDatasource(),
    queries: [
      infinityJsonQuery({
        refId: 'agents',
        url: '/api/metrics/agents/detail',
        columns: [
          { selector: 'star_name', text: 'Agent', type: 'string' },
          { selector: 'project', text: 'Project', type: 'string' },
          { selector: 'status', text: 'Status', type: 'string' },
          { selector: 'model', text: 'Model', type: 'string' },
          { selector: 'turns', text: 'Turns', type: 'number' },
          { selector: 'elapsed', text: 'Elapsed', type: 'string' },
          { selector: 'milestone', text: 'Milestone', type: 'string' },
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
          { selector: 'model', text: 'Model', type: 'string' },
          { selector: 'count', text: 'Agents', type: 'number' },
          { selector: 'estimated_cost', text: 'Cost', type: 'number' },
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
        // Row 1: Steampunk trace visualization
        new SceneFlexItem({
          minHeight: 450,
          body: new SceneReactObject({
            component: SteampunkTracePanel,
            props: {},
          }),
        }),
        // Row 2: Agent table + Model breakdown
        new SceneFlexLayout({
          direction: 'row',
          children: [
            new SceneFlexItem({
              minHeight: 200,
              body: new VizPanel({
                title: 'Agent Details',
                pluginId: 'table',
                $data: agentQuery,
                fieldConfig: {
                  defaults: {},
                  overrides: [
                    {
                      matcher: { id: 'byName', options: 'Status' },
                      properties: [
                        {
                          id: 'custom.cellOptions',
                          value: {
                            type: 'color-text',
                          },
                        },
                        {
                          id: 'mappings',
                          value: [
                            { type: 'value', options: { active: { text: 'ACTIVE', color: 'blue' } } },
                            { type: 'value', options: { idle: { text: 'IDLE', color: 'green' } } },
                            { type: 'value', options: { error: { text: 'ERROR', color: 'red' } } },
                          ],
                        },
                      ],
                    },
                  ],
                },
                options: { showHeader: true },
              }),
            }),
            new SceneFlexItem({
              minHeight: 200,
              minWidth: 300,
              body: new VizPanel({
                title: 'Model Distribution',
                pluginId: 'piechart',
                $data: modelQuery,
                options: {
                  reduceOptions: {
                    values: true,
                    calcs: [],
                    fields: '/^Agents$/',
                  },
                  legend: { displayMode: 'list', placement: 'right' },
                  pieType: 'donut',
                },
                fieldConfig: {
                  defaults: {
                    color: { mode: 'palette-classic' },
                  },
                  overrides: [],
                },
              }),
            }),
          ],
        }),
      ],
    }),
  });
}
