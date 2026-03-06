import {
  EmbeddedScene,
  SceneFlexLayout,
  SceneFlexItem,
  SceneReactObject,
} from '@grafana/scenes';
import { ControlCenterPanel } from '../components/ControlCenterPanel';

/**
 * Control Center Scene
 *
 * Interactive operations dashboard for monitoring, dispatching,
 * and managing Claude agents. Uses a single full-size custom
 * React component that manages all its own state.
 */
export function getControlCenterScene(): EmbeddedScene {
  return new EmbeddedScene({
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexItem({
          minHeight: 600,
          body: new SceneReactObject({
            component: ControlCenterPanel,
            props: {},
          }),
        }),
      ],
    }),
  });
}
