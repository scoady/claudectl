# Grafana Scenes Research for c9s Agent Platform

**Status**: Research Document
**Date**: March 6, 2026
**Scope**: c9s dashboard visualization layer
**Author**: Architecture Research

---

## Executive Summary

**Recommendation: Option D (Grafana + Infinity Data Source) for metrics, keep Remotion for cinematic views.**

Grafana Scenes **cannot run standalone** — it requires a full Grafana instance as its runtime host. It is a framework for building Grafana **app plugins**, not an embeddable charting library. The `@grafana/scenes` package has hard peer dependencies on `@grafana/runtime`, `@grafana/data`, `@grafana/ui`, and `@grafana/schema` (all `>=11.6`), which are only available inside a running Grafana environment.

For c9s, the most practical path to Prometheus/Grafana-quality dashboards is:

1. **Deploy Grafana to the kind cluster** via Helm (15 min setup)
2. **Use the Infinity data source plugin** to query c9s `/api/metrics/*` endpoints directly — no custom plugin needed
3. **Build dashboards in Grafana's native UI** with the space/constellation theme via custom CSS
4. **Embed panels** in the c9s TUI or web dashboard via iframe or Grafana's public dashboard feature
5. **Keep Remotion** for the cinematic animated compositions — Grafana cannot replicate particle effects, constellation animations, or SVG shooting stars

This gives us production-grade time series, gauges, tables, and stat panels with zero custom plugin code, while the existing Remotion pipeline handles the "wow factor" visuals.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   c9s Platform                       │
│                                                      │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  Go TUI  │  │ Remotion     │  │ Grafana       │  │
│  │ claudectl │  │ Dashboard    │  │ (kind cluster)│  │
│  │          │  │ (animations) │  │ (metrics)     │  │
│  └────┬─────┘  └──────┬───────┘  └───────┬───────┘  │
│       │               │                  │           │
│       └───────┬───────┘                  │           │
│               │                          │           │
│        ┌──────▼──────┐           ┌───────▼───────┐   │
│        │ FastAPI     │◄──────────┤ Infinity      │   │
│        │ Backend     │  HTTP/JSON│ Data Source    │   │
│        │ :4040       │           │ Plugin        │   │
│        └─────────────┘           └───────────────┘   │
│                                                      │
│  Endpoints queried by Grafana:                       │
│    /api/metrics/agents                               │
│    /api/metrics/costs                                │
│    /api/metrics/tasks                                │
│    /api/metrics/models                               │
│    /api/metrics/projects                             │
│    /api/metrics/health                               │
│    /api/metrics/summary                              │
└─────────────────────────────────────────────────────┘
```

---

## Option Analysis

### Option A: Grafana Scenes as Standalone React App

**Verdict: NOT POSSIBLE**

Grafana Scenes is **not** a standalone library. Key findings:

- **Peer dependencies**: `@grafana/runtime >=11.6`, `@grafana/data >=11.6`, `@grafana/ui >=11.6`, `@grafana/schema >=11.6`, `@grafana/e2e-selectors >=11.6`, `@grafana/i18n *`
- These packages provide the Grafana application shell, data source registry, panel rendering pipeline, and theme system — they expect to run **inside** a Grafana instance
- The `@grafana/runtime` package specifically provides `getBackendSrv()`, `getDataSourceSrv()`, and other services that only exist in a running Grafana context
- The docs explicitly state: "You must already know about building Grafana plugins before continuing"
- `SceneApp` renders at `/a/<PLUGIN_ID>` — a Grafana plugin URL
- `npx @grafana/create-plugin@latest` scaffolds a **Grafana plugin**, not a standalone app

| Criterion | Rating |
|-----------|--------|
| Setup complexity | Impossible (no standalone mode) |
| Visual quality | N/A |
| Real-time | N/A |
| Customization | N/A |
| Maintenance | N/A |

### Option B: Grafana App Plugin with Scenes

**Verdict: HIGH EFFORT, MODERATE VALUE**

Build a custom Grafana app plugin that renders c9s agent dashboards inside Grafana using the Scenes framework.

**How it works:**
- Scaffold with `npx @grafana/create-plugin@latest`
- Define scenes programmatically with `SceneQueryRunner`, `VizPanel`, layouts
- Register custom panels via `sceneUtils.registerRuntimePanelPlugin()`
- 20 built-in visualizations: time series, stat, gauge, bar chart, table, heatmap, node graph, etc.
- Custom React components can be embedded inside scene objects

**Pros:**
- Full programmatic control over dashboard layout
- Custom React components inside panels
- URL sync, drill-down navigation, variables all built-in
- Can register runtime panels without separate plugin.json

**Cons:**
- Requires Grafana instance deployed to cluster
- Must build and maintain a Grafana plugin (build toolchain, versioning, signing)
- Plugin must be rebuilt and redeployed for every dashboard change
- Grafana plugin development has a steep learning curve
- Still needs a data source (custom or Infinity) to query c9s API
- Cannot do particle effects, SVG animations, or constellation visuals

| Criterion | Rating |
|-----------|--------|
| Setup complexity | High (~2-3 days) |
| Visual quality | Good for charts, poor for animations |
| Real-time | Polling only (configurable refresh) |
| Customization | Deep (custom React panels) |
| Maintenance | Medium (plugin rebuild cycle) |

### Option C: Grafana + Custom Data Source Plugin

**Verdict: UNNECESSARY COMPLEXITY**

Build a custom Grafana data source plugin that translates c9s API responses into Grafana data frames.

**How it works:**
- Scaffold a backend data source plugin (Go) + frontend (TypeScript)
- Implement `QueryData()` in Go to call c9s endpoints and return data frames
- Configure in Grafana, then build standard dashboards

**Pros:**
- Clean abstraction — c9s becomes a first-class Grafana data source
- Enables alerting on c9s metrics via Grafana alerting

**Cons:**
- Must maintain both Go backend and TypeScript frontend for the plugin
- Plugin signing required for distribution
- The c9s API already returns JSON — a generic JSON data source does the same thing
- Overkill for an internal tool

| Criterion | Rating |
|-----------|--------|
| Setup complexity | Very high (~3-5 days) |
| Visual quality | Same as any Grafana dashboard |
| Real-time | Polling only |
| Customization | Limited to Grafana panel ecosystem |
| Maintenance | High (two codebases for the plugin) |

### Option D: Grafana + Infinity Data Source (RECOMMENDED)

**Verdict: BEST BANG FOR BUCK**

Deploy Grafana to the kind cluster, install the Infinity data source plugin, point it at c9s API endpoints. No custom code.

**How it works:**
- `helm install grafana grafana-community/grafana` with Infinity plugin pre-installed
- Configure Infinity data source with base URL `http://host.docker.internal:4040`
- Create dashboards in Grafana UI using JSON queries against `/api/metrics/*`
- Use JSONPath or JSONata to extract fields from responses
- Expose via ingress at `grafana.localhost`

