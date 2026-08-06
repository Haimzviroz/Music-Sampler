import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import { useState } from 'react';
import Grid from './components/Grid';
import { usePattern, COLS } from './hooks/usePattern';
import { useTransport } from './hooks/useTransport';
import './App.css';

function App() {
  const { pattern, toggle } = usePattern();
  const [bpm, setBpm] = useState(120);
  const { isPlaying, currentStep, start, stop } = useTransport(COLS, bpm);

  return (
    <div className="app">
      <h1>Music Sampler</h1>

      <div className="transport">
        <IconButton
          onClick={isPlaying ? stop : start}
          aria-label={isPlaying ? 'Stop' : 'Play'}
          sx={{ color: '#e8e8f0', bgcolor: '#2a2a3a', '&:hover': { bgcolor: '#3a3a4e' } }}
        >
          {isPlaying ? <StopIcon /> : <PlayArrowIcon />}
        </IconButton>

        <Slider
          value={bpm}
          onChange={(_, value) => setBpm(value as number)}
          min={60}
          max={200}
          aria-label="Tempo in BPM"
          sx={{ width: 160, color: '#7c5cff' }}
        />
        <span className="bpm-readout">{bpm} BPM</span>
      </div>

      <Grid pattern={pattern} currentStep={currentStep} onToggle={toggle} />
    </div>
  );
}

export default App;
