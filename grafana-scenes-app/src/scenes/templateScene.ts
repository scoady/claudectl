import {
  EmbeddedScene,
  SceneFlexLayout,
  SceneFlexItem,
  SceneReactObject,
} from '@grafana/scenes';
import { TemplateBrowserPanel } from '../components/TemplateBrowserPanel';

/**
 * Template Library Scene
 *
 * Browse workflow templates — card grid with expandable detail panels
 * showing roles, config schema, phase timeline, and apply action.
 */
export function getTemplateScene(): EmbeddedScene {
  return new EmbeddedScene({
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexItem({
          minHeight: 600,
          body: new SceneReactObject({
            component: TemplateBrowserPanel,
            props: {},
          }),
        }),
      ],
    }),
  });
}
