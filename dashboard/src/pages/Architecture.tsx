import { Player } from '@remotion/player';
import { OperatorArchitecture } from '../compositions/OperatorArchitecture';

export default function Architecture() {
  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
          Operator Architecture
        </h1>
        <span className="text-xs" style={{ color: 'rgba(103, 232, 249, 0.5)' }}>
          Event-driven agent orchestration
        </span>
      </div>

      <div
        className="flex-1 rounded-2xl overflow-hidden"
        style={{
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(103, 232, 249, 0.08)',
          minHeight: 500,
        }}
      >
        <Player
          component={OperatorArchitecture}
          compositionWidth={1920}
          compositionHeight={1080}
          durationInFrames={300}
          fps={30}
          style={{ width: '100%', height: '100%' }}
          controls
          loop
          autoPlay
        />
      </div>
    </div>
  );
}
