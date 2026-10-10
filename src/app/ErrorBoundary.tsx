import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last-resort error UI so a render crash never leaves a blank page.
 * Shows the message plus a way to recover (reload / go home).
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[sakura-ledger] Render error:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="page" style={{ maxWidth: 640, margin: '0 auto', paddingTop: 'var(--spacing-xl)' }}>
        <div className="card">
          <h1 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--spacing-sm)' }}>Something went wrong</h1>
          <p className="muted text-sm" style={{ marginBottom: 'var(--spacing-md)' }}>
            The app hit an unexpected error. Your data is stored locally and was not changed by this failure.
          </p>
          <pre
            className="text-sm"
            style={{
              whiteSpace: 'pre-wrap',
              backgroundColor: 'var(--brand-muted-surface)',
              padding: 'var(--spacing-md)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--spacing-md)',
              border: '1px solid var(--brand-border)',
            }}
          >
            {this.state.error.message}
          </pre>
          <div className="page-actions">
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload app
            </button>
            <a className="btn btn-ghost" href="/dashboard">
              Go to dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }
}
