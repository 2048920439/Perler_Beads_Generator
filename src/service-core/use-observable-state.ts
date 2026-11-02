'use client';

import { useSyncExternalStore } from 'react';
import type { ReadonlyState } from './readonly-state';

export function useObservableState<T>(source: ReadonlyState<T>): T {
  return useSyncExternalStore(
    (listener) => {
      const subscription = source.subscribe(() => listener());
      return () => subscription.unsubscribe();
    },
    () => source.getValue(),
    () => source.getValue(),
  );
}
