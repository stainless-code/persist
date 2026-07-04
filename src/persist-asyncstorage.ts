// React Native AsyncStorage entry — owns the
// `@react-native-async-storage/async-storage` dependency so the core stays
// zero-dep. Ships as its own subpath entry with that peer optional. No barrel
// re-exports this module: importing it directly IS the dependency opt-in
// (enforced by an isolation test).
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AsyncStorage as AsyncStorageInstance } from "@react-native-async-storage/async-storage";

import type { StateStorage } from "./persist-core";
import { createJSONStorage } from "./persist-core";

/**
 * `StateStorage` over React Native `AsyncStorage` — fully async, string-wire.
 * Pass a custom instance (e.g. `getLegacyStorage()`, or `createAsyncStorage(name)`)
 * to namespace away from the default; defaults to the module singleton.
 *
 * @example
 * ```ts
 * const storage = asyncStorageStateStorage();
 * ```
 */
export function asyncStorageStateStorage(
  storage: AsyncStorageInstance = AsyncStorage,
): StateStorage {
  return {
    getItem: (name) => storage.getItem(name),
    setItem: (name, value) => storage.setItem(name, value),
    removeItem: (name) => storage.removeItem(name),
  };
}

/**
 * Build a JSON-encoded `PersistStorage` over React Native `AsyncStorage`.
 * Async backend → hydration can't settle before first render, so `useHydrated`
 * gating is mandatory (the `./react` / `./solid` / `./vue` adapters).
 *
 * @example
 * ```ts
 * const storage = createAsyncStorage<Prefs>()!;
 * persistStore(store, { name: "app:prefs:v1", storage });
 * ```
 */
export function createAsyncStorage<S>(
  storage: AsyncStorageInstance = AsyncStorage,
) {
  return createJSONStorage<S>(() => asyncStorageStateStorage(storage));
}
