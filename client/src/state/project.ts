import type { Instrument, Project, Track } from '../types/project';
import { PROJECT_VERSION } from '../types/project';

export const DEFAULT_STEPS = 16;
export const DEFAULT_BPM = 120;

let fallbackId = 0;

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  fallbackId += 1;
  return `track-${fallbackId}`;
}

export function emptySteps(count: number): boolean[] {
  return Array<boolean>(count).fill(false);
}

/** Keeps a step array at the project length, preserving what the user already programmed. */
export function resizeSteps(steps: boolean[], length: number): boolean[] {
  if (steps.length === length) return steps;
  if (steps.length > length) return steps.slice(0, length);
  return [...steps, ...emptySteps(length - steps.length)];
}

export function labelFor(instrument: Instrument, note: string): string {
  return instrument.samples.find(sample => sample.note === note)?.label ?? note;
}

export function createTrack(instrument: Instrument, note: string, steps: number): Track {
  return {
    id: createId(),
    instrumentId: instrument.id,
    note,
    label: labelFor(instrument, note),
    steps: emptySteps(steps),
    volume: 0.8,
    muted: false,
    solo: false,
  };
}

/**
 * A first project that already sounds like something. An empty grid is a worse
 * first impression than a four-on-the-floor the user can immediately edit.
 */
export function createStarterProject(instruments: Instrument[]): Project {
  const drums = instruments.find(instrument => instrument.kind === 'kit') ?? instruments[0];
  const tracks: Track[] = [];

  if (drums) {
    for (const note of drums.defaultNotes) {
      tracks.push(createTrack(drums, note, DEFAULT_STEPS));
    }
    seed(tracks, 'kick', [0, 4, 8, 12]);
    seed(tracks, 'clap', [4, 12]);
    seed(tracks, 'hihat', [0, 2, 4, 6, 8, 10, 12, 14]);
    seed(tracks, 'openhat', [14]);
  }

  const bass = instruments.find(instrument => instrument.id === 'bass');
  if (bass && bass.defaultNotes.length > 0) {
    const track = createTrack(bass, bass.defaultNotes[0], DEFAULT_STEPS);
    [0, 6, 10].forEach(step => {
      track.steps[step] = true;
    });
    tracks.push(track);
  }

  return {
    version: PROJECT_VERSION,
    name: 'Untitled',
    bpm: DEFAULT_BPM,
    steps: DEFAULT_STEPS,
    swing: 0,
    masterVolume: 0.8,
    loop: true,
    tracks,
  };
}

function seed(tracks: Track[], note: string, steps: number[]): void {
  const track = tracks.find(candidate => candidate.note === note);
  if (!track) return;
  for (const step of steps) {
    if (step < track.steps.length) track.steps[step] = true;
  }
}
