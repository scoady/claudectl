import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import type { TimeSeriesPoint } from '../lib/api';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
  sparkline?: TimeSeriesPoint[];
  color?: string;
  icon?: React.ReactNode;
  delay?: number;
}

export default function MetricCard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  sparkline,
  color = '#67e8f9',
  icon,
  delay = 0,
}: MetricCardProps) {
  const trendColor = trend === 'up' ? '#34d399' : trend === 'down' ? '#fb7185' : 'rgba(255,255,255,0.2)';

  return (
    <motion.div
      className="glass-metric px-4 py-3 flex flex-col gap-1.5 min-w-0"
      style={{ '--accent-color': color } as React.CSSProperties}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: delay * 0.06, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {/* Title row — whisper weight */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-light uppercase tracking-[0.15em]" style={{ color: 'rgba(255,255,255,0.3)' }}>
          {title}
        </span>
        {icon && <span style={{ color, opacity: 0.35 }} className="scale-90">{icon}</span>}
      </div>

      {/* Value — the hero */}
      <div className="flex items-end gap-2">
        <motion.span
          className="text-2xl font-light tracking-tight"
          style={{ color: 'rgba(255,255,255,0.9)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: delay * 0.06 + 0.3, duration: 0.5 }}
        >
          {value}
        </motion.span>
        {trend && trendValue && (
          <span className="flex items-center gap-0.5 text-[10px] font-light pb-1" style={{ color: trendColor }}>
            {trend === 'up' ? <TrendingUp size={10} /> : trend === 'down' ? <TrendingDown size={10} /> : null}
            {trendValue}
          </span>
        )}
      </div>

      {subtitle && <span className="text-[10px] font-light" style={{ color: 'rgba(255,255,255,0.2)' }}>{subtitle}</span>}

      {/* Sparkline — floats below */}
      {sparkline && sparkline.length > 0 && (
        <div className="h-7 -mx-2 mt-0.5">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkline}>
              <defs>
                <linearGradient id={`sg-${title.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={1}
                strokeOpacity={0.6}
                fill={`url(#sg-${title.replace(/\s/g, '')})`}
                dot={false}
                animationDuration={1200}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  );
}
