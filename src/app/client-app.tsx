'use client';

import * as React from 'react';
import App from '../presentation/App';
import { ServiceProvider } from '../service-core';
import type { Language } from '@/config/localization';
import { ui } from '@/config/localization';

type ErrorBoundaryState = { error: Error | null };

class AppErrorBoundary extends React.Component<React.PropsWithChildren<{ language: Language }>, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      const text = ui[this.props.language];
      return (
        <main className="app-fallback">
          <h1>{text.errorTitle}</h1>
          <p>{text.errorDescription}</p>
          <pre>{this.state.error.message}</pre>
          <button onClick={() => window.location.reload()}>{text.reload}</button>
        </main>
      );
    }
    return this.props.children;
  }
}

export default function ClientApp({ language }: { language: Language }) {
  return (
    <React.StrictMode>
      <AppErrorBoundary language={language}>
        <ServiceProvider language={language}>
          <App />
        </ServiceProvider>
      </AppErrorBoundary>
    </React.StrictMode>
  );
}
