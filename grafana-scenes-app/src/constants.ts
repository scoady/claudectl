export const PLUGIN_ID = 'scoady-claudectl-app';
export const PLUGIN_BASE_URL = `/a/${PLUGIN_ID}`;

// The Infinity data source configured in Grafana pointing to claude-manager API
export const INFINITY_DS = {
  type: 'yesoreyeram-infinity-datasource',
  uid: '${DS_CLAUDE_MANAGER}',
};

// We'll resolve the actual UID at runtime
export function getInfinityDsUid(): { type: string; uid: string } {
  return {
    type: 'yesoreyeram-infinity-datasource',
    uid: 'PBFA97CFB0B386A0B', // Will be overridden by variable
  };
}
