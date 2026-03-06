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
      className="glass glass-hover flex flex-col overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: delay * 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div>
          <h3 className="text-sm font-medium text-text">{title}</h3>
          {subtitle && <p className="text-xs text-dim mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="flex-1 px-2 pb-2" style={{ height }}>
        {children}
      </div>
    </motion.div>
  );
}
