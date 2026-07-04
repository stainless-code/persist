// expo-secure-store entry — owns the `expo-secure-store` dependency so the
// core stays zero-dep. Ships as its own subpath entry with that peer optional.
// No barrel re-exports this module: importing it directly IS the dependency
// opt-in (enforced by an isolation test).
import * as SecureStore from "expo-secure-store";

import type { StateStorage } from "./persist-core";
import { createJSONStorage } from "./persist-core";

/**
 * `StateStorage` over `expo-secure-store` — fully async, string-wire, backed
 * by the platform keychain/keystore. Values are encrypted at rest by the OS.
 *
 * **~2KB value limit per key** (platform-imposed) — use this for small secrets
 * (auth tokens, short prefs), not large state. Oversized writes reject; pair
 * `partialize` to persist only a small slice.
 *
 * @example
 * ```ts
 * const storage = secureStoreStateStorage();
 * ```
 */
export function secureStoreStateStorage(): StateStorage {
  return {
    getItem: (name) => SecureStore.getItemAsync(name),
    setItem: (name, value) => SecureStore.setItemAsync(name, value),
    removeItem: (name) => SecureStore.deleteItemAsync(name),
  };
}

/**
 * Build a JSON-encoded `PersistStorage` over `expo-secure-store`. Async backend
 * → `useHydrated` gating is mandatory. **~2KB value limit per key** — keep
 * persisted state small; use `partialize` to project a tiny slice (e.g. an auth
 * token) and a different backend (IndexedDB, MMKV) for larger state.
 *
 * @example
 * ```ts
 * const storage = createSecureStoreStorage<AuthToken>()!;
 * persistStore(store, { name: "auth:token:v1", storage, partialize: (s) => s.token });
 * ```
 */
export function createSecureStoreStorage<S>() {
  return createJSONStorage<S>(() => secureStoreStateStorage());
}
