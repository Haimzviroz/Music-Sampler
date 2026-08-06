import { Component, type ErrorInfo, type ReactNode } from 'react';
import { clearLocalProject } from '../../state/storage';
import './ErrorBoundary.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Last line of defence. Without one of these, anything thrown during render
 * leaves a blank page and no explanation.
 *
 * The recovery offered is deliberate: the most likely way a user reaches this
 * screen twice is a saved project the app cannot handle, and that save is
 * reloaded on every boot. Discarding it is the one action that breaks the loop.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // No logging service here, so the console is the only record there is.
    console.error('Music Sampler crashed:', error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="crash">
        <div className="crash-panel" role="alert">
          <h1>Something broke</h1>
          <p>The sampler hit an error it could not recover from on its own.</p>
          <pre className="crash-detail">{error.message}</pre>

          <div className="crash-actions">
            <button type="button" className="crash-action" onClick={() => window.location.reload()}>
              Reload
            </button>
            <button
              type="button"
              className="crash-action is-danger"
              onClick={() => {
                clearLocalProject();
                window.location.reload();
              }}
            >
              Discard the saved project and reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
