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
import { TaskProgressPanel } from '../components/TaskProgressPanel';

/**
 * Task Progress Scene
 *
 * Animated progress bars showing task completion across projects.
 * Bars animate with counting effects, neon glows, and particle trails.
 *
 * Layout:
 * Row 1: Custom animated progress panel (full width)
 * Row 2: Project list table + cost breakdown bar chart
 */
export function getTaskProgressScene(): EmbeddedScene {
  const projectQuery = new SceneQueryRunner({
    datasource: getInfinityDatasource(),
    queries: [
      infinityJsonQuery({
        refId: 'projects',
        url: '/api/metrics/projects',
        columns: [
          { selector: 'name', text: 'Project', type: 'string' },
          { selector: 'agent_count', text: 'Agents', type: 'number' },
          { selector: 'task_total', text: 'Tasks', type: 'number' },
          { selector: 'task_done', text: 'Done', type: 'number' },
          { selector: 'estimated_cost', text: 'Cost', type: 'number' },
        ],
      }),
    ],
  });

  const costQuery = new SceneQueryRunner({
    datasource: getInfinityDatasource(),
    queries: [
      infinityJsonQuery({
        refId: 'costs',
        url: '/api/metrics/projects',
        columns: [
          { selector: 'name', text: 'Project', type: 'string' },
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
        // Row 1: Animated progress bars
        new SceneFlexItem({
          minHeight: 400,
          body: new SceneReactObject({
            component: TaskProgressPanel,
            props: {},
          }),
        }),
        // Row 2: Project table + cost bar chart
        new SceneFlexLayout({
          direction: 'row',
          children: [
            new SceneFlexItem({
              minHeight: 200,
              body: new VizPanel({
                title: 'Project Details',
                pluginId: 'table',
                $data: projectQuery,
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
                options: { showHeader: true },
              }),
            }),
            new SceneFlexItem({
              minHeight: 200,
              body: new VizPanel({
                title: 'Cost by Project',
                pluginId: 'barchart',
                $data: costQuery,
                options: {
                  orientation: 'horizontal',
                  barWidth: 0.7,
                  groupWidth: 0.7,
                  legend: { displayMode: 'hidden' },
                },
                fieldConfig: {
                  defaults: {
                    unit: 'currencyUSD',
                    color: { mode: 'palette-classic' },
                    custom: {
                      fillOpacity: 80,
                      gradientMode: 'hue',
                    },
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
