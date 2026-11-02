import type { BehaviorSubject, Observable } from 'rxjs';

export type ReadonlyState<T> = Observable<T> & { getValue(): T };

export function readonlyState<T>(state: BehaviorSubject<T>): ReadonlyState<T> {
  return Object.assign(state.asObservable(), { getValue: () => state.getValue() });
}
