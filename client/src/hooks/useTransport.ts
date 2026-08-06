import { useCallback, useEffect, useRef, useState } from 'react';
import { getAudioContext, resumeAudioContext } from '../audio/audioContext';

/** How often the scheduler wakes up to look ahead, in ms. */
const LOOKAHEAD_MS = 25;
/** How far ahead of the audio clock we schedule, in seconds. */
const SCHEDULE_AHEAD_TIME = 0.1;
/** Small offset so the first step is not scheduled in the past. */
const START_DELAY = 0.05;

interface ScheduledStep {
  step: number;
  time: number;
}

/**
 * Step sequencer transport built on the two-clock pattern: a coarse
 * setInterval schedules steps ahead of time against AudioContext.currentTime
 * (sample accurate), while requestAnimationFrame only paints the playhead.
 * JS timers are never used for timing itself — they drift and get throttled.
 */
export function useTransport(steps: number, bpm: number) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);

  const nextStepRef = useRef(0);
  const nextStepTimeRef = useRef(0);
  const queueRef = useRef<ScheduledStep[]>([]);

  // Kept in refs so tempo and length can change mid-playback without
  // tearing down the scheduler.
  const stepsRef = useRef(steps);
  const bpmRef = useRef(bpm);
  stepsRef.current = steps;
  bpmRef.current = bpm;

  const start = useCallback(async () => {
    const ctx = await resumeAudioContext();
    nextStepRef.current = 0;
    nextStepTimeRef.current = ctx.currentTime + START_DELAY;
    queueRef.current = [];
    setIsPlaying(true);
  }, []);

  const stop = useCallback(() => {
    setIsPlaying(false);
    setCurrentStep(-1);
    queueRef.current = [];
  }, []);

  useEffect(() => {
    if (!isPlaying) return;

    const ctx = getAudioContext();

    const scheduler = () => {
      while (nextStepTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD_TIME) {
        queueRef.current.push({
          step: nextStepRef.current,
          time: nextStepTimeRef.current,
        });
        // 16th notes: a quarter note lasts 60/bpm seconds.
        nextStepTimeRef.current += 60 / bpmRef.current / 4;
        nextStepRef.current = (nextStepRef.current + 1) % stepsRef.current;
      }
    };

    scheduler();
    const timerId = window.setInterval(scheduler, LOOKAHEAD_MS);

    let rafId = 0;
    const draw = () => {
      let stepToPaint = -1;
      while (queueRef.current.length && queueRef.current[0].time <= ctx.currentTime) {
        stepToPaint = queueRef.current[0].step;
        queueRef.current.shift();
      }
      if (stepToPaint !== -1) {
        setCurrentStep(stepToPaint);
      }
      rafId = requestAnimationFrame(draw);
    };
    rafId = requestAnimationFrame(draw);

    return () => {
      window.clearInterval(timerId);
      cancelAnimationFrame(rafId);
    };
  }, [isPlaying]);

  return { isPlaying, currentStep, start, stop };
}
