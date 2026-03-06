import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, ChevronDown } from 'lucide-react';
import { useDashboard, type RefreshInterval } from '../context/DashboardContext';

const options: { label: string; value: RefreshInterval }[] = [
  { label: '5s', value: 5000 },
  { label: '10s', value: 10000 },
  { label: '30s', value: 30000 },
  { label: 'Off', value: 0 },
];

export default function RefreshPicker() {
  const { refreshInterval, setRefreshInterval } = useDashboard();
  const [open, setOpen] = useState(false);

  const current = options.find((o) => o.value === refreshInterval)!;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-bg-surface/80 text-subtext hover:text-text border border-transparent hover:border-cyan/20 transition-all duration-200"
      >
        <RefreshCw
          size={12}
          className={refreshInterval > 0 ? 'animate-spin' : ''}
          style={{ animationDuration: '3s' }}
        />
        {current.label}
        <ChevronDown size={10} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute top-full right-0 mt-1 glass py-1 min-w-[80px] z-50"
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setRefreshInterval(opt.value); setOpen(false); }}
                className={`w-full px-3 py-1.5 text-xs text-left hover:bg-bg-surface-1 transition-colors ${
                  opt.value === refreshInterval ? 'text-cyan' : 'text-subtext'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
