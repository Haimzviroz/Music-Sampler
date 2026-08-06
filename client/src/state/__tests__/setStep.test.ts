import { describe, expect, it } from 'vitest';
import { projectReducer } from '../projectReducer';
import { makeProject } from '../../test/fixtures';

describe('setStep', () => {
  it('writes the requested value rather than flipping', () => {
    const project = makeProject();

    const on = projectReducer(project, { type: 'setStep', trackId: 'a', step: 1, value: true });
    expect(on.tracks[0].steps).toEqual([true, true, true, false]);

    const off = projectReducer(on, { type: 'setStep', trackId: 'a', step: 0, value: false });
    expect(off.tracks[0].steps).toEqual([false, true, true, false]);
  });

  /**
   * Dragging sweeps back over cells it has already painted. Returning the same
   * object keeps those repeats from re-rendering the whole grid.
   */
  it('returns the same project when the step already holds the value', () => {
    const project = makeProject();

    expect(projectReducer(project, { type: 'setStep', trackId: 'a', step: 0, value: true })).toBe(project);
    expect(projectReducer(project, { type: 'setStep', trackId: 'a', step: 1, value: false })).toBe(project);
  });

  it('ignores an unknown track', () => {
    const project = makeProject();
    expect(projectReducer(project, { type: 'setStep', trackId: 'ghost', step: 0, value: true })).toBe(project);
  });

  it('does not mutate the project it was given', () => {
    const project = makeProject();
    const before = structuredClone(project);

    projectReducer(project, { type: 'setStep', trackId: 'a', step: 1, value: true });

    expect(project).toEqual(before);
  });

  it('leaves the other tracks referentially untouched', () => {
    const project = makeProject();
    const next = projectReducer(project, { type: 'setStep', trackId: 'a', step: 1, value: true });

    expect(next.tracks[1]).toBe(project.tracks[1]);
  });
});
