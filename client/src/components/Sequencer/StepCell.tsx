interface StepCellProps {
  active: boolean;
  playing: boolean;
  /** First step of a beat — drawn a shade lighter so the bar is readable. */
  accent: boolean;
  color: string;
  label: string;
  onToggle(): void;
}

function StepCell({ active, playing, accent, color, label, onToggle }: StepCellProps) {
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
      onClick={onToggle}
    />
  );
}

export default StepCell;
