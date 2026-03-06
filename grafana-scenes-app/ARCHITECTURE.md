# Grafana Scenes Control Center — Architecture & Handover Plan

## Vision

Transform the Grafana Scenes plugin from a passive dashboard into a full interactive SPA-like control center for AI agent orchestration. Mission control — not just monitoring, but managing projects, dispatching agents, communicating with them, browsing templates, and seeing killer visualizations.

## Current State

- **3 active tabs**: Agent Overview (Infinity DS), Control Center (custom React), Cost Explorer (Infinity DS)
- **12+ visual panels** built but disabled (constellation, steampunk, orbital, matrix, etc.)
- **3 unused SceneAppPage scenes** with drilldown patterns: `agentTimeline.ts`, `projectComparison.ts`, `realTimeMonitor.ts`
- Deployed via ConfigMap to kind-scoady cluster, Grafana 12.3.1

## Navigation Model

URL-routed pages via react-router inside `setRootPage(App)`:

```
/a/scoady-claudectl-app/                  → Mission Control (home)
/a/scoady-claudectl-app/projects          → Project Browser
/a/scoady-claudectl-app/projects/:name    → Project Detail (drilldown)
/a/scoady-claudectl-app/agents            → Agent Timeline + Table
/a/scoady-claudectl-app/agents/:id        → Agent Detail (drilldown)
/a/scoady-claudectl-app/control           → Control Center (ops view)
/a/scoady-claudectl-app/templates         → Template Library
/a/scoady-claudectl-app/templates/:id     → Template Detail (drilldown)
/a/scoady-claudectl-app/costs             → Cost Explorer
/a/scoady-claudectl-app/viz              → Visualization Gallery
```

## Key Screens

### Mission Control (Home)
- Stat row (Grafana VizPanels via Infinity)
- Interactive constellation (click agent → drill to detail)
- Live activity feed (WebSocket milestones)
- Agent activity time series (Grafana timeseries panel)
- Quick actions (dispatch, stop all)

### Project Browser → Detail
- Card grid of all projects with agent count, task summary
- Click → drilldown with tabs: Overview, Tasks, Agents, Workflow, Files

### Agent Timeline → Detail
- State timeline panel + table (already exists in agentTimeline.ts)
- Click → drilldown: live terminal output (WebSocket), milestone track, chat input, kill button

### Control Center (Ops View)
- Split pane: agent list (left) + detail/tasks (right)
- Dispatch modal, inject messages, kill agents
- Existing component — needs visual redesign for compactness

### Template Library → Detail
- Card grid of workflow templates from /api/templates
- Click → roles, config schema form, phase timeline, prompt preview
- Actions: "Apply to Project", "Create Project with Template"

### Visualization Gallery
- Thumbnail grid of all 12+ visual panels
- Click → Drawer opens with full-size canvas

## Shared Infrastructure

### `src/services/api.ts` — Centralized API client
All fetch calls consolidated. Pattern: `api.projects.list()`, `api.agents.kill(id)`, etc.

### `src/services/websocket.ts` — Singleton WebSocket manager
Event bus pattern. Multiple components subscribe without separate connections.
```typescript
agentWS.on('agent_stream', (data) => { ... });
agentWS.on('agent_milestone', (data) => { ... });
```

### `src/types.ts` — Shared TypeScript interfaces
All types in one place. Critical: Agent uses `session_id` (not `id`), `project_name` (not `project`), `turn_count` (not `turns`).

### `src/styles/theme.ts` — Design system
Colors, animations, glassmorphism mixins. Space theme: dark bg, cyan/purple neon accents, frosted glass panels.

## API Endpoints (actual response shapes)

```
GET /api/agents → [{ session_id, project_name, model, status, turn_count, milestones: string[], task, pid }]
GET /api/projects → [{ name, path, description, active_session_ids }]
GET /api/stats → { total_projects, total_agents, working_agents, idle_agents, uptime_seconds }
GET /api/projects/{name}/tasks → [{ id, title, status }]
GET /api/templates → [{ id, name, description, category, role_presets, config_schema, phases }]
POST /api/projects/{name}/dispatch → { task, model }
DELETE /api/agents/{session_id}
POST /api/agents/{session_id}/inject → { message }
WS /ws → agent_stream, agent_milestone, agent_spawned, agent_done events
```

## Panel Type Decisions

| View | Type | Why |
|------|------|-----|
| Stat panels, time series, pie charts | Grafana VizPanel + Infinity DS | Native time controls, thresholds, alerting |
| Constellation, visual panels | Custom SceneReactObject | Canvas animation, click interactivity |
| Control Center, Agent Detail | Custom SceneReactObject | WebSocket, mutations, complex state |
| Project/Template Browser | Custom SceneReactObject | Card layouts, action buttons |
| Project Detail | Hybrid | Stats (Grafana) + lists/actions (Custom) |

## OTel Integration (Phase 6)

Backend emits: Prometheus metrics (agent gauges/counters), Tempo traces (agent lifecycle spans), optional Loki logs.
Plugin: replace Infinity queries with Prometheus DS, add trace links to Tempo.

## Build Constraints

- Single chunk: `LimitChunkCountPlugin({ maxChunks: 1 })`
- AMD format for Grafana's SystemJS loader
- `@grafana/scenes` BUNDLED, core Grafana packages EXTERNALIZED
- ConfigMap deployment (delete+create, not apply)
- Rebuild: `cd grafana-scenes-app && rm -rf dist node_modules/.cache && npm run build`
- Deploy: delete ConfigMap → create ConfigMap → rollout restart grafana

## Phases

1. **Navigation Foundation** — Replace tab bar with URL routing
2. **Project Management** — Project browser + detail drilldown
3. **Agent Interactivity** — Enhanced detail, clickable constellation, chat
4. **Template Library** — Browse + detail + apply-to-project
5. **Viz Gallery** — Showcase visual panels with drawer expansion
6. **OTel Integration** — Backend instrumentation + Prometheus/Tempo
7. **Polish** — Unified theme, transitions, responsive layout
