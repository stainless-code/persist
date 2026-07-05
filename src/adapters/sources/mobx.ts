// mobx source adapter — peer `mobx` >=6.0.0.
import { observe, toJS } from "mobx";

import type { PersistApi, PersistOptions } from "../../core/persist-core";
import { persistSource } from "../../core/persist-core";

/**
 * Persist a mobx observable object. `toJS` for reads, `Object.assign` for
 * writes, `observe` for change tracking.
 *
 * @example
 * ```ts
 * import { observable } from "mobx";
 * import { persistObservable } from "@stainless-code/persist/sources/mobx";
 * const state = observable.object({ count: 0 });
 * const persist = persistObservable(state, { name: "count" });
 * ```
 */
export function persistObservable<
  TState extends object,
  TPersistedState = TState,
>(
  observable: TState,
  options: PersistOptions<TState, TPersistedState>,
): PersistApi<TState, TPersistedState> {
  return persistSource(
    {
      getState: () => toJS(observable) as TState,
      setState: (updater) => {
        const next = updater(toJS(observable) as TState);
        Object.assign(observable, next);
      },
      subscribe: (listener) => {
        const unsub = observe(observable, () => listener());
        return { unsubscribe: unsub };
      },
    },
    options,
  );
}
