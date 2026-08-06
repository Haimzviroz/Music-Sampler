import type { CSSProperties } from 'react';
import type { Instrument, Project } from '../../types/project';
import PatternBar from './PatternBar';
import StepCell from './StepCell';
import TrackHeader from './TrackHeader';
import './Sequencer.css';

interface SequencerProps {
  project: Project;
  instruments: Instrument[];
  currentStep: number;
  onToggleStep(trackId: string, step: number): void;
  onSetNote(trackId: string, note: string, instrument: Instrument): void;
  onToggleMute(trackId: string): void;
  onToggleSolo(trackId: string): void;
  onRemoveTrack(trackId: string): void;
  onAudition(trackId: string): void;
  onSetSteps(steps: number): void;
  onAddInstrument(instrument: Instrument): void;
  onClearAll(): void;
}

function Sequencer({
  project,
  instruments,
  currentStep,
  onToggleStep,
  onSetNote,
  onToggleMute,
  onToggleSolo,
  onRemoveTrack,
  onAudition,
  onSetSteps,
  onAddInstrument,
  onClearAll,
}: SequencerProps) {
  const byId = new Map(instruments.map(instrument => [instrument.id, instrument]));
  const gridStyle = { '--steps': project.steps } as CSSProperties;

  return (
    <section className="sequencer">
      <PatternBar
        project={project}
        instruments={instruments}
        onSetSteps={onSetSteps}
        onAddInstrument={onAddInstrument}
        onClearAll={onClearAll}
      />

      {project.tracks.length === 0 ? (
        <p className="sequencer-empty">No tracks yet — add an instrument to start building a pattern.</p>
      ) : (
        <div className="sequencer-grid">
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
                  onSetNote={note => {
                    if (instrument) onSetNote(track.id, note, instrument);
                  }}
                  onToggleMute={() => onToggleMute(track.id)}
                  onToggleSolo={() => onToggleSolo(track.id)}
                  onRemove={() => onRemoveTrack(track.id)}
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
      )}
    </section>
  );
}

export default Sequencer;
