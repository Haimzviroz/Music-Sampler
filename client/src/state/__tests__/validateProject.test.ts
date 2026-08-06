import { describe, expect, it } from 'vitest';
import { validateProject } from '../validateProject';
import { KIT, makeProject, makeTrack } from '../../test/fixtures';
import { LIMITS, PROJECT_VERSION } from '../../types/project';

const catalog = [KIT];

describe('validateProject', () => {
  it('rejects values that are not recognisably a project', () => {
    for (const value of [null, undefined, 42, 'project', [], {}, { tracks: 'nope' }]) {
      expect(validateProject(value, catalog)).toBeNull();
    }
  });

  it('passes a well-formed project through unchanged', () => {
    const project = makeProject();
    expect(validateProject(structuredClone(project), catalog)).toEqual({
      ...project,
      version: PROJECT_VERSION,
    });
  });

  it('clamps every numeric field to its declared bounds', () => {
    const result = validateProject(
      { ...makeProject(), bpm: 9999, steps: 500, swing: -3, masterVolume: '0.5' },
      catalog,
    );

    expect(result?.bpm).toBe(LIMITS.bpm.max);
    expect(result?.steps).toBe(LIMITS.steps.max);
    expect(result?.swing).toBe(0);
    expect(result?.masterVolume).toBe(0.5);
  });

  it('forces every track to the project step count', () => {
    const result = validateProject(
      makeProject({
        steps: 8,
        tracks: [
          makeTrack({ id: 'short', steps: [true, true] }),
          makeTrack({ id: 'long', steps: Array<boolean>(20).fill(true) }),
        ],
      }),
      catalog,
    );

    expect(result?.tracks.map(track => track.steps.length)).toEqual([8, 8]);
    expect(result?.tracks[0].steps).toEqual([true, true, false, false, false, false, false, false]);
  });

  it('drops tracks whose instrument is not in the catalog', () => {
    const result = validateProject(
      makeProject({ tracks: [makeTrack({ id: 'a' }), makeTrack({ id: 'b', instrumentId: 'ghost' })] }),
      catalog,
    );

    expect(result?.tracks.map(track => track.id)).toEqual(['a']);
  });

  it('keeps unknown instruments while the catalog is still empty', () => {
    const result = validateProject(makeProject({ tracks: [makeTrack({ instrumentId: 'ghost' })] }), []);

    expect(result?.tracks).toHaveLength(1);
  });

  it('gives duplicate and missing track ids fresh ones', () => {
    const result = validateProject(
      makeProject({
        tracks: [
          makeTrack({ id: 'same' }),
          makeTrack({ id: 'same' }),
          { ...makeTrack(), id: undefined } as unknown as ReturnType<typeof makeTrack>,
        ],
      }),
      catalog,
    );

    const ids = result?.tracks.map(track => track.id) ?? [];
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
  });

  it('drops track entries that are not objects or have no instrument or note', () => {
    const result = validateProject(
      makeProject({
        tracks: [
          'nonsense',
          { ...makeTrack(), instrumentId: '' },
          { ...makeTrack(), note: '' },
          makeTrack({ id: 'keep' }),
        ] as unknown as ReturnType<typeof makeProject>['tracks'],
      }),
      catalog,
    );

    expect(result?.tracks.map(track => track.id)).toEqual(['keep']);
  });

  it('survives an object whose getters throw', () => {
    const hostile = {
      tracks: [],
      get bpm(): number {
        throw new Error('boom');
      },
    };

    expect(validateProject(hostile, catalog)).toBeNull();
  });
});
