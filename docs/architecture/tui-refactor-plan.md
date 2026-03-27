# TUI Refactor Plan

## Purpose

Make the TUI maintainable without backing out the current workspace shell behavior.

This plan is the canonical checklist for:

- shrinking `internal/tui/app.go`
- keeping workspace logic split by responsibility
- moving legacy code out of the hot path
- reducing duplicate logic and one-off view state
- bringing the TUI closer to a clean, testable architecture

Operator-facing references:

- [PROJECT.md](/Users/ayx106492/git/codexctl/PROJECT.md)
- [TASKS.md](/Users/ayx106492/git/codexctl/TASKS.md)

Detailed subsystem inventory:

- [tui-module-inventory.md](/Users/ayx106492/git/codexctl/docs/architecture/tui-module-inventory.md)

## Frontend Architecture Model

This TUI should follow a terminal-friendly **MVC / MVU hybrid**:

- **Models**
  - own durable state
  - own domain data
  - do not own color/layout decisions
- **Views**
  - compose components into screens
  - render from explicit model or view-model state
  - stay free of mutation and backend side effects
- **Controllers**
  - own user intent handling
  - translate keys, mouse, and commands into model mutations and backend actions
  - in Bubble Tea terms, this is primarily the `Update` / command layer
- **Components**
  - reusable UI building blocks such as tabs, menus, cards, explorer rows, and terminal panes
  - expose a small API to screens instead of forcing each screen to rebuild the same behavior
- **Presenters / View Models**
  - format raw API data into stable display-ready structures
  - keep screens from formatting backend data inline
- **Styles**
  - semantic tokens and component style builders
  - never hidden inside business logic

The intent is not to force textbook MVC for its own sake. The intent is:

- stable ownership
- reusable components
- predictable render behavior
- less regression risk
- easier AI and human maintenance

Rule:

- a screen should compose **views over components**
- a component should expose a **small interface**
- a controller should mutate **owned models**
- renderers should consume **models or view models**, not re-derive business state ad hoc

## Canvas + Blocks Paradigm

The preferred mental model for new UI work is:

- a **Canvas** is a full page or large surface
- a **Block** is a reusable UI unit placed on a Canvas grid
- a **Block** owns its own model, view, styling, and interaction contract
- a **Canvas** owns only composition, placement, and screen-specific wiring

This should feel more like Grafana or a dashboard builder than a pile of bespoke screen code.

Rule:

- do not hand-build a new screen by scattering panel rendering helpers around the screen file
- do build a new screen by placing reusable Blocks on a Canvas
- do keep the Block API small enough that another screen can place the same Block with no internal knowledge

Block design requirements:

- explicit placement on a grid
- explicit sizing behavior
- reusable styling through semantic style modules
- hover/click ownership through shared interaction infrastructure
- no duplicate panel chrome per screen

This is the preferred pattern for:

- telemetry panels
- milestones/release summaries
- timeseries charts
- tool/catalog cards
- workspace summaries
- future canvas widgets

Near-term proof points:

- workspace telemetry stats Block
- milestones Block
- future generic timeseries Block that can be stamped out multiple times on one Canvas

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

### 4.5. Define transport contracts at subsystem boundaries

Some subsystems deserve a transport/schema layer in addition to their in-process domain model.

This is especially true for:

- terminal event streams
- canvas scenes/widgets
- future plugin or MCP-provided UI resources
- telemetry/export pipelines

Rule:

- use protobuf or another explicit schema at **process and transport boundaries**
- keep in-process screen and component state as idiomatic Go domain models
- never let generated transport structs become the default UI model

Preferred shape:

- `proto/c9s/ui/v1/*.proto`
- domain models under `internal/tui/components/...` or `internal/tui/workspace/...`
- adapters between proto transport contracts and Go domain models

This gives us:

- stable event contracts
- future IPC/plugin boundaries
- reusable telemetry/export payloads
- cleaner modularity than stringly event blobs

### 5. Keep legacy code out of active files

Unused or superseded code should live under `internal/tui/dump/` until it is either recycled or deleted.

