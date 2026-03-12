import RemotionPanel from '../components/RemotionPanel';
import { AuroraPianoRoll } from '../compositions/AuroraPianoRoll';
import { AuroraMixer } from '../compositions/AuroraMixer';
import { AuroraArrange } from '../compositions/AuroraArrange';

export default function Studio() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-text tracking-wide">Aurora Studio</h1>
          <p className="text-xs text-dim mt-0.5">MIDI analysis &amp; DAW visualizations</p>
        </div>
      </div>

      {/* Piano Roll + Chord Intelligence */}
      <RemotionPanel
        component={AuroraPianoRoll}
        inputProps={{
          title: 'AURORA PIANO ROLL',
          currentChord: 'Em9',
          chordQuality: 'minor ninth',
          bpm: 120,
          progression: ['Em9', 'Am7', 'D7', 'Gmaj7', 'Cmaj9', 'F#ø7', 'B7'],
        }}
        title="Piano Roll"
        subtitle="Chord intelligence + MIDI visualizer"
        width={1920}
        height={800}
        durationInFrames={300}
        fps={30}
        delay={0}
        borderColor="rgba(103, 232, 249, 0.15)"
        className="h-[420px]"
      />

      {/* Mixer Console */}
      <RemotionPanel
        component={AuroraMixer}
        inputProps={{
          title: 'AURORA MIXER',
          bpm: 120,
        }}
        title="Mixer"
        subtitle="Channel strips + spectrum analyzer"
        width={1920}
        height={800}
        durationInFrames={300}
        fps={30}
        delay={1}
        borderColor="rgba(45, 212, 191, 0.15)"
        className="h-[420px]"
      />

      {/* Arrangement View */}
      <RemotionPanel
        component={AuroraArrange}
        inputProps={{
          title: 'AURORA ARRANGE',
          barCount: 32,
          trackCount: 8,
        }}
        title="Arrangement"
        subtitle="Timeline + clip visualization"
        width={1920}
        height={800}
        durationInFrames={300}
        fps={30}
        delay={2}
        borderColor="rgba(167, 139, 250, 0.15)"
        className="h-[420px]"
      />
    </div>
  );
}
