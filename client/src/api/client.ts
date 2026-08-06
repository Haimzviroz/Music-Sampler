import type { components } from './schema';

export type SamplerState = components['schemas']['SamplerState'];

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
    
export async function getInstruments() {
  const res = await fetch(`${BASE}/api/instruments`);
  if (!res.ok) throw new Error(`Failed to load instruments: ${res.status}`);
  return res.json();
}

export async function getState(): Promise<SamplerState | null> {
  const res = await fetch(`${BASE}/api/state`);
  if (res.status === 404) return null;          // אין שמירה קודמת - מצב תקין
  if (!res.ok) throw new Error(`Failed to load state: ${res.status}`);
  return res.json();
}

export async function saveState(state: SamplerState) {
  const res = await fetch(`${BASE}/api/state`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });
  if (!res.ok) throw new Error(`Failed to save state: ${res.status}`);
}