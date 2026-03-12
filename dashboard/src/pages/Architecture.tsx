import { useState, lazy, Suspense } from 'react';
import { Player } from '@remotion/player';
import { OperatorArchitecture } from '../compositions/OperatorArchitecture';

const NasaMissionControl = lazy(() => import('../compositions/NasaMissionControl'));
const JarvisHUD = lazy(() => import('../compositions/JarvisHUD'));
const NuclearSCADA = lazy(() => import('../compositions/NuclearSCADA'));
const SubmarineCIC = lazy(() => import('../compositions/SubmarineCIC'));
const ATCRadar = lazy(() => import('../compositions/ATCRadar'));
const F1PitWall = lazy(() => import('../compositions/F1PitWall'));
const SurgicalTheater = lazy(() => import('../compositions/SurgicalTheater'));
const StarshipBridge = lazy(() => import('../compositions/StarshipBridge'));
const DroneCommand = lazy(() => import('../compositions/DroneCommand'));
const TradingTerminal = lazy(() => import('../compositions/TradingTerminal'));

const themes = [
  { id: 'operator', label: 'Constellation', subtitle: 'Event-driven orchestration', icon: '◈', component: OperatorArchitecture, accent: '#67e8f9' },
  { id: 'nasa', label: 'Mission Control', subtitle: 'Apollo-era CRT telemetry', icon: '🚀', component: NasaMissionControl, accent: '#33ff66' },
  { id: 'jarvis', label: 'JARVIS HUD', subtitle: 'Holographic interface', icon: '💠', component: JarvisHUD, accent: '#00d4ff' },
  { id: 'nuclear', label: 'Nuclear SCADA', subtitle: 'Reactor control room', icon: '☢', component: NuclearSCADA, accent: '#ffaa00' },
  { id: 'submarine', label: 'Submarine CIC', subtitle: 'Sonar tactical display', icon: '🔱', component: SubmarineCIC, accent: '#00ff88' },
  { id: 'atc', label: 'ATC Radar', subtitle: 'Air traffic control', icon: '📡', component: ATCRadar, accent: '#00ff66' },
  { id: 'f1', label: 'F1 Pit Wall', subtitle: 'Race telemetry wall', icon: '🏎', component: F1PitWall, accent: '#ff0044' },
  { id: 'surgery', label: 'Surgical Theater', subtitle: 'Patient monitoring suite', icon: '💓', component: SurgicalTheater, accent: '#00ff88' },
  { id: 'starship', label: 'Starship Bridge', subtitle: 'LCARS tactical display', icon: '✦', component: StarshipBridge, accent: '#ff9933' },
  { id: 'drone', label: 'Drone Command', subtitle: 'UAV ground control', icon: '🎯', component: DroneCommand, accent: '#00ff44' },
  { id: 'trading', label: 'Trading Terminal', subtitle: 'Bloomberg-style desk', icon: '📊', component: TradingTerminal, accent: '#ff8800' },
];

export default function Architecture() {
  const [activeTheme, setActiveTheme] = useState('operator');
  const theme = themes.find((t) => t.id === activeTheme) || themes[0];

  return (
    <div className="flex flex-col gap-3 h-full">
      {themes.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
          {themes.map((t) => {
            const isActive = t.id === activeTheme;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTheme(t.id)}
                className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-300"
                style={{
                  background: isActive ? `rgba(${hexToRgba(t.accent, 0.12)})` : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isActive ? t.accent + '40' : 'rgba(255,255,255,0.06)'}`,
                  color: isActive ? t.accent : 'rgba(255,255,255,0.4)',
                  boxShadow: isActive ? `0 0 20px ${t.accent}15` : 'none',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 16 }}>{t.icon}</span>
                <div className="text-left">
                  <div className="text-xs font-semibold" style={{ letterSpacing: 0.5 }}>{t.label}</div>
                  <div className="text-[9px]" style={{ opacity: 0.6 }}>{t.subtitle}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
      <div
        className="flex-1 rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(0,0,0,0.3)',
          border: `1px solid ${theme.accent}14`,
          minHeight: 500,
        }}
      >
        <Suspense fallback={
          <div className="flex items-center justify-center h-full" style={{ color: 'rgba(255,255,255,0.3)' }}>
            <span className="text-sm">Loading composition...</span>
          </div>
        }>
          <Player
            key={theme.id}
            component={theme.component}
            compositionWidth={1920}
            compositionHeight={1080}
            durationInFrames={300}
            fps={30}
            style={{ width: '100%', height: '100%' }}
            controls
            loop
            autoPlay
          />
        </Suspense>
      </div>
    </div>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return `255, 255, 255, ${alpha}`;
  return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}, ${alpha}`;
}
