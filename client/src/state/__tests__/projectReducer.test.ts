import { describe, expect, it } from 'vitest';
import { projectReducer } from '../projectReducer';
import { LIMITS } from '../../types/project';
import { KIT, NOTELESS_KIT, makeProject, makeTrack } from '../../test/fixtures';

describe('toggleStep', () => {
  it('flips the addressed step of the addressed track only', () => {
    const project = makeProject();
    const next = projectReducer(project, { type: 'toggleStep', trackId: 'a', step: 1 });

    expect(next.tracks[0].steps).toEqual([true, true, true, false]);
    expect(next.tracks[1]).toBe(project.tracks[1]);
  });

  it('turns an active step back off', () => {
    const project = makeProject();
    const next = projectReducer(project, { type: 'toggleStep', trackId: 'a', step: 0 });

    expect(next.tracks[0].steps).toEqual([false, false, true, false]);
  });

  it('leaves the project it was given untouched', () => {
    const project = makeProject();
    const before = structuredClone(project);

    const next = projectReducer(project, { type: 'toggleStep', trackId: 'a', step: 1 });

    expect(project).toEqual(before);
    expect(next).not.toBe(project);
    expect(next.tracks[0].steps).not.toBe(project.tracks[0].steps);
  });

  it('ignores an unknown track id', () => {
    const project = makeProject();
    const next = projectReducer(project, { type: 'toggleStep', trackId: 'nope', step: 0 });

    expect(next.tracks).toEqual(project.tracks);
  });
});

describe('setSteps', () => {
  it('keeps programmed steps and pads with false when growing', () => {
    const next = projectReducer(makeProject(), { type: 'setSteps', steps: 8 });

    expect(next.steps).toBe(8);
    expect(next.tracks[0].steps).toEqual([true, false, true, false, false, false, false, false]);
    expect(next.tracks[1].steps).toEqual([false, true, false, true, false, false, false, false]);
  });

  it('truncates from the end when shrinking', () => {
    const project = makeProject({
      steps: 8,
      tracks: [makeTrack({ id: 'a', steps: [true, false, true, false, true, true, true, true] })],
    });

    const next = projectReducer(project, { type: 'setSteps', steps: 4 });

    expect(next.steps).toBe(4);
    expect(next.tracks[0].steps).toEqual([true, false, true, false]);
  });

  it('gives every track exactly project.steps entries', () => {
    const next = projectReducer(makeProject(), { type: 'setSteps', steps: 32 });

    for (const track of next.tracks) {
      expect(track.steps).toHaveLength(next.steps);
    }
  });

  it('clamps and rounds the requested length', () => {
    expect(projectReducer(makeProject(), { type: 'setSteps', steps: 999 }).steps).toBe(LIMITS.steps.max);
    expect(projectReducer(makeProject(), { type: 'setSteps', steps: 7.6 }).steps).toBe(8);

    const wide = projectReducer(makeProject(), { type: 'setSteps', steps: 16 });
    expect(projectReducer(wide, { type: 'setSteps', steps: 1 }).steps).toBe(LIMITS.steps.min);
  });

  it('returns the same project when the length does not change', () => {
    const project = makeProject();

    expect(projectReducer(project, { type: 'setSteps', steps: project.steps })).toBe(project);
    expect(projectReducer(project, { type: 'setSteps', steps: 2 })).toBe(project);
  });
});

describe('setBpm', () => {
  it('rounds to a whole beat count', () => {
    expect(projectReducer(makeProject(), { type: 'setBpm', bpm: 128.4 }).bpm).toBe(128);
    expect(projectReducer(makeProject(), { type: 'setBpm', bpm: 128.5 }).bpm).toBe(129);
  });

  it('clamps to the supported tempo range', () => {
    expect(projectReducer(makeProject(), { type: 'setBpm', bpm: 5 }).bpm).toBe(LIMITS.bpm.min);
    expect(projectReducer(makeProject(), { type: 'setBpm', bpm: 5000 }).bpm).toBe(LIMITS.bpm.max);
    expect(projectReducer(makeProject(), { type: 'setBpm', bpm: 39.4 }).bpm).toBe(LIMITS.bpm.min);
  });
});

describe('level actions', () => {
  it('clamps swing to 0..1', () => {
    expect(projectReducer(makeProject(), { type: 'setSwing', swing: -0.5 }).swing).toBe(0);
    expect(projectReducer(makeProject(), { type: 'setSwing', swing: 1.5 }).swing).toBe(1);
    expect(projectReducer(makeProject(), { type: 'setSwing', swing: 0.25 }).swing).toBe(0.25);
  });

  it('clamps master volume to 0..1', () => {
    expect(projectReducer(makeProject(), { type: 'setMasterVolume', volume: -2 }).masterVolume).toBe(0);
    expect(projectReducer(makeProject(), { type: 'setMasterVolume', volume: 4 }).masterVolume).toBe(1);
    expect(projectReducer(makeProject(), { type: 'setMasterVolume', volume: 0.6 }).masterVolume).toBe(0.6);
  });

  it('clamps track volume to 0..1 without touching the other tracks', () => {
    const project = makeProject();

    expect(projectReducer(project, { type: 'setTrackVolume', trackId: 'a', volume: -1 }).tracks[0].volume).toBe(0);
    expect(projectReducer(project, { type: 'setTrackVolume', trackId: 'a', volume: 9 }).tracks[0].volume).toBe(1);

    const next = projectReducer(project, { type: 'setTrackVolume', trackId: 'a', volume: 0.3 });
    expect(next.tracks[0].volume).toBe(0.3);
    expect(next.tracks[1]).toBe(project.tracks[1]);
  });
});

