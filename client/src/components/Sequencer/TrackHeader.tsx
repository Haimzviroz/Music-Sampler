import { useMemo } from 'react';
import { notesInRange } from '../../state/notes';
import type { Instrument, Track } from '../../types/project';

interface TrackHeaderProps {
  track: Track;
  instrument: Instrument | undefined;
  onSetNote(note: string): void;
  onToggleMute(): void;
  onToggleSolo(): void;
  onRemove(): void;
  onAudition(): void;
}

function TrackHeader({
  track,
  instrument,
  onSetNote,
  onToggleMute,
  onToggleSolo,
  onRemove,
  onAudition,
}: TrackHeaderProps) {
  const color = instrument?.color ?? '#7c5cff';

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
        <button
          type="button"
          className="track-toggle is-remove"
          aria-label={`Remove ${track.label}`}
          onClick={onRemove}
        >
          ×
        </button>
      </div>
    </div>
  );
}

export default TrackHeader;
