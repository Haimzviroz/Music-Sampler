import type { PointerEvent } from 'react';

interface StepCellProps {
  active: boolean;
  playing: boolean;
  /** First step of a beat — drawn a shade lighter so the bar is readable. */
  accent: boolean;
  color: string;
  label: string;
  /** Pointer pressed on this cell: begins a drag. */
  onPaintStart(): void;
  /** Pointer dragged onto this cell while a drag is in progress. */
  onPaintEnter(): void;
  /** Keyboard activation. */
  onToggle(): void;
}

function StepCell({ active, playing, accent, color, label, onPaintStart, onPaintEnter, onToggle }: StepCellProps) {
  const className = ['step-cell', active && 'is-active', playing && 'is-playing', accent && 'is-accent']
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={className}
      style={active ? { background: color } : undefined}
      aria-pressed={active}
      aria-label={label}
      onPointerDown={onPaintStart}
      onPointerEnter={onPaintEnter}
      // A pointer already toggled the cell on pointerdown; the click that
      // follows it carries a detail count, and only a keyboard activation
      // arrives with none.
      onClick={(event: PointerEvent<HTMLButtonElement>) => {
        if (event.detail === 0) onToggle();
      }}
    />
  );
}

export default StepCell;
