import {
  EmbeddedScene,
  SceneFlexLayout,
  SceneFlexItem,
  SceneReactObject,
} from '@grafana/scenes';
import { LayoutStudioPanel } from '../components/LayoutStudioPanel';

/**
 * Layout Studio Scene
 *
 * Manage layout presets — save, browse, and apply widget arrangements.
 * Currently a styled placeholder; full implementation TBD.
 */
export function getLayoutStudioScene(): EmbeddedScene {
  return new EmbeddedScene({
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexItem({
          minHeight: 600,
          body: new SceneReactObject({
            component: LayoutStudioPanel,
            props: {},
          }),
        }),
      ],
    }),
  });
}
