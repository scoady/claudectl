# TUI Module Inventory

## Purpose

This document lists the TUI subsystems that should become explicit modules instead of continuing to live as scattered helper functions across `internal/tui`.

It is the detailed companion to:

- [tui-refactor-plan.md](/Users/ayx106492/git/codexctl/docs/architecture/tui-refactor-plan.md)
- [PROJECT.md](/Users/ayx106492/git/codexctl/PROJECT.md)
- [TASKS.md](/Users/ayx106492/git/codexctl/TASKS.md)

## Architectural Stance

The frontend should be organized as a **terminal-native MVC / MVU hybrid**:

- **Models**
  - own durable state and domain data
- **Views**
  - compose screens from reusable components
- **Controllers**
  - translate input and backend results into model mutations and commands
- **Components**
  - reusable building blocks with narrow interfaces
- **Presenters / View Models**
  - shape backend data for rendering
- **Styles**
  - semantic tokens and component style builders

In practical terms:

- Bubble Tea `Update` functions behave like controllers
- Bubble Tea `View` functions behave like views
- screen and component structs behave like models
- presenter helpers behave like view-model mappers

Goal:

- no screen should need to know how a component works internally
- no component should need to know how the whole app routes screens
- no style token should be re-declared inside business logic

## Preferred Package / Directory Shape

Target shape once subsystems stabilize:

```text
internal/tui/
  app/
    model.go
    update.go
    navigation.go
    overlays.go
  style/
    theme.go
    workspace.go
    home.go
    menu.go
  interaction/
    zones.go
    mouse.go
    focus.go
  components/
    blocks/
    menu/
    tabs/
    cards/
    terminal/
    explorer/
  workspace/
    model.go
    route.go
    layout.go
    view.go
    controller.go
    presenters.go
    explorer/
    terminal/
    editor/
    canvas/
    git/
    transcript/
  testutil/
    frame.go
    harness.go
```

This is preferred over adding more flat files like:

- `workspace_shell_<subthing>_<detail>.go`

Use flat files only as a transition state until the subsystem API is clear.

## Immediate Refactor Candidates

### 0. Canvas / Blocks Composition Layer

**Why**

- we want pages to be composed from reusable building blocks instead of bespoke panel code
- this is the missing layer that makes new UI fast to build without copy-pasting layout logic
- the same telemetry, milestone, chart, and summary blocks should be placeable on multiple screens

**Target**

```text
internal/tui/components/blocks/types.go
internal/tui/components/blocks/style.go
internal/tui/components/blocks/view.go
internal/tui/components/blocks/telemetry.go
internal/tui/components/blocks/milestones.go
```

**Owned types**

- `Canvas`
- `Placement`
- `Block`
- `Header`
- `Sizing`
- `TelemetryBlock`
- `MilestonesBlock`

**Public API**

- `NewCanvas(columns, gap, blocks...)`
- `RenderCanvas(...)`
- `RenderCard(...)`
- `TelemetryBlock.View(...)`
- `MilestonesBlock.View(...)`

**Rule**

- screens place Blocks on a Canvas
- screens do not rebuild card chrome or row layout themselves

These are the strongest candidates to become explicit modules next.

### 1. Workspace Route Module

**Why**

- route state is still split across `DockMode`, `FocusPane`, selected tabs, editor flags, and project state
- screen transitions and workspace transitions are still too easy to break

**Current sources**

- `internal/tui/workspace_shell_model.go`
- `internal/tui/workspace_shell_selection.go`
- `internal/tui/workspace_shell.go`
- `internal/tui/app_workspace.go`
- `internal/tui/app_workspace_keys.go`

**Target**

```text
internal/tui/workspace/route.go
internal/tui/workspace/selection.go
internal/tui/workspace/controller.go
```

**Owned types**

- `WorkspaceRoute`
- `WorkspaceSelection`
- `WorkspaceFocusState`

**Public API**

- `SetDock(mode)`
- `SetProject(name)`
- `SetCanvas(name)`
- `SetFocus(pane)`
- `ResetForProjectChange()`
- `ResetForDockChange()`

### 2. Workspace Explorer Component

**Why**

