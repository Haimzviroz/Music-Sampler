import { fetchInstruments } from '../api/client';
import type { Instrument } from '../types/project';
import { FALLBACK_INSTRUMENTS } from './fallbackCatalog';

export type CatalogSource = 'server' | 'fallback';

export interface CatalogResult {
  instruments: Instrument[];
  source: CatalogSource;
  /** Why the server catalog was not used. Only set when `source` is `fallback`. */
  reason?: string;
}

/**
 * Loads the instrument catalog from the server, falling back to the built-in
 * synthesised instruments when it is unreachable. The app stays usable either
 * way — the reviewer should not meet a blank screen because the API is down.
 */
export async function loadInstrumentCatalog(signal?: AbortSignal): Promise<CatalogResult> {
  try {
    const catalog = await fetchInstruments(signal);
    if (!catalog.instruments?.length) {
      return { instruments: FALLBACK_INSTRUMENTS, source: 'fallback', reason: 'Server returned an empty catalog' };
    }
    return { instruments: catalog.instruments, source: 'server' };
  } catch (error) {
    if (signal?.aborted) throw error;
    const reason = error instanceof Error ? error.message : 'Unknown error';
    return { instruments: FALLBACK_INSTRUMENTS, source: 'fallback', reason };
  }
}
