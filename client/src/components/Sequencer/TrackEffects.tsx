import type { EffectName, Track } from '../../types/project';
import { DEFAULT_EFFECTS } from '../../types/project';
import './TrackEffects.css';

interface TrackEffectsProps {
  track: Track;
  color: string;
  onSetEffect(effect: EffectName, value: number): void;
  onReset(): void;
}

const CONTROLS: { name: EffectName; label: string; hint: string }[] = [
  { name: 'tone', label: 'Tone', hint: 'Lowpass filter — turn down to darken the sound' },
  { name: 'drive', label: 'Drive', hint: 'Distortion — adds harmonics and grit' },
  { name: 'reverb', label: 'Reverb', hint: 'Send level into the shared reverb' },
];

function TrackEffects({ track, color, onSetEffect, onReset }: TrackEffectsProps) {
  const effects = { ...DEFAULT_EFFECTS, ...track.effects };
  const isDefault = CONTROLS.every(control => effects[control.name] === DEFAULT_EFFECTS[control.name]);

  return (
    <div className="track-effects">
      {CONTROLS.map(control => (
        <label key={control.name} className="track-effect" title={control.hint}>
          <span className="track-effect-label">{control.label}</span>
          <input
            type="range"
            className="track-effect-slider"
            min={0}
            max={100}
            value={Math.round(effects[control.name] * 100)}
            onChange={event => onSetEffect(control.name, Number(event.target.value) / 100)}
            style={{ accentColor: color }}
            aria-label={`${control.label} for ${track.label}`}
          />
          <span className="track-effect-value">{Math.round(effects[control.name] * 100)}</span>
        </label>
      ))}

      <button type="button" className="track-effect-reset" onClick={onReset} disabled={isDefault}>
        Reset
      </button>
    </div>
  );
}

export default TrackEffects;
