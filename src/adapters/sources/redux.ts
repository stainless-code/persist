// redux source adapter — peer `redux` >=5.0.0 (covers classic + RTK stores).
import type { Action, Reducer, Store, UnknownAction } from "redux";

import type { PersistApi, PersistOptions } from "../../core/persist-core";
import { persistSource } from "../../core/persist-core";

/** Private set/hydrate action — owned by this module; not for app dispatch. */
const PERSIST_SET = "@stainless-code/persist/SET" as const;

interface PersistSetAction<TState> {
  type: typeof PERSIST_SET;
  payload: TState;
}

/**
 * Wrap the **root** reducer so hydrate/`setState` can replace state. Do not
 * wrap individual slices inside `combineReducers` — the payload is the full
 * root. Without this wrapper RTK slices ignore the private action (silent
 * no-op). Named to avoid clashing with redux-persist's `persistReducer`.
 *
 * @example
 * ```ts
 * import { createStore } from "redux";
 * import { persistableReducer } from "@stainless-code/persist/sources/redux";
 * const store = createStore(persistableReducer(rootReducer));
 * ```
 */
export function persistableReducer<
  TState,
  TAction extends Action = UnknownAction,
>(baseReducer: Reducer<TState, TAction>): Reducer<TState, TAction> {
  return (state, action) => {
    if (action.type === PERSIST_SET) {
      return (action as unknown as PersistSetAction<TState>).payload;
    }
    return baseReducer(state, action as TAction);
  };
}

/**
 * Persist a Redux store (classic `createStore` or RTK `configureStore`).
 * Redux has no `setState` — hydrate/writes dispatch a private action handled
 * by {@link persistableReducer} on the root. Do not use `replaceReducer` for
 * hydrate.
 *
 * If you also import redux-persist's `persistStore`, alias this one:
 * `import { persistStore as persistWithStainless } from "@stainless-code/persist/sources/redux"`.
 *
 * @example
 * ```ts
 * import { createStore } from "redux";
 * import { createJSONStorage } from "@stainless-code/persist";
 * import {
 *   persistStore,
 *   persistableReducer,
 * } from "@stainless-code/persist/sources/redux";
 * const store = createStore(persistableReducer(rootReducer));
 * const persist = persistStore(store, {
 *   name: "root",
 *   storage: createJSONStorage(() => localStorage),
 * });
 * ```
 */
export function persistStore<TState, TPersistedState = TState>(
  store: Store<TState>,
  options: PersistOptions<TState, TPersistedState>,
): PersistApi<TState, TPersistedState> {
  return persistSource(
    {
      getState: () => store.getState(),
      setState: (updater) => {
        const prev = store.getState();
        const payload = updater(prev);
        const action: PersistSetAction<TState> = {
          type: PERSIST_SET,
          payload,
        };
        store.dispatch(action as unknown as UnknownAction);
        // Unchanged reference ⇒ reducer ignored PERSIST_SET (missing root wrap).
        if (
          process.env.NODE_ENV !== "production" &&
          store.getState() === prev
        ) {
          console.warn(
            "[@stainless-code/persist/sources/redux] setState/hydrate did not apply. Wrap the root reducer with persistableReducer (not each slice).",
          );
        }
      },
      subscribe: (listener) => ({
        unsubscribe: store.subscribe(listener),
      }),
    },
    options,
  );
}
