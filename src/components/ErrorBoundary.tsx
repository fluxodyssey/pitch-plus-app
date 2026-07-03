import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="page" style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 16, minHeight: '60vh',
      }}>
        <h2 style={{ color: 'var(--text-1, var(--text-1))', margin: 0 }}>
          Something went wrong
        </h2>
        <p style={{ color: 'var(--text-2, #8892a4)', maxWidth: 480, textAlign: 'center' }}>
          {this.state.error?.message || 'An unexpected error occurred.'}
        </p>
        <button
          onClick={() => {
            this.setState({ hasError: false, error: null });
            window.location.reload();
          }}
          style={{
            padding: '8px 20px', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: 'var(--accent, #4a9eff)', color: '#fff', fontSize: 14,
          }}
        >
          Reload
        </button>
      </div>
    );
  }
}
