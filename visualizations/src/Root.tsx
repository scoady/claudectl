import React from 'react';
import { Composition, Still } from 'remotion';
import { AgentConstellation } from './compositions/AgentConstellation';
import { MetricsTimeline } from './compositions/MetricsTimeline';
import { CostTracker } from './compositions/CostTracker';
import { ProjectHeatmap } from './compositions/ProjectHeatmap';
import { LiveDashboard } from './compositions/LiveDashboard';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Agent Constellation — animated star field of agents */}
      <Composition
        id="AgentConstellation"
        component={AgentConstellation}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />

      {/* Metrics Timeline — animated line chart */}
      <Composition
        id="MetricsTimeline"
        component={MetricsTimeline}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={400}
      />

      {/* Cost Tracker — animated donut chart */}
      <Composition
        id="CostTracker"
        component={CostTracker}
        durationInFrames={300}
        fps={30}
        width={800}
        height={800}
      />

      {/* Project Heatmap — activity grid */}
      <Composition
        id="ProjectHeatmap"
        component={ProjectHeatmap}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={600}
      />

      {/* Live Dashboard — full composite view */}
      <Composition
        id="LiveDashboard"
        component={LiveDashboard}
        durationInFrames={600}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
