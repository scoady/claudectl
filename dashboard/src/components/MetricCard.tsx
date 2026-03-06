import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
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
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? '#34d399' : trend === 'down' ? '#fb7185' : '#6b7280';

  return (
    <motion.div
      className="glass glass-hover p-4 flex flex-col gap-2 min-w-0"
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay: delay * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ borderColor: `${color}40` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-subtext uppercase tracking-wider">{title}</span>
        {icon && <span style={{ color }} className="opacity-60">{icon}</span>}
      </div>

      <div className="flex items-end gap-3">
        <motion.span
          className="text-2xl font-semibold text-text"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: delay * 0.08 + 0.2 }}
        >
          {value}
        </motion.span>
        {trend && (
          <span className="flex items-center gap-1 text-xs pb-0.5" style={{ color: trendColor }}>
            <TrendIcon size={12} />
            {trendValue}
          </span>
        )}
      </div>

      {subtitle && <span className="text-xs text-dim">{subtitle}</span>}

      {sparkline && sparkline.length > 0 && (
        <div className="h-8 -mx-1 mt-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkline}>
              <defs>
                <linearGradient id={`grad-${title.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={1.5}
                fill={`url(#grad-${title.replace(/\s/g, '')})`}
                dot={false}
                animationDuration={800}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  );
}
