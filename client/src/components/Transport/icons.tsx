/** Inline icons — no icon dependency, and they inherit the button's colour. */

export function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13a1 1 0 0 0 1.54.84l10-6.5a1 1 0 0 0 0-1.68l-10-6.5A1 1 0 0 0 8 5.5Z" />
    </svg>
  );
}

export function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

export function RewindIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <rect x="5" y="5.5" width="2.4" height="13" rx="1" />
      <path d="M20 6.7v10.6a1 1 0 0 1-1.53.85l-8.4-5.3a1 1 0 0 1 0-1.7l8.4-5.3A1 1 0 0 1 20 6.7Z" />
    </svg>
  );
}

export function LoopIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 3.5 20.5 7 17 10.5" />
      <path d="M20.5 7H7a3.5 3.5 0 0 0-3.5 3.5V12" />
      <path d="M7 20.5 3.5 17 7 13.5" />
      <path d="M3.5 17H17a3.5 3.5 0 0 0 3.5-3.5V12" />
    </svg>
  );
}

export function VolumeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M4 9.5h3.2L12 5.4a.8.8 0 0 1 1.3.6v12a.8.8 0 0 1-1.3.6L7.2 14.5H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z" />
      <path d="M16.2 8.4a.9.9 0 0 1 1.3.1 5.6 5.6 0 0 1 0 7 .9.9 0 1 1-1.4-1.1 3.8 3.8 0 0 0 0-4.8.9.9 0 0 1 .1-1.2Z" />
    </svg>
  );
}
