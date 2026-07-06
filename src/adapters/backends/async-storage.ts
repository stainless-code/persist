// React Native AsyncStorage backend — peer `@react-native-async-storage/async-storage` >=1.0.0.
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AsyncStorage as AsyncStorageInstance } from "@react-native-async-storage/async-storage";

import type { PersistStorage, StateStorage } from "../../core/persist-core";
import { createJSONStorage } from "../../core/persist-core";

/**
 * `StateStorage` over React Native `AsyncStorage` — fully async, string-wire.
 * Pass a custom `AsyncStorage` instance (e.g. `getLegacyStorage()`) to
 * namespace away from the default; defaults to the module singleton.
 *
 * @example
 * ```ts
 * import { asyncStorageStateStorage } from "@stainless-code/persist/backends/async-storage";
 *
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
 * gating is mandatory (the `./frameworks/react` / `./frameworks/solid` / `./frameworks/vue` / `./frameworks/svelte` adapters).
 *
 * @example
 * ```ts
 * import { createAsyncStorage } from "@stainless-code/persist/backends/async-storage";
 * import { persistStore } from "@stainless-code/persist/sources/tanstack-store";
 *
 * const storage = createAsyncStorage<Prefs>()!;
 * persistStore(store, { name: "app:prefs:v1", storage });
 * ```
 */
export function createAsyncStorage<S>(
  storage: AsyncStorageInstance = AsyncStorage,
): PersistStorage<S> | undefined {
  return createJSONStorage<S>(() => asyncStorageStateStorage(storage));
}
