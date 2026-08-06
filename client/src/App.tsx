import { useMemo } from 'react';
import Sequencer from './components/Sequencer/Sequencer';
import TransportBar from './components/Transport/TransportBar';
import { FALLBACK_INSTRUMENTS } from './audio/fallbackCatalog';
import { useInstruments } from './hooks/useInstruments';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useProject } from './hooks/useProject';
import { useSampler } from './hooks/useSampler';
import { createStarterProject } from './state/project';
import './App.css';

function App() {
  const catalog = useInstruments();
  const initialProject = useMemo(() => createStarterProject(FALLBACK_INSTRUMENTS), []);
  const [project, actions] = useProject(initialProject);
  const sampler = useSampler(project, catalog.instruments);

  useKeyboardShortcuts({
    togglePlay: sampler.togglePlay,
    rewind: sampler.rewind,
    toggleLoop: () => actions.setLoop(!project.loop),
  });

  const status = catalog.loading
    ? 'Loading instruments…'
    : catalog.source === 'server'
      ? 'Samples loaded from the server'
      : 'Offline — playing built-in synth instruments';

  return (
    <div className="app">
      <header className="app-header">
        <h1>Music Sampler</h1>
        <span className="app-status" title={catalog.reason}>
          {status}
        </span>
      </header>

      <TransportBar
        project={project}
        isPlaying={sampler.isPlaying}
        onTogglePlay={sampler.togglePlay}
        onRewind={sampler.rewind}
        onSetLoop={actions.setLoop}
        onSetBpm={actions.setBpm}
        onSetSwing={actions.setSwing}
        onSetMasterVolume={actions.setMasterVolume}
      />

      <Sequencer
        project={project}
        instruments={catalog.instruments}
        currentStep={sampler.currentStep}
        onToggleStep={actions.toggleStep}
        onSetNote={actions.setTrackNote}
        onSetTrackVolume={actions.setTrackVolume}
        onToggleMute={actions.toggleMute}
        onToggleSolo={actions.toggleSolo}
        onMoveTrack={actions.moveTrack}
        onRemoveTrack={actions.removeTrack}
        onAudition={sampler.audition}
        onSetSteps={actions.setSteps}
        onAddInstrument={actions.addInstrument}
        onClearAll={actions.clearAll}
      />
    </div>
  );
}

export default App;