### 5.5. Add UI contracts between layout and rendering

We are still missing a thin contract layer between layout budgeting and rendered surfaces.

The recent regression came from breaking implicit assumptions:

- a one-line strip rendered multiple lines
- tab cells in a one-line header rendered as multi-line blocks
- a custom explorer renderer diverged from the stable sidebar sizing assumptions

Those rules need to become explicit.

Required surface contracts:

- single-line surfaces
  - top strip
  - bottom strip
  - project tab strip
  - file tab strip
  - canvas tab strip
- bounded panels
  - sidebar body
  - transcript body
  - editor body
- zone-owned interactive surfaces
  - rendered surfaces own their hitboxes
  - hitboxes must not be re-derived with parallel geometry when a zone-based surface already exists

Required tests:

- top strip renders exactly one line
- bottom strip renders exactly one line
- each tab strip renders exactly one line
- full workspace shell render matches requested terminal height
- no interactive component depends on guessed row math when it already owns a rendered zone

### 6. Prefer stable module boundaries over flat file sprawl

The current `internal/tui/*.go` layout is acceptable as a transition state, but it is not the best long-term shape once major subsystems stabilize.

Rule of thumb:

- split by file first while APIs are still moving quickly
- introduce subdirectories only when a subsystem has a clear owned model, render path, and event flow
- do not create a new package just to move files around cosmetically
- do create a package when it reduces duplicate logic, clarifies ownership, and gives us a small stable API

This repo should prefer a hybrid structure:

- top-level `internal/tui` keeps the root app shell, screen routing, and high-level composition
- stable subsystems graduate into subpackages such as:
  - `internal/tui/workspace`
  - `internal/tui/editor`
  - `internal/tui/components/tabs`
  - `internal/tui/components/picker`
  - `internal/tui/metrics`

Why:

- it is more AI-friendly because context is local to the subsystem directory
- it reduces the chance of re-implementing similar logic in parallel files
- it makes ownership clearer than a large flat directory with long file names
- it avoids premature package churn while designs are still settling

Anti-pattern to avoid:

- creating many tiny packages that force large exported surfaces and introduce import-cycle pressure

Target:

- a directory should represent one concept with a small, explicit API
- a file inside that directory should represent one concern inside that concept

Preferred naming/shape once stabilized:

- `internal/tui/<thing>/model.go`
- `internal/tui/<thing>/render.go`
- `internal/tui/<thing>/update.go`
- `internal/tui/<thing>/<subthing>.go`

For deeper subsystems:

- `internal/tui/<thing>/<subthing>/model.go`
- `internal/tui/<thing>/<subthing>/render.go`

This is preferred over endlessly extending flat names like:

- `workspace_shell_<subthing>_<detail>.go`

Use the flat style only as a temporary transition while the subsystem API is still moving.

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
- `workspace_shell_activity.go`
  - activity rail rendering and interaction
- `workspace_shell_tabs.go`
  - shared project/file/canvas tab rendering and hitbox semantics
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
- `workspace_shell_contracts_test.go`
  - render/layout invariants and regression guards
- future:
  - `workspace_shell_canvas.go`
  - `workspace_shell_git.go`
  - `workspace_shell_editor.go`
  - `workspace_shell_terminals.go`

### Protocol layer

- `proto/c9s/ui/v1/terminal.proto`
  - normalized terminal event transport contract
- future:
  - `proto/c9s/ui/v1/canvas.proto`
  - `proto/c9s/ui/v1/menu.proto`
  - `proto/c9s/ui/v1/metrics.proto`

Principle:

- protobuf is the transport contract
- the TUI component model is the domain contract
- adapters keep those layers from collapsing into each other

### Shared interaction layer

- `context_menu.go`
  - shared overlay menu model only
- future:
  - `components/menu/model.go`
  - `components/menu/render.go`
  - `components/menu/update.go`
  - `components/menu/items.go`

Principle:

