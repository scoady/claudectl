# TUI Refactor Plan

## Purpose

Make the TUI maintainable without backing out the current workspace shell behavior.

This plan is the canonical checklist for:

- shrinking `internal/tui/app.go`
- keeping workspace logic split by responsibility
- moving legacy code out of the hot path
- reducing duplicate logic and one-off view state
- bringing the TUI closer to a clean, testable architecture

## Current State

The workspace shell is already partially decomposed:

- `workspace_shell_model.go`: state, initialization, project/session bootstrap
- `workspace_shell_session.go`: terminal, editor, composer, transcript state
- `workspace_shell_render.go`: rendering
- `workspace_shell_layout.go`: layout math
- `workspace_shell_types.go`: workspace shell UI structs
- `workspace_shell_explorer.go`: explorer-specific helpers
- `workspace_shell_presenters.go`: transcript/icon/presenter helpers
- `app_workspace.go`: workspace-specific app flow and mouse handling
- `app_workspace_hitboxes.go`: workspace hitbox helpers

Legacy workspace code is parked in:

- `internal/tui/dump/legacy_workspace.go`

## Architecture Goals

### 1. One file, one responsibility

Each file should answer one question:

- model/state
- rendering
- layout
- event handling
- backend command wiring
- presentation formatting

### 2. No duplicate declarations

UI structs, layout structs, and hitbox structs must exist once and be shared. No second copy of the same type in another screen file.

### 3. Keep state mutation separate from rendering

The render path should not contain data fetching, sorting, transcript reconciliation, or project switching logic.

### 4. Build reusable view models

The TUI should have stable intermediate models that make rendering predictable and testable instead of each screen formatting raw API objects inline.

### 5. Keep legacy code out of active files

Unused or superseded code should live under `internal/tui/dump/` until it is either recycled or deleted.

## Proposed TUI Shape

### App layer

- `app.go`
  - only app bootstrap, top-level `Update`, top-level `View`, and common screen routing
- `app_workspace.go`
  - workspace-specific navigation, commands, mouse flow
- `app_workspace_hitboxes.go`
  - workspace hitbox math only
- future:
  - `app_navigation.go`
  - `app_commands.go`
  - `app_overlays.go`
  - `app_tools.go`

### Workspace shell layer

- `workspace_shell_model.go`
  - owned state and initialization
- `workspace_shell_session.go`
  - terminal/editor/composer behavior
- `workspace_shell_explorer.go`
  - explorer state and git badge logic
- `workspace_shell_presenters.go`
  - transcript formatting and icon/presenter helpers
- `workspace_shell_layout.go`
  - layout math and slot allocation
- `workspace_shell_render.go`
  - pure rendering
- `workspace_shell_metrics.go`
  - top strip / bottom strip metrics and context efficiency helpers
- future:
  - `workspace_shell_canvas.go`
  - `workspace_shell_tabs.go`
  - `workspace_shell_git.go`

### Shared support layer

- `workspace_shared.go`
  - shared messages and API commands
- `workspace_legacy_support.go`
  - generic helpers still used outside the old workspace path

## Common Data Models To Introduce

These are the next useful shared models to add, even if only some land immediately.

### `WorkspaceRoute`

Represents the active workspace section:

- dock mode
- selected project
- selected canvas
- selected file
- selected task

Why:

- avoids scattering routing state across `FocusPane`, `DockMode`, and several selected indices

### `WorkspaceSelection`

Represents current selections in one place:

- project tab
- explorer index
- canvas widget index
- subagent index
- file tab

Why:

- centralizes selection reset rules when project/dock/context changes

### `WorkspaceGitContext`

Represents git state for the active project:

- branch
- remote
- provider
- status map
- ready flag

Why:

- removes individual git fields from the main shell model
- makes future git widgets and badges easier

### `TranscriptRow`

Represents one rendered terminal/chat row:

- timestamp
- role
- kind
- label
- body lines
- accent color

Why:

- makes transcript rendering deterministic
- simplifies ordering bugs and testing
- cleanly separates transcript merge from transcript view

### `CanvasTabState`

Represents one project canvas tab:

- tab name
- widget ids
- selected widget
- layout mode

Why:

- prepares for multi-widget canvases and richer canvas composition

## Remaining Work

### Phase 1: Finish the decomposition

- split more workspace-specific helpers out of `app.go`
- extract tool-screen-specific helpers from `app.go`
- move command/filter/input handlers into smaller app files
- reduce `workspace_shell.go` further until it only contains state mutation and synchronization

Exit criteria:

- `app.go` is under 2000 lines
- `workspace_shell.go` is under 400 lines

### Phase 2: Introduce stable view models

- add `WorkspaceGitContext`
- add `TranscriptRow`
- add `WorkspaceSelection`
- move transcript merge + ordering into one builder function that outputs `[]TranscriptRow`
- make renderers consume these view models instead of raw `api.Message` and ad hoc lists

