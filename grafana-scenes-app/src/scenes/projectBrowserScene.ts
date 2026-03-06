import {
  EmbeddedScene,
  SceneFlexLayout,
  SceneFlexItem,
  SceneReactObject,
} from '@grafana/scenes';

/**
 * Project Browser Scene
 *
 * Card grid of all projects. Clicking a card triggers project detail
 * drill-in via window.__c9s_selectProject (handled by App.tsx).
 *
 * The ProjectBrowserPanel component is built by a separate agent.
 * This scene wraps it in the standard EmbeddedScene layout.
 */
export function getProjectBrowserScene(): EmbeddedScene {
  // Lazy-require: the panel may not exist yet (another agent builds it).
  // Fall back to a placeholder if the import fails.
  let component: React.ComponentType<any>;
  try {
    component = require('../components/ProjectBrowserPanel').ProjectBrowserPanel;
  } catch {
    component = (() => {
      const React = require('react');
      return React.createElement('div', {
        style: {
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: 400, color: 'rgba(204,204,220,0.5)', fontSize: 14,
        },
      }, 'ProjectBrowserPanel -- not yet available');
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
