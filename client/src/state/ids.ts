let fallbackCount = 0;

/**
 * Stable unique id for a track.
 *
 * `crypto.randomUUID` is only exposed in secure contexts, and reading it can
 * throw outside them, so the counter is a real fallback rather than decoration.
 */
export function createId(prefix = 'track'): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {
    // Fall through to the counter.
  }

  fallbackCount += 1;
  return `${prefix}-${fallbackCount}`;
}
