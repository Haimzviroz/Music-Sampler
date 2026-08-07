import { useState } from 'react';

interface NumberFieldProps {
  value: number;
  min: number;
  max: number;
  label: string;
  className?: string;
  onCommit(value: number): void;
}

/**
 * A numeric input that only reports a value when the user is done with it.
 *
 * Committing on every keystroke does not work here: the reducer clamps, so
 * halfway through typing "90" the field would be yanked to the minimum, and
 * "16" could never be turned into "8" without passing through "168". The draft
 * is held locally and reconciled with the prop afterwards — including when the
 * clamped result equals the current value and no prop change ever arrives.
 */
function NumberField({ value, min, max, label, className, onCommit }: NumberFieldProps) {
  const [draft, setDraft] = useState(String(value));
  const [lastValue, setLastValue] = useState(value);

  // Derived state adjusted during render: follow the value when it moves
  // elsewhere — a slider, a tap, a loaded project.
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(String(value));
  }

  const commit = () => {
    const parsed = Number(draft);
    if (draft.trim() !== '' && Number.isFinite(parsed)) onCommit(parsed);
    setDraft(String(value));
  };

  return (
    <input
      type="number"
      className={className}
      min={min}
      max={max}
      value={draft}
      onChange={event => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={event => {
        if (event.key === 'Enter') {
          event.currentTarget.blur();
        } else if (event.key === 'Escape') {
          setDraft(String(value));
          event.currentTarget.blur();
        }
      }}
      aria-label={label}
    />
  );
}

export default NumberField;
