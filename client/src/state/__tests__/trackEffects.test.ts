import { describe, expect, it } from 'vitest';
import { projectReducer } from '../projectReducer';
import { validateProject } from '../validateProject';
import { KIT, makeProject, makeTrack } from '../../test/fixtures';
import { DEFAULT_EFFECTS } from '../../types/project';

describe('track effects', () => {
  it('sets one effect and leaves the others alone', () => {
    const project = makeProject();
    const next = projectReducer(project, { type: 'setTrackEffect', trackId: 'a', effect: 'drive', value: 0.4 });

    expect(next.tracks[0].effects).toEqual({ ...DEFAULT_EFFECTS, drive: 0.4 });
    expect(next.tracks[1].effects).toEqual(DEFAULT_EFFECTS);
    expect(project.tracks[0].effects).toEqual(DEFAULT_EFFECTS);
  });

  it('clamps effect values to 0..1', () => {
    const project = makeProject();

    expect(projectReducer(project, { type: 'setTrackEffect', trackId: 'a', effect: 'tone', value: 5 }).tracks[0].effects.tone).toBe(1);
    expect(projectReducer(project, { type: 'setTrackEffect', trackId: 'a', effect: 'reverb', value: -2 }).tracks[0].effects.reverb).toBe(0);
  });

  it('fills in missing effects on a track saved before they existed', () => {
    const legacy = makeProject({ tracks: [makeTrack({ id: 'a' })] });
    delete (legacy.tracks[0] as Partial<(typeof legacy.tracks)[number]>).effects;

    const next = projectReducer(legacy, { type: 'setTrackEffect', trackId: 'a', effect: 'tone', value: 0.5 });

    expect(next.tracks[0].effects).toEqual({ ...DEFAULT_EFFECTS, tone: 0.5 });
  });

  it('resets a track back to a clean chain', () => {
    const project = makeProject({ tracks: [makeTrack({ id: 'a', effects: { tone: 0.2, drive: 0.6, reverb: 0.9 } })] });

    expect(projectReducer(project, { type: 'resetTrackEffects', trackId: 'a' }).tracks[0].effects).toEqual(DEFAULT_EFFECTS);
  });

  it('restores defaults when a saved project has no effects at all', () => {
    const saved = {
      ...makeProject({ tracks: [makeTrack({ id: 'a' })] }),
      tracks: [{ id: 'a', instrumentId: KIT.id, note: 'kick', label: 'Kick', steps: [true, false, false, false] }],
    };

    const result = validateProject(saved, [KIT]);

    expect(result?.tracks[0].effects).toEqual(DEFAULT_EFFECTS);
  });

  it('clamps effects that arrive out of range from storage', () => {
    const saved = makeProject({
      tracks: [makeTrack({ id: 'a', effects: { tone: 9, drive: -1, reverb: 0.5 } })],
    });

    expect(validateProject(saved, [KIT])?.tracks[0].effects).toEqual({ tone: 1, drive: 0, reverb: 0.5 });
  });
});
