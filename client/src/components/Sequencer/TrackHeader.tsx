import { useMemo } from 'react';
import { notesInRange } from '../../state/notes';
import type { Instrument, Track } from '../../types/project';
import { DEFAULT_TRACK_COLOR } from '../../types/project';

interface TrackHeaderProps {
  track: Track;
  instrument: Instrument | undefined;
  canMoveUp: boolean;
  canMoveDown: boolean;
  fxOpen: boolean;
  /** True when the chain is doing something, so a closed panel still shows it. */
  fxActive: boolean;
  onToggleFx(): void;
  onSetNote(note: string): void;
  onSetVolume(volume: number): void;
  onToggleMute(): void;
  onToggleSolo(): void;
  onMove(offset: -1 | 1): void;
  onRemove(): void;
  onAudition(): void;
}

function TrackHeader({
  track,
  instrument,
  canMoveUp,
  canMoveDown,
  fxOpen,
  fxActive,
  onToggleFx,
  onSetNote,
  onSetVolume,
  onToggleMute,
  onToggleSolo,
  onMove,
  onRemove,
  onAudition,
}: TrackHeaderProps) {
  const color = instrument?.color ?? DEFAULT_TRACK_COLOR;

  const options = useMemo(() => {
    if (!instrument) return [{ value: track.note, label: track.label }];

    if (instrument.kind === 'kit') {
      return instrument.samples.map(sample => ({ value: sample.note, label: sample.label }));
    }

    const range = instrument.noteRange;
    const notes = range ? notesInRange(range.low, range.high) : [];
    const list = notes.length > 0 ? notes : instrument.samples.map(sample => sample.note);
    return list.map(note => ({ value: note, label: note }));
  }, [instrument, track.note, track.label]);

  // A project loaded from elsewhere may hold a note the catalog no longer has;
  // keep it selectable rather than silently snapping the track to another sound.
  const hasCurrent = options.some(option => option.value === track.note);

  return (
    <div className="track-header">
      <div className="track-header-row">
        <button
          type="button"
          className="track-preview"
          onClick={onAudition}
          title={`Preview ${instrument?.name ?? track.instrumentId} ${track.note}`}
          aria-label={`Preview ${track.label}`}
        >
          <span className="track-dot" style={{ background: color }} aria-hidden="true" />
        </button>

        <select
          className="track-note"
          value={track.note}
          onChange={event => onSetNote(event.target.value)}
          aria-label={`Sound for ${track.label}`}
        >
          {!hasCurrent && <option value={track.note}>{track.label}</option>}
          {options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <div className="track-toggles">
          <button
            type="button"
            className={`track-toggle${track.muted ? ' is-on' : ''}`}
            aria-pressed={track.muted}
            aria-label={`Mute ${track.label}`}
            onClick={onToggleMute}
          >
            M
          </button>
          <button
            type="button"
            className={`track-toggle is-solo${track.solo ? ' is-on' : ''}`}
            aria-pressed={track.solo}
            aria-label={`Solo ${track.label}`}
            onClick={onToggleSolo}
          >
            S
          </button>
        </div>
      </div>

      <div className="track-header-row is-secondary">
        <div className="track-order">
          <button
            type="button"
            className="track-order-button"
            onClick={() => onMove(-1)}
            disabled={!canMoveUp}
            aria-label={`Move ${track.label} up`}
          >
            ▲
          </button>
          <button
            type="button"
            className="track-order-button"
            onClick={() => onMove(1)}
            disabled={!canMoveDown}
            aria-label={`Move ${track.label} down`}
          >
            ▼
          </button>
        </div>

        <button
          type="button"
          className={`track-fx-toggle${fxOpen ? ' is-on' : ''}${fxActive && !fxOpen ? ' is-active' : ''}`}
          onClick={onToggleFx}
          aria-expanded={fxOpen}
          aria-label={`Effects for ${track.label}`}
        >
          FX
        </button>

        <input
          type="range"
          className="track-volume"
          min={0}
          max={100}
          value={Math.round(track.volume * 100)}
          onChange={event => onSetVolume(Number(event.target.value) / 100)}
          style={{ accentColor: color }}
          aria-label={`Level for ${track.label}`}
        />

        <button
          type="button"
          className="track-remove"
          aria-label={`Remove ${track.label}`}
          title={`Remove ${track.label}`}
          onClick={onRemove}
        >
          ×
        </button>
      </div>
    </div>
  );
}

export default TrackHeader;
