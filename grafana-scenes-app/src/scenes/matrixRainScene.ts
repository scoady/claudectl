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
import { MatrixRainPanel } from '../components/MatrixRainPanel';

export function getMatrixRainScene(): EmbeddedScene {
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
          { selector: 'total_agents_spawned', text: 'Total Spawned', type: 'number' },
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
        new SceneFlexItem({
          minHeight: 500,
          body: new SceneReactObject({
            component: MatrixRainPanel,
            props: {},
          }),
        }),
        new SceneFlexLayout({
          direction: 'row',
          children: [
            new SceneFlexItem({
              minWidth: 150,
              body: new VizPanel({
                title: 'Connected Agents',
                pluginId: 'stat',
                $data: healthQuery,
                options: {
                  reduceOptions: { values: false, calcs: ['lastNotNull'], fields: '/^Active$/' },
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
                title: 'Red Pills (Errors)',
                pluginId: 'stat',
                $data: healthQuery.clone(),
                options: {
                  reduceOptions: { values: false, calcs: ['lastNotNull'], fields: '/^Errors$/' },
                  colorMode: 'value',
                  graphMode: 'none',
                },
                fieldConfig: {
                  defaults: { color: { mode: 'fixed', fixedColor: '#ff2222' } },
                  overrides: [],
                },
              }),
            }),
            new SceneFlexItem({
              minWidth: 150,
              body: new VizPanel({
                title: 'Total Spawned',
                pluginId: 'stat',
                $data: healthQuery.clone(),
                options: {
                  reduceOptions: { values: false, calcs: ['lastNotNull'], fields: '/^Total Spawned$/' },
                  colorMode: 'value',
                  graphMode: 'none',
                },
                fieldConfig: {
                  defaults: { color: { mode: 'fixed', fixedColor: '#00ff41' } },
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
