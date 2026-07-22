# @stainless-code/persist

## 0.4.0

### Minor Changes

- [#36](https://github.com/stainless-code/persist/pull/36) [`4cc9ec6`](https://github.com/stainless-code/persist/commit/4cc9ec672e881f054ec2da04c3b76cbe6779d592) Thanks [@SutuSebastian](https://github.com/SutuSebastian)! - Add `./codecs/standard-schema` — sync `~standard` codec, `PersistStorage` wraps (`withStandardSchema` / `withStandardSchemaAsync`), and JSON factories. Types vendored; no runtime peer. `createStorage` rethrows `PersistDecodeRethrowError` from decode (wrong-lane / programmer errors — not clearCorrupt).

  Remove `./codecs/zod`. Migrate to `createStandardSchemaStorage(getStorage, schema)` (Zod ≥3.24 / v4 via `~standard`). Encode writes schema `value` (defaults/transforms). Yup / async `~standard.validate` → async lane (async hydrate — gate UI).

## 0.3.0

### Minor Changes

- [#34](https://github.com/stainless-code/persist/pull/34) [`470ef1d`](https://github.com/stainless-code/persist/commit/470ef1dfbd702c506674b6639d14f26acf921dc2) Thanks [@SutuSebastian](https://github.com/SutuSebastian)! - Add Alpine framework adapter (`./frameworks/alpine`) — `useHydrated` + `$hydrated` plugin over `HydrationSignal`.

- [#34](https://github.com/stainless-code/persist/pull/34) [`470ef1d`](https://github.com/stainless-code/persist/commit/470ef1dfbd702c506674b6639d14f26acf921dc2) Thanks [@SutuSebastian](https://github.com/SutuSebastian)! - Add Lit `HydrationController` framework adapter (`./frameworks/lit`).

- [#31](https://github.com/stainless-code/persist/pull/31) [`f7d4abc`](https://github.com/stainless-code/persist/commit/f7d4abcbb39c1f7c4d4ec0a63324188ec5d85c60) Thanks [@SutuSebastian](https://github.com/SutuSebastian)! - Add first-party Pinia source adapter (`./sources/pinia`) with shape-named `persistStore` over `persistSource`.

- [#31](https://github.com/stainless-code/persist/pull/31) [`f7d4abc`](https://github.com/stainless-code/persist/commit/f7d4abcbb39c1f7c4d4ec0a63324188ec5d85c60) Thanks [@SutuSebastian](https://github.com/SutuSebastian)! - Add first-party Redux source adapter (`./sources/redux`) with `persistStore` and companion `persistableReducer` (classic + RTK).

## 0.2.1

### Patch Changes

- [#20](https://github.com/stainless-code/persist/pull/20) [`cb6ca1d`](https://github.com/stainless-code/persist/commit/cb6ca1dce91dc9f4716a5ac35f1cf4e6e707967c) Thanks [@SutuSebastian](https://github.com/SutuSebastian)! - Ship the public docs site at https://stainless-code.com/persist (`apps/docs`); README is now the npm landing digest that links there.

## 0.2.0

### Minor Changes

- [#7](https://github.com/stainless-code/persist/pull/7) [`934af37`](https://github.com/stainless-code/persist/commit/934af373f3653707537e47100021a9dbc008a94a) Thanks [@SutuSebastian](https://github.com/SutuSebastian)! - Add `./frameworks/angular` and `./frameworks/preact` hydration adapters over the `HydrationSignal` seam.

  - `./frameworks/angular` (peer `@angular/core >=17.0.0`): `useHydrated(signal)` → readonly `Signal<boolean>`. Call inside a component's injection context (`effect()` requires it).
  - `./frameworks/preact` (peer `preact >=10.19.0`): `useHydrated(signal)` → `{ hydrated }` via `useSyncExternalStore` (preact/compat). `@ts-expect-error` on the 3-arg call (Preact types omit `getServerSnapshot`; runtime ignores it).

- [#7](https://github.com/stainless-code/persist/pull/7) [`934af37`](https://github.com/stainless-code/persist/commit/934af373f3653707537e47100021a9dbc008a94a) Thanks [@SutuSebastian](https://github.com/SutuSebastian)! - Add `./transport/crosstab` subpath — `createBroadcastCrossTab`, a zero-dep `BroadcastChannel` bridge for cross-tab sync over backends that fire no `storage` events (IndexedDB). Returns `{ crossTabEventTarget, wrap, close }`: pass the target as `crossTabEventTarget` and `wrap(storage)` as `storage` so writes/removes broadcast to other tabs. Posts `storageArea: null` on every event so key-only matching applies in every tab (each tab owns its own backend instance — reference equality on `raw` would fail across tabs). Guards `BroadcastChannel` availability (SSR, Node <18) and posts after the write settles so receivers rehydrate into committed state.

- [#7](https://github.com/stainless-code/persist/pull/7) [`934af37`](https://github.com/stainless-code/persist/commit/934af373f3653707537e47100021a9dbc008a94a) Thanks [@SutuSebastian](https://github.com/SutuSebastian)! - Add two zero-dep storage wrappers over the `StateStorage` seam — both async web-global adapters (no peer dep), composing with `createStorage(backend, codec)`:

  - `./backends/encrypted` — `createEncryptedStorage(getStorage, { key })`: AES-GCM via WebCrypto (`crypto.subtle`). Each stored value is `base64(iv).base64(ciphertext)`; the AES-GCM auth tag means a wrong key or tampered ciphertext throws on decrypt → the backend's async `getItem` rejects → persist-core reports it via `onError` phase `"hydrate"` (NOT the codec's `clearCorruptOnFailure` path, which only fires when the codec throws parsing a raw value). Returns `undefined` when `crypto.subtle` is unavailable; `createStorage` then returns `undefined` (the consumer can fall back, or `persistSource` no-ops if no storage resolves).
  - `./backends/compressed` — `createCompressedStorage(getStorage, { format? })`: native `CompressionStream`/`DecompressionStream` (`gzip` | `deflate` | `deflate-raw`, default `gzip`); output is base64 so it stays string-wire. Returns `undefined` when the stream APIs are unavailable. Stacks with `createEncryptedStorage` (compress-then-encrypt is the standard order).

  **Design note:** encryption + compression are backend **wrappers**, not sync `StorageCodec`s, because `crypto.subtle` and the stream APIs are async and the `StorageCodec` seam is sync. The codec serializes the envelope (sync); the wrapper encrypts/compresses the serialized string (async).

  Also adds a README comparison table vs zustand-persist / redux-persist / @tanstack/query-persist-client / pinia-persist, and a migration guide with option-mapping tables + port snippets for each incumbent.

- [#7](https://github.com/stainless-code/persist/pull/7) [`934af37`](https://github.com/stainless-code/persist/commit/934af373f3653707537e47100021a9dbc008a94a) Thanks [@SutuSebastian](https://github.com/SutuSebastian)! - Add `createMigrationChain` — a zero-dep core helper that builds a `migrate` callback from a per-version step chain. Plug into `PersistOptions.migrate`.

  - `steps[N]` takes vN → v(N+1); the chain walks from the stored version to `version`, awaiting each.
  - `onNewer` (default `"throw"` — a downgrade is a bug) / `onOlder` (default `"discard"` — dropped support for that version).
  - Eager construction validation: a gap in the covered range, an out-of-range key, or a non-integer version throws now.
  - Beyond TanStack `buster` (discards on mismatch) — transforms instead.

- [#7](https://github.com/stainless-code/persist/pull/7) [`934af37`](https://github.com/stainless-code/persist/commit/934af373f3653707537e47100021a9dbc008a94a) Thanks [@SutuSebastian](https://github.com/SutuSebastian)! - Add `./backends/node-fs` — `nodeFsStateStorage({ dir })`, an async `StateStorage<string>` over Node `fs.promises` (one file per key under `dir`). No peer dep (`node:fs` is a Node built-in). Keys are sanitized to filename-safe segments with a short hash suffix (`app:prefs:v1` → `app_prefs_v1.<hash>`) so distinct keys that sanitize to the same segment don't collide on one file; `..`/`.`/empty keys are refused; missing files map to `null` (no throw); the dir is created lazily on first write. Compose with `createStorage(() => nodeFsStateStorage({ dir }), codec)`. Unblocks server / SSR / CLI persistence.

  Also adds export/pack validation (`check:pack`: `@arethetypeswrong/cli` + `publint` + `knip`) and README storage + codec decision matrices.

- [#7](https://github.com/stainless-code/persist/pull/7) [`934af37`](https://github.com/stainless-code/persist/commit/934af373f3653707537e47100021a9dbc008a94a) Thanks [@SutuSebastian](https://github.com/SutuSebastian)! - Add three React Native storage subpaths over the `StateStorage` seam, mirroring the `./backends/idb` template (own subpath, optional peer, no cross-entry value imports):

  - `./backends/async-storage` (peer `@react-native-async-storage/async-storage >=1.0.0`) — `asyncStorageStateStorage` / `createAsyncStorage`. Fully async, string-wire; `useHydrated` gating mandatory. Accepts a custom `AsyncStorage` instance (e.g. `getLegacyStorage()`) to namespace.
  - `./backends/mmkv` (peer `react-native-mmkv >=4.0.0`) — `mmkvStateStorage` / `createMmkvStorage({ id, path?, encryptionKey? })`. Synchronous (no hydration gate needed); uses the v4 `createMMKV` factory + `getString`/`set`/`remove` API. Pair `encryptionKey` for secrets-at-rest.
  - `./backends/secure-store` (peer `expo-secure-store >=12.0.0`) — `secureStoreStateStorage` / `createSecureStoreStorage`. OS keychain/keystore, async, **~2KB value limit per key** — for small secrets (auth tokens), not large state; pair `partialize` to persist a tiny slice.

  All three compose via `createJSONStorage` (jsonCodec default); swap codecs with `createStorage(backend, codec)`.

- [#7](https://github.com/stainless-code/persist/pull/7) [`934af37`](https://github.com/stainless-code/persist/commit/934af373f3653707537e47100021a9dbc008a94a) Thanks [@SutuSebastian](https://github.com/SutuSebastian)! - Add `createSessionStorage` — a zero-dep core DX factory over `sessionStorage` (per-tab; `crossTab` is meaningless). Returns `undefined` when `sessionStorage` is unavailable (SSR / non-DOM) or defined-but-broken (Node 22+ half-built global). No new subpath — exports from the core `.` entry.

- [#7](https://github.com/stainless-code/persist/pull/7) [`934af37`](https://github.com/stainless-code/persist/commit/934af373f3653707537e47100021a9dbc008a94a) Thanks [@SutuSebastian](https://github.com/SutuSebastian)! - Add `./frameworks/solid` and `./frameworks/vue` hydration subpaths — `useHydrated(signal)` over the `HydrationSignal` seam, mirroring the React adapter (`./frameworks/react`).

  - `./frameworks/solid` (peer `solid-js >=1.6.0`): returns a Solid `Accessor<boolean>` via `from`; the subscription is owned by the reactive scope and cleaned up on scope dispose. Uses the `from(producer, initialValue)` overload so the accessor is `Accessor<boolean>` (not `boolean | undefined`); reads `isHydrated()` for the initial value (pull-model signal — no initial notification).
  - `./frameworks/vue` (peer `vue >=3.3.0`): returns a Vue `Ref<boolean>` via `shallowRef`; subscription cleaned up via `onScopeDispose` — call inside `setup()` or an `effectScope()`.

  Both render `true` on the server (the no-op `PersistApi` is always-hydrated, so the signal is `true` server-side) — matching the `HydrationSignal` adapter contract. Each ships as its own subpath with the peer as optional, no cross-entry value imports.

- [#7](https://github.com/stainless-code/persist/pull/7) [`934af37`](https://github.com/stainless-code/persist/commit/934af373f3653707537e47100021a9dbc008a94a) Thanks [@SutuSebastian](https://github.com/SutuSebastian)! - Add four source adapters over the `PersistableSource` seam — shape-named (not library-named): same persistable shape → same name → same merge semantics, regardless of library; the subpath carries the library. Each is a thin `persistSource` wrapper mapping the library's store API:

  - `./sources/zustand` (peer `zustand >=4.0.0`): `persistStore(store, opts)` — zustand's `getState`/`setState`/`subscribe` map directly. Same name + shallow-spread merge as `./sources/tanstack-store`'s `persistStore` (same shape); alias one if importing both.
  - `./sources/jotai` (peer `jotai >=2.0.0`): `persistAtom(store, atom, opts)` — wraps a writable atom + jotai `Store`; replace-merge default (like `persistAtom` from `./sources/tanstack-store`) so primitive atoms don't hydrate to `{}`.
  - `./sources/valtio` (peer `valtio >=1.0.0`): `persistProxy(proxyObject, opts)` — `snapshot` for reads, `Object.assign` for writes, `subscribe` for changes.
  - `./sources/mobx` (peer `mobx >=6.0.0`): `persistObservable(observable, opts)` — `toJS` for reads, `Object.assign` for writes, `observe` for changes.

  Each is its own subpath with the peer optional, no cross-entry value imports. README "Wrapping your store" recipe section shows both the shipped adapter + the underlying `persistSource` mapping for customization.

- [#7](https://github.com/stainless-code/persist/pull/7) [`934af37`](https://github.com/stainless-code/persist/commit/934af373f3653707537e47100021a9dbc008a94a) Thanks [@SutuSebastian](https://github.com/SutuSebastian)! - Reorganize the public subpath namespace. Adapter subpaths are now category-prefixed. **Breaking** (early package; consumers must update imports) — the four subpaths that existed on `main` are renamed:

  - `./seroval` → `./codecs/seroval`
  - `./idb` → `./backends/idb`
  - `./tanstack-store` → `./sources/tanstack-store`
  - `./react` → `./frameworks/react`

  The rest of the surface (`./codecs/zod`, `./backends/{async-storage,mmkv,secure-store,encrypted,compressed,node-fs}`, `./transport/crosstab`, `./sources/{zustand,jotai,valtio,mobx}`, `./frameworks/{solid,vue,svelte,svelte-store,angular,preact}`) is NEW — added by sibling changesets, not renames.

  The `.` (core) entry is unchanged.

- [#7](https://github.com/stainless-code/persist/pull/7) [`934af37`](https://github.com/stainless-code/persist/commit/934af373f3653707537e47100021a9dbc008a94a) Thanks [@SutuSebastian](https://github.com/SutuSebastian)! - Add Svelte hydration adapters over the `HydrationSignal` seam, covering both pre- and post-runes Svelte. Two subpaths because `svelte/reactivity` (runes) is Svelte 5+ and would break a Svelte 4 import — each subpath owns its dep range:

  - `./frameworks/svelte` (requires Svelte ≥5.7 at runtime for `createSubscriber`; the package peer stays `>=3.0.0` shared with `./frameworks/svelte-store`) — `hydratedRune(signal)` via `svelte/reactivity` `createSubscriber`. Returns `{ readonly current: boolean }`; read `current` inside a reactive context (`$derived`/`$effect`/component/`{#if}`). Subscription owned by the reactive context, cleaned up on context dispose. Post-runes.
  - `./frameworks/svelte-store` (peer `svelte >=3.0.0`) — `hydratedStore(signal)` via `svelte/store` `readable`. Returns `Readable<boolean>`; auto-subscribe with `$hydratedStore`. Works on Svelte 4 (pre-runes) AND Svelte 5 (for users who prefer the store API). Subscription tied to the store's subscriber lifecycle.

  Both render `true` on the server (no-op `PersistApi` is always-hydrated) — matching the `HydrationSignal` adapter contract. Each is its own subpath with `svelte` optional, no cross-entry value imports.

- [#7](https://github.com/stainless-code/persist/pull/7) [`934af37`](https://github.com/stainless-code/persist/commit/934af373f3653707537e47100021a9dbc008a94a) Thanks [@SutuSebastian](https://github.com/SutuSebastian)! - Add `./codecs/zod` subpath — `zodCodec` / `createZodStorage`, a schema-gated codec over the `StorageCodec` seam. `encode` validates `state` against a `ZodType` before serializing the envelope (invalid state never persists; the throw surfaces via `onError` phase `"write"`). `decode` parses + validates the stored `state`; a validation failure throws into persist-core's corrupt-payload path → returns `null`, or with `clearCorruptOnFailure` removes the key. Validates `state` only — `version` / `timestamp` / `buster` stay the envelope's concern. `zod` is an optional peer (`>=3.20.0`, stable across v3/v4 via `ZodType` + `.parse`).

## 0.1.1

### Patch Changes

- [#4](https://github.com/stainless-code/persist/pull/4) [`efc5614`](https://github.com/stainless-code/persist/commit/efc5614799cd26c7e81b8a679d13f058deadd475) Thanks [@SutuSebastian](https://github.com/SutuSebastian)! - `createStorage` now shape-checks the resolved backend and treats one missing `getItem`/`setItem`/`removeItem` as unavailable. Fixes the Node 22+ SSR crash where `localStorage` exists as an object (so the availability lookup doesn't throw) but its methods are `undefined` without a valid `--localstorage-file` path — previously this passed availability and threw `storage.getItem is not a function` inside `hydrate`; now `persistSource`/`persistStore`/`persistAtom` collapse to the no-op `PersistApi`.

## 0.1.0

### Minor Changes

- [#2](https://github.com/stainless-code/persist/pull/2) [`dbf0428`](https://github.com/stainless-code/persist/commit/dbf0428edf45479a45dd6a092ba7f130278b9691) Thanks [@SutuSebastian](https://github.com/SutuSebastian)! - Ship consumer Agent Skills via TanStack Intent. Adds `skills/tanstack-store/SKILL.md` (packaged in the npm tarball), the `tanstack-intent` keyword for registry discovery, `intent:validate` / `intent:stale` scripts, `intent validate` gated in `prepublishOnly`, and a `check-skills.yml` CI workflow for skill validation + post-release staleness review. No runtime API change.
