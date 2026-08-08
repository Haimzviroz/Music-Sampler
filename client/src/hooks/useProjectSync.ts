import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE, ApiError, fetchProject, saveProject } from '../api/client';
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
  /** False until the catalog has settled; loading earlier would validate against a placeholder. */
  catalogReady: boolean,
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
      // schedules another attempt on its own. A rejection from the server is
      // reported as such — calling a 422 "offline" would hide a real contract
      // failure behind a network excuse.
      setMessage(describe(error));
      setStatus(error instanceof ApiError ? 'error' : 'offline');
    } finally {
      if (saveControllerRef.current === controller) saveControllerRef.current = null;
    }
  }, []);

  const saveNow = useCallback(() => {
    cancelTimer();
    saveLocalProject(projectRef.current);
    void flush();
  }, [cancelTimer, flush]);

  // Initial load. Runs once the catalog has settled, and only once.
  useEffect(() => {
    if (!catalogReady || instruments.length === 0) return;
    // Held in a local: the object identity never changes, and the cleanup below
    // must not reach back into the ref.
    const load = loadRef.current;
    if (load.started || load.settled) return;
    load.started = true;

    const controller = new AbortController();
    let cancelled = false;

    const catalog = instruments;

    const settle = (loaded: Project | null, next: SyncStatus, fromServer: boolean, reason?: string) => {
      if (cancelled) return;
      load.settled = true;
      if (loaded) {
        // Only a project the server itself handed back is already saved there.
        // A local mirror has never been seen by the server, so leaving the
        // marker null lets the first autosave push it.
        savedPayloadRef.current = fromServer ? JSON.stringify(loaded) : null;
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
          settle(valid, 'saved', true);
          return;
        }
        // 404, or a body the server accepted but we cannot use — fall through
        // to the mirror rather than starting from scratch.
      } catch (error) {
        if (cancelled) return;
        serverReason = `Server unreachable: ${describe(error)}`;
      }

      const local = validateProject(loadLocalProject(), catalog);
      settle(local, serverReason ? 'offline' : 'idle', false, serverReason);
    })();

    return () => {
      cancelled = true;
      controller.abort();
      // A StrictMode remount aborts a load that never finished; let the second
      // mount start it again instead of hydrating off a cancelled request.
      if (!load.settled) load.started = false;
    };
  }, [catalogReady, instruments]);

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

  /**
   * A debounced save that has not fired yet dies with the tab. `sendBeacon`
   * hands the payload to the browser, which delivers it after the page is gone
   * — a `fetch` here would simply be cancelled.
   */
  useEffect(() => {
    const flushOnUnload = () => {
      if (!hydratedRef.current) return;
      const payload = JSON.stringify(projectRef.current);
      if (payload === savedPayloadRef.current) return;
      navigator.sendBeacon?.(`${API_BASE}/api/state`, new Blob([payload], { type: 'application/json' }));
    };

    window.addEventListener('beforeunload', flushOnUnload);
    return () => window.removeEventListener('beforeunload', flushOnUnload);
  }, []);

  useEffect(
    () => () => {
      cancelTimer();
      saveControllerRef.current?.abort();
    },
    [cancelTimer],
  );

  return { status, lastSavedAt, hydrated, message, saveNow };
}
