/**
 * Sanitises a project that came from outside the running app.
 *
 * A save can be older than the code, hand-edited, truncated by a full quota, or
 * written against an instrument catalog that has since changed. Rather than
 * rejecting the whole thing on the first oddity, this repairs what it can and
 * drops only what it cannot make sense of — a user who renamed a track should
 * not lose the pattern because one field went missing.
 *
 * The function is total: it never throws, whatever it is handed.
 */

import type { Instrument, Project, Track } from '../types/project';
import { LIMITS, PROJECT_VERSION } from '../types/project';
import { DEFAULT_BPM, DEFAULT_STEPS, resizeSteps } from './project';

const DEFAULT_VOLUME = 0.8;

let fallbackId = 0;

function createId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {
    // Non-secure contexts can expose `crypto` without `randomUUID`.
  }
  fallbackId += 1;
  return `restored-track-${fallbackId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Accepts numbers and numeric strings; anything else falls back. */
function toNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function toInteger(value: unknown, fallback: number, min: number, max: number): number {
  return Math.round(toNumber(value, fallback, min, max));
}

function toString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function toSteps(value: unknown, length: number): boolean[] {
  const raw = Array.isArray(value) ? value.map(step => step === true) : [];
  return resizeSteps(raw, length);
}

function validateTrack(
  value: unknown,
  steps: number,
  knownInstruments: Set<string>,
  usedIds: Set<string>,
): Track | null {
  if (!isRecord(value)) return null;

  const instrumentId = typeof value.instrumentId === 'string' ? value.instrumentId : '';
  if (!instrumentId) return null;
  // An empty catalog means "not loaded yet", not "nothing exists" — only drop
  // tracks when we actually know what the catalog contains.
  if (knownInstruments.size > 0 && !knownInstruments.has(instrumentId)) return null;

  const note = toString(value.note, '');
  if (!note) return null;

  const id = typeof value.id === 'string' && value.id.length > 0 && !usedIds.has(value.id) ? value.id : createId();
  usedIds.add(id);

  return {
    id,
    instrumentId,
    note,
    label: toString(value.label, note),
    steps: toSteps(value.steps, steps),
    volume: toNumber(value.volume, DEFAULT_VOLUME, 0, 1),
    muted: toBoolean(value.muted, false),
    solo: toBoolean(value.solo, false),
  };
}

/**
 * @param value        Anything: a parsed JSON body, a `localStorage` blob, `undefined`.
 * @param instruments  The current catalog. Pass an empty array while it is still
 *                     loading — no track will be dropped for an unknown instrument.
 * @returns A project safe to hand to the reducer, or `null` if `value` was not
 *          recognisably a project at all.
 */
export function validateProject(value: unknown, instruments: Instrument[]): Project | null {
  try {
    if (!isRecord(value)) return null;
    if (!Array.isArray(value.tracks)) return null;

    const steps = toInteger(value.steps, DEFAULT_STEPS, LIMITS.steps.min, LIMITS.steps.max);
    const knownInstruments = new Set(
      (Array.isArray(instruments) ? instruments : [])
        .filter(instrument => isRecord(instrument) && typeof instrument.id === 'string')
        .map(instrument => instrument.id),
    );
    const usedIds = new Set<string>();

    const tracks = value.tracks
      .map(track => validateTrack(track, steps, knownInstruments, usedIds))
      .filter((track): track is Track => track !== null);

    return {
      version: PROJECT_VERSION,
      name: toString(value.name, 'Untitled'),
      bpm: toInteger(value.bpm, DEFAULT_BPM, LIMITS.bpm.min, LIMITS.bpm.max),
      steps,
      swing: toNumber(value.swing, 0, 0, 1),
      masterVolume: toNumber(value.masterVolume, DEFAULT_VOLUME, 0, 1),
      loop: toBoolean(value.loop, true),
      tracks,
    };
  } catch {
    // Nothing here should throw, but a getter on a hostile object could.
    return null;
  }
}
