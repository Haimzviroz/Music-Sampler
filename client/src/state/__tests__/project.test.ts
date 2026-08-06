import { describe, expect, it } from 'vitest';
import { DEFAULT_BPM, DEFAULT_STEPS, createStarterProject, createTrack, emptySteps, labelFor, resizeSteps } from '../project';
import { FALLBACK_INSTRUMENTS } from '../../audio/fallbackCatalog';
import { PROJECT_VERSION } from '../../types/project';
import { KIT } from '../../test/fixtures';

describe('emptySteps', () => {
  it('produces the requested number of inactive steps', () => {
    expect(emptySteps(3)).toEqual([false, false, false]);
    expect(emptySteps(0)).toEqual([]);
  });
});

describe('resizeSteps', () => {
  it('pads with inactive steps when growing', () => {
    expect(resizeSteps([true, false], 5)).toEqual([true, false, false, false, false]);
  });

  it('drops the tail when shrinking', () => {
    expect(resizeSteps([true, false, true, true], 2)).toEqual([true, false]);
  });

  it('returns the same array when the length already matches', () => {
    const steps = [true, false, true];

    expect(resizeSteps(steps, 3)).toBe(steps);
  });

  it('does not mutate the array it was given', () => {
    const steps = [true, false];

    resizeSteps(steps, 4);
    resizeSteps(steps, 1);

    expect(steps).toEqual([true, false]);
  });
});

describe('labelFor', () => {
  it('uses the sample label when the instrument has the note', () => {
    expect(labelFor(KIT, 'hihat')).toBe('Hi-Hat');
  });

  it('falls back to the note name for an unknown note', () => {
    expect(labelFor(KIT, 'G#4')).toBe('G#4');
  });
});

describe('createTrack', () => {
  it('sizes the step array to the requested length and starts empty', () => {
    const track = createTrack(KIT, 'kick', 6);

    expect(track.steps).toEqual(emptySteps(6));
    expect(track.instrumentId).toBe(KIT.id);
    expect(track.note).toBe('kick');
    expect(track.label).toBe('Kick');
    expect(track.muted).toBe(false);
    expect(track.solo).toBe(false);
  });

  it('gives every track its own id and its own step array', () => {
    const tracks = Array.from({ length: 25 }, () => createTrack(KIT, 'kick', 4));
    const ids = new Set(tracks.map(track => track.id));

    expect(ids.size).toBe(tracks.length);
    expect(tracks[0].steps).not.toBe(tracks[1].steps);
  });
});

describe('createStarterProject', () => {
  it('gives every track exactly project.steps steps', () => {
    const project = createStarterProject(FALLBACK_INSTRUMENTS);

    for (const track of project.tracks) {
      expect(track.steps).toHaveLength(project.steps);
    }
  });

  it('is not empty for the fallback catalog and is already programmed', () => {
    const project = createStarterProject(FALLBACK_INSTRUMENTS);

    expect(project.tracks.length).toBeGreaterThan(0);
    expect(project.tracks.some(track => track.steps.includes(true))).toBe(true);
  });

  it('seeds the kick on every downbeat', () => {
    const project = createStarterProject(FALLBACK_INSTRUMENTS);
    const kick = project.tracks.find(track => track.note === 'kick');

    expect(kick?.steps).toEqual([
      true, false, false, false,
      true, false, false, false,
      true, false, false, false,
      true, false, false, false,
    ]);
  });

  it('uses the documented defaults', () => {
    const project = createStarterProject(FALLBACK_INSTRUMENTS);

    expect(project.version).toBe(PROJECT_VERSION);
    expect(project.bpm).toBe(DEFAULT_BPM);
    expect(project.steps).toBe(DEFAULT_STEPS);
    expect(project.loop).toBe(true);
  });

  it('still returns a valid project when no instruments are available', () => {
    const project = createStarterProject([]);

    expect(project.tracks).toEqual([]);
    expect(project.steps).toBe(DEFAULT_STEPS);
  });
});
