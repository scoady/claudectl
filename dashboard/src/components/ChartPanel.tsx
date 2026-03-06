import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface ChartPanelProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  height?: number | string;
  delay?: number;
  actions?: ReactNode;
}

export default function ChartPanel({
  title,
  subtitle,
  children,
  height = 280,
  delay = 0,
  actions,
}: ChartPanelProps) {
  return (
    <motion.div
      className="glass-chart flex flex-col overflow-hidden"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: delay * 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {/* Whisper-light header overlay */}
      <div className="flex items-baseline justify-between px-4 pt-3 pb-1">
        <div className="flex items-baseline gap-3">
          <h3 className="text-[11px] font-light uppercase tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {title}
          </h3>
          {subtitle && (
            <p className="text-[10px] font-light" style={{ color: 'rgba(255,255,255,0.18)' }}>
              {subtitle}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {/* Chart area — the hero */}
      <div className="flex-1 px-1 pb-1" style={{ height }}>
        {children}
      </div>
    </motion.div>
  );
}
