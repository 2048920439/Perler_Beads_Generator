'use client';

import * as React from 'react';
import App from '../src/presentation/App';
import { ServiceProvider } from '../src/service-core';

type ErrorBoundaryState = { error: Error | null };

class AppErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="app-fallback">
          <h1>Perler Beads Generator</h1>
          <p>Something went wrong. Please reload the page.</p>
          <pre>{this.state.error.message}</pre>
          <button onClick={() => window.location.reload()}>Reload</button>
        </main>
      );
    }
    return this.props.children;
  }
}

export default function ClientApp() {
  return (
    <React.StrictMode>
      <AppErrorBoundary>
        <ServiceProvider>
          <App />
        </ServiceProvider>
      </AppErrorBoundary>
    </React.StrictMode>
  );
}
