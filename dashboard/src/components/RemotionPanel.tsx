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
}: RemotionPanelProps<T>) {
  return (
    <motion.div
      className={`glass-remotion flex flex-col ${className}`}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.8, delay: delay * 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {/* Title floats as ghostly overlay */}
      {(title || subtitle) && (
        <div className="absolute top-3 left-4 z-10 flex items-baseline gap-3">
          {title && (
            <span className="text-[10px] font-light uppercase tracking-[0.15em]" style={{ color: 'rgba(103, 232, 249, 0.4)' }}>
              {title}
            </span>
          )}
          {subtitle && (
            <span className="text-[9px] font-light" style={{ color: 'rgba(255,255,255,0.15)' }}>
              {subtitle}
            </span>
          )}
        </div>
      )}

      {/* The animation IS the panel */}
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
