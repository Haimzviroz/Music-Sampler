import { useCallback, useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import { createVoices, type Voice } from '../audio/instruments';
import type { GridState } from '../types/types';

/**
 * Drives playback with Tone.Transport, which schedules ahead against the
 * Web Audio clock rather than a JS timer. Visual updates go through
 * Tone.Draw so the playhead lands with the sound instead of ahead of it.
 */
export function useTransport(pattern: GridState, bpm: number) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);

  // Read inside the audio callback, so toggling a cell takes effect on the
  // next step without rebuilding the sequence. Synced in an effect rather
  // than during render; the callback only ever fires from Tone's scheduler.
  const patternRef = useRef(pattern);
  useEffect(() => {
    patternRef.current = pattern;
  }, [pattern]);

  const voicesRef = useRef<Voice[]>([]);
  const sequenceRef = useRef<Tone.Sequence<number> | null>(null);

  const steps = pattern[0]?.length ?? 0;

  useEffect(() => {
    Tone.getTransport().bpm.value = bpm;
  }, [bpm]);

  useEffect(() => {
    if (steps === 0) return;

    const voices = createVoices();
    voicesRef.current = voices;

    const sequence = new Tone.Sequence<number>(
      (time, step) => {
        patternRef.current.forEach((row, rowIndex) => {
          if (row[step]) {
            voices[rowIndex]?.trigger(time);
          }
        });
        Tone.getDraw().schedule(() => setCurrentStep(step), time);
      },
      Array.from({ length: steps }, (_, i) => i),
      '16n'
    );
    sequenceRef.current = sequence;

    return () => {
      sequence.dispose();
      voices.forEach(voice => voice.dispose());
      sequenceRef.current = null;
      voicesRef.current = [];
    };
  }, [steps]);

  const start = useCallback(async () => {
    // Browsers block audio until a user gesture; this must run from the click.
    await Tone.start();
    const transport = Tone.getTransport();
    transport.stop();
    transport.position = 0;
    sequenceRef.current?.start(0);
    transport.start();
    setIsPlaying(true);
  }, []);

  const stop = useCallback(() => {
    Tone.getTransport().stop();
    sequenceRef.current?.stop();
    // Drop any repaints already queued, so the playhead does not flash a
    // stale step after stopping.
    Tone.getDraw().cancel();
    setCurrentStep(-1);
    setIsPlaying(false);
  }, []);

  return { isPlaying, currentStep, start, stop };
}
