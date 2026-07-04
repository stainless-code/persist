---
"@stainless-code/persist": minor
---

Add three React Native storage subpaths over the `StateStorage` seam, mirroring the `./backends/idb` template (own subpath, optional peer, no cross-entry value imports):

- `./backends/async-storage` (peer `@react-native-async-storage/async-storage >=1.0.0`) — `asyncStorageStateStorage` / `createAsyncStorage`. Fully async, string-wire; `useHydrated` gating mandatory. Accepts a custom instance (`getLegacyStorage()`, `createAsyncStorage(name)`) to namespace.
- `./backends/mmkv` (peer `react-native-mmkv >=4.0.0`) — `mmkvStateStorage` / `createMmkvStorage({ id, path?, encryptionKey? })`. Synchronous (no hydration gate needed); uses the v4 `createMMKV` factory + `getString`/`set`/`remove` API. Pair `encryptionKey` for secrets-at-rest.
- `./backends/secure-store` (peer `expo-secure-store >=12.0.0`) — `secureStoreStateStorage` / `createSecureStoreStorage`. OS keychain/keystore, async, **~2KB value limit per key** — for small secrets (auth tokens), not large state; pair `partialize` to persist a tiny slice.

All three compose via `createJSONStorage` (jsonCodec default); swap codecs with `createStorage(backend, codec)`.
