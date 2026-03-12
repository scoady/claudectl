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
import { FlightBoardPanel } from '../components/FlightBoardPanel';

/**
 * Flight Board Scene
 *
 * Airport departures/arrivals flip-board display.
 *
 * Layout:
 * Row 1: Custom flight board (full width, tall)
 * Row 2: Model distribution pie + cost breakdown
 */
export function getFlightBoardScene(): EmbeddedScene {
  const modelQuery = new SceneQueryRunner({
    datasource: getInfinityDatasource(),
    queries: [
      infinityJsonQuery({
        refId: 'models',
        url: '/api/metrics/models',
        columns: [
          { selector: 'model', text: 'Aircraft Type', type: 'string' },
          { selector: 'count', text: 'Fleet Size', type: 'number' },
          { selector: 'total_turns', text: 'Distance', type: 'number' },
          { selector: 'estimated_cost', text: 'Fuel Cost', type: 'number' },
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
          { selector: 'idle_agents', text: 'On Time', type: 'number' },
          { selector: 'error_agents', text: 'Delayed', type: 'number' },
          { selector: 'cumulative_cost', text: 'Total Fuel', type: 'number' },
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
        // Row 1: Flight board
        new SceneFlexItem({
          minHeight: 400,
          body: new SceneReactObject({
            component: FlightBoardPanel,
            props: {},
          }),
        }),
        // Row 2: Fleet + cost
        new SceneFlexLayout({
          direction: 'row',
          children: [
            new SceneFlexItem({
              minHeight: 200,
              minWidth: 300,
              body: new VizPanel({
                title: 'Fleet Composition',
                pluginId: 'piechart',
                $data: modelQuery,
                options: {
                  reduceOptions: { values: true, calcs: [], fields: '/^Fleet Size$/' },
                  legend: { displayMode: 'list', placement: 'right' },
                  pieType: 'donut',
                },
                fieldConfig: {
                  defaults: { color: { mode: 'palette-classic' } },
                  overrides: [],
                },
              }),
            }),
            new SceneFlexItem({
              minHeight: 200,
              body: new VizPanel({
                title: 'Fuel Expenditure',
                pluginId: 'stat',
                $data: healthQuery,
                options: {
                  reduceOptions: { values: false, calcs: ['lastNotNull'], fields: '/^Total Fuel$/' },
                  colorMode: 'value',
                  graphMode: 'none',
                },
                fieldConfig: {
                  defaults: {
                    color: { mode: 'fixed', fixedColor: '#ffbf00' },
                    unit: 'currencyUSD',
                    decimals: 2,
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
