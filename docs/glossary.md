# Persist — Ubiquitous Language

> Single canonical glossary for terms used across `src/` and `docs/`. When in doubt, this file wins. Update on the same PR that introduces a new term. Architecture nouns (`module`, `seam`, `adapter`) live in [`improve-codebase-architecture/LANGUAGE.md`](../.agents/skills/improve-codebase-architecture/LANGUAGE.md); this file covers the **persistence domain**.

## Seams

| Term        | Definition                                                                                                                                        | Aliases / avoid                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| **backend** | The `StateStorage<TRaw>` seam — `getItem` / `setItem` / `removeItem` against a physical store (sync or Promise).                                  | storage driver, engine            |
| **codec**   | The `StorageCodec<S, TRaw>` seam — pure `encode` / `decode` between the persisted envelope and the backend's wire type.                           | serializer, (de)serializer        |
| **source**  | The `PersistableSource<TState>` seam — the reactive store being persisted (`getState` / `setState` / `subscribe`), structural and store-agnostic. | store (avoid — overloaded)        |
| **storage** | The composed `PersistStorage<S>` — a backend × codec cell produced by `createStorage`; the keyed store of envelopes `persistSource` reads/writes. | persisted storage, PersistStorage |
| **entry**   | A subpath export in `package.json` `exports` — one entry = one optional peer opt-in (`./seroval`, `./idb`, `./tanstack-store`, `./react`).        | subpath, entry point              |

## Envelope & wire

| Term                | Definition                                                                                                                                                | Aliases / avoid         |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| **envelope**        | The `StorageValue<S>` shape — the persisted wrapper (state + metadata: version, timestamp, etc.) that codecs encode and backends store.                   | payload, record         |
| **wire type**       | `TRaw` — the backend's on-storage representation (string by default; structured for `identityCodec` / structured-clone backends). Must not be a thenable. | raw, serialized form    |
| **encode / decode** | The codec's pure transforms: `encode: StorageValue → TRaw`, `decode: TRaw → StorageValue`.                                                                | serialize / deserialize |

## Hydration

| Term                        | Definition                                                                                                                                                                                                                                                  | Aliases / avoid       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **hydration signal**        | The `HydrationSignal` from `hydration.ts` — the external observation point for hydration state. Framework adapters mount it into their external-store mechanism (React `useSyncExternalStore` via `useHydrated`) without coupling to the store's read path. | hydrated flag (avoid) |
| **sync vs async read path** | One API; the read path branches on `instanceof Promise` (deliberately not thenable duck-typing). Sync backends settle hydration before first paint; async backends ride the same `getItem` Promise branch.                                                  |                       |
| **SSR policy**              | Render `hydrated = true` on the server; a `null` hydration signal means no persistence = hydrated.                                                                                                                                                          |                       |

## Write lifecycle & guards

| Term                 | Definition                                                                                                                                                                                                                                                                                                                     | Aliases / avoid          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| **generation guard** | The `writeGeneration` counter — every top-level write event (setItem, skipPersist removal, `destroy()`) starts a new generation. An in-flight `retryWrite` loop captures the generation it started in and **abandons silently on mismatch**, so a stale shrunk state never clobbers fresher state or resurrects a removed key. | write-generation counter |
| **hydrationVersion** | Sibling counter of `writeGeneration` for the hydration read path — bumped on rehydrate so stale read callbacks can be distinguished.                                                                                                                                                                                           |                          |
| **rehydrate**        | `rehydrate()` — awaitable re-read of the backend into the source; bumps the generation counters so in-flight writes don't clobber the freshly migrated state.                                                                                                                                                                  |                          |
| **destroy**          | `destroy()` — tears down the subscription, flushes the pending write (no-retry), and bumps `writeGeneration` to supersede any in-flight retryWrite loop.                                                                                                                                                                       | teardown, dispose        |

## Options (non-exhaustive — see JSDoc)

| Term              | Definition                                                              |
| ----------------- | ----------------------------------------------------------------------- |
| **skipHydration** | Skip the on-create hydration read (consumer rehydrates manually).       |
| **throttleMs**    | Trailing write throttle window.                                         |
| **maxAge**        | Opt-in expiry (deliberate divergence: prefs shouldn't silently expire). |
| **buster**        | Cache-busting key mixed into the storage key.                           |
| **migrate**       | Versioned migration of a persisted envelope on read.                    |
| **crossTab**      | Cross-tab sync via storage events; rehydrate on remote write.           |
| **retryWrite**    | Retry loop for failed writes, guarded by the generation guard.          |

## Flagged ambiguities

- **"store"** is overloaded — it can mean the **source** (the reactive store being persisted) or the **storage** (the composed `PersistStorage`). In this repo, **source** = `PersistableSource<TState>` (the consumer's reactive store); **storage** = `PersistStorage<S>` (the backend × codec composition). Avoid bare "store" in prose.
- **"storage"** at the type level means `PersistStorage<S>`; at the seam level **backend** means `StateStorage<TRaw>`. Don't call a backend "a storage" — that collides with the composed storage.

## Reference

- [`docs/architecture.md`](./architecture.md) — the three-seam model and entry-point layout.
- [`docs/README.md`](./README.md) — docs index.
- `src/persist-core.ts`, `src/hydration.ts` — the JSDoc is the full contract.
