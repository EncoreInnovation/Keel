/**
 * Top-level crash guard. Without this, a render-time throw anywhere in the
 * tree unmounts the whole app to a blank white screen with no way back
 * short of guessing to reload — the worst possible failure mode for a daily
 * tool. Every write in this app is durability-first (a set is on disk before
 * any downstream math runs, see `sessionController.logSet`), so a reload
 * after a crash is genuinely safe — nothing logged is lost — and the copy
 * says so rather than leaving that to be assumed.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error?: Error;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('COLOSSUS crashed:', error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="today">
        <h1 className="today__day">Something broke</h1>
        <p className="placeholder__body">
          Your training data is saved as you go, so nothing logged is lost. Reloading is safe.
        </p>
        <button className="btn btn--hero" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