Exit criteria:

- transcript ordering logic exists in one place
- explorer/task/canvas sidebar rows are rendered from explicit row models

### Phase 3: Reduce duplicated command/menu wiring

- centralize workspace commands into typed actions instead of stringly-typed `executeCommandMsg`
- centralize context menu item builders
- remove repeated project/session navigation code paths where possible

Exit criteria:

- fewer raw command strings in workspace paths
- fewer repeated `tea.Batch(...)` project reload calls

### Phase 4: Clean up screen boundaries

- unwire or isolate leftover legacy claudectl-era screens not part of the current product focus
- keep only:
  - workspace
  - metrics
  - tools/plugins
  - clearly necessary project/task/detail flows
- move superseded screens into `dump/` or behind explicit legacy flags

Exit criteria:

- app navigation surface matches the actual product direction

### Phase 5: Raise engineering quality

- add focused tests for:
  - transcript merge/order
  - workspace tab hitboxes
  - dock hitboxes
  - project picker behavior
  - canvas tab switching
- add lint/static-analysis step if not already present
- add package-level architecture notes for `internal/tui`

Exit criteria:

- key workspace behaviors are covered by unit tests
- refactor safety does not depend on manual screenshots only

## Best-Practice Gaps Still Open

- `app.go` still owns too many responsibilities
- workspace selection state is still spread across multiple fields
- transcript rendering still depends on raw strings more than structured rows
- context menu wiring is still repeated
- some screen navigation is still command-string driven instead of typed action driven
- `dump/` exists, but there is not yet a formal deletion policy

## Anti-Slop Guardrails

These are the rules that keep the codebase from drifting into low-quality duplicate implementation work.

### Structural Guardrails

- Do not add new feature logic to the largest existing file just because it is already open.
- If a file grows past roughly 400 to 600 lines and is serving more than one concern, split it before adding more behavior.
- New reusable concepts must get one canonical model or helper instead of multiple near-identical local versions.
- Prefer extending an existing module or extracting a shared abstraction over creating a second structure that solves the same problem.
- Do not add global state or singleton-heavy coordination when constructor injection or explicit ownership will work.

### Design Guardrails

- Prefer composition over inheritance-like coupling and one-off manager objects.
- Favor explicit interfaces and dependency injection when a dependency crosses screen or package boundaries.
- Keep render functions pure: no sorting, loading, mutating, or reconciliation in the view layer.
- Keep state mutation close to the owning model.
- Avoid stringly typed routing or commands for new feature flows when typed actions or models are practical.

### Quality Guardrails

- New workspace behavior should come with at least one focused test when the logic is nontrivial.
- Hitbox math, transcript ordering, and selection-reset behavior should be covered by small unit tests instead of screenshot-only validation.
- Refactors should reduce duplication, not move duplication into new files.
- “Looks done” is not enough; code should also be easier to extend after the change than before it.
- Release or handoff quality requires `go build ./...` and `go test ./...` at minimum.
- Bug fixes should add regression coverage when the behavior can be isolated.

### Review Questions

Before merging, ask:

1. Did this change reuse an existing abstraction where it should have?
2. Did it introduce a second copy of logic, data shape, or UI mapping that already exists elsewhere?
3. Is the resulting ownership boundary clearer than before?
4. Would the next related feature land in an obvious place without growing a mega file?

## Execution Order

### Immediate

1. keep shrinking `app.go`
2. introduce `TranscriptRow`
3. move workspace command routing away from string commands where practical

### After that

1. introduce `WorkspaceGitContext`
2. introduce `WorkspaceSelection`
3. split canvas-specific workspace logic into its own file

### Final cleanup

1. prune or isolate legacy screens
2. add tests around the current workspace shell
3. delete `dump/` contents that are no longer needed

## Rules For Future Changes

- do not add new workspace behavior to `app.go` when a workspace-specific file already exists
- do not re-declare shared layout or hitbox structs
- when a capability already exists, extend it or extract a reusable abstraction from it instead of creating a second parallel implementation
- prefer reusable modules and shared models over one-off local structures when the same behavior can serve multiple call sites
- favor cohesive object-oriented design with clear ownership, composition, and dependency injection instead of global or singleton-heavy wiring
- do not put formatting helpers in state files
- do not put state mutation in render files
- move dead code to `dump/` instead of leaving it in active source files
- when adding a new pane or dock section, create a dedicated file if it introduces more than a few helpers
- keep files small and single-purpose; when a file starts turning into a grab bag, split it before adding more behavior
- prefer `component_or_domain_src_file.go` decomposition over one giant feature file
- shared models should be canonical; do not define a second copy of the same row, layout, or action type elsewhere

## Validation Commands

```bash
go build ./...
go test ./...
go build -o c9s ./cmd
```
