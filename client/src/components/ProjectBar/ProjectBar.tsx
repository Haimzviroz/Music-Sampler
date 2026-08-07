import { useState } from 'react';
import './ProjectBar.css';

interface ProjectBarProps {
  name: string;
  onRename(name: string): void;
  onNewProject(): void;
}

function ProjectBar({ name, onRename, onNewProject }: ProjectBarProps) {
  // Two-step rather than a confirm dialog: discarding the pattern is worth a
  // deliberate second click, not a modal that gets dismissed by reflex.
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="project-bar">
      <label className="project-name-field">
        <span className="project-name-label">Project</span>
        <input
          type="text"
          className="project-name-input"
          value={name}
          maxLength={60}
          placeholder="Untitled"
          onChange={event => onRename(event.target.value)}
          aria-label="Project name"
        />
      </label>

      {confirming ? (
        <span className="project-confirm">
          <span className="project-confirm-text">Discard this pattern?</span>
          <button
            type="button"
            className="project-action is-danger"
            onClick={() => {
              setConfirming(false);
              onNewProject();
            }}
          >
            Yes, start over
          </button>
          <button
            type="button"
            className="project-action"
            // Focus lands on the safe option: the button that was clicked has
            // just been replaced, and a stray Enter should not discard a
            // pattern.
            ref={node => {
              node?.focus();
            }}
            onClick={() => setConfirming(false)}
          >
            Cancel
          </button>
        </span>
      ) : (
        <button type="button" className="project-action" onClick={() => setConfirming(true)}>
          New project
        </button>
      )}
    </div>
  );
}

export default ProjectBar;
