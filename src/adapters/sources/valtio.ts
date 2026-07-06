// valtio source adapter — peer `valtio` >=1.0.0.
import { snapshot, subscribe } from "valtio/vanilla";

import type { PersistApi, PersistOptions } from "../../core/persist-core";
import { persistSource } from "../../core/persist-core";

/**
 * Persist a valtio proxy. `snapshot` for reads, `Object.assign` for writes,
 * `subscribe` for change tracking.
 *
 * @example
 * ```ts
 * import { proxy } from "valtio";
 * import { persistProxy } from "@stainless-code/persist/sources/valtio";
 * const state = proxy({ count: 0 });
 * const persist = persistProxy(state, { name: "count" });
 * ```
 */
export function persistProxy<TState extends object, TPersistedState = TState>(
  proxyObject: TState,
  options: PersistOptions<TState, TPersistedState>,
): PersistApi<TState, TPersistedState> {
  return persistSource(
    {
      getState: () => snapshot(proxyObject) as TState,
      setState: (updater) => {
        const next = updater(snapshot(proxyObject) as TState);
        Object.assign(proxyObject, next);
      },
      subscribe: (listener) => {
        const unsub = subscribe(proxyObject, () => listener());
        return { unsubscribe: unsub };
      },
    },
    options,
  );
}
