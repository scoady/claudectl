import {
  EmbeddedScene,
  SceneFlexLayout,
  SceneFlexItem,
  SceneReactObject,
  SceneQueryRunner,
  SceneVariableSet,
  CustomVariable,
  VizPanel,
} from '@grafana/scenes';
import {
  getDefaultTimeRange,
  getTimeControls,
  getInfinityDatasource,
  getInfinityDsVariable,
  getTempoDatasource,
  getLokiDatasource,
  getPrometheusDatasource,
  infinityTimeSeriesQuery,
  tempoTraceQLQuery,
  lokiLogQuery,
  prometheusQuery,
} from './shared';
import { ObservabilityPanel } from '../components/ObservabilityPanel';

/**
 * Agent Trace Explorer Scene
 *
 * Layout:
 * Row 1: ObservabilityPanel — session picker + trace waterfall + agent output
 * Row 2: Tempo trace view (flamegraph/waterfall) + Loki correlated logs
 * Row 3: Prometheus OTel metrics — task duration, tool calls, throughput
 * Row 4: Infinity API metrics — cost + task throughput
 */
export function getTraceExplorerScene(): EmbeddedScene {
  // ── Tempo: Trace search for claudectl service ─────────────────────────────

  // Trace search — find recent traces from claudectl
  const traceSearchQuery = new SceneQueryRunner({
    datasource: getTempoDatasource(),
    queries: [
      tempoTraceQLQuery({
        refId: 'traceSearch',
        query: '{resource.service.name="claudectl"}',
      }),
    ],
  });

  // Trace detail — agent.session spans with tool calls
  const traceDetailQuery = new SceneQueryRunner({
    datasource: getTempoDatasource(),
    queries: [
      tempoTraceQLQuery({
        refId: 'traceDetail',
        query: '{resource.service.name="claudectl" && name="agent.session"}',
      }),
    ],
  });

  // ── Loki: Structured logs from claudectl ──────────────────────────────────

  const lokiLogsQuery = new SceneQueryRunner({
    datasource: getLokiDatasource(),
    queries: [
      lokiLogQuery({
        refId: 'logs',
        expr: '{service_name="claudectl"} | json',
      }),
    ],
  });

  // ── Prometheus: OTel metrics ──────────────────────────────────────────────

  const taskDurationQuery = new SceneQueryRunner({
    datasource: getPrometheusDatasource(),
    queries: [
      prometheusQuery({
        refId: 'p50',
        expr: 'histogram_quantile(0.5, sum(rate(scoady_duration_milliseconds_bucket{service_name="claudectl"}[5m])) by (le)) / 1000',
        legendFormat: 'p50 (HTTP)',
      }),
      prometheusQuery({
        refId: 'p95',
        expr: 'histogram_quantile(0.95, sum(rate(scoady_duration_milliseconds_bucket{service_name="claudectl"}[5m])) by (le)) / 1000',
        legendFormat: 'p95 (HTTP)',
      }),
      prometheusQuery({
        refId: 'p99',
        expr: 'histogram_quantile(0.99, sum(rate(scoady_duration_milliseconds_bucket{service_name="claudectl"}[5m])) by (le)) / 1000',
        legendFormat: 'p99 (HTTP)',
      }),
    ],
  });

  const toolCallsQuery = new SceneQueryRunner({
    datasource: getPrometheusDatasource(),
    queries: [
      prometheusQuery({
        refId: 'endpoints',
        expr: 'topk(10, sum by (span_name) (rate(scoady_calls_total{service_name="claudectl"}[5m])))',
        legendFormat: '{{span_name}}',
      }),
    ],
  });

  const turnsRateQuery = new SceneQueryRunner({
    datasource: getPrometheusDatasource(),
    queries: [
      prometheusQuery({
        refId: 'http_rate',
        expr: 'sum(rate(scoady_calls_total{service_name="claudectl"}[5m])) * 60',
        legendFormat: 'HTTP Requests / min',
      }),
      prometheusQuery({
        refId: 'error_rate',
        expr: 'sum(rate(scoady_calls_total{service_name="claudectl",status_code="STATUS_CODE_ERROR"}[5m])) * 60 or vector(0)',
        legendFormat: 'Errors / min',
      }),
    ],
  });

  const activeAgentsQuery = new SceneQueryRunner({
    datasource: getPrometheusDatasource(),
    queries: [
      prometheusQuery({
        refId: 'active',
        expr: 'claudectl_agents_active or vector(0)',
        legendFormat: 'Active Agents',
      }),
      prometheusQuery({
        refId: 'spanmetrics_rate',
        expr: 'sum(rate(scoady_calls_total{service_name="claudectl"}[5m])) or vector(0)',
        legendFormat: 'HTTP Requests / sec',
      }),
    ],
  });

  // ── Infinity API metrics ──────────────────────────────────────────────────

  const costQuery = new SceneQueryRunner({
    datasource: getInfinityDatasource(),
    queries: [
      infinityTimeSeriesQuery({
        refId: 'cost',
        url: '/api/metrics/costs',
        columns: [
          { selector: 'time', text: 'Time', type: 'timestamp' },
          { selector: 'cumulative', text: 'Cumulative', type: 'number' },
          { selector: 'incremental', text: 'Incremental', type: 'number' },
        ],
      }),
    ],
  });

  const taskMetricsQuery = new SceneQueryRunner({
    datasource: getInfinityDatasource(),
    queries: [
      infinityTimeSeriesQuery({
        refId: 'tasks',
        url: '/api/metrics/tasks',
        columns: [
          { selector: 'time', text: 'Time', type: 'timestamp' },
          { selector: 'started', text: 'Started', type: 'number' },
          { selector: 'completed', text: 'Completed', type: 'number' },
          { selector: 'failed', text: 'Failed', type: 'number' },
        ],
      }),
    ],
  });

  return new EmbeddedScene({
    $variables: new SceneVariableSet({ variables: [getInfinityDsVariable()] }),
    $timeRange: getDefaultTimeRange(),
    controls: getTimeControls(),
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        // ── Row 1: Session Picker + Trace Detail ────────────────────────────
        new SceneFlexItem({
          minHeight: 480,
          body: new SceneReactObject({
            component: ObservabilityPanel,
            props: {},
          }),
        }),

        // ── Row 2: Native Tempo Traces + Loki Logs ─────────────────────────
        new SceneFlexLayout({
          direction: 'row',
          children: [
            // Tempo: Trace list / flamegraph
            new SceneFlexItem({
              minHeight: 350,
              body: new VizPanel({
                title: 'Traces — agent.session spans (Tempo)',
                pluginId: 'traces',
                $data: traceDetailQuery,
                fieldConfig: { defaults: {}, overrides: [] },
                options: {},
              }),
            }),
            // Loki: Structured logs
            new SceneFlexItem({
              minHeight: 350,
              minWidth: 400,
              body: new VizPanel({
                title: 'Logs (Loki)',
                pluginId: 'logs',
                $data: lokiLogsQuery,
                fieldConfig: { defaults: {}, overrides: [] },
                options: {
                  showTime: true,
                  showLabels: true,
                  showCommonLabels: false,
                  wrapLogMessage: true,
                  prettifyLogMessage: false,
                  enableLogDetails: true,
                  sortOrder: 'Descending',
                  dedupStrategy: 'none',
                },
              }),
            }),
          ],
        }),

        // Tempo: Trace search table
        new SceneFlexItem({
          minHeight: 250,
          body: new VizPanel({
            title: 'Recent Traces (Tempo Search)',
            pluginId: 'table',
            $data: traceSearchQuery,
            fieldConfig: { defaults: {}, overrides: [] },
            options: {
              showHeader: true,
              sortBy: [{ displayName: 'Start time', desc: true }],
            },
          }),
        }),

        // ── Row 3: OTel Prometheus Metrics ──────────────────────────────────
        new SceneFlexLayout({
          direction: 'row',
          children: [
            // Active agents gauge
            new SceneFlexItem({
              minHeight: 250,
              body: new VizPanel({
                title: 'HTTP Traffic (Spanmetrics)',
                pluginId: 'timeseries',
                $data: activeAgentsQuery,
                fieldConfig: {
                  defaults: {
                    custom: { lineWidth: 2, fillOpacity: 15, spanNulls: true },
                  },
                  overrides: [
                    {
                      matcher: { id: 'byName', options: 'Active Agents' },
                      properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: '#00ffcc' } }],
                    },
                    {
                      matcher: { id: 'byName', options: 'HTTP Requests / sec' },
                      properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: '#7B61FF' } }],
                    },
                  ],
                },
                options: {
                  legend: { displayMode: 'list', placement: 'bottom' },
                  tooltip: { mode: 'multi', sort: 'desc' },
                },
              }),
            }),
            // Task duration histogram
            new SceneFlexItem({
              minHeight: 250,
              body: new VizPanel({
                title: 'HTTP Latency Percentiles (Spanmetrics)',
                pluginId: 'timeseries',
                $data: taskDurationQuery,
                fieldConfig: {
                  defaults: {
                    unit: 's',
                    custom: { lineWidth: 2, fillOpacity: 10, spanNulls: true },
                  },
                  overrides: [
                    {
                      matcher: { id: 'byName', options: 'p50' },
                      properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: '#00ffcc' } }],
                    },
                    {
                      matcher: { id: 'byName', options: 'p95' },
                      properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: '#ffaa00' } }],
                    },
                    {
                      matcher: { id: 'byName', options: 'p99' },
                      properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: '#ff4466' } }],
                    },
                  ],
                },
                options: {
                  legend: { displayMode: 'list', placement: 'bottom' },
                  tooltip: { mode: 'multi', sort: 'desc' },
                },
              }),
            }),
          ],
        }),

        new SceneFlexLayout({
          direction: 'row',
          children: [
            // Tool call rate
            new SceneFlexItem({
              minHeight: 250,
              body: new VizPanel({
                title: 'Endpoint Call Rate (Spanmetrics)',
                pluginId: 'timeseries',
                $data: toolCallsQuery,
                fieldConfig: {
                  defaults: {
                    custom: {
                      lineWidth: 2,
                      fillOpacity: 20,
                      drawStyle: 'bars',
                      stacking: { mode: 'normal' as any },
                    },
                    color: { mode: 'palette-classic' },
                  },
                  overrides: [],
                },
                options: {
                  legend: { displayMode: 'list', placement: 'bottom' },
                  tooltip: { mode: 'multi', sort: 'desc' },
                },
              }),
            }),
            // Throughput
            new SceneFlexItem({
              minHeight: 250,
              body: new VizPanel({
                title: 'Throughput (Spanmetrics)',
                pluginId: 'timeseries',
                $data: turnsRateQuery,
                fieldConfig: {
                  defaults: {
                    custom: { lineWidth: 2, fillOpacity: 15, spanNulls: true },
                  },
                  overrides: [
                    {
                      matcher: { id: 'byName', options: 'HTTP Requests / min' },
                      properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: '#7B61FF' } }],
                    },
                    {
                      matcher: { id: 'byName', options: 'Errors / min' },
                      properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: '#ff4466' } }],
                    },
                  ],
                },
                options: {
                  legend: { displayMode: 'list', placement: 'bottom' },
                  tooltip: { mode: 'multi', sort: 'desc' },
                },
              }),
            }),
          ],
        }),

        // ── Row 4: API Metrics (Cost + Tasks) ───────────────────────────────
        new SceneFlexLayout({
          direction: 'row',
          children: [
            // Cost
            new SceneFlexItem({
              minHeight: 250,
              body: new VizPanel({
                title: 'Cost Over Time',
                pluginId: 'timeseries',
                $data: costQuery,
                fieldConfig: {
                  defaults: {
                    unit: 'currencyUSD',
                    decimals: 4,
                    custom: { lineWidth: 2, fillOpacity: 15, spanNulls: true },
                  },
                  overrides: [
                    {
                      matcher: { id: 'byName', options: 'Cumulative' },
                      properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: '#FF6B6B' } }],
                    },
                    {
                      matcher: { id: 'byName', options: 'Incremental' },
                      properties: [
                        { id: 'color', value: { mode: 'fixed', fixedColor: '#ffaa00' } },
                        { id: 'custom.drawStyle', value: 'bars' },
                        { id: 'custom.fillOpacity', value: 40 },
                      ],
                    },
                  ],
                },
                options: {
                  legend: { displayMode: 'list', placement: 'bottom' },
                  tooltip: { mode: 'multi', sort: 'desc' },
                },
              }),
            }),
            // Task throughput
            new SceneFlexItem({
              minHeight: 250,
              body: new VizPanel({
                title: 'Task Throughput',
                pluginId: 'timeseries',
                $data: taskMetricsQuery,
                fieldConfig: {
                  defaults: {
                    custom: { lineWidth: 2, fillOpacity: 10, spanNulls: true },
                  },
                  overrides: [
                    {
                      matcher: { id: 'byName', options: 'Started' },
                      properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: '#3498db' } }],
                    },
                    {
                      matcher: { id: 'byName', options: 'Completed' },
                      properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: '#22cc88' } }],
                    },
                    {
                      matcher: { id: 'byName', options: 'Failed' },
                      properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: '#ff4466' } }],
                    },
                  ],
                },
                options: {
                  legend: { displayMode: 'list', placement: 'bottom' },
                  tooltip: { mode: 'multi', sort: 'desc' },
                },
              }),
            }),
          ],
        }),
      ],
    }),
  });
}
