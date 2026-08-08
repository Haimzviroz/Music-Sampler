import type { EffectName, Instrument, Project } from '../types/project';
import { DEFAULT_EFFECTS, LIMITS } from '../types/project';
import { createTrack, emptySteps, labelFor, resizeSteps } from './project';

export type ProjectAction =
  | { type: 'replace'; project: Project }
  | { type: 'rename'; name: string }
  | { type: 'toggleStep'; trackId: string; step: number }
  | { type: 'setStep'; trackId: string; step: number; value: boolean }
  | { type: 'setBpm'; bpm: number }
  | { type: 'setSteps'; steps: number }
  | { type: 'setSwing'; swing: number }
  | { type: 'setMasterVolume'; volume: number }
  | { type: 'setLoop'; loop: boolean }
  | { type: 'addInstrument'; instrument: Instrument }
  | { type: 'removeTrack'; trackId: string }
  | { type: 'setTrackNote'; trackId: string; note: string; instrument: Instrument }
  | { type: 'setTrackVolume'; trackId: string; volume: number }
  | { type: 'setTrackEffect'; trackId: string; effect: EffectName; value: number }
  | { type: 'resetTrackEffects'; trackId: string }
  | { type: 'toggleMute'; trackId: string }
  | { type: 'toggleSolo'; trackId: string }
  | { type: 'moveTrack'; trackId: string; offset: -1 | 1 }
  | { type: 'clearAll' };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function updateTrack(project: Project, trackId: string, update: (track: Project['tracks'][number]) => Project['tracks'][number]): Project {
  return {
    ...project,
    tracks: project.tracks.map(track => (track.id === trackId ? update(track) : track)),
  };
}

export function projectReducer(project: Project, action: ProjectAction): Project {
  switch (action.type) {
    case 'replace':
      return action.project;

    case 'rename':
      return { ...project, name: action.name };

    case 'toggleStep':
      return updateTrack(project, action.trackId, track => {
        const steps = [...track.steps];
        steps[action.step] = !steps[action.step];
        return { ...track, steps };
      });

    /**
     * Used while dragging across the grid. Returns the same project when the
     * step already holds the requested value, so sweeping back over cells that
     * are already painted costs nothing.
     */
    case 'setStep': {
      const track = project.tracks.find(candidate => candidate.id === action.trackId);
      if (!track || track.steps[action.step] === action.value) return project;
      return updateTrack(project, action.trackId, current => {
        const steps = [...current.steps];
        steps[action.step] = action.value;
        return { ...current, steps };
      });
    }

    case 'setBpm':
      return { ...project, bpm: clamp(Math.round(action.bpm), LIMITS.bpm.min, LIMITS.bpm.max) };

    case 'setSteps': {
      const steps = clamp(Math.round(action.steps), LIMITS.steps.min, LIMITS.steps.max);
      if (steps === project.steps) return project;
      return {
        ...project,
        steps,
        tracks: project.tracks.map(track => ({ ...track, steps: resizeSteps(track.steps, steps) })),
      };
    }

    case 'setSwing':
      return { ...project, swing: clamp(action.swing, 0, 1) };

    case 'setMasterVolume':
      return { ...project, masterVolume: clamp(action.volume, 0, 1) };

    case 'setLoop':
      return { ...project, loop: action.loop };

    case 'addInstrument': {
      const notes = action.instrument.defaultNotes.length
        ? action.instrument.defaultNotes
        : action.instrument.samples.slice(0, 4).map(sample => sample.note);
      return {
        ...project,
        tracks: [...project.tracks, ...notes.map(note => createTrack(action.instrument, note, project.steps))],
      };
    }

    case 'removeTrack':
      return { ...project, tracks: project.tracks.filter(track => track.id !== action.trackId) };

    case 'setTrackNote':
      return updateTrack(project, action.trackId, track => ({
        ...track,
        note: action.note,
        label: labelFor(action.instrument, action.note),
      }));

    case 'setTrackVolume':
      return updateTrack(project, action.trackId, track => ({ ...track, volume: clamp(action.volume, 0, 1) }));

    case 'setTrackEffect':
      return updateTrack(project, action.trackId, track => ({
        ...track,
        effects: { ...DEFAULT_EFFECTS, ...track.effects, [action.effect]: clamp(action.value, 0, 1) },
      }));

    case 'resetTrackEffects':
      return updateTrack(project, action.trackId, track => ({ ...track, effects: { ...DEFAULT_EFFECTS } }));

    case 'toggleMute':
      return updateTrack(project, action.trackId, track => ({ ...track, muted: !track.muted }));

    case 'toggleSolo':
      return updateTrack(project, action.trackId, track => ({ ...track, solo: !track.solo }));

    case 'moveTrack': {
      const index = project.tracks.findIndex(track => track.id === action.trackId);
      const target = index + action.offset;
      if (index < 0 || target < 0 || target >= project.tracks.length) return project;
      const tracks = [...project.tracks];
      [tracks[index], tracks[target]] = [tracks[target], tracks[index]];
      return { ...project, tracks };
    }

    case 'clearAll':
      return {
        ...project,
        tracks: project.tracks.map(track => ({ ...track, steps: emptySteps(project.steps) })),
      };

    default:
      return project;
  }
}