**Infinity Data Source capabilities:**
- GET/POST/PATCH/PUT/DELETE HTTP methods
- JSONPath and JSONata query languages for field extraction
- Custom headers, auth (OAuth2, API keys, digest)
- Backend mode enables alerting, recorded queries, caching
- Template variable support with `${__from}` / `${__to}` time macros
- Supports JSON, CSV, XML, GraphQL, HTML responses

**Pros:**
- Zero custom plugin code
- 15-minute setup with Helm
- Full Grafana visualization library (time series, gauges, stats, tables, heatmaps, node graphs)
- Dashboard-as-code via Grafana provisioning or JSON export
- Alerting on c9s metrics for free
- Can embed panels via iframe or public dashboards
- Fits existing kind cluster + helm-platform infrastructure perfectly
- Infinity is actively maintained (unlike the deprecated JSON API plugin)

**Cons:**
- No WebSocket/streaming — polling only (min 1s refresh)
- Constellation/particle animations not possible in Grafana
- Theme customization limited to Grafana's theming system (dark mode + custom CSS overrides)
- Extra pod running in the cluster (~256MB RAM)

| Criterion | Rating |
|-----------|--------|
| Setup complexity | Low (~15-30 min) |
| Visual quality | Excellent for charts, N/A for animations |
| Real-time | Polling (1s minimum refresh) |
| Customization | Medium (Grafana themes + panel library) |
| Maintenance | Very low (just Grafana Helm upgrades) |

---

## Comparison with Current Remotion Approach

| Capability | Remotion (current) | Grafana + Infinity |
|------------|-------------------|-------------------|
| Time series charts | Recharts (manual) | Native, production-grade |
| Stat panels | Custom React | Native with sparklines |
| Gauges | Custom SVG | Native, multiple styles |
| Tables | Custom React | Native with sorting/filtering |
| Heatmaps | Not implemented | Native |
| Node graphs | Not implemented | Native (agent topology) |
| Particle effects | Yes (strength) | No |
| Constellation animation | Yes (strength) | No |
| Shooting stars | Yes (strength) | No |
| Space theme | Full control | CSS overrides only |
| Real-time updates | Polling + WS | Polling only |
| Alerting | Not built | Free with Grafana |
| Dashboard persistence | Manual JSON | Built-in |
| Setup effort | Already done | 30 min |
| Export/share | MP4/GIF via Remotion | PNG/PDF/link/embed |

