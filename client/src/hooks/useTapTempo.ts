import { useCallback, useRef } from 'react';
import { LIMITS } from '../types/project';

/** Taps further apart than this start a new measurement instead of extending the old one. */
const RESET_AFTER_MS = 2500;
const MAX_TAPS = 5;

/**
 * Tap tempo: averages the intervals between the last few taps. Averaging rather
 * than using the latest interval keeps a slightly uneven hand from jumping the
 * tempo around.
 */
export function useTapTempo(onTempo: (bpm: number) => void): () => void {
  const taps = useRef<number[]>([]);

  return useCallback(() => {
    const now = performance.now();
    const previous = taps.current[taps.current.length - 1];

    if (previous === undefined || now - previous > RESET_AFTER_MS) {
      taps.current = [now];
      return;
    }

    taps.current = [...taps.current, now].slice(-MAX_TAPS);
    if (taps.current.length < 2) return;

    const intervals = taps.current.slice(1).map((tap, index) => tap - taps.current[index]);
    const average = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    if (average <= 0) return;

    const bpm = Math.round(60000 / average);
    onTempo(Math.min(LIMITS.bpm.max, Math.max(LIMITS.bpm.min, bpm)));
  }, [onTempo]);
}
