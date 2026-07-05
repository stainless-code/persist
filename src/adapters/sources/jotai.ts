// jotai source adapter — peer `jotai` >=2.0.0.
import type { Atom, WritableAtom } from "jotai";

import type { PersistApi, PersistOptions } from "../../core/persist-core";
import { persistSource } from "../../core/persist-core";

/** jotai's Store type — structural to avoid importing internals. */
export interface JotaiStore {
  get: <T>(atom: Atom<T>) => T;
  set: <T>(
    atom: WritableAtom<T, [T | ((prev: T) => T)], void>,
    value: T | ((prev: T) => T),
  ) => void;
  sub: (atom: Atom<unknown>, listener: () => void) => () => void;
}

/**
 * Persist a writable jotai atom via a jotai `Store`. `get`/`set`/`sub` map
 * to `PersistableSource` for the atom's value.
 *
 * @example
 * ```ts
 * import { atom, createStore } from "jotai";
 * import { persistJotai } from "@stainless-code/persist/sources/jotai";
 * const countAtom = atom(0);
 * const store = createStore();
 * const persist = persistJotai(store, countAtom, { name: "count" });
 * ```
 */
export function persistJotai<TState, TPersistedState = TState>(
  store: JotaiStore,
  atom: WritableAtom<TState, [TState | ((prev: TState) => TState)], void>,
  options: PersistOptions<TState, TPersistedState>,
): PersistApi<TState, TPersistedState> {
  return persistSource(
    {
      getState: () => store.get(atom),
      setState: (updater) => store.set(atom, updater),
      subscribe: (listener) => {
        const unsub = store.sub(atom, () => listener());
        return { unsubscribe: unsub };
      },
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
