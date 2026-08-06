import { useState } from 'react';
import type { Project } from '../../types/project';
import { LIMITS } from '../../types/project';
import { useTapTempo } from '../../hooks/useTapTempo';
import { LoopIcon, PlayIcon, RewindIcon, StopIcon, VolumeIcon } from './icons';
import './TransportBar.css';

interface TransportBarProps {
  project: Project;
  isPlaying: boolean;
  onTogglePlay(): void;
  onRewind(): void;
  onSetLoop(loop: boolean): void;
  onSetBpm(bpm: number): void;
  onSetSwing(swing: number): void;
  onSetMasterVolume(volume: number): void;
}

function TransportBar({
  project,
  isPlaying,
  onTogglePlay,
  onRewind,
  onSetLoop,
  onSetBpm,
  onSetSwing,
  onSetMasterVolume,
}: TransportBarProps) {
  const tap = useTapTempo(onSetBpm);

  return (
    <div className="transport">
      <div className="transport-group">
        <button
          type="button"
          className={`transport-play${isPlaying ? ' is-playing' : ''}`}
          onClick={onTogglePlay}
          aria-label={isPlaying ? 'Stop (space)' : 'Play (space)'}
          title={isPlaying ? 'Stop (space)' : 'Play (space)'}
        >
          {isPlaying ? <StopIcon /> : <PlayIcon />}
        </button>

        <button
          type="button"
          className="transport-icon"
          onClick={onRewind}
          aria-label="Return to start (home)"
          title="Return to start (home)"
        >
          <RewindIcon />
        </button>

        <button
          type="button"
          className={`transport-icon${project.loop ? ' is-on' : ''}`}
          onClick={() => onSetLoop(!project.loop)}
          aria-pressed={project.loop}
          aria-label="Loop the pattern (L)"
          title="Loop the pattern (L)"
        >
          <LoopIcon />
        </button>
      </div>

      <div className="transport-group">
        <TempoField bpm={project.bpm} onCommit={onSetBpm} />
        <input
          type="range"
          className="slider slider-tempo"
          min={LIMITS.bpm.min}
          max={LIMITS.bpm.max}
          value={project.bpm}
          onChange={event => onSetBpm(Number(event.target.value))}
          aria-label="Tempo in BPM"
        />
        <button type="button" className="transport-tap" onClick={tap} title="Tap four times to set the tempo">
          Tap
        </button>
      </div>

      <div className="transport-group">
        <label className="transport-label" htmlFor="swing">
          Swing
        </label>
        <input
          id="swing"
          type="range"
          className="slider slider-short"
          min={0}
          max={100}
          value={Math.round(project.swing * 100)}
          onChange={event => onSetSwing(Number(event.target.value) / 100)}
          aria-label="Swing amount"
        />
        <span className="transport-readout">{Math.round(project.swing * 100)}%</span>
      </div>

      <div className="transport-group transport-group-volume">
        <span className="transport-icon-static" aria-hidden="true">
          <VolumeIcon />
        </span>
        <input
          type="range"
          className="slider slider-short"
          min={0}
          max={100}
          value={Math.round(project.masterVolume * 100)}
          onChange={event => onSetMasterVolume(Number(event.target.value) / 100)}
          aria-label="Master volume"
        />
        <span className="transport-readout">{Math.round(project.masterVolume * 100)}%</span>
      </div>
    </div>
  );
}

interface TempoFieldProps {
  bpm: number;
  onCommit(bpm: number): void;
}

/**
 * Typed tempo. The value is held locally while editing so that halfway through
 * typing "90" the field is not yanked to the minimum by the clamp.
 */
function TempoField({ bpm, onCommit }: TempoFieldProps) {
  const [draft, setDraft] = useState(String(bpm));
  const [lastBpm, setLastBpm] = useState(bpm);

  // Derived state adjusted during render: when the tempo changes elsewhere
  // (slider, tap, a loaded project) the field follows it.
  if (bpm !== lastBpm) {
    setLastBpm(bpm);
    setDraft(String(bpm));
  }

  const commit = () => {
    const parsed = Number(draft);
    if (Number.isFinite(parsed) && draft.trim() !== '') {
      onCommit(parsed);
    } else {
      setDraft(String(bpm));
    }
  };

  return (
    <span className="tempo-field">
      <input
        type="number"
        className="tempo-input"
        min={LIMITS.bpm.min}
        max={LIMITS.bpm.max}
        value={draft}
        onChange={event => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={event => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
        aria-label="Tempo in beats per minute"
      />
      <span className="tempo-unit">BPM</span>
    </span>
  );
}

export default TransportBar;
