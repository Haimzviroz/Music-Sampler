import type { SyncStatus } from '../../hooks/useProjectSync';
import './SaveIndicator.css';

interface SaveIndicatorProps {
  status: SyncStatus;
  lastSavedAt: number | null;
  /** Detail behind an `offline` or `error` status, surfaced as the tooltip. */
  message?: string;
}

function formatTime(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function labelFor(status: SyncStatus, lastSavedAt: number | null): string {
  switch (status) {
    case 'loading':
      return 'Loading…';
    case 'saving':
      return 'Saving…';
    case 'saved': {
      const at = lastSavedAt === null ? '' : ` ${formatTime(lastSavedAt)}`;
      return `Saved${at}`;
    }
    case 'offline':
      return 'Offline — saved locally';
    case 'error':
      return 'Could not save';
    default:
      return lastSavedAt === null ? 'Not saved yet' : `Saved ${formatTime(lastSavedAt)}`;
  }
}

/**
 * Purely presentational chip. `role="status"` with a polite live region so the
 * change from "Saving…" to "Saved" is announced without stealing focus.
 */
function SaveIndicator({ status, lastSavedAt, message }: SaveIndicatorProps) {
  return (
    <span className={`save-indicator is-${status}`} role="status" aria-live="polite" title={message}>
      <span className="save-indicator-dot" aria-hidden="true" />
      {labelFor(status, lastSavedAt)}
    </span>
  );
}

export default SaveIndicator;
