import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Popup/options contexts have no browser chrome to fall back on — an
 * uncaught render error would otherwise leave a blank extension surface
 * with no way to recover short of closing and reopening it.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Extension Manager crashed:', error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="mx-auto flex min-w-64 max-w-sm flex-col items-center gap-2 bg-zinc-900 px-4 py-8 text-center text-zinc-100">
        <p className="text-sm font-medium">Something went wrong.</p>
        <p className="text-xs text-zinc-500">{error.message}</p>
        <button
          type="button"
          onClick={this.reset}
          className="mt-2 rounded bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-400"
        >
          Try again
        </button>
      </div>
    );
  }
}
