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
import { DeepSeaSonarPanel } from '../components/DeepSeaSonarPanel';

export function getDeepSeaSonarScene(): EmbeddedScene {
  return new EmbeddedScene({
    $timeRange: getDefaultTimeRange(),
    controls: getTimeControls(),
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexItem({
          minHeight: 500,
          body: new SceneReactObject({
            component: DeepSeaSonarPanel,
            props: {},
          }),
        }),
      ],
    }),
  });
}
