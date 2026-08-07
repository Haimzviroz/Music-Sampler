import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { EffectName, Instrument, Project } from '../../types/project';
import { DEFAULT_EFFECTS, DEFAULT_TRACK_COLOR } from '../../types/project';
import PatternBar from './PatternBar';
import StepCell from './StepCell';
import TrackEffects from './TrackEffects';
import TrackHeader from './TrackHeader';
import './Sequencer.css';

interface SequencerProps {
  project: Project;
  instruments: Instrument[];
  currentStep: number;
  onToggleStep(trackId: string, step: number): void;
  onSetStep(trackId: string, step: number, value: boolean): void;
  onSetNote(trackId: string, note: string, instrument: Instrument): void;
  onSetTrackVolume(trackId: string, volume: number): void;
  onSetTrackEffect(trackId: string, effect: EffectName, value: number): void;
  onResetTrackEffects(trackId: string): void;
  onToggleMute(trackId: string): void;
  onToggleSolo(trackId: string): void;
  onMoveTrack(trackId: string, offset: -1 | 1): void;
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
  onSetStep,
  onSetNote,
  onSetTrackVolume,
  onSetTrackEffect,
  onResetTrackEffects,
  onToggleMute,
  onToggleSolo,
  onMoveTrack,
  onRemoveTrack,
  onAudition,
  onSetSteps,
  onAddInstrument,
  onClearAll,
}: SequencerProps) {
  // Which effect panels are open is a view concern — it does not belong in the
  // saved project, and it should not travel to another machine.
  const [openEffects, setOpenEffects] = useState<readonly string[]>([]);

  /**
   * Value being painted while the pointer is held down, or null when it is not.
   * Programming a bar means filling a run of steps, and doing that one click at
   * a time is the single most tedious thing about a grid sequencer.
   */
  const paintValue = useRef<boolean | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const endPaint = () => {
      paintValue.current = null;
    };

    // Listened for on the window: the pointer is very often released outside
    // the cell — or outside the grid — that started the drag.
    window.addEventListener('pointerup', endPaint);
    window.addEventListener('pointercancel', endPaint);
    return () => {
      window.removeEventListener('pointerup', endPaint);
      window.removeEventListener('pointercancel', endPaint);
    };
  }, []);

  const byId = new Map(instruments.map(instrument => [instrument.id, instrument]));
  const gridStyle = { '--steps': project.steps } as CSSProperties;

  const toggleEffects = (trackId: string) =>
    setOpenEffects(open => (open.includes(trackId) ? open.filter(id => id !== trackId) : [...open, trackId]));

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
        <div className="sequencer-grid" ref={gridRef} tabIndex={-1}>
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

          {project.tracks.map((track, index) => {
            const instrument = byId.get(track.instrumentId);
            const color = instrument?.color ?? DEFAULT_TRACK_COLOR;
            const effects = { ...DEFAULT_EFFECTS, ...track.effects };
            const fxOpen = openEffects.includes(track.id);
            const fxActive =
              effects.tone !== DEFAULT_EFFECTS.tone ||
              effects.drive !== DEFAULT_EFFECTS.drive ||
              effects.reverb !== DEFAULT_EFFECTS.reverb;

            return (
              <div key={track.id} className={`track-row${track.muted ? ' is-muted' : ''}`}>
                <TrackHeader
                  track={track}
                  instrument={instrument}
                  canMoveUp={index > 0}
                  canMoveDown={index < project.tracks.length - 1}
                  fxOpen={fxOpen}
                  fxActive={fxActive}
                  onToggleFx={() => toggleEffects(track.id)}
                  onSetNote={note => {
                    if (instrument) onSetNote(track.id, note, instrument);
                  }}
                  onSetVolume={volume => onSetTrackVolume(track.id, volume)}
                  onToggleMute={() => onToggleMute(track.id)}
                  onToggleSolo={() => onToggleSolo(track.id)}
                  onMove={offset => onMoveTrack(track.id, offset)}
                  onRemove={() => {
                    // The focused button is about to be unmounted; without this
                    // focus falls to the document body.
                    gridRef.current?.focus();
                    onRemoveTrack(track.id);
                  }}
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
                      onPaintStart={() => {
                        paintValue.current = !active;
                        onSetStep(track.id, step, !active);
                      }}
                      onPaintEnter={() => {
                        if (paintValue.current !== null) onSetStep(track.id, step, paintValue.current);
                      }}
                      onToggle={() => onToggleStep(track.id, step)}
                    />
                  ))}
                </div>

                {fxOpen && (
                  <TrackEffects
                    track={track}
                    color={color}
                    onSetEffect={(effect, value) => onSetTrackEffect(track.id, effect, value)}
                    onReset={() => onResetTrackEffects(track.id)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default Sequencer;
