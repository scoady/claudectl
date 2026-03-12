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
} from './shared';
import { ATCRadarPanel } from '../components/ATCRadarPanel';

/**
 * ATC Radar Scene
 *
 * Air Traffic Control radar display showing agents as aircraft blips.
 *
 * Layout:
 * Row 1: Custom ATC radar canvas (full width, tall)
 * Row 2: Agent details table + model breakdown
 */
export function getATCRadarScene(): EmbeddedScene {
  const agentQuery = new SceneQueryRunner({
    datasource: getInfinityDatasource(),
    queries: [
      infinityJsonQuery({
        refId: 'agents',
        url: '/api/metrics/agents/detail',
        columns: [
          { selector: 'star_name', text: 'Callsign', type: 'string' },
          { selector: 'project', text: 'Sector', type: 'string' },
          { selector: 'status', text: 'Status', type: 'string' },
          { selector: 'model', text: 'Aircraft', type: 'string' },
          { selector: 'turns', text: 'Altitude', type: 'number' },
          { selector: 'elapsed', text: 'Flight Time', type: 'string' },
          { selector: 'milestone', text: 'Last Report', type: 'string' },
        ],
      }),
    ],
  });

  const healthQuery = new SceneQueryRunner({
    datasource: getInfinityDatasource(),
    queries: [
      infinityJsonQuery({
        refId: 'health',
        url: '/api/metrics/health',
        columns: [
          { selector: 'active_agents', text: 'In Flight', type: 'number' },
          { selector: 'idle_agents', text: 'Holding', type: 'number' },
          { selector: 'error_agents', text: 'Mayday', type: 'number' },
          { selector: 'total_agents_spawned', text: 'Total Sorties', type: 'number' },
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
        // Row 1: ATC Radar visualization
        new SceneFlexItem({
          minHeight: 450,
          body: new SceneReactObject({
            component: ATCRadarPanel,
            props: {},
          }),
        }),
        // Row 2: Stats
        new SceneFlexLayout({
          direction: 'row',
          children: [
            new SceneFlexItem({
              minWidth: 150,
              body: new VizPanel({
                title: 'Aircraft In Flight',
                pluginId: 'stat',
                $data: healthQuery,
                options: {
                  reduceOptions: { values: false, calcs: ['lastNotNull'], fields: '/^In Flight$/' },
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
                title: 'Holding Pattern',
                pluginId: 'stat',
                $data: healthQuery.clone(),
                options: {
                  reduceOptions: { values: false, calcs: ['lastNotNull'], fields: '/^Holding$/' },
                  colorMode: 'value',
                  graphMode: 'none',
                },
                fieldConfig: {
                  defaults: { color: { mode: 'fixed', fixedColor: '#00e5ff' } },
                  overrides: [],
                },
              }),
            }),
            new SceneFlexItem({
              minWidth: 150,
              body: new VizPanel({
                title: 'Mayday',
                pluginId: 'stat',
                $data: healthQuery.clone(),
                options: {
                  reduceOptions: { values: false, calcs: ['lastNotNull'], fields: '/^Mayday$/' },
                  colorMode: 'value',
                  graphMode: 'none',
                },
                fieldConfig: {
                  defaults: { color: { mode: 'fixed', fixedColor: '#ff3333' } },
                  overrides: [],
                },
              }),
            }),
          ],
        }),
        // Row 3: Agent table
        new SceneFlexItem({
          minHeight: 200,
          body: new VizPanel({
            title: 'Flight Manifest',
            pluginId: 'table',
            $data: agentQuery,
            fieldConfig: {
              defaults: {},
              overrides: [
                {
                  matcher: { id: 'byName', options: 'Status' },
                  properties: [
                    { id: 'custom.cellOptions', value: { type: 'color-text' } },
                    {
                      id: 'mappings',
                      value: [
                        { type: 'value', options: { active: { text: 'CLIMBING', color: 'green' } } },
                        { type: 'value', options: { idle: { text: 'CRUISING', color: 'blue' } } },
                        { type: 'value', options: { error: { text: 'MAYDAY', color: 'red' } } },
                        { type: 'value', options: { done: { text: 'LANDED', color: 'text' } } },
                      ],
                    },
                  ],
                },
              ],
            },
            options: { showHeader: true },
          }),
        }),
      ],
    }),
  });
}
