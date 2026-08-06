import { useEffect, useRef } from 'react';

export interface ShortcutHandlers {
  togglePlay(): void;
  rewind(): void;
  toggleLoop(): void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * Global transport shortcuts, the way a sequencer is expected to behave: space
 * always starts and stops, even when a step button has focus. Keyboard users
 * still activate the focused button with Enter. Text fields keep every key.
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers): void {
  const ref = useRef(handlers);

  useEffect(() => {
    ref.current = handlers;
  }, [handlers]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      switch (event.code) {
        case 'Space':
          event.preventDefault();
          ref.current.togglePlay();
          break;
        case 'Home':
        case 'Backspace':
          event.preventDefault();
          ref.current.rewind();
          break;
        case 'KeyL':
          event.preventDefault();
          ref.current.toggleLoop();
          break;
        default:
          break;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