describe('addInstrument', () => {
  it('adds one track per default note, sized to the current step count', () => {
    const project = makeProject();
    const next = projectReducer(project, { type: 'addInstrument', instrument: KIT });

    expect(next.tracks).toHaveLength(project.tracks.length + KIT.defaultNotes.length);
    expect(next.tracks[0]).toBe(project.tracks[0]);
    expect(next.tracks.slice(2).map(track => track.note)).toEqual(['kick', 'snare']);
    expect(next.tracks.slice(2).map(track => track.label)).toEqual(['Kick', 'Snare']);
    expect(next.tracks[2].instrumentId).toBe(KIT.id);
    expect(next.tracks[2].steps).toEqual(Array<boolean>(project.steps).fill(false));
  });

  it('sizes new tracks to a resized grid', () => {
    const wide = projectReducer(makeProject(), { type: 'setSteps', steps: 32 });
    const next = projectReducer(wide, { type: 'addInstrument', instrument: KIT });

    expect(next.tracks[next.tracks.length - 1].steps).toHaveLength(32);
  });

  it('falls back to the first four samples when there are no default notes', () => {
    const next = projectReducer(makeProject(), { type: 'addInstrument', instrument: NOTELESS_KIT });

    expect(next.tracks.slice(2).map(track => track.note)).toEqual(['one', 'two', 'three', 'four']);
  });
});

describe('removeTrack', () => {
  it('drops only the addressed track', () => {
    const next = projectReducer(makeProject(), { type: 'removeTrack', trackId: 'a' });

    expect(next.tracks.map(track => track.id)).toEqual(['b']);
  });

  it('keeps every track for an unknown id', () => {
    const project = makeProject();
    const next = projectReducer(project, { type: 'removeTrack', trackId: 'nope' });

    expect(next.tracks).toEqual(project.tracks);
  });
});

describe('mute and solo', () => {
  it('toggles mute on the addressed track only', () => {
    const project = makeProject();
    const muted = projectReducer(project, { type: 'toggleMute', trackId: 'b' });

    expect(muted.tracks[1].muted).toBe(true);
    expect(muted.tracks[0].muted).toBe(false);
    expect(projectReducer(muted, { type: 'toggleMute', trackId: 'b' }).tracks[1].muted).toBe(false);
  });

  it('toggles solo on the addressed track only', () => {
    const project = makeProject();
    const soloed = projectReducer(project, { type: 'toggleSolo', trackId: 'a' });

    expect(soloed.tracks[0].solo).toBe(true);
    expect(soloed.tracks[1].solo).toBe(false);
    expect(projectReducer(soloed, { type: 'toggleSolo', trackId: 'a' }).tracks[0].solo).toBe(false);
  });
});

describe('clearing', () => {
  it('clears every track without dropping any', () => {
    const project = makeProject();
    const next = projectReducer(project, { type: 'clearAll' });

    expect(next.tracks).toHaveLength(project.tracks.length);
    for (const track of next.tracks) {
      expect(track.steps).toEqual([false, false, false, false]);
    }
    expect(project.tracks[0].steps).toEqual([true, false, true, false]);
  });
});

describe('moveTrack', () => {
  it('swaps the track with its neighbour', () => {
    const project = makeProject({
      tracks: [makeTrack({ id: 'a' }), makeTrack({ id: 'b' }), makeTrack({ id: 'c' })],
    });

    expect(projectReducer(project, { type: 'moveTrack', trackId: 'b', offset: -1 }).tracks.map(t => t.id))
      .toEqual(['b', 'a', 'c']);
    expect(projectReducer(project, { type: 'moveTrack', trackId: 'b', offset: 1 }).tracks.map(t => t.id))
      .toEqual(['a', 'c', 'b']);
  });

  it('is a no-op at both ends and for an unknown id', () => {
    const project = makeProject();

    expect(projectReducer(project, { type: 'moveTrack', trackId: 'a', offset: -1 })).toBe(project);
    expect(projectReducer(project, { type: 'moveTrack', trackId: 'b', offset: 1 })).toBe(project);
    expect(projectReducer(project, { type: 'moveTrack', trackId: 'nope', offset: 1 })).toBe(project);
  });
});

describe('setTrackNote', () => {
  it('re-derives the label from the instrument sample list', () => {
    const project = makeProject();
    const next = projectReducer(project, {
      type: 'setTrackNote',
      trackId: 'a',
      note: 'hihat',
      instrument: KIT,
    });

    expect(next.tracks[0].note).toBe('hihat');
    expect(next.tracks[0].label).toBe('Hi-Hat');
    expect(next.tracks[1]).toBe(project.tracks[1]);
  });

  it('labels a note the instrument has no sample for with the note itself', () => {
    const next = projectReducer(makeProject(), {
      type: 'setTrackNote',
      trackId: 'a',
      note: 'C#3',
      instrument: KIT,
    });

    expect(next.tracks[0].label).toBe('C#3');
  });
});
