/**
 * The local mirror of the project.
 *
 * `localStorage` is the offline safety net: it is written on every change so a
 * refresh (or a server that is down) never loses the pattern. Every access is
 * wrapped because the API throws outright in private-mode browsers and on
 * quota overflow, and losing the mirror must never take the app down with it.
 */

import type { Project } from '../types/project';
import { PROJECT_VERSION } from '../types/project';

/**
 * Versioned so a project written by an older build is simply ignored rather
 * than half-read. Bump `PROJECT_VERSION` and old saves disappear on their own.
 */
export const STORAGE_KEY = `music-sampler:project:v${PROJECT_VERSION}`;

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Accessing the property itself throws when cookies are blocked.
    return null;
  }
}

/**
 * The parsed mirror, or `null` when there is none.
 *
 * The result is whatever was on disk: it is typed as `Project` for the caller's
 * convenience but it has *not* been checked. Always run it through
 * `validateProject` before handing it to the app.
 */
export function loadLocalProject(): Project | null {
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Project;
  } catch {
    return null;
  }
}

export function saveLocalProject(project: Project): void {
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(project));
  } catch {
    // Full quota or a blocked store. The server copy is still the real save.
  }
}

export function clearLocalProject(): void {
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do — the mirror is best effort in both directions.
  }
}
