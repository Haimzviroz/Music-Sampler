import type { CSSProperties } from 'react';
import type { Instrument, Project } from '../../types/project';
import StepCell from './StepCell';
import TrackHeader from './TrackHeader';
import './Sequencer.css';

interface SequencerProps {
  project: Project;
  instruments: Instrument[];
  currentStep: number;
  onToggleStep(trackId: string, step: number): void;
  onToggleMute(trackId: string): void;
  onToggleSolo(trackId: string): void;
  onAudition(trackId: string): void;
}

function Sequencer({
  project,
  instruments,
  currentStep,
  onToggleStep,
  onToggleMute,
  onToggleSolo,
  onAudition,
}: SequencerProps) {
  const byId = new Map(instruments.map(instrument => [instrument.id, instrument]));
  const gridStyle = { '--steps': project.steps } as CSSProperties;

  if (project.tracks.length === 0) {
    return (
      <div className="sequencer is-empty">
        <p>No tracks yet. Add an instrument to start building a pattern.</p>
      </div>
    );
  }

  return (
    <div className="sequencer">
      <div className="track-row is-ruler">
        <div className="track-header is-ruler" aria-hidden="true" />
        <div className="track-steps" style={gridStyle}>
          {Array.from({ length: project.steps }, (_, step) => (
            <span
              key={step}
              className={`step-tick${step % 4 === 0 ? ' is-accent' : ''}${step === currentStep ? ' is-playing' : ''}`}
              aria-hidden="true"
            >
              {step % 4 === 0 ? step / 4 + 1 : ''}
            </span>
          ))}
        </div>
      </div>

      {project.tracks.map(track => {
        const instrument = byId.get(track.instrumentId);
        const color = instrument?.color ?? '#7c5cff';

        return (
          <div key={track.id} className={`track-row${track.muted ? ' is-muted' : ''}`}>
            <TrackHeader
              track={track}
              instrument={instrument}
              onToggleMute={() => onToggleMute(track.id)}
              onToggleSolo={() => onToggleSolo(track.id)}
              onAudition={() => onAudition(track.id)}
            />
            <div className="track-steps" style={gridStyle}>
              {track.steps.map((active, step) => (
                <StepCell
                  key={step}
                  active={active}
                  playing={step === currentStep}
                  accent={step % 4 === 0}
                  color={color}
                  label={`${track.label}, step ${step + 1}`}
                  onToggle={() => onToggleStep(track.id, step)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default Sequencer;
