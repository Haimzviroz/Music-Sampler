import { useEffect, useRef, useState } from 'react';
import type { Instrument, Project } from '../../types/project';
import { LIMITS } from '../../types/project';
import NumberField from '../common/NumberField';
import './PatternBar.css';

const STEP_PRESETS = [8, 16, 32];

interface PatternBarProps {
  project: Project;
  instruments: Instrument[];
  onSetSteps(steps: number): void;
  onAddInstrument(instrument: Instrument): void;
  onClearAll(): void;
}

function PatternBar({ project, instruments, onSetSteps, onAddInstrument, onClearAll }: PatternBarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;

    function onPointerDown(event: PointerEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) setPickerOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setPickerOpen(false);
      // Closing with the keyboard has to hand focus back, otherwise it falls to
      // the document and the keyboard user loses their place.
      triggerRef.current?.focus();
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [pickerOpen]);

  return (
    <div className="pattern-bar">
      <div className="pattern-group">
        <span className="pattern-label">Steps</span>
        {STEP_PRESETS.map(preset => (
          <button
            key={preset}
            type="button"
            className={`pattern-chip${project.steps === preset ? ' is-on' : ''}`}
            aria-pressed={project.steps === preset}
            onClick={() => onSetSteps(preset)}
          >
            {preset}
          </button>
        ))}
        <NumberField
          className="pattern-number"
          value={project.steps}
          min={LIMITS.steps.min}
          max={LIMITS.steps.max}
          label="Number of steps in the pattern"
          onCommit={onSetSteps}
        />
      </div>

      <div className="pattern-group pattern-group-end">
        {/* A disclosure, not a menu: it has no roving focus or arrow-key
            navigation, and claiming menu semantics it does not implement is
            worse for a screen reader than claiming none. */}
        <div className="pattern-picker" ref={pickerRef}>
          <button
            ref={triggerRef}
            type="button"
            className="pattern-action"
            onClick={() => setPickerOpen(open => !open)}
            aria-expanded={pickerOpen}
          >
            + Add instrument
          </button>

          {pickerOpen && (
            <div className="pattern-menu">
              {instruments.map(instrument => (
                <button
                  key={instrument.id}
                  type="button"
                  className="pattern-menu-item"
                  onClick={() => {
                    onAddInstrument(instrument);
                    setPickerOpen(false);
                    triggerRef.current?.focus();
                  }}
                >
                  <span className="pattern-menu-dot" style={{ background: instrument.color }} aria-hidden="true" />
                  <span>{instrument.name}</span>
                  <span className="pattern-menu-hint">
                    {instrument.kind === 'kit' ? `${instrument.samples.length} voices` : 'pitched'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button type="button" className="pattern-action" onClick={onClearAll}>
          Clear
        </button>
      </div>
    </div>
  );
}

export default PatternBar;
