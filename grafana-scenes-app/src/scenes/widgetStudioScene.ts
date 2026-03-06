import {
  EmbeddedScene,
  SceneFlexLayout,
  SceneFlexItem,
  SceneReactObject,
} from '@grafana/scenes';

/**
 * Widget Studio Scene
 *
 * Browse and create widget types from the catalog.
 * The WidgetStudioPanel component is built by a separate agent.
 */
export function getWidgetStudioScene(): EmbeddedScene {
  let component: React.ComponentType<any>;
  try {
    component = require('../components/WidgetStudioPanel').WidgetStudioPanel;
  } catch {
    component = (() => {
      const React = require('react');
      return React.createElement('div', {
        style: {
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: 400, color: 'rgba(204,204,220,0.5)', fontSize: 14,
        },
      }, 'WidgetStudioPanel -- not yet available');
    }) as React.ComponentType<any>;
  }

  return new EmbeddedScene({
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexItem({
          minHeight: 600,
          body: new SceneReactObject({
            component,
            props: {},
          }),
        }),
      ],
    }),
  });
}
