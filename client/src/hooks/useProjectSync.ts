import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchProject, saveProject } from '../api/client';
import { FALLBACK_INSTRUMENTS } from '../audio/fallbackCatalog';
import { loadLocalProject, saveLocalProject } from '../state/storage';
import { validateProject } from '../state/validateProject';
import type { Instrument, Project } from '../types/project';

export type SyncStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'offline' | 'error';

export interface ProjectSync {
  status: SyncStatus;
  lastSavedAt: number | null;
  /** Set once the initial load has settled, so the app knows the project is authoritative. */
  hydrated: boolean;
  message?: string;
  saveNow(): void;
}

/** Long enough that dragging a slider is one save, short enough to feel automatic. */
const SAVE_DEBOUNCE_MS = 800;

function describe(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

/**
 * Keeps the project in sync with the server and with `localStorage`.
 *
 * Load order on mount is server → local mirror → nothing; whatever comes back
 * is validated before the app ever sees it. Afterwards the mirror is written on
 * every change and the server is written on a debounce.
 *
 * `onLoaded` is called at most once, and only when a valid saved project was
 * actually found — the caller keeps its starter project otherwise.
 */
export function useProjectSync(
  project: Project,
  instruments: Instrument[],
  onLoaded: (project: Project) => void,
): ProjectSync {
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [hydrated, setHydrated] = useState(false);

  // Latest values, read from callbacks that must not re-create on every render.
  const projectRef = useRef(project);
  const onLoadedRef = useRef(onLoaded);

  /**
   * The autosave gate. This mirrors the `hydrated` state but is readable
   * synchronously, because a save scheduled a tick before the initial load
   * settles would push the starter pattern over the user's saved project.
   */
  const hydratedRef = useRef(false);
  /** Survives StrictMode's double mount so the project is loaded exactly once. */
  const loadRef = useRef({ started: false, settled: false });
  /** Serialised form of the last project the server accepted; `null` until one is. */
  const savedPayloadRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  // Declared first so every effect below reads the current render's values.
  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    onLoadedRef.current = onLoaded;
  }, [onLoaded]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const cancelTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const flush = useCallback(async () => {
    // Second gate, on the path that actually writes. See `hydratedRef`.
    if (!hydratedRef.current) return;

    const current = projectRef.current;
    const payload = JSON.stringify(current);
    if (payload === savedPayloadRef.current) return;

    // A newer edit supersedes whatever is still in flight; last write wins.
    saveControllerRef.current?.abort();
    const controller = new AbortController();
    saveControllerRef.current = controller;

    setStatus('saving');

    try {
      await saveProject(current, controller.signal);
      if (controller.signal.aborted || !mountedRef.current) return;
      savedPayloadRef.current = payload;
      setLastSavedAt(Date.now());
      setMessage(undefined);
      setStatus('saved');
    } catch (error) {
      if (controller.signal.aborted || !mountedRef.current) return;
      // No retry loop: the mirror already holds this change, and the next edit
      // schedules another attempt on its own.
      setMessage(describe(error));
      setStatus('offline');
    } finally {
      if (saveControllerRef.current === controller) saveControllerRef.current = null;
    }
  }, []);

  const saveNow = useCallback(() => {
    cancelTimer();
    saveLocalProject(projectRef.current);
    void flush();
  }, [cancelTimer, flush]);

  // Initial load. Runs once instruments are available, and only once.
  useEffect(() => {
    if (instruments.length === 0) return;
    // Held in a local: the object identity never changes, and the cleanup below
    // must not reach back into the ref.
    const load = loadRef.current;
    if (load.started || load.settled) return;
    load.started = true;

    const controller = new AbortController();
    let cancelled = false;

    // While the built-in fallback is in place the real catalog is either still
    // in flight or unreachable. Validating against it would drop tracks whose
    // instrument only exists on the server, so treat it as "not loaded yet".
    const catalog = instruments === FALLBACK_INSTRUMENTS ? [] : instruments;

    const settle =(loaded: Project | null, next: SyncStatus, reason?: string) => {
      if (cancelled) return;
      load.settled = true;
      if (loaded) {
        // Remember what the server already has so hydration does not bounce
        // the very same project straight back at it.
        savedPayloadRef.current = next === 'offline' ? null : JSON.stringify(loaded);
        onLoadedRef.current(loaded);
      }
      setMessage(reason);
      setStatus(next);
      hydratedRef.current = true;
      setHydrated(true);
    };

    setStatus('loading');

    void (async () => {
      let serverReason: string | undefined;

      try {
        const remote = await fetchProject(controller.signal);
        if (cancelled) return;
        const valid = validateProject(remote, catalog);
        if (valid) {
          // Already on the server by definition, so the chip opens on "Saved".
          settle(valid, 'saved');
          return;
        }
        // 404, or a body the server accepted but we cannot use — fall through
        // to the mirror rather than starting from scratch.
      } catch (error) {
        if (cancelled) return;
        serverReason = `Server unreachable: ${describe(error)}`;
      }

      const local = validateProject(loadLocalProject(), catalog);
      settle(local, serverReason ? 'offline' : 'idle', serverReason);
    })();

    return () => {
      cancelled = true;
      controller.abort();
      // A StrictMode remount aborts a load that never finished; let the second
      // mount start it again instead of hydrating off a cancelled request.
      if (!load.settled) load.started = false;
    };
  }, [instruments]);

  // Autosave. Mirror synchronously, server on a debounce.
  useEffect(() => {
    if (!hydrated) return;
    if (JSON.stringify(project) === savedPayloadRef.current) return;

    saveLocalProject(project);

    cancelTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void flush();
    }, SAVE_DEBOUNCE_MS);
  }, [project, hydrated, cancelTimer, flush]);

  useEffect(
    () => () => {
      cancelTimer();
      saveControllerRef.current?.abort();
    },
    [cancelTimer],
  );

  return { status, lastSavedAt, hydrated, message, saveNow };
}