**Key insight**: These are complementary, not competing. Remotion excels at cinematic animated experiences. Grafana excels at operational metrics dashboards. Use both.

---

## Recommended Architecture: Hybrid Approach

```
┌─────────────────────────────────────────────────┐
│                 c9s Dashboard                    │
│                                                  │
│  ┌───────────────────┐  ┌─────────────────────┐  │
│  │  Remotion Layer   │  │  Grafana Layer      │  │
│  │  (cinematic)      │  │  (operational)      │  │
│  │                   │  │                     │  │
│  │  - Constellation  │  │  - Agent count/cost │  │
│  │  - Star map       │  │  - Token usage      │  │
│  │  - Particle FX    │  │  - Task throughput  │  │
│  │  - Animated intros│  │  - Model breakdown  │  │
│  │  - Agent orbits   │  │  - Health status    │  │
│  │                   │  │  - Error rates      │  │
│  │  Vite + React     │  │  - Cost over time   │  │
│  │  localhost:5173   │  │                     │  │
│  └───────────────────┘  │  grafana.localhost   │  │
│                          │  (kind cluster)     │  │
│                          └─────────────────────┘  │
│                                                  │
│  Both query: FastAPI :4040 /api/metrics/*        │
└─────────────────────────────────────────────────┘
```

---

## Step-by-Step Setup Guide (Option D)

### 1. Add Grafana Helm Chart to helm-platform

```bash
# Add to ~/git/helm-platform/helm/grafana/values.yaml
cat <<'EOF' > ~/git/helm-platform/helm/grafana/values.yaml
replicas: 1

persistence:
  enabled: true
  size: 1Gi

plugins:
  - yesoreyeram-infinity-datasource

ingress:
  enabled: true
  ingressClassName: nginx
  hosts:
    - grafana.localhost

datasources:
  datasources.yaml:
    apiVersion: 1
    datasources:
      - name: c9s
        type: yesoreyeram-infinity-datasource
        access: proxy
        url: http://host.docker.internal:4040
        isDefault: true
        jsonData:
          auth_method: ""
          global_queries: []

dashboardProviders:
  dashboardproviders.yaml:
    apiVersion: 1
    providers:
      - name: default
        orgId: 1
        folder: c9s
        type: file
        options:
          path: /var/lib/grafana/dashboards/default

adminPassword: admin
EOF
```

### 2. Deploy Grafana

```bash
helm repo add grafana-community https://grafana-community.github.io/helm-charts
helm repo update
kubectl create namespace monitoring

helm install grafana grafana-community/grafana \
  -n monitoring \
  -f ~/git/helm-platform/helm/grafana/values.yaml
```

### 3. Add Ingress to /etc/hosts (or rely on kind-infra setup)

```bash
# If not already handled by kind-infra /etc/hosts setup:
echo "127.0.0.1 grafana.localhost" | sudo tee -a /etc/hosts
```

### 4. Create Agent Overview Dashboard

Example Infinity data source query configuration for an "Active Agents" stat panel:

```
Type: JSON
Source: URL
URL: /api/metrics/agents
Method: GET
Parser: Backend

Columns:
  - Selector: $.active_count    Type: Number    As: Active Agents
```

Example for a "Cost Over Time" time series panel:

```
Type: JSON
Source: URL
URL: /api/metrics/costs
Method: GET
Parser: Backend

Columns:
  - Selector: $.costs[*].timestamp    Type: Timestamp    As: Time
  - Selector: $.costs[*].total_usd    Type: Number       As: Cost (USD)
```

### 5. Embed in c9s (Optional)

Grafana panels can be embedded via:

**a) iframe embed (simplest):**
```html
<iframe
  src="http://grafana.localhost/d-solo/c9s-overview/agents?orgId=1&panelId=1"
  width="100%" height="300"
  frameborder="0">
</iframe>
```

**b) Public dashboards (no auth required):**
Enable in Grafana settings, generate a public URL for read-only access.

**c) Grafana Image Renderer (for TUI):**
Install the image renderer plugin to get PNG snapshots of panels via API — useful for the Go TUI:
```bash
# Add to plugins list in values.yaml
plugins:
  - yesoreyeram-infinity-datasource
  - grafana-image-renderer
```
Then fetch panel PNGs from Go:
```go
// Fetch rendered panel image for TUI display
url := "http://grafana.localhost/render/d-solo/c9s-overview/agents?panelId=1&width=800&height=400"
resp, err := http.Get(url)
```

---

## Grafana Scenes Specifics (for reference)

Even though we recommend Option D over Scenes, here are the technical details for completeness:

