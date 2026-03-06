import { motion } from 'framer-motion';
import { useDashboard, type TimeRange } from '../context/DashboardContext';

const ranges: TimeRange[] = ['15m', '1h', '6h', '24h', '7d'];

export default function TimeRangePicker() {
  const { timeRange, setTimeRange } = useDashboard();

  return (
    <div className="flex items-center gap-1 p-0.5 rounded-lg bg-bg-surface/80">
      {ranges.map((r) => (
        <button
          key={r}
          onClick={() => setTimeRange(r)}
          className="relative px-3 py-1 text-xs font-medium rounded-md transition-colors duration-200"
          style={{ color: timeRange === r ? '#0a0a1a' : '#94a3b8' }}
        >
          {timeRange === r && (
            <motion.div
              layoutId="time-range-indicator"
              className="absolute inset-0 rounded-md"
              style={{ background: 'linear-gradient(135deg, #67e8f9, #c084fc)' }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative z-10">{r}</span>
        </button>
      ))}
    </div>
  );
}
