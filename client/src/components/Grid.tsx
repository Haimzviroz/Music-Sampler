import StepCell from './StepCell';
import type { GridState } from '../types/types';
import './Grid.css';

interface GridProps {
  pattern: GridState;
  onToggle: (row: number, col: number) => void;
}

function Grid({ pattern, onToggle }: GridProps) {
  return (
    <div className="grid">
      {pattern.map((row, rowIndex) => (
        <div key={rowIndex} className="grid-row">
          {row.map((cell, colIndex) => (
            <StepCell
              key={colIndex}
              row={rowIndex}
              col={colIndex}
              active={cell}
              onToggle={() => onToggle(rowIndex, colIndex)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default Grid;
