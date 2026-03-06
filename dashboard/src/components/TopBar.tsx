import { Menu } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import TimeRangePicker from './TimeRangePicker';
import RefreshPicker from './RefreshPicker';
import StatusDot from './StatusDot';

export default function TopBar() {
  const { connected, toggleSidebar } = useDashboard();

  return (
    <header className="h-12 flex items-center justify-between px-4 border-b border-muted/30 bg-bg-primary/80 backdrop-blur-md z-30 shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-md hover:bg-bg-surface-1 text-subtext hover:text-text transition-colors"
        >
          <Menu size={18} />
        </button>

        <div className="flex items-center gap-2">
          {/* c9s logo */}
          <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold"
            style={{
              background: 'linear-gradient(135deg, #67e8f9, #c084fc)',
              color: '#0a0a1a',
            }}
          >
            c9s
          </div>
          <span className="text-sm font-semibold text-text tracking-tight">Metrics Dashboard</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <TimeRangePicker />
        <RefreshPicker />
        <StatusDot
          status={connected ? 'connected' : 'disconnected'}
          label={connected ? 'Live' : 'Offline'}
        />
      </div>
    </header>
  );
}