- menu rows, tabs, cards, and picker rows should all use the same zone-owned surface pattern
- the rendered surface defines the hitbox
- hover and click behavior should come from the same shared interaction model, not separate guessed geometry
- screen-specific menus should extend shared app navigation instead of rebuilding `Home`, `Workspace`, `Tools`, and `Quit` independently

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

### `WorkspaceTerminalSurface`

Represents one interactive terminal surface:

- surface kind
- title
- session or command lane id
- scrollback
- input mode
- visible state

Why:

- prepares for agent terminal plus system terminal drawer/split behavior
- keeps IO and rendering ownership explicit

### `EditorBuffer`

Represents editable file state independently of the UI widget:

- text buffer
- cursor/selection
- undo history
- file metadata
- language id

Why:

- enables syntax highlighting, structured text transforms, and future prompt-driven mutations without coupling them to `textarea`

### `EditorHighlightPipeline`

Represents language-aware highlighting as a composable subsystem:

- language detector
- highlighter provider
- render adapter
- plugin capability hook
- fallback plain renderer

Why:

- avoids hardcoding per-language highlight logic directly into the workspace editor
- allows external tools/plugins to contribute highlighting or language services cleanly
- keeps future transforms, formatting, and semantic editing on the same buffer pipeline

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

### Phase 6: Editor and explorer architecture

- replace the file explorer’s ad hoc row interactions with a dedicated explorer row/view module
- introduce an `editor` subsystem directory once the current interfaces settle:
  - `internal/tui/editor/buffer.go`
  - `internal/tui/editor/detect.go`
  - `internal/tui/editor/highlight.go`
  - `internal/tui/editor/render_ansi.go`
  - `internal/tui/editor/plugins.go`
- define a plugin-facing capability model for:
  - syntax highlighting
  - formatting
  - diagnostics
  - code actions / transforms
- keep the current plain textarea path as fallback while the highlight path matures

Exit criteria:

- file explorer rendering and hitboxes are owned by one focused module
- editor highlighting is provider-based instead of hardcoded by extension in the workspace shell
- future editor features can be added through one editor subsystem boundary

### Phase 6: Editor architecture

- replace direct editor rendering with a modular pipeline:
  - buffer
  - language detection
  - syntax highlighter
  - renderer
  - editor view
- prefer a pluggable highlighter implementation instead of hardcoded token rules
- keep the rendering target abstract so terminal ANSI now and richer HTML later can share the same intermediate model
- support future prompt-side text transforms and mutations through the same buffer/model layer

Exit criteria:

- syntax highlighting is not hardcoded into the editor view
- text mutation features can operate on a shared editor buffer
- file highlighting can be swapped or extended without rewriting editor UI code

### Phase 7: Terminal architecture

- split terminal behavior into dedicated terminal surface modules
- model agent terminal and system pass-through terminal as separate but composable surfaces
- support a drawer or split layout where opening the system terminal resizes the main agent terminal instead of replacing it
- define clear IO ownership for:
  - user to agent
  - user to system
  - system output copied into agent-visible transcript when intended
- unify transcript, exec output, and future terminal widgets behind shared terminal surface abstractions where practical

Exit criteria:

- pass-through OS calls no longer depend on a small inline toggle
- dual-terminal layout is cleanly modeled instead of bolted into the composer row
- agent-visible and system-visible outputs have explicit routing semantics

## Best-Practice Gaps Still Open

- `app.go` still owns too many responsibilities
- workspace selection state is still spread across multiple fields
- transcript rendering still depends on raw strings more than structured rows
- context menu wiring is still repeated
- some screen navigation is still command-string driven instead of typed action driven
- `dump/` exists, but there is not yet a formal deletion policy
- tabs are still not fully owned by a single shared tab module
- the editor is still tied to direct `textarea` behavior instead of a proper code-editor pipeline
- terminal IO semantics are still too coupled to one workspace session surface

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
4. modularize tabs as one shared subsystem

### After that

1. introduce `WorkspaceGitContext`
2. introduce `WorkspaceSelection`
3. split canvas-specific workspace logic into its own file
4. design the editor buffer and syntax-highlighting pipeline
5. design the dual-terminal surface model and drawer/split UX

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
