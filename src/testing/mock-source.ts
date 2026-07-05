import type { PersistableSource } from "../core/persist-core";

/**
 * A minimal `PersistableSource` for tests — a plain object with
 * `getState` / `setState` / `subscribe` + a `state` getter for assertions.
 * Test-only; not a tsdown/typedoc entry, so not shipped in `dist/`.
 */
export function createMockSource<T>(
  initial: T,
): PersistableSource<T> & { state: T } {
  let state = initial;
  const listeners = new Set<() => void>();

  return {
    get state() {
      return state;
    },
    getState: () => state,
    setState: (updater) => {
      state = updater(state);
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return {
        unsubscribe: () => listeners.delete(listener),
      };
    },
  };
}
