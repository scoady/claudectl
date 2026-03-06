import { Player } from '@remotion/player';
import { AgentConstellation, type ConstellationAgent } from '../compositions/AgentConstellation';
import { useMetrics } from '../hooks/useMetrics';
import { mockAgents, type Agent as LibAgent } from '../lib/api';

function mapToConstellation(agents: LibAgent[]): ConstellationAgent[] {
  return agents.map((a) => ({
    id: a.id,
    project: a.project,
    status: a.status === 'running' ? 'working' : a.status,
    model: a.model,
    isController: false,
  }));
}

export default function ConstellationBg() {
  const { data: agents } = useMetrics<LibAgent[]>(
    async () => {
      try {
        const r = await fetch('/api/agents');
        if (!r.ok) throw new Error('fail');
        return await r.json();
      } catch {
        return mockAgents();
      }
    },
    15000,
    mockAgents,
  );
  const constellationAgents = agents ? mapToConstellation(agents) : undefined;

  return (
    <>
      {/* Remotion constellation — always animating behind everything */}
      <div className="fixed inset-0 z-0 opacity-[0.18] pointer-events-none">
        <Player
          component={AgentConstellation}
          inputProps={{ agents: constellationAgents, showLabels: false, showTitle: false }}
          durationInFrames={600}
          fps={30}
          compositionWidth={1920}
          compositionHeight={1080}
          style={{ width: '100%', height: '100%' }}
          loop
          autoPlay
          controls={false}
        />
      </div>

      {/* Vignette for depth */}
      <div
        className="fixed inset-0 z-[1] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(10, 10, 26, 0.75) 100%)',
        }}
      />
    </>
  );
}
