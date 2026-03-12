import {
  SceneTimeRange,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneVariableSet,
  CustomVariable,
  DataSourceVariable,
} from '@grafana/scenes';

export function getInfinityDsVariable() {
  return new DataSourceVariable({
    name: 'infinityDs',
    label: 'Infinity Datasource',
    pluginId: 'yesoreyeram-infinity-datasource',
  });
}

export function getInfinityDatasource() {
  return {
    type: 'yesoreyeram-infinity-datasource',
    uid: '${infinityDs}',
  };
}

export function getDefaultTimeRange() {
  return new SceneTimeRange({ from: 'now-1h', to: 'now' });
}

export function getTimeControls() {
  return [
    new SceneTimePicker({ isOnCanvas: true }),
    new SceneRefreshPicker({
      intervals: ['5s', '10s', '30s', '1m', '5m'],
      refresh: '10s',
      isOnCanvas: true,
    }),
  ];
}

/**
 * Build an Infinity JSON query object for SceneQueryRunner.
 * The Infinity data source expects a specific query shape.
 */
export function infinityJsonQuery(opts: {
  refId: string;
  url: string;
  columns?: Array<{ selector: string; text: string; type: string }>;
  rootSelector?: string;
  filterExpression?: string;
}) {
  return {
    refId: opts.refId,
    datasource: getInfinityDatasource(),
    type: 'json',
    source: 'url',
    url: opts.url,
    url_options: { method: 'GET' },
    parser: 'backend',
    root_selector: opts.rootSelector || '',
    columns: opts.columns || [],
    filterExpression: opts.filterExpression || '',
    format: 'table',
  };
}

/**
 * Build an Infinity JSON query for time series data.
 * Expects the API to return an array with time + value fields.
 */
export function infinityTimeSeriesQuery(opts: {
  refId: string;
  url: string;
  columns: Array<{ selector: string; text: string; type: string }>;
  rootSelector?: string;
}) {
  return {
    ...infinityJsonQuery(opts),
    format: 'timeseries',
  };
}

// ── Observability Datasources ───────────────────────────────────────────────

export function getTempoDatasource() {
  return { type: 'tempo', uid: 'tempo' };
}

export function getLokiDatasource() {
  return { type: 'loki', uid: 'loki' };
}

export function getPrometheusDatasource() {
  return { type: 'prometheus', uid: 'prometheus' };
}

/** Build a TraceQL query for the Tempo datasource. */
export function tempoTraceQLQuery(opts: { refId: string; query: string }) {
  return {
    refId: opts.refId,
    datasource: getTempoDatasource(),
    queryType: 'traceql',
    query: opts.query,
    limit: 20,
  };
}

/** Build a LogQL query for the Loki datasource. */
export function lokiLogQuery(opts: { refId: string; expr: string }) {
  return {
    refId: opts.refId,
    datasource: getLokiDatasource(),
    expr: opts.expr,
    queryType: 'range',
  };
}

/** Build a PromQL query for the Prometheus datasource. */
export function prometheusQuery(opts: {
  refId: string;
  expr: string;
  legendFormat?: string;
}) {
  return {
    refId: opts.refId,
    datasource: getPrometheusDatasource(),
    expr: opts.expr,
    legendFormat: opts.legendFormat || '',
  };
}
