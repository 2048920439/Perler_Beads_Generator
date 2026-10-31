'use client';

import { useSyncExternalStore } from 'react';
import type { BehaviorSubject } from 'rxjs';

export function useObservableState<T>(source: BehaviorSubject<T>): T {
  return useSyncExternalStore(
    (listener) => {
      const subscription = source.subscribe(() => listener());
      return () => subscription.unsubscribe();
    },
    () => source.getValue(),
    () => source.getValue(),
  );
}
