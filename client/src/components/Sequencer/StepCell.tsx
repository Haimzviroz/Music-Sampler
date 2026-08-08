import { memo } from 'react';

interface StepCellProps {
  trackId: string;
  step: number;
  active: boolean;
  playing: boolean;
  /** First step of a beat — drawn a shade lighter so the bar is readable. */
  accent: boolean;
  color: string;
  label: string;
  /** Pointer pressed on this cell: begins a drag. */
  onPaintStart(trackId: string, step: number, active: boolean): void;
  /** Pointer dragged onto this cell while a drag is in progress. */
  onPaintEnter(trackId: string, step: number): void;
  /** Keyboard activation. */
  onToggle(trackId: string, step: number): void;
}

function StepCell({
  trackId,
  step,
  active,
  playing,
  accent,
  color,
  label,
  onPaintStart,
  onPaintEnter,
  onToggle,
}: StepCellProps) {
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
      // Preventing the default also keeps the cell from taking focus, which is
      // what leaves space free to start and stop the transport while a pattern
      // is being clicked in. Tabbing to a cell still focuses it normally.
      onPointerDown={event => {
        event.preventDefault();
        onPaintStart(trackId, step, active);
      }}
      onPointerEnter={() => onPaintEnter(trackId, step)}
      // A pointer already toggled the cell on pointerdown; the click that
      // follows it carries a detail count, and only a keyboard activation
      // arrives with none.
      onClick={event => {
        if (event.detail === 0) onToggle(trackId, step);
      }}
    />
  );
}

/**
 * The playhead moves eight times a second at 120 BPM. Without this every cell
 * in the grid reconciles on every step, when only the two columns either side
 * of the playhead have actually changed. All props are primitives or stable
 * callbacks, so the default comparison is enough.
 */
export default memo(StepCell);
