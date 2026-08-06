import type { Instrument, Project, Track } from '../types/project';
import { DEFAULT_EFFECTS, PROJECT_VERSION } from '../types/project';

/** A kit whose sample list is deliberately longer than `defaultNotes`. */
export const KIT: Instrument = {
  id: 'kit',
  name: 'Test Kit',
  kind: 'kit',
  color: '#111111',
  noteRange: null,
  defaultNotes: ['kick', 'snare'],
  samples: [
    { note: 'kick', label: 'Kick', url: '' },
    { note: 'snare', label: 'Snare', url: '' },
    { note: 'hihat', label: 'Hi-Hat', url: '' },
  ],
};

/** No `defaultNotes`, so the reducer has to fall back to the sample list. */
export const NOTELESS_KIT: Instrument = {
  id: 'noteless',
  name: 'Noteless Kit',
  kind: 'kit',
  color: '#222222',
  noteRange: null,
  defaultNotes: [],
  samples: [
    { note: 'one', label: 'One', url: '' },
    { note: 'two', label: 'Two', url: '' },
    { note: 'three', label: 'Three', url: '' },
    { note: 'four', label: 'Four', url: '' },
    { note: 'five', label: 'Five', url: '' },
  ],
};

export function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: 'a',
    instrumentId: KIT.id,
    note: 'kick',
    label: 'Kick',
    steps: [false, false, false, false],
    volume: 0.8,
    muted: false,
    solo: false,
    effects: { ...DEFAULT_EFFECTS },
    ...overrides,
  };
}

/** Two tracks, four steps — small enough to assert on whole step arrays. */
export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    version: PROJECT_VERSION,
    name: 'Test project',
    bpm: 120,
    steps: 4,
    swing: 0,
    masterVolume: 0.8,
    loop: true,
    tracks: [
      makeTrack({ id: 'a', note: 'kick', label: 'Kick', steps: [true, false, true, false] }),
      makeTrack({ id: 'b', note: 'snare', label: 'Snare', steps: [false, true, false, true] }),
    ],
    ...overrides,
  };
}
