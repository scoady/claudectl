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
  getInfinityDsVariable,
  getTempoDatasource,
  getPrometheusDatasource,
  tempoTraceQLQuery,
  prometheusQuery,
} from './shared';
import { AgentTraceWaterfall } from '../components/AgentTraceWaterfall';

/**
 * Agent Traces Scene — focused on the enriched OTel span attributes
 *
 * Layout:
 * Row 1: Dispatch events table + Agent sessions table (Tempo)
 * Row 2: Tool call breakdown by type (Tempo) + Agent resumes
 * Row 3: Dispatch/Session/Resume rates + Tool call rate by type
 * Row 4: Duration percentiles (session vs tool) + Error rates
 */
export function getAgentTracesScene(): EmbeddedScene {
  // ── Dispatch events — the parent span for each agent spawn ──────────────
  const dispatchQuery = new SceneQueryRunner({
    datasource: getTempoDatasource(),
    queries: [
      tempoTraceQLQuery({
        refId: 'dispatches',
        query: '{resource.service.name="claudectl" && name="dispatch"}',
      }),
    ],
  });

  // ── Agent sessions — searchable by project, model, controller status ────
  const agentSessionsQuery = new SceneQueryRunner({
    datasource: getTempoDatasource(),
    queries: [
      tempoTraceQLQuery({
        refId: 'sessions',
        query: '{resource.service.name="claudectl" && name="agent.session"}',
      }),
    ],
  });

  // ── Agent resumes — follow-up injections ────────────────────────────────
  const agentResumesQuery = new SceneQueryRunner({
    datasource: getTempoDatasource(),
    queries: [
      tempoTraceQLQuery({
        refId: 'resumes',
        query: '{resource.service.name="claudectl" && name="agent.resume"}',
      }),
    ],
  });

  // ── Tool calls by type — using the enriched tool.{name} spans ──────────
  const toolReadQuery = new SceneQueryRunner({
    datasource: getTempoDatasource(),
    queries: [
      tempoTraceQLQuery({
        refId: 'toolRead',
        query: '{resource.service.name="claudectl" && name=~"tool..*"}',
      }),
    ],
  });

  // ── Prometheus: spanmetrics for enriched spans ─────────────────────────

  // Dispatch rate
  const dispatchRateQuery = new SceneQueryRunner({
    datasource: getPrometheusDatasource(),
    queries: [
      prometheusQuery({
        refId: 'dispatch_rate',
        expr: 'sum(rate(scoady_calls_total{service_name="claudectl",span_name="dispatch"}[5m])) * 60 or vector(0)',
        legendFormat: 'Dispatches / min',
      }),
      prometheusQuery({
        refId: 'session_rate',
        expr: 'sum(rate(scoady_calls_total{service_name="claudectl",span_name="agent.session"}[5m])) * 60 or vector(0)',
        legendFormat: 'Sessions / min',
      }),
      prometheusQuery({
        refId: 'resume_rate',
        expr: 'sum(rate(scoady_calls_total{service_name="claudectl",span_name="agent.resume"}[5m])) * 60 or vector(0)',
        legendFormat: 'Resumes / min',
      }),
    ],
  });

  // Tool call rate by tool type
  const toolRateQuery = new SceneQueryRunner({
    datasource: getPrometheusDatasource(),
    queries: [
      prometheusQuery({
        refId: 'tool_rate',
        expr: 'topk(10, sum by (span_name) (rate(scoady_calls_total{service_name="claudectl",span_name=~"tool..*"}[5m]))) * 60',
        legendFormat: '{{span_name}}',
      }),
    ],
  });

  // Session duration percentiles
  const sessionDurationQuery = new SceneQueryRunner({
    datasource: getPrometheusDatasource(),
    queries: [
      prometheusQuery({
        refId: 'p50_session',
        expr: 'histogram_quantile(0.5, sum(rate(scoady_duration_milliseconds_bucket{service_name="claudectl",span_name="agent.session"}[5m])) by (le)) / 1000',
        legendFormat: 'p50 Session',
      }),
      prometheusQuery({
        refId: 'p95_session',
        expr: 'histogram_quantile(0.95, sum(rate(scoady_duration_milliseconds_bucket{service_name="claudectl",span_name="agent.session"}[5m])) by (le)) / 1000',
        legendFormat: 'p95 Session',
      }),
      prometheusQuery({
        refId: 'p50_tool',
        expr: 'histogram_quantile(0.5, sum(rate(scoady_duration_milliseconds_bucket{service_name="claudectl",span_name=~"tool..*"}[5m])) by (le)) / 1000',
        legendFormat: 'p50 Tool Call',
      }),
      prometheusQuery({
        refId: 'p95_tool',
        expr: 'histogram_quantile(0.95, sum(rate(scoady_duration_milliseconds_bucket{service_name="claudectl",span_name=~"tool..*"}[5m])) by (le)) / 1000',
        legendFormat: 'p95 Tool Call',
      }),
    ],
  });

  // Error spans
  const errorQuery = new SceneQueryRunner({
    datasource: getPrometheusDatasource(),
    queries: [
      prometheusQuery({
        refId: 'session_errors',
        expr: 'sum(rate(scoady_calls_total{service_name="claudectl",span_name="agent.session",status_code="STATUS_CODE_ERROR"}[5m])) * 60 or vector(0)',
        legendFormat: 'Session Errors / min',
      }),
      prometheusQuery({
        refId: 'tool_errors',
        expr: 'sum(rate(scoady_calls_total{service_name="claudectl",span_name=~"tool..*",status_code="STATUS_CODE_ERROR"}[5m])) * 60 or vector(0)',
        legendFormat: 'Tool Errors / min',
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
        // ── Row 0: Steampunk Trace Waterfall (custom viz) ─────────────────
        new SceneFlexItem({
          minHeight: 120,
          body: new SceneReactObject({
            component: AgentTraceWaterfall,
            props: {},
          }),
        }),

        // ── Row 1: Dispatch + Session trace tables ─────────────────────────
        new SceneFlexLayout({
          direction: 'row',
          children: [
            new SceneFlexItem({
              minHeight: 300,
              body: new VizPanel({
                title: 'Dispatch Events (Tempo)',
                description: 'Parent spans linking dispatch requests to downstream agent sessions',
                pluginId: 'table',
                $data: dispatchQuery,
                fieldConfig: { defaults: {}, overrides: [] },
                options: {
                  showHeader: true,
                  sortBy: [{ displayName: 'Start time', desc: true }],
                },
              }),
            }),
            new SceneFlexItem({
              minHeight: 300,
              body: new VizPanel({
                title: 'Agent Sessions (Tempo)',
                description: 'agent.session spans with project, model, task attributes',
                pluginId: 'table',
                $data: agentSessionsQuery,
                fieldConfig: { defaults: {}, overrides: [] },
                options: {
                  showHeader: true,
                  sortBy: [{ displayName: 'Start time', desc: true }],
                },
              }),
            }),
          ],
        }),

        // ── Row 2: Tool calls trace table + Resumes ───────────────────────
        new SceneFlexLayout({
          direction: 'row',
          children: [
            new SceneFlexItem({
              minHeight: 300,
              body: new VizPanel({
                title: 'Tool Calls (Tempo)',
                description: 'tool.{name} spans with description, file path, command attributes',
                pluginId: 'table',
                $data: toolReadQuery,
                fieldConfig: { defaults: {}, overrides: [] },
                options: {
                  showHeader: true,
                  sortBy: [{ displayName: 'Start time', desc: true }],
                },
              }),
            }),
            new SceneFlexItem({
              minHeight: 300,
              body: new VizPanel({
                title: 'Agent Resumes (Tempo)',
                description: 'Follow-up injection spans (--resume sessions)',
                pluginId: 'table',
                $data: agentResumesQuery,
                fieldConfig: { defaults: {}, overrides: [] },
                options: {
                  showHeader: true,
                  sortBy: [{ displayName: 'Start time', desc: true }],
                },
              }),
            }),
          ],
        }),

        // ── Row 3: Dispatch + Session rates (Spanmetrics) ─────────────────
        new SceneFlexLayout({
          direction: 'row',
          children: [
            new SceneFlexItem({
              minHeight: 280,
              body: new VizPanel({
                title: 'Agent Lifecycle Rate',
                description: 'Dispatch, session, and resume throughput from spanmetrics',
                pluginId: 'timeseries',
                $data: dispatchRateQuery,
                fieldConfig: {
                  defaults: {
                    custom: { lineWidth: 2, fillOpacity: 15, spanNulls: true },
                  },
                  overrides: [
                    {
                      matcher: { id: 'byName', options: 'Dispatches / min' },
                      properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: '#FF6B6B' } }],
                    },
                    {
                      matcher: { id: 'byName', options: 'Sessions / min' },
                      properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: '#00ffcc' } }],
                    },
                    {
                      matcher: { id: 'byName', options: 'Resumes / min' },
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
            new SceneFlexItem({
              minHeight: 280,
              body: new VizPanel({
                title: 'Tool Call Rate by Type',
                description: 'Per-tool throughput: tool.Read, tool.Bash, tool.Edit, etc.',
                pluginId: 'timeseries',
                $data: toolRateQuery,
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
          ],
        }),

        // ── Row 4: Duration percentiles + Error rates ─────────────────────
        new SceneFlexLayout({
          direction: 'row',
          children: [
            new SceneFlexItem({
              minHeight: 280,
              body: new VizPanel({
                title: 'Duration Percentiles (Session vs Tool)',
                description: 'Agent session and tool call latency from spanmetrics histograms',
                pluginId: 'timeseries',
                $data: sessionDurationQuery,
                fieldConfig: {
                  defaults: {
                    unit: 's',
                    custom: { lineWidth: 2, fillOpacity: 10, spanNulls: true },
                  },
                  overrides: [
                    {
                      matcher: { id: 'byName', options: 'p50 Session' },
                      properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: '#00ffcc' } }],
                    },
                    {
                      matcher: { id: 'byName', options: 'p95 Session' },
                      properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: '#ffaa00' } }],
                    },
                    {
                      matcher: { id: 'byName', options: 'p50 Tool Call' },
                      properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: '#7B61FF' } }],
                    },
                    {
                      matcher: { id: 'byName', options: 'p95 Tool Call' },
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
            new SceneFlexItem({
              minHeight: 280,
              body: new VizPanel({
                title: 'Error Rate (Sessions + Tools)',
                description: 'Errored spans from agent sessions and tool calls',
                pluginId: 'timeseries',
                $data: errorQuery,
                fieldConfig: {
                  defaults: {
                    custom: { lineWidth: 2, fillOpacity: 15, spanNulls: true },
                  },
                  overrides: [
                    {
                      matcher: { id: 'byName', options: 'Session Errors / min' },
                      properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: '#ff4466' } }],
                    },
                    {
                      matcher: { id: 'byName', options: 'Tool Errors / min' },
                      properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: '#ffaa00' } }],
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
