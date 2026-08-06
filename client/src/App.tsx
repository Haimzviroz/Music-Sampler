import { useState } from 'react';
import Grid from './components/Grid';
import { usePattern } from './hooks/usePattern';
import { useTransport } from './hooks/useTransport';
import './App.css';

function App() {
  const { pattern, toggle } = usePattern();
  const [bpm, setBpm] = useState(120);
  const { isPlaying, currentStep, start, stop } = useTransport(pattern, bpm);

  return (
    <div className="app">
      <h1>Music Sampler</h1>

      <div className="transport">
        <button
          type="button"
          className="transport-button"
          onClick={isPlaying ? stop : start}
          aria-label={isPlaying ? 'Stop' : 'Play'}
        >
          {isPlaying ? '■' : '▶'}
        </button>

        <input
          type="range"
          className="bpm-slider"
          min={60}
          max={200}
          value={bpm}
          onChange={event => setBpm(Number(event.target.value))}
          aria-label="Tempo in BPM"
        />
        <span className="bpm-readout">{bpm} BPM</span>
      </div>

      <Grid pattern={pattern} currentStep={currentStep} onToggle={toggle} />
    </div>
  );
}

export default App;
