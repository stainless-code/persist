// pinia source adapter — peer `pinia` >=2.0.0.
import type { Store, StoreState } from "pinia";

import type { PersistApi, PersistOptions } from "../../core/persist-core";
import { persistSource } from "../../core/persist-core";

/**
 * Persist a Pinia store. `$state` / `$subscribe` map to `PersistableSource`.
 * Hydrate assigns `$state` (shallow Object.assign via Pinia's setter), not
 * object `$patch`.
 *
 * @example
 * ```ts
 * import { defineStore } from "pinia";
 * import { createJSONStorage } from "@stainless-code/persist";
 * import { persistStore } from "@stainless-code/persist/sources/pinia";
 * const useCountStore = defineStore("count", { state: () => ({ count: 0 }) });
 * const store = useCountStore();
 * const persist = persistStore(store, { name: "count", storage: createJSONStorage(() => localStorage) });
 * ```
 */
export function persistStore<
  TStore extends Store,
  TPersistedState = StoreState<TStore>,
>(
  store: TStore,
  options: PersistOptions<StoreState<TStore>, TPersistedState>,
): PersistApi<StoreState<TStore>, TPersistedState> {
  return persistSource(
    {
      getState: () => store.$state as StoreState<TStore>,
      setState: (updater) => {
        store.$state = updater(
          store.$state as StoreState<TStore>,
        ) as TStore["$state"];
      },
      subscribe: (listener) => ({
        unsubscribe: store.$subscribe(() => listener(), { detached: true }),
      }),
    },
    options,
  );
}
