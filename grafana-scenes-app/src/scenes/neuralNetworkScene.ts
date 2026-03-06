import {
  EmbeddedScene,
  SceneFlexLayout,
  SceneFlexItem,
  SceneReactObject,
} from '@grafana/scenes';
import {
  getDefaultTimeRange,
  getTimeControls,
} from './shared';
import { NeuralNetworkPanel } from '../components/NeuralNetworkPanel';

export function getNeuralNetworkScene(): EmbeddedScene {
  return new EmbeddedScene({
    $timeRange: getDefaultTimeRange(),
    controls: getTimeControls(),
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexItem({
          minHeight: 500,
          body: new SceneReactObject({
            component: NeuralNetworkPanel,
            props: {},
          }),
        }),
      ],
    }),
  });
}
