import { useCallback, useMemo, useReducer } from 'react';
import type { EffectName, Instrument, Project } from '../types/project';
import { projectReducer, type ProjectAction } from '../state/projectReducer';

export interface ProjectActions {
  replace(project: Project): void;
  rename(name: string): void;
  toggleStep(trackId: string, step: number): void;
  setStep(trackId: string, step: number, value: boolean): void;
  setBpm(bpm: number): void;
  setSteps(steps: number): void;
  setSwing(swing: number): void;
  setMasterVolume(volume: number): void;
  setLoop(loop: boolean): void;
  addTrack(instrument: Instrument, note: string): void;
  addInstrument(instrument: Instrument): void;
  removeTrack(trackId: string): void;
  setTrackNote(trackId: string, note: string, instrument: Instrument): void;
  setTrackVolume(trackId: string, volume: number): void;
  setTrackEffect(trackId: string, effect: EffectName, value: number): void;
  resetTrackEffects(trackId: string): void;
  toggleMute(trackId: string): void;
  toggleSolo(trackId: string): void;
  moveTrack(trackId: string, offset: -1 | 1): void;
  clearTrack(trackId: string): void;
  clearAll(): void;
}

export function useProject(initial: Project): [Project, ProjectActions] {
  const [project, dispatch] = useReducer(projectReducer, initial);

  const send = useCallback((action: ProjectAction) => dispatch(action), []);

  const actions = useMemo<ProjectActions>(
    () => ({
      replace: project => send({ type: 'replace', project }),
      rename: name => send({ type: 'rename', name }),
      toggleStep: (trackId, step) => send({ type: 'toggleStep', trackId, step }),
      setStep: (trackId, step, value) => send({ type: 'setStep', trackId, step, value }),
      setBpm: bpm => send({ type: 'setBpm', bpm }),
      setSteps: steps => send({ type: 'setSteps', steps }),
      setSwing: swing => send({ type: 'setSwing', swing }),
      setMasterVolume: volume => send({ type: 'setMasterVolume', volume }),
      setLoop: loop => send({ type: 'setLoop', loop }),
      addTrack: (instrument, note) => send({ type: 'addTrack', instrument, note }),
      addInstrument: instrument => send({ type: 'addInstrument', instrument }),
      removeTrack: trackId => send({ type: 'removeTrack', trackId }),
      setTrackNote: (trackId, note, instrument) => send({ type: 'setTrackNote', trackId, note, instrument }),
      setTrackVolume: (trackId, volume) => send({ type: 'setTrackVolume', trackId, volume }),
      setTrackEffect: (trackId, effect, value) => send({ type: 'setTrackEffect', trackId, effect, value }),
      resetTrackEffects: trackId => send({ type: 'resetTrackEffects', trackId }),
      toggleMute: trackId => send({ type: 'toggleMute', trackId }),
      toggleSolo: trackId => send({ type: 'toggleSolo', trackId }),
      moveTrack: (trackId, offset) => send({ type: 'moveTrack', trackId, offset }),
      clearTrack: trackId => send({ type: 'clearTrack', trackId }),
      clearAll: () => send({ type: 'clearAll' }),
    }),
    [send],
  );

  return [project, actions];
}
