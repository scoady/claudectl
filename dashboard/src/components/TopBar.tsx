import { Menu } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import TimeRangePicker from './TimeRangePicker';
import RefreshPicker from './RefreshPicker';
import StatusDot from './StatusDot';

export default function TopBar() {
  const { connected, toggleSidebar } = useDashboard();

  return (
    <header className="glass-topbar h-10 flex items-center justify-between px-4 z-30 shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="p-1 rounded-lg transition-all duration-300"
          style={{ color: 'rgba(255,255,255,0.25)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.25)'; }}
        >
          <Menu size={16} />
        </button>

        {/* Logo — minimal */}
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-medium tracking-[0.2em] uppercase"
            style={{
              background: 'linear-gradient(135deg, #67e8f9, #c084fc)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 8px rgba(103, 232, 249, 0.2))',
            }}
          >
            c9s
          </span>
          <span className="text-[11px] font-extralight tracking-wide" style={{ color: 'rgba(255,255,255,0.3)' }}>
            metrics
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
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
