import { useEffect, useState } from 'react';
import { loadInstrumentCatalog, type CatalogSource } from '../audio/catalog';
import { FALLBACK_INSTRUMENTS } from '../audio/fallbackCatalog';
import type { Instrument } from '../types/project';

interface InstrumentsState {
  instruments: Instrument[];
  source: CatalogSource;
  loading: boolean;
  reason?: string;
}

/** Loads the instrument catalog once on mount. Never rejects — it falls back. */
export function useInstruments(): InstrumentsState {
  const [state, setState] = useState<InstrumentsState>({
    instruments: FALLBACK_INSTRUMENTS,
    source: 'fallback',
    loading: true,
  });

  useEffect(() => {
    const controller = new AbortController();

    loadInstrumentCatalog(controller.signal)
      .then(result => {
        setState({
          instruments: result.instruments,
          source: result.source,
          reason: result.reason,
          loading: false,
        });
      })
      .catch(() => {
        // Only reached when the request was aborted by the cleanup below.
      });

    return () => controller.abort();
  }, []);

  return state;
}