### Package Details
- **Package**: `@grafana/scenes` v7.1.2
- **Framework**: React 18 + RxJS 7.8
- **Layout**: Uses `react-grid-layout` internally (same as GridStack concept)
- **Peer deps**: `@grafana/data`, `@grafana/runtime`, `@grafana/ui`, `@grafana/schema`, `@grafana/e2e-selectors`, `@grafana/i18n` (all >=11.6)

### Cannot Run Standalone
The peer dependency on `@grafana/runtime` is the hard blocker. This package provides:
- `getBackendSrv()` — HTTP client that authenticates against Grafana backend
- `getDataSourceSrv()` — registry of configured data sources
- `getTemplateSrv()` — template variable interpolation
- Theme context, plugin context, user context

These services only exist inside a running Grafana instance. There is no mock/standalone provider.

### Scene Object Model
```typescript
// A scene is a tree of SceneObjects
const scene = new EmbeddedScene({
  $data: new SceneQueryRunner({
    datasource: { type: 'infinity', uid: 'c9s' },
    queries: [{ refId: 'A', type: 'json', url: '/api/metrics/agents' }],
  }),
  $timeRange: new SceneTimeRange({ from: 'now-1h', to: 'now' }),
  body: new SceneFlexLayout({
    children: [
      new SceneFlexItem({
        body: PanelBuilders.stat()
          .setTitle('Active Agents')
          .build(),
      }),
      new SceneFlexItem({
        body: PanelBuilders.timeseries()
          .setTitle('Cost Over Time')
          .build(),
      }),
    ],
  }),
});
```

### Custom React Panels (inside Grafana only)
```typescript
// Register a custom panel at runtime
sceneUtils.registerRuntimePanelPlugin({
  pluginId: 'c9s-constellation',
  plugin: new PanelPlugin(ConstellationPanel),
});

// Use it in a scene
new VizPanel({
  pluginId: 'c9s-constellation',
  title: 'Agent Constellation',
});
```

### 20 Built-in Panel Types
Bar chart, Bar gauge, Flame graph, Gauge, Geomap, Heatmap, Histogram, Logs, News, Node graph, Pie chart, Stat, State timeline, Status history, Table, Text, Time series, Trend, Traces, XY chart.

### Real-time
No native WebSocket support. Uses polling via `SceneQueryRunner` with configurable refresh intervals (minimum ~1 second). For agent streaming events, this is a limitation — you'd still need the Remotion/custom layer for live WebSocket feeds.

---

## Effort Estimates

| Task | Effort | Notes |
|------|--------|-------|
| Deploy Grafana to kind cluster | 30 min | Helm chart + ingress |
| Configure Infinity data source | 15 min | Point at c9s API |
| Build Agent Overview dashboard | 2 hrs | Stats, time series, tables |
| Build Cost Analysis dashboard | 1 hr | Cost breakdowns, model usage |
| Build Task Pipeline dashboard | 1 hr | Task status, throughput |
| Space theme CSS override | 2 hrs | Dark theme + custom colors |
| Panel embedding in c9s web | 1 hr | iframe integration |
| Image renderer for TUI | 2 hrs | PNG snapshots for Go TUI |
| **Total (Option D)** | **~1 day** | |
| | | |
| Grafana Scenes plugin (Option B) | 3-5 days | Plugin scaffolding, build pipeline, custom panels |
| Custom data source (Option C) | 3-5 days | Go backend + TS frontend plugin |

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Infinity plugin doesn't parse c9s JSON correctly | Medium | Test with actual endpoint responses; use JSONata for complex transforms |
| Grafana adds memory pressure to kind cluster | Low | Grafana uses ~256MB; cluster has headroom |
| Polling latency for real-time agent updates | Medium | Keep Remotion/WebSocket layer for live feeds; Grafana for historical metrics |
| Theme customization limitations | Low | Dark theme + CSS overrides get 80% of the way; constellation/particles stay in Remotion |
| Grafana version upgrades break Infinity | Low | Pin Helm chart version; Infinity is widely used and actively maintained |

---

## Conclusion

Grafana Scenes is an impressive framework but is definitively **not a standalone library** — it is a Grafana plugin development toolkit. For c9s, the highest-value path is:

1. **Deploy Grafana via Helm** to the existing kind cluster (Option D)
2. **Use Infinity data source** to query c9s `/api/metrics/*` endpoints with zero custom code
3. **Build operational dashboards** (agent stats, costs, task throughput, health) in Grafana's native UI
4. **Keep Remotion** for the cinematic constellation/particle/animation layer that Grafana cannot replicate
5. **Optionally embed** Grafana panels in the c9s web dashboard via iframes or render PNGs for the Go TUI

This hybrid approach gives you Prometheus/Grafana-quality metrics visualization in under a day of work, without abandoning the unique animated visualizations that make c9s distinctive.
