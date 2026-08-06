import { useCallback, useState } from 'react';
import type { GridState } from '../types/types';

export const ROWS = 4;
export const COLS = 4;

export function createEmptyPattern(rows = ROWS, cols = COLS): GridState {
  return Array.from({ length: rows }, () => Array<boolean>(cols).fill(false));
}

export function usePattern(rows = ROWS, cols = COLS) {
  const [pattern, setPattern] = useState<GridState>(() =>
    createEmptyPattern(rows, cols)
  );

  const toggle = useCallback((row: number, col: number) => {
    setPattern(prevPattern => {
      const newPattern = [...prevPattern];
      newPattern[row] = [...newPattern[row]];
      newPattern[row][col] = !newPattern[row][col];
      return newPattern;
    });
  }, []);

  return { pattern, setPattern, toggle };
}
