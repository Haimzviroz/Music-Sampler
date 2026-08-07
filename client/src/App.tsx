import { useMemo } from 'react';
import ProjectBar from './components/ProjectBar/ProjectBar';
import SaveIndicator from './components/SaveIndicator/SaveIndicator';
import Sequencer from './components/Sequencer/Sequencer';
import TransportBar from './components/Transport/TransportBar';
import { FALLBACK_INSTRUMENTS } from './audio/fallbackCatalog';
import { useInstruments } from './hooks/useInstruments';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useProject } from './hooks/useProject';
import { useProjectSync } from './hooks/useProjectSync';
import { useSampler } from './hooks/useSampler';
import { createStarterProject } from './state/project';
import './App.css';

function App() {
  const catalog = useInstruments();
  const initialProject = useMemo(() => createStarterProject(FALLBACK_INSTRUMENTS), []);
  const [project, actions] = useProject(initialProject);
  const sampler = useSampler(project, catalog.instruments);
  const sync = useProjectSync(project, catalog.instruments, actions.replace);

  useKeyboardShortcuts({
    togglePlay: sampler.togglePlay,
    rewind: sampler.rewind,
    toggleLoop: () => actions.setLoop(!project.loop),
    save: sync.saveNow,
  });

  const status = catalog.loading
    ? 'Loading instruments…'
    : catalog.source === 'fallback'
      ? 'Offline — playing built-in synth instruments'
      : sampler.loadingSamples
        ? 'Decoding samples…'
        : 'Samples loaded from the server';

  return (
    <div className="app">
      <header className="app-header">
        <h1>Music Sampler</h1>
        <div className="app-meta">
          <span className="app-status" title={catalog.reason}>
            {status}
          </span>
          <SaveIndicator status={sync.status} lastSavedAt={sync.lastSavedAt} message={sync.message} />
        </div>
      </header>

      <ProjectBar
        name={project.name}
        onRename={actions.rename}
        onNewProject={() => actions.replace(createStarterProject(catalog.instruments))}
      />

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
        onSetStep={actions.setStep}
        onSetNote={actions.setTrackNote}
        onSetTrackVolume={actions.setTrackVolume}
        onSetTrackEffect={actions.setTrackEffect}
        onResetTrackEffects={actions.resetTrackEffects}
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
