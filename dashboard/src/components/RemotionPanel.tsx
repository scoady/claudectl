import { Player } from '@remotion/player';
import { motion } from 'framer-motion';
import type { ComponentType } from 'react';

interface RemotionPanelProps<T extends Record<string, unknown>> {
  component: ComponentType<T>;
  inputProps: T;
  title?: string;
  subtitle?: string;
  width?: number;
  height?: number;
  durationInFrames?: number;
  fps?: number;
  className?: string;
  delay?: number;
  borderColor?: string;
  aspectRatio?: string;
}

export default function RemotionPanel<T extends Record<string, unknown>>({
  component,
  inputProps,
  title,
  subtitle,
  width = 1920,
  height = 400,
  durationInFrames = 300,
  fps = 30,
  className = '',
  delay = 0,
  borderColor = 'rgba(103, 232, 249, 0.15)',
}: RemotionPanelProps<T>) {
  return (
    <motion.div
      className={`glass glass-hover overflow-hidden flex flex-col ${className}`}
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay: delay * 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
      style={{ borderColor }}
    >
      {(title || subtitle) && (
        <div className="flex items-baseline justify-between px-4 pt-3 pb-1">
          {title && (
            <h3 className="text-xs font-semibold tracking-wider uppercase text-cyan">
              {title}
            </h3>
          )}
          {subtitle && <span className="text-[10px] text-dim font-mono">{subtitle}</span>}
        </div>
      )}
      <div className="flex-1 min-h-0">
        <Player
          component={component}
          inputProps={inputProps}
          durationInFrames={durationInFrames}
          fps={fps}
          compositionWidth={width}
          compositionHeight={height}
          style={{ width: '100%', height: '100%' }}
          loop
          autoPlay
          controls={false}
        />
      </div>
    </motion.div>
  );
}