- explorer behavior is currently smeared across:
  - model state
  - list rebuilding
  - row rendering
  - git badge logic
  - mouse hit-testing
  - app-level click handling
- this is the exact case where a reusable component boundary should exist

**Current sources**

- `internal/tui/workspace_shell_explorer.go`
- `internal/tui/workspace_shell_explorer_view.go`
- `internal/tui/workspace_shell.go`
- `internal/tui/app_workspace.go`
- `internal/tui/app_workspace_keys.go`

**Target**

```text
internal/tui/workspace/explorer/model.go
internal/tui/workspace/explorer/view.go
internal/tui/workspace/explorer/controller.go
internal/tui/workspace/explorer/types.go
```

**Owned types**

- `ExplorerModel`
- `ExplorerItem`
- `ExplorerAction`
- `ExplorerViewModel`

**Public API**

- `SetEntries(dir, entries)`
- `SetGitContext(ctx)`
- `Items()`
- `Selected()`
- `Move(delta)`
- `Select(index)`
- `ActivateSelected()`
- `ContextBaseDir()`
- `HandleMouse(msg)`
- `View(width, height, mouse)`

**Rule**

- the app should talk to the explorer through its API
- the app should not know how explorer rows are built or hit-tested

### 3. Terminal Surface Component

**Why**

- agent chat and system pass-through should be instances of the same terminal surface concept
- only the backend / IO behavior should differ
- this is the exact reusable constructor-style pattern we want elsewhere too
- terminal events should use one typed domain model and one explicit transport contract instead of ad hoc strings and slices

**Current sources**

- `internal/tui/workspace_terminal_blocks.go`
- `internal/tui/workspace_shell_render.go`
- `internal/tui/workspace_shell_session.go`
- `internal/tui/app_workspace.go`
- `internal/tui/app_workspace_update.go`

**Target**

```text
internal/tui/components/terminal/model.go
internal/tui/components/terminal/view.go
internal/tui/components/terminal/controller.go
internal/tui/components/terminal/backend.go
internal/tui/components/terminal/log.go
internal/tui/components/terminal/types.go
proto/c9s/ui/v1/terminal.proto
```

**Owned types**

- `TerminalSurface`
- `TerminalBackend`
- `TerminalSurfaceConfig`
- `TerminalSurfaceState`
- `TerminalEvent`
- `EventLog`
- `EventAudience`
- `EventSource`
- `EventKind`

**Backends**

- `AssistantBackend`
- `SystemExecBackend`

**Public API**

- `NewTerminalSurface(config, backend)`
- `SetSize(w, h)`
- `SetFocused(bool)`
- `AppendLine(...)`
- `AppendChunk(...)`
- `Clear()`
- `Submit(input)`
- `Viewport()`
- `View(mouse)`

**Transport rule**

- terminal component owns the Go domain event model
- `proto/c9s/ui/v1/terminal.proto` owns the transport contract
- adapters translate between them
- renderers/controllers should not depend directly on generated proto structs

**Rule**

- the workspace screen should place terminal surfaces on a grid
- it should not own terminal-specific rendering or IO details

### 4. Editor Module

**Why**

- editor behavior is currently mixed into workspace session logic
- input ergonomics, buffer state, undo history, save state, and future syntax highlighting need a dedicated home

**Current sources**

- `internal/tui/workspace_shell_session.go`
- `internal/tui/workspace_shell_render.go`
- `internal/tui/app_workspace_update.go`
- `internal/tui/app_workspace_keys.go`
- `internal/tui/editor_highlight_types.go`

**Target**

```text
internal/tui/workspace/editor/model.go
internal/tui/workspace/editor/controller.go
internal/tui/workspace/editor/view.go
internal/tui/workspace/editor/highlight.go
internal/tui/workspace/editor/buffer.go
```

**Owned types**

- `EditorModel`
- `EditorBuffer`
- `EditorMutation`
- `EditorViewModel`
- `SyntaxHighlighter`

**Public API**

- `OpenFile(path, content)`
- `SetSize(w, h)`
- `HandleKey(msg)`
- `Saveable()`
- `Dirty()`
- `Value()`
- `Undo()`
- `Copy()`
- `Paste()`
- `Highlight(language)`
- `View()`

