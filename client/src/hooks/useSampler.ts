import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE } from '../api/client';
import { SamplerEngine } from '../audio/engine';
import type { Instrument, Project } from '../types/project';

export interface SamplerControls {
  isPlaying: boolean;
  /** Column currently sounding, or -1 when stopped. */
  currentStep: number;
  /** True while sample buffers are still downloading. */
  loadingSamples: boolean;
  play(): Promise<void>;
  stop(): void;
  togglePlay(): void;
  rewind(): void;
  audition(trackId: string): void;
}

/**
 * Binds the project to the audio engine: the engine is created once, kept in a
 * ref, and re-synced whenever the project changes. React state only mirrors
 * what the UI needs to draw.
 */
export function useSampler(project: Project, instruments: Instrument[]): SamplerControls {
  const engineRef = useRef<SamplerEngine | null>(null);
  const projectRef = useRef(project);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [loadingSamples, setLoadingSamples] = useState(true);

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    const engine = new SamplerEngine();
    engineRef.current = engine;

    engine.onStep = step => setCurrentStep(step);
    engine.onEnd = () => {
      engine.stop();
      setIsPlaying(false);
      setCurrentStep(-1);
    };

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    let cancelled = false;
    setLoadingSamples(true);

    const settle = () => {
      if (cancelled) return;
      // The buffers that just arrived replace whatever voices were built while
      // the download was in flight.
      engine.resetVoices();
      engine.sync(projectRef.current, instruments);
      setLoadingSamples(false);
    };

    // `loadCatalog` swallows per-sample failures, but a rejection here would
    // otherwise leave the app loading forever with the voices never rebuilt.
    engine.loadCatalog(instruments, API_BASE).then(settle, settle);

    return () => {
      cancelled = true;
    };
  }, [instruments]);

  useEffect(() => {
    engineRef.current?.sync(project, instruments);
  }, [project, instruments]);

  const play = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    await engine.start();
    setIsPlaying(true);
  }, []);

  const stop = useCallback(() => {
    engineRef.current?.stop();
    setIsPlaying(false);
    setCurrentStep(-1);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      stop();
    } else {
      void play();
    }
  }, [isPlaying, play, stop]);

  const rewind = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (isPlaying) {
      engine.rewind();
    } else {
      setCurrentStep(-1);
    }
  }, [isPlaying]);

  const audition = useCallback((trackId: string) => {
    void engineRef.current?.audition(trackId);
  }, []);

  return { isPlaying, currentStep, loadingSamples, play, stop, togglePlay, rewind, audition };
}
