# v2.1.0 Handover

## Purpose

This document is the handoff point for the modular TUI rewrite that shipped in `v2.1.0`.

Use this doc as the starting point for the next round of work instead of rediscovering structure from the codebase.

## Current Product Shape

The app now has three major UI directions in place:

1. `Home`
   - primary app entry point
   - card/block-based dashboard
   - no longer relies on the old `--workspace-ui` flag

2. `Workspace`
   - dock-driven shell
   - agent chat
   - files/editor
   - canvas
   - tasks
   - metrics
   - tools

3. `Shared component layer`
   - metrics component
   - terminal event/log groundwork
   - blocks/canvas groundwork
   - style layer for workspace

## Architectural Intent

The TUI is being refactored toward a terminal-native **MVC / MVU hybrid**:

- **Models**
  - own durable state
  - should not directly own raw color/layout concerns

- **Views**
  - compose screens from reusable components
  - should render over shared component/state contracts

- **Controllers / update paths**
  - own routing, key handling, mouse handling, commands
  - should stay thin and route into component-owned behavior where possible

- **Presenters**
  - shape raw data into render-ready content
  - should avoid re-encoding business logic

- **Styles**
  - semantic palette and component chrome
  - should live in dedicated style modules, not inline in random render helpers

## Design Language

Two terms are now the preferred mental model:

- **Canvas**
  - a whole page or layout surface
  - composed of reusable pieces placed on a grid

- **Block**
  - a reusable UI element placed onto a canvas
  - examples:
    - telemetry panel
    - milestones panel
    - future graph panel
    - future workspace stats panel

The goal is a Grafana-like compositional model for the entire app, not just the metrics dashboard.

## Important Current Modules

### Shared style layer

- `internal/tui/style/workspace.go`

This is the start of the semantic workspace style system.

Use it instead of hardcoding palette decisions in renderers.

### Blocks / Canvas groundwork

- `internal/tui/components/blocks/types.go`
- `internal/tui/components/blocks/style.go`
- `internal/tui/components/blocks/view.go`
- `internal/tui/components/blocks/telemetry.go`
- `internal/tui/components/blocks/milestones.go`

These are the first shared “Block” primitives.

### Metrics component

- `internal/tui/components/metrics/model.go`
- `internal/tui/components/metrics/view.go`
- `internal/tui/components/metrics/style.go`

This is the first intentionally reusable UI component in the new model.

### Terminal groundwork

- `internal/tui/components/terminal/types.go`
- `internal/tui/components/terminal/log.go`
- `proto/c9s/ui/v1/terminal.proto`

This is the start of the transport/domain split for terminal events.

### Editor groundwork

- `internal/tui/components/editor/style.go`
- `internal/tui/components/editor/view.go`
- `internal/tui/editor_highlight_types.go`

This is the seam intended for syntax highlighting and future editor behavior.

### Workspace shell

Key active files:

- `internal/tui/workspace_shell_render.go`
- `internal/tui/workspace_shell_session.go`
- `internal/tui/workspace_shell_presenters.go`
- `internal/tui/workspace_shell_explorer.go`
- `internal/tui/workspace_shell_explorer_view.go`
- `internal/tui/workspace_terminal_blocks.go`

These still need further extraction, but they are materially more modular than the original monolith.

## Current Workspace Behavior

### Agent Chat

- full-width main terminal surface
- optional OS drawer terminal below
- shared terminal look is being normalized

### Files

- single-file editor flow
- black editor surface to mimic IDE feel
- shallow recursive explorer feed from backend
- directories use emoji icon

### Home

- action strip on top
- block/canvas-driven lower section

## What Still Needs Work

### 1. File explorer graphics / styling

Current state:
- functionally improved
- still visually rough
- tree is present but not yet polished

Next goal:
- cleaner minimalist tree
- better typography
- better spacing and icon sizing
- stronger IDE-style hierarchy

### 2. Syntax highlighting

Target direction:
- use **Chroma** as first implementation
- keep it modular through the editor component seam

Desired architecture:
- language detector
- highlighter provider
- renderer
- editor integration

Do **not** bury syntax highlighting logic in workspace render code.

### 3. Componentization of remaining heavy areas

High-priority extractions:
- `components/explorer`
- `components/terminal`
- `components/editor`
- `components/tabs`
- `components/menu`

### 4. Canvas / Block system maturity

The current Blocks layer is real, but still early.

Next step is to make more screens actually consume it:
- workspace-local telemetry block
- milestones / release-summary block
- reusable graph blocks
- generic grid placement rules

## Coding Rules To Preserve

These are the design principles this work is following:

- do not create a second implementation when a shared abstraction can be extended
- prefer reusable modules over local one-off feature wiring
- keep files focused and single-purpose
- keep view/layout/style/model responsibilities separate
- keep style tokens in the style layer
- keep transport contracts separate from in-memory UI models
- add tests for layout contracts and regressions when behavior is isolated

## Immediate Next Iteration

The next practical slice should be:

1. polish file explorer graphics and typography
2. implement Chroma-based syntax highlighting through the editor component seam
3. continue extracting reusable terminal/explorer/editor components
4. apply the Block / Canvas pattern to more workspace-local views

## Validation Baseline For This Release

Validated before tagging:

- `go test ./...`
- `go build ./...`
- `go build -o c9s ./cmd`

## Notes

- local non-release artifacts like `bin/`, `c9s-debug`, and `tmp/` are intentionally not part of the release commit
- if the workspace UI seems stale, ensure the running `c9s serve` process is using the current repo-built binary
