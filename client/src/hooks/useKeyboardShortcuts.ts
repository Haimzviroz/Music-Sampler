import { useEffect, useRef } from 'react';

export interface ShortcutHandlers {
  togglePlay(): void;
  rewind(): void;
  toggleLoop(): void;
  save(): void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * Space belongs to whatever control has focus — activating a focused button
 * with it is a baseline expectation for anyone navigating by keyboard, and
 * taking it away is not ours to do. Clicking a step cell does not leave focus
 * on it (see `StepCell`), so in practice space still starts and stops the
 * transport while a pattern is being programmed with the mouse.
 */
function isActivatable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return ['BUTTON', 'A', 'SUMMARY'].includes(target.tagName) || target.tabIndex >= 0;
}

/**
 * Global transport shortcuts. Text fields keep every key; space additionally
 * defers to any focusable control that has focus.
 */
export function useKeyboardShortcuts(handlers: ShortcutHandlers): void {
  const ref = useRef(handlers);

  useEffect(() => {
    ref.current = handlers;
  }, [handlers]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Ctrl/Cmd+S saves, everywhere, including from inside a field: the browser
      // "save page" dialog is never what someone wants here.
      if ((event.ctrlKey || event.metaKey) && event.code === 'KeyS') {
        event.preventDefault();
        ref.current.save();
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      switch (event.code) {
        case 'Space':
          if (isActivatable(event.target)) return;
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
