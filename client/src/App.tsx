import { useMemo } from 'react';
import Sequencer from './components/Sequencer/Sequencer';
import { FALLBACK_INSTRUMENTS } from './audio/fallbackCatalog';
import { useInstruments } from './hooks/useInstruments';
import { useProject } from './hooks/useProject';
import { useSampler } from './hooks/useSampler';
import { createStarterProject } from './state/project';
import { LIMITS } from './types/project';
import './App.css';

function App() {
  const catalog = useInstruments();
  const initialProject = useMemo(() => createStarterProject(FALLBACK_INSTRUMENTS), []);
  const [project, actions] = useProject(initialProject);
  const sampler = useSampler(project, catalog.instruments);

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

      <div className="transport">
        <button
          type="button"
          className="transport-button"
          onClick={sampler.togglePlay}
          aria-label={sampler.isPlaying ? 'Stop' : 'Play'}
        >
          {sampler.isPlaying ? '■' : '▶'}
        </button>

        <label className="transport-field">
          <span className="transport-field-label">Tempo</span>
          <input
            type="range"
            className="slider"
            min={LIMITS.bpm.min}
            max={LIMITS.bpm.max}
            value={project.bpm}
            onChange={event => actions.setBpm(Number(event.target.value))}
            aria-label="Tempo in BPM"
          />
          <span className="transport-readout">{project.bpm} BPM</span>
        </label>
      </div>

      <Sequencer
        project={project}
        instruments={catalog.instruments}
        currentStep={sampler.currentStep}
        onToggleStep={actions.toggleStep}
        onToggleMute={actions.toggleMute}
        onToggleSolo={actions.toggleSolo}
        onAudition={sampler.audition}
      />
    </div>
  );
}

export default App;
