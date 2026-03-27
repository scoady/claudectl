# Tasks

## Active Roadmap

Use [docs/architecture/tui-refactor-plan.md](/Users/ayx106492/git/codexctl/docs/architecture/tui-refactor-plan.md) as the canonical architecture roadmap.
Use [docs/architecture/tui-module-inventory.md](/Users/ayx106492/git/codexctl/docs/architecture/tui-module-inventory.md) as the canonical subsystem inventory and package-boundary plan.

## Now

- [ ] Finish `WorkspaceSelection` as the canonical owner of project/explorer/canvas/task/file selection state.
  Current slice started: project/explorer/canvas/task index selection now lives in the new shared selection model.
- [ ] Introduce `WorkspaceRoute` as the canonical owner of dock mode, focus pane, and route context.
- [ ] Continue extracting non-workspace update handling out of `app.go`.
- [ ] Modularize tab behavior into a shared tab module for project/file/canvas tabs.
- [ ] Split workspace canvas behavior into dedicated files.
- [ ] Replace remaining stringly workspace command paths with typed actions where practical.
- [ ] Decide and document the first real TUI subpackage boundaries so we do not keep growing `internal/tui` as a flat namespace.
- [ ] Extract the workspace explorer into its own module with a model/view/controller boundary and a small frontend-facing API.
- [ ] Extract the terminal surface into a reusable component with backend-specific implementations for assistant and OS pass-through.
- [ ] Define the terminal event contract as both:
  - a reusable domain model under `internal/tui/components/terminal`
  - a transport schema under `proto/c9s/ui/v1/terminal.proto`
- [ ] Extract the file editor into its own module with buffer, controller, view, and future syntax-highlighting seams.
- [ ] Establish the shared Canvas + Blocks layer for page composition.
- [ ] Build the first reusable Blocks:
  - workspace telemetry stats
  - milestones / recent releases

## Next

- [ ] Graduate the first stable subsystem into a subpackage once its API is small and explicit.
- [ ] Design the modular syntax-highlighting editor pipeline:
  buffer, language detection, highlighting, rendering, and mutation hooks.
- [ ] Design the dual-terminal architecture:
  user-to-agent terminal, user-to-system terminal drawer/split, shared IO/event models.
- [ ] Generalize the current metrics/dashboard graph work into reusable time-series Blocks that can be stamped out multiple times on one Canvas grid.
- [ ] Add focused unit tests for workspace hitboxes.
- [ ] Add focused unit tests for project tab behavior and selection reset rules.
- [ ] Add focused unit tests for canvas tab switching and widget selection.
- [ ] Isolate or unwire remaining non-core legacy screens into `dump/` or explicit legacy paths.

## Later

- [ ] Add package-level architecture notes for `internal/tui`.
- [ ] Add a clearer deletion policy for code parked in `internal/tui/dump/`.
- [ ] Add more shared UI/view-model abstractions where multiple screens converge on the same behavior.

## Working Rule

Future Codex sessions should update this file as the short operational task list and keep the longer rationale in the architecture roadmap doc.
