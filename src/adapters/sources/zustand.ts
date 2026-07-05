// zustand source adapter — peer `zustand` >=4.0.0.
import type { StoreApi } from "zustand";

import type { PersistApi, PersistOptions } from "../../core/persist-core";
import { persistSource } from "../../core/persist-core";

/**
 * Persist a zustand store. zustand's `getState`/`setState`/`subscribe` map
 * directly to `PersistableSource`.
 *
 * @example
 * ```ts
 * import { create } from "zustand";
 * import { persistZustand } from "@stainless-code/persist/sources/zustand";
 * const store = create(() => ({ count: 0 }));
 * const persist = persistZustand(store, { name: "count", storage: createJSONStorage(() => localStorage) });
 * ```
 */
export function persistZustand<TState, TPersistedState = TState>(
  store: StoreApi<TState>,
  options: PersistOptions<TState, TPersistedState>,
): PersistApi<TState, TPersistedState> {
  return persistSource(
    {
      getState: () => store.getState(),
      setState: (updater) => store.setState(updater),
      subscribe: (listener) => {
        const unsub = store.subscribe(() => listener());
        return { unsubscribe: unsub };
      },
    },
    options,
  );
}
