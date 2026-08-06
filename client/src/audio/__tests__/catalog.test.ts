import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadInstrumentCatalog } from '../catalog';
import { FALLBACK_INSTRUMENTS } from '../fallbackCatalog';
import type { Instrument } from '../../types/project';

const SERVER_INSTRUMENT: Instrument = {
  id: 'drums',
  name: 'Server Drums',
  kind: 'kit',
  color: '#ff0000',
  noteRange: null,
  defaultNotes: ['kick'],
  samples: [{ note: 'kick', label: 'Kick', url: '/audio/kick.wav' }],
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadInstrumentCatalog', () => {
  it('returns the server catalog when the request succeeds', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ instruments: [SERVER_INSTRUMENT] }));

    const result = await loadInstrumentCatalog();

    expect(result.source).toBe('server');
    expect(result.instruments).toEqual([SERVER_INSTRUMENT]);
    expect(result.reason).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back with a reason when the request rejects', async () => {
    fetchMock.mockRejectedValue(new Error('Network down'));

    const result = await loadInstrumentCatalog();

    expect(result.source).toBe('fallback');
    expect(result.instruments).toBe(FALLBACK_INSTRUMENTS);
    expect(result.reason).toBe('Network down');
  });

  it('falls back with the status when the server answers with an error', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 503));

    const result = await loadInstrumentCatalog();

    expect(result.source).toBe('fallback');
    expect(result.reason).toContain('503');
  });

  it('falls back when the server answers with an empty catalog', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ instruments: [] }));

    const result = await loadInstrumentCatalog();

    expect(result.source).toBe('fallback');
    expect(result.instruments).toBe(FALLBACK_INSTRUMENTS);
    expect(result.reason).toBe('Server returned an empty catalog');
  });

  it('re-throws instead of falling back when the caller aborted', async () => {
    fetchMock.mockImplementation((_input, init) => {
      const signal = init?.signal;
      if (signal?.aborted) return Promise.reject(signal.reason as Error);
      return Promise.resolve(jsonResponse({ instruments: [SERVER_INSTRUMENT] }));
    });

    const controller = new AbortController();
    controller.abort(new Error('Component unmounted'));

    await expect(loadInstrumentCatalog(controller.signal)).rejects.toThrow('Component unmounted');
  });
});
