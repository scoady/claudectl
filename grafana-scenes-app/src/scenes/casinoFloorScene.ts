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
import { CasinoFloorPanel } from '../components/CasinoFloorPanel';

export function getCasinoFloorScene(): EmbeddedScene {
  return new EmbeddedScene({
    $timeRange: getDefaultTimeRange(),
    controls: getTimeControls(),
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexItem({
          minHeight: 500,
          body: new SceneReactObject({
            component: CasinoFloorPanel,
            props: {},
          }),
        }),
      ],
    }),
  });
}