### 5. Transcript / Conversation Module

**Why**

- transcript ordering, streamed rows, thinking rows, tool rows, local system rows, and pending user rows already form a distinct model
- rendering bugs often come from mixing transcript data shaping with terminal rendering

**Current sources**

- `internal/tui/workspace_shell_transcript.go`
- `internal/tui/workspace_shell_presenters.go`
- `internal/tui/workspace_shell_session.go`

**Target**

```text
internal/tui/workspace/transcript/model.go
internal/tui/workspace/transcript/view.go
internal/tui/workspace/transcript/presenter.go
```

**Owned types**

- `TranscriptModel`
- `TranscriptRow`
- `TranscriptStreamState`

**Public API**

- `SetMessages(messages)`
- `AppendPendingUser(text)`
- `AppendThinking(status)`
- `AppendChunk(text)`
- `AppendTool(label)`
- `FinishTurn(status)`
- `Rows()`
- `PlainText()`
- `Render(width)`

### 6. Tab Component

**Why**

- project tabs, file tabs, and canvas tabs still share semantics but not a fully stable implementation boundary
- hitbox bugs have repeatedly come from tabs

**Current sources**

- `internal/tui/workspace_shell_tabs.go`
- `internal/tui/workspace_shell_render.go`
- `internal/tui/app_workspace.go`

**Target**

```text
internal/tui/components/tabs/model.go
internal/tui/components/tabs/view.go
internal/tui/components/tabs/controller.go
```

**Owned types**

- `TabsModel`
- `TabItem`
- `TabAction`

**Public API**

- `SetItems(items)`
- `SetActive(id)`
- `Layout(width)`
- `HandleMouse(msg)`
- `View(mouse)`

### 7. Project Picker Component

**Why**

- picker sizing, row rendering, selection, hover, and click behavior should not live inside the workspace screen

**Current sources**

- `internal/tui/workspace_shell_picker.go`
- `internal/tui/app_workspace.go`

**Target**

```text
internal/tui/components/picker/model.go
internal/tui/components/picker/view.go
internal/tui/components/picker/controller.go
```

**Owned types**

- `PickerModel`
- `PickerItem`
- `PickerAction`

**Public API**

- `Open(items)`
- `Close()`
- `Move(delta)`
- `Selected()`
- `HandleMouse(msg)`
- `View(width, height, mouse)`

### 8. Canvas Module

**Why**

- canvas is already large enough to deserve its own boundary
- it has its own tabs, widgets, renderers, data lifecycle, and future web/render integration

**Current sources**

- `internal/tui/workspace_shell_render.go`
- `internal/tui/workspace_shell.go`
- `internal/tui/canvas_screen.go`
- `internal/tui/workspace_shared.go`

**Target**

```text
internal/tui/workspace/canvas/model.go
internal/tui/workspace/canvas/view.go
internal/tui/workspace/canvas/controller.go
internal/tui/workspace/canvas/widgets.go
```

### 9. Git Context Module

**Why**

- branch, provider, remote, status aggregation, and explorer footer state already form a distinct domain

**Current sources**

- `internal/tui/workspace_shell_git.go`
- `internal/tui/workspace_shell_explorer.go`
- `internal/tui/workspace_shell_render.go`

**Target**

```text
internal/tui/workspace/git/model.go
internal/tui/workspace/git/presenter.go
```

## Cross-Cutting Shared Modules

These are not workspace-only, and should become shared building blocks.

### 10. Style System

**Why**

- style tokens are still too scattered
- style changes should not require editing business logic files

**Current sources**

- `internal/tui/style/workspace.go`
- `internal/tui/styles.go`
- `internal/tui/themes.go`
- various render files

**Target**

```text
internal/tui/style/theme.go
internal/tui/style/workspace.go
internal/tui/style/home.go
internal/tui/style/menu.go
internal/tui/style/components.go
```

### 11. Menu System

**Why**

- menus are still partly centralized and partly screen-local
- we need a single menu framework with per-screen menus extending it

**Current sources**

