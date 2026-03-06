import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type TimeRange = '15m' | '1h' | '6h' | '24h' | '7d';
export type RefreshInterval = 5000 | 10000 | 30000 | 0;

interface DashboardState {
  timeRange: TimeRange;
  setTimeRange: (tr: TimeRange) => void;
  refreshInterval: RefreshInterval;
  setRefreshInterval: (ri: RefreshInterval) => void;
  connected: boolean;
  setConnected: (c: boolean) => void;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

const timeRangeToSince: Record<TimeRange, string> = {
  '15m': '15m',
  '1h': '1h',
  '6h': '6h',
  '24h': '24h',
  '7d': '7d',
};

const timeRangeToResolution: Record<TimeRange, string> = {
  '15m': '15s',
  '1h': '1m',
  '6h': '5m',
  '24h': '30m',
  '7d': '4h',
};

export function getSince(tr: TimeRange) {
  return timeRangeToSince[tr];
}

export function getResolution(tr: TimeRange) {
  return timeRangeToResolution[tr];
}

const DashboardContext = createContext<DashboardState | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');
  const [refreshInterval, setRefreshInterval] = useState<RefreshInterval>(10000);
  const [connected, setConnected] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const toggleSidebar = useCallback(() => setSidebarOpen(prev => !prev), []);

  return (
    <DashboardContext.Provider
      value={{
        timeRange, setTimeRange,
        refreshInterval, setRefreshInterval,
        connected, setConnected,
        sidebarOpen, toggleSidebar,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error('useDashboard must be used inside DashboardProvider');
  return ctx;
}
