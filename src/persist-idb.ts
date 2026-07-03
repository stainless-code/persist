// IndexedDB entry — owns the `idb-keyval` dependency so the core stays
// zero-dep. Ships as its own subpath entry with idb-keyval as an optional
// peer. No barrel re-exports this module: importing it directly IS the
// dependency opt-in (enforced by an isolation test).
import type { UseStore } from "idb-keyval";
import { del, get, set } from "idb-keyval";

import type {
  CreateStorageOptions,
  PersistStorage,
  StateStorage,
  StorageValue,
} from "./persist-core";
import { createStorage, identityCodec } from "./persist-core";

export interface IdbStorageOptions extends CreateStorageOptions {
  /**
   * Custom `idb-keyval` store (`createStore(dbName, storeName)`) — e.g. to
   * namespace persisted state away from other idb-keyval users.
   * @default idb-keyval's shared default store (`keyval-store` / `keyval`)
   */
  store?: UseStore;
}

/**
 * `StateStorage` over idb-keyval — fully async; maps idb-keyval's
 * `undefined`-for-missing to the `null` this seam expects. Generic over the
 * wire type: `string` for codec-encoded use, `StorageValue<S>` for the
 * structured-clone mode (see `createIdbStorage`). IndexedDB
 * unavailability (private-mode edge cases, forced closes) surfaces as a
 * rejection on first use — reported via `onError` phase `"hydrate"` — not at
 * construction (`createStorage`'s sync try-guard can't see it).
 */
export function idbStateStorage<TRaw = string>(
  store?: UseStore,
): StateStorage<TRaw> {
  return {
    getItem: (name) => get<TRaw>(name, store).then((value) => value ?? null),
    setItem: (name, value) => set(name, value, store),
    removeItem: (name) => del(name, store),
  };
}

/**
 * Build an IndexedDB-backed `PersistStorage` (via idb-keyval) —
 * **structured-clone mode**: IndexedDB stores the `StorageValue` envelope
 * NATIVELY, so `Set` / `Map` / `Date` round-trip via the structured-clone
 * algorithm with zero (de)serialization — no seroval, no JSON, and better
 * DevTools inspection (objects, not encoded strings). The payoff of the
 * generic wire-type seam (`StateStorage<TRaw>`).
 *
 * Codec use cases (encryption at rest, compression, legacy string payloads)
 * are a one-line composition over the core primitives instead of a second
 * factory:
 *
 * ```ts
 * createStorage(() => idbStateStorage(store), myEncryptedCodec, options);
 * ```
 *
 * Semantics vs `localStorage` backends:
 * hydration can't settle before first paint, so `useHydrated` gating is
 * mandatory rather than optional; IndexedDB fires no `storage` events, so
 * `crossTab` needs a `BroadcastChannel` bridge via `crossTabEventTarget`;
 * and `clearCorruptOnFailure` is inert here — the identity decode never
 * throws (structured clone can't truncate-corrupt the way strings can).
 *
 * @example
 * ```ts
 * import { createIdbStorage } from "./persist-idb";
 *
 * const storage = createIdbStorage<Prefs>(); // Set/Map/Date just work
 * ```
 */
export function createIdbStorage<S>(
  options?: IdbStorageOptions,
): PersistStorage<S> | undefined {
  return createStorage<S, StorageValue<S>>(
    () => idbStateStorage<StorageValue<S>>(options?.store),
    identityCodec<S>(),
    options,
  );
}