- `internal/tui/context_menu.go`
- `internal/tui/app_menus.go`
- `internal/tui/menu_navigation.go`
- `internal/tui/menu_home.go`

**Target**

```text
internal/tui/components/menu/model.go
internal/tui/components/menu/view.go
internal/tui/components/menu/controller.go
internal/tui/components/menu/navigation.go
```

### 12. Interaction / Zones Module

**Why**

- hitbox bugs have repeatedly come from not centralizing zone-owned surface behavior
- hover, click, focus, and mouse-motion rules need a shared home

**Current sources**

- `internal/tui/zone_runtime.go`
- `internal/tui/zone_card.go`
- `internal/tui/app_workspace_hitboxes.go`
- component-local zone helpers

**Target**

```text
internal/tui/interaction/zones.go
internal/tui/interaction/mouse.go
internal/tui/interaction/focus.go
```

### 13. Dashboard / Home Module

**Why**

- home is becoming a proper product entry point, not a placeholder screen
- it needs the same component/view/controller discipline as workspace

**Current sources**

- `internal/tui/dashboard.go`
- `internal/tui/app_home.go`
- shared zone card helpers

**Target**

```text
internal/tui/home/model.go
internal/tui/home/view.go
internal/tui/home/controller.go
internal/tui/home/hero.go
```

### 14. Clipboard Service

**Why**

- transcript copy, editor copy, and future paste/import behaviors should not each shell out or call clipboard APIs independently

**Current sources**

- `internal/tui/clipboard.go`
- transcript/editor command paths

**Target**

```text
internal/tui/services/clipboard.go
```

### 15. Test Harness / UI Contracts

**Why**

- layout regressions are too easy to introduce
- we need screen contracts plus scripted journeys

**Current sources**

- `internal/tui/testutil/frame.go`
- `internal/tui/app_workspace_smoke_test.go`
- `internal/tui/workspace_shell_contracts_test.go`

**Target**

```text
internal/tui/testutil/frame.go
internal/tui/testutil/harness.go
internal/tui/testutil/journey.go
```

## App-Level Candidates

These should remain higher in the tree but still be split into explicit domains.

### 16. App Navigation / Router

**Why**

- `app.go` still carries too much routing knowledge

**Target**

```text
internal/tui/app/navigation.go
internal/tui/app/router.go
internal/tui/app/model.go
```

### 17. App Overlays

**Why**

- create-project, inject, dispatch, confirm, palette, help, and menus are a coherent overlay domain

**Target**

```text
internal/tui/app/overlays.go
internal/tui/app/overlay_router.go
```

### 18. App Data Refresh / Background Work

**Why**

- periodic refresh, websocket streaming, metrics refresh, and tool refresh should not all live in one app control surface

**Target**

```text
internal/tui/app/data.go
internal/tui/app/stream.go
internal/tui/app/background.go
```

## Priority Order

### Phase 1: Highest-value boundaries

1. `workspace/explorer`
2. `components/terminal`
3. `workspace/editor`
4. `components/tabs`
5. `style/*`

### Phase 2: Screen and data structure cleanup

6. `workspace/route`
7. `workspace/transcript`
8. `workspace/canvas`
9. `workspace/git`
10. `components/menu`

### Phase 3: App shell cleanup

11. `home/*`
12. `interaction/*`
13. `app/navigation`
14. `app/overlays`
15. `testutil/harness`

## Code Convention Implications

When adding new UI behavior:

- prefer extending an existing component module over adding a new ad hoc helper
- prefer new files inside a concept directory over adding another long flat filename
- prefer `Model`, `View`, `Controller`, `Presenter`, `Style`, and `Config` types with clear roles
- prefer constructor/config patterns for reusable components
- do not re-implement the same semantics in a second screen file
- do not hide styles inside state mutation code
- do not hide hitbox logic outside the component that renders the surface

## Practical Rule For Future Sessions

Before adding a feature, ask:

1. Is there already a component that should own this?
2. Is this state local to a component, a screen, or the whole app?
3. Does this need a style token instead of an inline color?
4. Does this belong in a controller instead of a render path?
5. Am I re-implementing behavior that should be shared?

If the answer to 5 is yes, stop and extract the shared module first.
