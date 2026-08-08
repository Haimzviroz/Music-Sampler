import type { components } from './schema';
import type { InstrumentCatalog, Project } from '../types/project';

export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

/**
 * Request and response shapes come from the generated OpenAPI types.
 * `src/api/contract.ts` proves they line up with the domain model, so nothing
 * here needs a mapping layer — and the build breaks if that stops being true.
 */
type ServerCatalog = components['schemas']['InstrumentCatalog'];
type ServerProjectInput = components['schemas']['Project-Input'];

/**
 * The server answered, and said no. Distinct from a network failure, because
 * "the API rejected this" and "the API is not there" call for different things
 * being said to the user.
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(method: string, path: string, status: number) {
    super(`${method} ${path} failed: ${status}`);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    throw new ApiError(init?.method ?? 'GET', path, response.status);
  }
  return (await response.json()) as T;
}

export function fetchInstruments(signal?: AbortSignal): Promise<InstrumentCatalog> {
  return request<ServerCatalog>('/api/instruments', { signal });
}

/**
 * Resolves to `null` when nothing has been saved yet, which is a normal state.
 *
 * Deliberately untyped: a saved project can predate the current model, so it
 * goes through `validateProject` before anything else is allowed to touch it.
 */
export async function fetchProject(signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(`${API_BASE}/api/state`, { signal });
  if (response.status === 404) return null;
  if (!response.ok) throw new ApiError('GET', '/api/state', response.status);
  return response.json();
}

export async function saveProject(project: Project, signal?: AbortSignal): Promise<void> {
  const payload: ServerProjectInput = project;
  await request<unknown>('/api/state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
}
