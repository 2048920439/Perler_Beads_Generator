'use client';

import * as React from 'react';
import App from '../presentation/App';
import { ServiceProvider } from '../service-core';
import type { Language } from '@/config/localization';

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

export default function ClientApp({ language }: { language: Language }) {
  return (
    <React.StrictMode>
      <AppErrorBoundary>
        <ServiceProvider language={language}>
          <App />
        </ServiceProvider>
      </AppErrorBoundary>
    </React.StrictMode>
  );
}
