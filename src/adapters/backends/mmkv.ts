// React Native MMKV entry — owns the `react-native-mmkv` dependency so the
// core stays zero-dep. Ships as its own subpath entry with that peer optional.
// No barrel re-exports this module: importing it directly IS the dependency
// opt-in (enforced by an isolation test).
import { createMMKV } from "react-native-mmkv";
import type { MMKV } from "react-native-mmkv";

import type { StateStorage } from "../../core/persist-core";
import { createJSONStorage } from "../../core/persist-core";

/**
 * `StateStorage` over a `react-native-mmkv` `MMKV` instance — synchronous,
 * string-wire. Pass an instance from `createMMKV({ id, encryptionKey?, path? })`.
 *
 * @example
 * ```ts
 * const instance = createMMKV({ id: "app-prefs" });
 * const storage = mmkvStateStorage(instance);
 * ```
 */
export function mmkvStateStorage(instance: MMKV): StateStorage {
  return {
    getItem: (name) => instance.getString(name) ?? null,
    setItem: (name, value) => {
      instance.set(name, value);
    },
    removeItem: (name) => {
      instance.remove(name);
    },
  };
}

export interface MmkvStorageOptions {
  /** MMKV instance id — namespaces persisted state into its own file. */
  id: string;
  /** Custom MMKV root path. */
  path?: string;
  /** Encryption key (max 16 bytes) — MMKV encrypts the file at rest. */
  encryptionKey?: string;
}

/**
 * Build a JSON-encoded `PersistStorage` over a fresh `react-native-mmkv`
 * instance. Synchronous backend → hydration settles before first render →
 * no `useHydrated` gate required (unlike IndexedDB / AsyncStorage). MMKV is
 * the fastest RN KV store; pair `encryptionKey` for secrets-at-rest.
 *
 * @example
 * ```ts
 * const storage = createMmkvStorage<Prefs>({ id: "app-prefs" })!;
 * persistStore(store, { name: "app:prefs:v1", storage });
 * ```
 */
export function createMmkvStorage<S>(options: MmkvStorageOptions) {
  const instance = createMMKV({
    id: options.id,
    path: options.path,
    encryptionKey: options.encryptionKey,
  });
  return createJSONStorage<S>(() => mmkvStateStorage(instance));
}
