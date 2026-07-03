// `@tanstack/store` adapters — the only module that references the store
// package (types only; `PersistableSource` is structural). Ships as a
// store-adapter subpath entry with `@tanstack/store` as a peer dep.
import type { Atom, Store, StoreActionMap } from "@tanstack/store";

import type { PersistApi, PersistOptions } from "./persist-core";
import { persistSource } from "./persist-core";

/**
 * Persist a `@tanstack/store` `Store` (action-bearing stores included).
 *
 * @example
 * ```ts
 * const store = new Store({ filters: [] as string[] });
 * const persist = persistStore(store, {
 *   name: "app:filters:v1",
 *   version: 1,
 *   skipPersist: (s) => s.filters.length === 0, // no key when default
 * });
 * // hydrates automatically on create; subscribe-writes on every setState
 * await persist.rehydrate(); // optional manual re-read, awaitable
 * ```
 */
export function persistStore<TState, TPersistedState = TState>(
  store: Store<TState, StoreActionMap>,
  options: PersistOptions<TState, TPersistedState>,
): PersistApi<TState, TPersistedState> {
  return persistSource(
    {
      getState: () => store.state,
      setState: (updater) => store.setState(updater),
      subscribe: (listener) =>
        store.subscribe(() => {
          listener();
        }),
    },
    options,
  );
}

/**
 * Persist a writable `@tanstack/store` `Atom`. Default `merge` REPLACES
 * instead of shallow-spreading — atoms commonly hold primitives, which a
 * spread would corrupt. Pass `merge` to override.
 *
 * @throws Error when given a readonly (computed) atom — there is no `set` to
 * hydrate into.
 *
 * @example
 * ```ts
 * const theme = createAtom<"light" | "dark">("light");
 * const persist = persistAtom(theme, { name: "app:theme:v1" });
 * // hydrate REPLACES the primitive; theme.set() writes through
 * ```
 */
export function persistAtom<TState, TPersistedState = TState>(
  atom: Atom<TState>,
  options: PersistOptions<TState, TPersistedState>,
): PersistApi<TState, TPersistedState> {
  if (!("set" in atom) || typeof atom.set !== "function") {
    throw new Error("[persistAtom] Cannot persist a readonly atom.");
  }

  return persistSource(
    {
      getState: () => atom.get(),
      setState: (updater) => atom.set(updater),
      subscribe: (listener) =>
        atom.subscribe(() => {
          listener();
        }),
    },
    {
      ...options,
      // `??` (not spread order) so an explicit `merge: undefined` still gets
      // the replace-merge — a shallow-spread fallback would corrupt primitive
      // atom states (spreading a number yields `{}`).
      merge: options.merge ?? ((persisted) => persisted as TState),
    },
  );
}
