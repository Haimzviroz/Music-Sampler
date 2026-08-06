import type { Instrument, Track } from '../../types/project';

interface TrackHeaderProps {
  track: Track;
  instrument: Instrument | undefined;
  onToggleMute(): void;
  onToggleSolo(): void;
  onAudition(): void;
}

function TrackHeader({ track, instrument, onToggleMute, onToggleSolo, onAudition }: TrackHeaderProps) {
  const color = instrument?.color ?? '#7c5cff';

  return (
    <div className="track-header">
      <button
        type="button"
        className="track-name"
        onClick={onAudition}
        title={`${instrument?.name ?? track.instrumentId} — ${track.note}`}
        aria-label={`Preview ${track.label}`}
      >
        <span className="track-dot" style={{ background: color }} aria-hidden="true" />
        <span className="track-label">{track.label}</span>
      </button>

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
  );
}

export default TrackHeader;
