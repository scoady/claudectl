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
import { F1TelemetryPanel } from '../components/F1TelemetryPanel';

export function getF1TelemetryScene(): EmbeddedScene {
  return new EmbeddedScene({
    $timeRange: getDefaultTimeRange(),
    controls: getTimeControls(),
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexItem({
          minHeight: 550,
          body: new SceneReactObject({
            component: F1TelemetryPanel,
            props: {},
          }),
        }),
      ],
    }),
  });
}
