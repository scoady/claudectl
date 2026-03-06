import { motion } from 'framer-motion';

interface StatusDotProps {
  status: 'healthy' | 'degraded' | 'down' | 'connected' | 'disconnected' | 'running' | 'done' | 'error' | 'pending' | 'idle' | 'active';
  size?: number;
  label?: string;
}

const statusColors: Record<string, string> = {
  healthy: '#34d399',
  connected: '#34d399',
  running: '#34d399',
  active: '#34d399',
  done: '#60a5fa',
  degraded: '#fbbf24',
  pending: '#fbbf24',
  idle: '#6b7280',
  down: '#fb7185',
  disconnected: '#fb7185',
  error: '#fb7185',
};

export default function StatusDot({ status, size = 8, label }: StatusDotProps) {
  const color = statusColors[status] || '#6b7280';
  const isAlive = ['healthy', 'connected', 'running', 'active'].includes(status);

  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative inline-flex" style={{ width: size, height: size }}>
        {isAlive && (
          <motion.span
            className="absolute inset-0 rounded-full"
            style={{ backgroundColor: color, opacity: 0.4 }}
            animate={{ scale: [1, 2, 1], opacity: [0.4, 0, 0.4] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
        <span
          className="relative inline-flex rounded-full"
          style={{ width: size, height: size, backgroundColor: color }}
        />
      </span>
      {label && <span className="text-xs text-subtext capitalize">{label}</span>}
    </span>
  );
}
