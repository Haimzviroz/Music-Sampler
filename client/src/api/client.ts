import type { InstrumentCatalog, Project } from '../types/project';

export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  if (!response.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${path} failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export function fetchInstruments(signal?: AbortSignal): Promise<InstrumentCatalog> {
  return request<InstrumentCatalog>('/api/instruments', { signal });
}

/** Resolves to `null` when nothing has been saved yet, which is a normal state. */
export async function fetchProject(signal?: AbortSignal): Promise<Project | null> {
  const response = await fetch(`${API_BASE}/api/state`, { signal });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Failed to load project: ${response.status}`);
  return (await response.json()) as Project;
}

export function saveProject(project: Project, signal?: AbortSignal): Promise<Project> {
  return request<Project>('/api/state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(project),
    signal,
  });
}

/**
 * Discards the saved project. Deleting when nothing is saved is not an error —
 * the caller wants the server empty, and it already is.
 *
 * Answers `204 No Content`, so there is no body to parse.
 */
export async function deleteProject(signal?: AbortSignal): Promise<void> {
  const response = await fetch(`${API_BASE}/api/state`, { method: 'DELETE', signal });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to delete project: ${response.status}`);
  }
}
