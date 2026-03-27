# Project Vision

## Product Direction

`c9s` is a project-centric terminal workspace for local AI-assisted development.

The product direction is:

- a clean, modern workspace shell with strong terminal ergonomics
- project-local tools, canvases, git context, and agent sessions
- a maintainable architecture that supports rapid feature work without collapsing back into mega files

## Architecture Vision

The TUI should evolve toward:

- one file, one responsibility
- canonical shared models instead of duplicate local structures
- composition and dependency injection over global or singleton-heavy wiring
- canvas-and-block composition over bespoke per-screen panel logic
- pure rendering paths
- state mutation owned by the relevant model
- typed actions and view models instead of stringly feature plumbing where practical
- explicit transport contracts where subsystem boundaries need to cross process or persistence lines

## Current Refactor Program

The active roadmap for this work lives in:

- [docs/architecture/tui-refactor-plan.md](/Users/ayx106492/git/codexctl/docs/architecture/tui-refactor-plan.md)
- [docs/architecture/tui-module-inventory.md](/Users/ayx106492/git/codexctl/docs/architecture/tui-module-inventory.md)

That document is the architecture source of truth.

## Near-Term Priorities

1. Introduce canonical workspace route and selection models.
2. Continue shrinking `app.go` until it is routing-only.
3. Split canvas behavior into dedicated workspace canvas files.
4. Replace remaining duplicate or stringly logic with shared typed abstractions.
5. Add focused tests around transcript ordering, hitboxes, selection reset, and tab behavior.
6. Refactor the highest-value TUI concepts into explicit component / domain modules instead of extending flat helper files.
7. Build a reusable Canvas + Blocks layer so new screens can be assembled from shared UI elements on a grid.

## Planned Feature Tracks

### Syntax-Highlighted Editor

The file editor should move toward a modular code-editor architecture:

- buffer model
- language detection
- syntax highlighting
- ANSI/terminal rendering
- future HTML/render-target support

The goal is dynamic highlighting without hardcoded language-specific UI logic in the editor view.

### Dual-Terminal Workspace

The workspace should support two terminal surfaces:

- user-to-agent terminal
- user-to-system pass-through terminal

The long-term UX direction is a drawer or split-pane system terminal that can open alongside the agent terminal, dynamically resize the workspace, and feed output back into the agent-visible session context where appropriate.

That terminal system should converge on:

- one domain event model
- one transport/event contract
- filtered views for agent/system/shared audiences
- reusable surface instances with backend-specific implementations

### Shared Tab System

Project tabs, file tabs, and canvas tabs should converge on a shared tab module so rendering, hitboxes, and tab actions are not reimplemented three different ways.

### Canvas + Blocks UI System

The product should converge on a generic page-composition model:

- **Canvas** = a page or large workspace surface
- **Block** = a reusable UI element placed on the Canvas grid

This is the intended pattern for:

- workspace telemetry
- milestones / release summaries
- timeseries charts
- tool and catalog panels
- future paintable workspace canvases

The goal is that adding a new UI feature mostly means:

1. implement a new Block
2. place it on a Canvas
3. wire its data source

instead of rebuilding chrome, grid logic, and interaction behavior from scratch.
