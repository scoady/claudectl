import {
  SceneTimeRange,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneVariableSet,
  CustomVariable,
} from '@grafana/scenes';

export const INFINITY_DS_UID = 'P54F6429051492C34';

export function getInfinityDatasource() {
  return {
    type: 'yesoreyeram-infinity-datasource',
    uid: INFINITY_DS_UID,
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
