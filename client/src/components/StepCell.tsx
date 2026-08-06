import './StepCell.css';

interface StepCellProps {
  row: number;
  col: number;
  active: boolean;
  onToggle: () => void;
}

function StepCell({ row, col, active, onToggle }: StepCellProps) {

  return (
    <button
      type="button"
      className={`step-cell ${active ? 'active' : ''}`}
      aria-pressed={active}
      aria-label={`Track ${row + 1}, step ${col + 1}`}
      onClick={onToggle}
    >
    </button>
  );
}

export default StepCell;
