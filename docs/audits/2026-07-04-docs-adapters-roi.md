# Audit — Docs adequacy, adapter landscape, ROI action items

**Date:** 2026-07-04
**Method:** Four GLM 5.2 subagents read every file in the repo (core, adapters, docs, build/CI), then synthesized.
**Audited lanes:** [core capabilities](#core-capability-inventory) · [adapter landscape](#adapter-landscape) · [consumer docs](#consumer-docs-adequacy) · [build/ci/release](#build--tooling).

---

## TL;DR answers

**Are consumer docs enough to explain full capabilities?** **No.** The README is a dense wall-of-text reference doubling as landing page. The real consumer doc is `skills/tanstack-store/SKILL.md` (excellent, but lives inside the tarball, not the repo surface). The library's namesake concept — **"hydration-aware" — is never defined** anywhere in consumer prose. The headline use case that justifies the library (IndexedDB + async hydration gate) has **no end-to-end example**. Five exported capabilities are effectively hidden: `createPersistRegistry`/clear-all-on-logout, `partialize`/`merge`, `retryWrite`, `alwaysHydratedSignal`, and the generated `docs/api/` site (built, git-ignored, never linked from README). Sufficient for an experienced TanStack Store user willing to read JSDoc; **not** sufficient for 5-minute cold onboarding.

**Enough examples?** **No.** Zero `examples/`/`demo/`/`playground/` directory exists. Only inline JSDoc `@example` blocks + README/skill snippets + tests. No runnable app demonstrates store+storage+codec+hydration wiring outside the test suite. ~12 README snippets / ~8 skill snippets, but **no example** for: IDB+React end-to-end, IDB+identity wired to a store, IDB cross-tab via BroadcastChannel, zustand/Redux via `persistSource`, `partialize`, `merge`, `registry`/clearAll, `throttleMs`, `maxAge`, `buster`, `retryWrite` (in prose), SSR/Next.js.

**More adapters?** **Yes — high ROI.** The core is a zero-dep engine with **three clean seams already in place** (`StateStorage`, `StorageCodec`, `PersistableSource`) plus the `HydrationSignal` framework seam. Adding adapters is a one-line composition, not a feature request — so adapter ROI is unusually high. Brainstormed matrix below.

---

## Core capability inventory

52 distinct capabilities confirmed by the core audit (read `src/core/persist-core.ts` + `src/core/persist-core.test.ts` in full). Highlights:

Two-axis `storage × codec` seam · structured-clone mode via `identityCodec` (Set/Map/Date survive without a codec) · trailing throttle with bypass for `skipPersist` removals · `destroy()` flushes pending throttled writes in `noRetry` mode · uncapped `retryWrite` that owns termination and covers post-migrate write-back · write-generation guard spanning throttle+retry+destroy+rehydrate · cross-tab `storageArea` identity guard with key-only fallback · `onCrossTabRemove` ownership primitive · `PersistRegistry` clear-all with `allSettled` + rethrow-first · `HydrationSignal` pull-model adapter contract (no initial notify, no payload, SSR renders hydrated) · `alwaysHydratedSignal()` collapses the no-persist ternary · `instanceof Promise` (same-realm) over thenable duck-typing · Node 22+ broken-`localStorage` shape guard · expiry-before-migrate ordering.

Most of these are **only documented in JSDoc + tests**, not consumer prose.

### Extension seams (interface shapes)

- **Storage backend** — `StateStorage<TRaw>` (`src/core/persist-core.ts:20`): `getItem`/`setItem`/`removeItem`, sync or async (detected via `instanceof Promise`).
- **Codec** — `StorageCodec<S, TRaw>` (`src/core/persist-core.ts:74`): `encode`/`decode` of `StorageValue<S>` ↔ wire type.
- **Reactive source** — `PersistableSource<TState>` (`src/core/persist-core.ts:357`): `getState`/`setState`/`subscribe`.
- **Framework hydration** — `HydrationSignal` (`src/core/hydration.ts:28`): `subscribeHydrated`/`isHydrated`, pull model.
- **Cross-tab event target** — `CrossTabEventTarget` (`src/core/persist-core.ts:113`).
- **Registry** — `PersistRegistry` (`src/core/persist-core.ts:369`).

### Core gaps (no shipped impl, seam only)

No IDB transactions · no `BroadcastChannel` transport shipped · no migration-chain helper · no compression/encryption shipped (seam only) · no multi-key batching · no key-namespacing helper · trailing-only throttle (no leading edge) · `retryWrite` uncapped by design (callback owns termination) · `setOptions` can't re-wire structural options (`registry`/`crossTab`/`crossTabEventTarget`) · no telemetry/observability beyond `onError` · no selective per-field hydrate · no SSR serialize-and-rehydrate (adapter's job).

---

## Adapter landscape

5 subpath entries today: `.` (zero-dep core) · `./codecs/seroval` (seroval codec) · `./backends/idb` (idb-keyval, structured-clone mode) · `./sources/tanstack-store` (`persistStore`/`persistAtom`) · `./frameworks/react` (`useHydrated` only).

Each optional peer is isolated behind its own subpath entry — importing the subpath IS the dep opt-in (enforced by `src/adapters/backends/idb.test.ts:175`).

**React surface is just `useHydrated`.** No provider/context, no auto store binding, no auto-`destroy()` on unmount, no RN-specific entry. `src/adapters/frameworks/react.ts:22` JSDoc signals richer ergonomics are intentionally deferred to a higher-layer package.

### Missing adapters — brainstormed

**Storage:** sessionStorage (S/med) · OPFS (M/med) · Node fs (S/med) · memory (S/low, dedupes 3 test copies) · Redis (M/med) · SQLite WASM (L/med) · **expo-secure-store (S/high)** · **MMKV (S/high)** · **AsyncStorage (S/high)** · Chrome storage.area (S/med) · cookies (M/low) · Cloudflare KV/DO (M/med) · **BroadcastChannel bridge for IDB cross-tab (S/high)**.

**Codecs:** **zod-validated (S/high)** · **encryption-at-rest via WebCrypto (M/high)** · MessagePack/cbor-x/CBOR (S/med) · compression via `CompressionStream` (M/med) · superjson/devalue (S/med) · structuredClone (S/low) · protobuf (L/low).

**Framework:** **Solid `from(signal)` (S/high)** · **Vue `shallowRef`+watch (S/high)** · Svelte (S/med) · Preact (S/med) · Angular signals (S/med) · **TanStack Query persister bridge (M/high)** · **React provider/context/auto-binding (M/high)** · zustand/jotai/valtio/mobx/signals source adapters (S each, decide ship vs recipe).

---

## Consumer docs adequacy

### Documented vs hidden (per public export)

| Export                                                                                                                                                                                        | Status       | Where                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | -------------------------------- |
| `persistSource`, `createStorage`, `jsonCodec`, `identityCodec`, `persistStore`, `persistAtom`, `useHydrated`, `serovalCodec`, `createSerovalStorage`, `createIdbStorage`, `toHydrationSignal` | ✅           | README + skill                   |
| `PersistApi` full surface, `createJSONStorage`, `idbStateStorage`, `HydrationSignal`/`HydrationSource`, `UseHydratedResult`                                                                   | 🟡           | partial / JSDoc only             |
| **`createPersistRegistry` / `registry` / clear-all**                                                                                                                                          | ❌           | exported, zero consumer mention  |
| **`alwaysHydratedSignal`**                                                                                                                                                                    | ❌           | JSDoc only                       |
| **`partialize` / `merge` / `onRehydrateStorage`**                                                                                                                                             | ❌ in README | skill only                       |
| **generated `docs/api/` site**                                                                                                                                                                | ❌           | built, git-ignored, never linked |
| `retryWrite`, `onError`, `maxAge`, `buster`, `throttleMs`, `skipHydration`                                                                                                                    | 🟡           | mentioned in prose, no recipe    |

### Onboarding gaps (ranked)

1. No "what is hydration / why does it flash" explainer — namesake concept undefined.
2. No complete IDB + React + `useHydrated` + `destroy()` walkthrough.
3. No full React component example in the README.
4. `createPersistRegistry` / clear-all invisible.
5. Generated API reference not linked.
6. `bun add` only — no npm/pnpm/yarn; engines supports Node ≥20.19.
7. TanStack intent opaque in README — five equal-weight subpaths, no "blessed path" signal.

### Missing doc types

Docs site (VitePress/Starlight) · Getting Started · Adapters catalog · Storage/codec decision matrices · Recipes section · Migration/porting guide from incumbents · Comparison table (zustand-persist / redux-persist / query-persist-client / pinia-persist) · Playground/StackBlitz · API reference link · Common-mistakes page · FAQ/troubleshooting.

---

## Build & tooling

**Strengths:** zero-dep core (test-enforced), correct optional peers, `sideEffects:false`, ESM-only tsdown build, deliberate bun/vitest split (bun unit + vitest/jsdom DOM), changeset release flow, packaged Agent Skills (`skills/` in `files`) intentional.

**Gaps:**

- **CI:** three workflows (ci/release/check-skills), single-env matrix. No preview deploy, no pkg-size diff, no bundle visualizer, no semver/export pack-validation (`attw`/`knip`/`publint`).
- **Release:** `release.yml` lacks npm provenance/signing and `id-token: write` permission.
- **Tests:** jsdom only — no real browser (Playwright/Safari), no SSR-framework (Next.js) test, no coverage gate, no integration tests combining multiple adapters.
- **Consumer DX:** no `packageManager` pin, no TS consumer range, no Node/React/TanStack version compat table, no bundle-size badge, no FAQ.
- **Examples:** no `examples/` workspace, no playground, no StackBlitz.

---

## ROI-ordered action items

Ordered by ROI = impact ÷ effort. **Effort:** S / M / L. **Status as of 2026-07-04:** ✅ = shipped on the `audit/docs-adapters-roi` branch.

### Tier 1 — Ship first (high impact, low effort)

| #    | Action                                                                                                                                                                                                                                                      | Effort |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| ✅ 1 | Define "hydration-aware" in the README — one paragraph + a "what flashes without it" diagram. Fixes the single biggest tone gap.                                                                                                                            | S      |
| ✅ 2 | Add a complete IDB + React + `useHydrated` + `destroy()` walkthrough to the README. Closes the gap that justifies the library's existence.                                                                                                                  | S      |
| 3    | Link the generated `docs/api/` site from the README + publish to GitHub Pages (`.nojekyll` already present).                                                                                                                                                | S      |
| ✅ 4 | Document `createPersistRegistry` + clear-all-on-logout with a recipe.                                                                                                                                                                                       | S      |
| ✅ 5 | Add recipes for `partialize`, `merge`, `retryWrite`, `throttleMs`, `maxAge`, `buster` — six hidden powers, one short block each.                                                                                                                            | S      |
| ✅ 6 | BroadcastChannel → `CrossTabEventTarget` bridge adapter for IDB cross-tab. Seam exists (`src/core/persist-core.ts:113`); IDB fires no `storage` events so `crossTab` is silently broken on IDB without it (`src/adapters/backends/idb.ts:62`, `skill:116`). | S      |
| ✅ 7 | `expo-secure-store` / `react-native-mmkv` / `AsyncStorage` storage adapters (one subpath each). Unlocks an entire platform.                                                                                                                                 | S each |
| ✅ 8 | `zod`-validated codec adapter — decode runs in existing corrupt-payload try/catch (`src/core/persist-core.ts:473`); validation errors map cleanly to `clearCorruptOnFailure`.                                                                               | S      |
| ✅ 9 | Solid + Vue framework hydration adapters — `HydrationSignal` JSDoc names both as targets (`src/core/hydration.ts:9-10`); each is a one-liner.                                                                                                               | S each |

### Tier 2 — Build out the surface (high impact, medium effort)

| #     | Action                                                                                                                                                                                       | Effort |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| ✅ 10 | Encryption-at-rest codec (WebCrypto + codec). Headline "custom codec" example in JSDoc (`src/core/persist-core.ts:69`, `src/adapters/backends/idb.ts:52`, `skill:155`) with no shipped impl. | M      |
| 11    | `examples/` monorepo workspace — runnable `tanstack-idb-react`, `tanstack-localstorage-react`, `nextjs-ssr`, `react-native-mmkv`. No runnable demo today.                                    | M      |
| 12    | Docs site (VitePress / Astro Starlight) — split wall-of-text README into Getting Started → Adapters → Recipes → Adapter authoring → Reference; host `docs/api/` under it.                    | M      |
| 13    | TanStack Query persister bridge (`persistQueryClient`-shaped). JSDoc cites Query as reference design (`src/core/persist-core.ts:12,263`). Flagship integration.                              | M      |
| ✅ 14 | Migration/porting guide — option mapping + conceptual diff vs zustand-persist / redux-persist / query-persist-client / pinia-persist.                                                        | S      |
| ✅ 15 | Comparison table across the 4 incumbents. README paragraph → table.                                                                                                                          | S      |
| ✅ 16 | Storage & codec decision matrices — lift + expand the skill's 4-row version to consumer docs.                                                                                                | S      |
| ✅ 17 | `CompressionStream` codec — native API, ~S now; pairs with binary `TRaw`.                                                                                                                    | M      |
| ✅ 18 | Node `fs` storage adapter — trivial `StateStorage`; unblocks server/SSR/CLI.                                                                                                                 | S      |
| ✅ 19 | Pack-validation + semver gate in CI — `attw --pack` + `knip` + `publint`. Prevents shipping a broken `exports` map.                                                                          | S      |
| ✅ 33 | Angular-signals hydration adapter — `signal` + `effect`-based gate over `HydrationSignal`; peer `@angular/core`.                                                                             | S      |
| ✅ 34 | Preact hydration adapter — near-clone of `./frameworks/react` (`useSyncExternalStore`); peer `preact`.                                                                                       | S      |

### Tier 3 — Maturity & polish (medium impact, medium effort)

| #     | Action                                                                                                  | Effort |
| ----- | ------------------------------------------------------------------------------------------------------- | ------ |
| ✅ 20 | npm provenance + signing in `release.yml` (`id-token: write` + `--provenance`).                         | S      |
| 21    | Test matrix — real browser (Playwright) + Safari + SSR-framework (Next.js hydration). Today jsdom only. | M      |
| ✅ 22 | Coverage gate.                                                                                          | S      |
| ✅ 23 | Bundle-size badge + `size-limit` gate.                                                                  | S      |
| ✅ 24 | `packageManager` pin + TS consumer range + Node/React/TanStack compat table.                            | S      |
| ✅ 25 | `zustand`/`jotai`/`valtio`/`mobx` source adapters — shipped + recipes.                                  | S each |
| ✅ 27 | FAQ / troubleshooting page.                                                                             | S      |

### Tier 4 — Strategic bets (high impact, high effort)

| #     | Action                                                                                                                                                                                            | Effort  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 28    | React ergonomics layer — `<PersistProvider>` + context + `usePersisted(store)` selector binding + auto-`destroy()`. `src/adapters/frameworks/react.ts:22` signals this is intentionally deferred. | M-L     |
| 29    | StackBlitz / CodeSandbox playground embedded in docs site.                                                                                                                                        | M       |
| 30    | OPFS + SQLite-WASM + Cloudflare KV/Durable Objects storage adapters.                                                                                                                              | M-L     |
| ✅ 31 | Migration-chain helper — `createMigrationChain({...})`; today `migrate` is a single callback, v0→v1→v2 chaining is user-written.                                                                  | M       |
| ✅ 32 | Continue the TanStack upstream pitch (`docs/plans/upstream-tanstack-pitch.md`) — adapter breadth (#13, #9) + docs polish (#1, #2, #12) are the leverage. Ongoing.                                 | ongoing |

---

## Recommended sequencing

- **Week 1:** #1, #2, #3, #4, #5, #6, #9 — docs + BroadcastChannel + Solid/Vue. All S, mostly docs, unlock existing-but-hidden powers.
- **Week 2:** #7, #8, #10 — RN platform + encryption headline gap.
- **Week 3-4:** #11, #12, #14, #15, #16 — structural fix for wall-of-text README + zero-examples problem.
- **Ongoing:** #19, #20, #21, #23 — CI/release hygiene so the growing surface doesn't break consumers.
- **Strategic:** #28 (React ergonomics) + #32 (TanStack upstream) after the surface is documented and exemplified.

---

## Audit agents

Four GLM 5.2 subagents ran in parallel, one per lane. Resume any for a deeper drill:

- [core capabilities](a4dcef3c-700e-4e3b-a222-7edf7311f017)
- [adapter landscape](9e6af533-7aa7-4d05-8e92-53ba25d25ee9)
- [consumer docs](b6cf6e7d-ac59-4c94-8d07-abbbb107c9c6)
- [build/CI](d0f5c223-e7eb-4495-b33d-2a55f0d1a43c)

---

# Appendix A — Core capability inventory (full subagent report)

Read-only audit of `src/core/persist-core.ts`, `src/core/persist-core.test.ts`, `src/core/hydration.ts`, `src/core/hydration.test.ts`, `src/core/index.ts`. All file:line refs point to `src/core/` (core) or `src/adapters/<seam>/` (adapters).

## A.1 Public API surface

### `src/core/persist-core.ts`

**Types / interfaces**

| Export                                    | Line      | One-line                                                                                                                                                     |
| ----------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `StateStorage<TRaw = string>`             | `20:24`   | Minimal string-keyed storage backend (matches `localStorage`); generic `TRaw` lets structured-clone backends carry objects.                                  |
| `StorageValue<S>`                         | `27:41`   | Envelope persisted per key: `state` + optional `version` / `timestamp` / `buster`.                                                                           |
| `PersistStorage<S>`                       | `49:64`   | Encoded storage layer `persistSource` reads/writes; `getItem`/`setItem`/`removeItem` over `StorageValue<S>` + optional `raw` for cross-tab area matching.    |
| `StorageCodec<S, TRaw = string>`          | `74:77`   | Pure encode/decode of `StorageValue<S>` ↔ backend wire type.                                                                                                 |
| `JsonStorageOptions`                      | `80:83`   | `JSON.parse` reviver / `JSON.stringify` replacer pass-through.                                                                                               |
| `CreateStorageOptions`                    | `85:93`   | `clearCorruptOnFailure` flag — self-heal a corrupt payload by removing the key.                                                                              |
| `CrossTabStorageEvent`                    | `101:105` | Structural `storage`-event shape (so non-DOM targets can dispatch fakes).                                                                                    |
| `CrossTabEventTarget`                     | `113:122` | Event-target seam for cross-tab (inject `BroadcastChannel`/fake).                                                                                            |
| `PersistOptions<TState, TPersistedState>` | `124:309` | Full options bag (see capability table below for each field).                                                                                                |
| `PersistApi<TState, TPersistedState>`     | `314:350` | Lifecycle handle returned by `persistSource` (`setOptions`/`clearStorage`/`rehydrate`/`hasHydrated`/`onHydrate`/`onFinishHydration`/`getOptions`/`destroy`). |
| `PersistableSource<TState>`               | `357:361` | Minimal reactive source shape (`getState`/`setState`/`subscribe`) — plug anything in.                                                                        |
| `PersistRegistry`                         | `369:377` | Clear-callback registry: `register`/`clearAll`.                                                                                                              |

**Functions / values**

| Export                                                | Line       | One-line                                                                                                         |
| ----------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------- |
| `createPersistRegistry()`                             | `384:401`  | Build a `PersistRegistry`; `clearAll` uses `allSettled` + rethrow-first-rejection.                               |
| `jsonCodec(options?)`                                 | `407:412`  | JSON `StorageCodec` (no `Set`/`Map`/`Date` round-trip); accepts reviver/replacer.                                |
| `identityCodec<S>()`                                  | `421:424`  | Pass-through codec for structured-clone backends (`TRaw = StorageValue<S>`).                                     |
| `createStorage<S, TRaw>(getStorage, codec, options?)` | `444:511`  | Backend×codec plumbing: try-guard availability, sync-vs-Promise branch, corrupt-payload handling; exposes `raw`. |
| `createJSONStorage<S>(getStorage, options?)`          | `521:526`  | `createStorage(getStorage, jsonCodec(options))` convenience.                                                     |
| `persistSource(source, options)`                      | `586:1124` | Attach persist to any `PersistableSource`; returns `PersistApi` (or no-op API when storage unavailable).         |

### `src/core/hydration.ts`

| Export                      | Line      | One-line                                                                                         |
| --------------------------- | --------- | ------------------------------------------------------------------------------------------------ |
| `HydrationSignal`           | `28:31`   | `subscribeHydrated` + `isHydrated` — framework-agnostic external-store hydration signal.         |
| `HydrationSource`           | `38:42`   | Minimal source shape (`hasHydrated`/`onHydrate`/`onFinishHydration`); `PersistApi` satisfies it. |
| `toHydrationSignal(source)` | `52:95`   | Bridge a `HydrationSource` → `HydrationSignal`; null-tolerant (`null`→`null`).                   |
| `alwaysHydratedSignal()`    | `103:108` | Always-hydrated signal for the no-persist path (uniform handle, no `null` branch at call site).  |

### `index.ts`

Re-exports `./persist-core` + `./hydration` only. No barrel into optional peers. (`1:7`)

## A.2 Capabilities (exhaustive, 52)

| #   | Capability                                                          | Where                                                                                                 | Evidence                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Storage-backend abstraction**                                     | `StateStorage<TRaw>` `20:24`, `createStorage` `444:511`                                               | Any backend with `getItem`/`setItem`/`removeItem`; sync or async (Promise detected via `instanceof Promise`, not thenable).                                                                                                    |
| 2   | **Codec / serialization seam (two-axis)**                           | `StorageCodec` `74:77`, `createStorage` `444:511`                                                     | Swap serialization (JSON / seroval / superjson / devalue / compression / encryption) independently of backend.                                                                                                                 |
| 3   | **Structured-clone backends (no string round-trip)**                | `identityCodec` `421:424`, test `182:212`                                                             | `TRaw = StorageValue<S>` carries objects natively (IndexedDB-friendly); `Set`/`Map`/`Date` survive.                                                                                                                            |
| 4   | **JSON default storage**                                            | `resolveDefaultStorage` `570:579`                                                                     | Default `createJSONStorage(() => localStorage)`; zero-dep by design.                                                                                                                                                           |
| 5   | **SSR / broken-backend guard**                                      | `createStorage` `450:466`, `570:579`, tests `143:166`, `487:547`                                      | `getStorage` throw → `undefined`; shape-check catches Node 22+ `localStorage` whose methods are `undefined`; no `window`/`localStorage` → no-op `PersistApi`.                                                                  |
| 6   | **Corrupt-payload self-heal**                                       | `parseStored` `468:489`, test `130:141`                                                               | `clearCorruptOnFailure` removes the key on a decode throw; default returns `null` (hydrate-to-nothing).                                                                                                                        |
| 7   | **Hydration lifecycle (awaitable, race-guarded)**                   | `hydrate` `982:1066`, `rehydrate` `1090`                                                              | `rehydrate()` returns a Promise that resolves after merge + finish listeners; `hydrationVersion` guard discards stale hydrates.                                                                                                |
| 8   | **Hydration listeners**                                             | `onHydrate` `335`, `onFinishHydration` `337`, `beginHydration`/`settleHydration` `927:973`            | Start + finish notifications; throwing finish listener contained (test `549:582`).                                                                                                                                             |
| 9   | **`skipHydration`** (manual rehydrate)                              | option `175`, `1068:1070`                                                                             | Skip the initial hydrate; caller drives `rehydrate()`.                                                                                                                                                                         |
| 10  | **`partialize`** (selective field persistence)                      | option `138`, test `242:260`                                                                          | Project `TState` → persisted slice; non-persisted field changes alone never write.                                                                                                                                             |
| 11  | **`merge`** (hydrate combine)                                       | option `170`, `shallowSpreadMerge` `532:538`, `applyResolvedState` `948:952`                          | Default shallow-spread persisted-over-current; custom merge supported; `persistAtom` overrides with replace.                                                                                                                   |
| 12  | **Schema versioning**                                               | option `152`, `resolveStoredState` `900:922`                                                          | `version` stamped on writes; mismatch → `migrate`.                                                                                                                                                                             |
| 13  | **Migration (`migrate`, sync or async)**                            | option `161`, `907:912`, tests `262:285`, `454:485`                                                   | Receives stored state + STORED version; returns new state or Promise. Throw → phase `"migrate"`.                                                                                                                               |
| 14  | **Post-migrate write-back**                                         | `hydrate` `1034:1040`, tests `262:285`, `1423:1448`                                                   | One-shot, unthrottled write of migrated state with current version.                                                                                                                                                            |
| 15  | **`buster` cache-busting**                                          | option `257`, `isStoredExpired` `887:895`, tests `1201:1257`                                          | Mismatch discards + removes key; prefer over migrate when old values are simply wrong.                                                                                                                                         |
| 16  | **`maxAge` expiry**                                                 | option `248`, `isStoredExpired` `887:895`, tests `1142:1199`                                          | Payload older than `maxAge` (by `timestamp`; missing timestamp = expired) discarded + key removed.                                                                                                                             |
| 17  | **Expiry-before-migrate ordering**                                  | `hydrate` `1018:1022`, test `1296:1321`                                                               | Expired data is never migrated.                                                                                                                                                                                                |
| 18  | **`timestamp` stamping on every write**                             | `buildEnvelope` `657:664`, test `1276:1294`                                                           | Always stamped (cheap, backward-compatible) — basis for `maxAge`; `buster` only when configured.                                                                                                                               |
| 19  | **`onRehydrateStorage` callback**                                   | option `144`, `beginHydration` `927:932`                                                              | Pre-hydration callback; optional return invoked on settle with `(state, undefined)` or `(undefined, error)`.                                                                                                                   |
| 20  | **`onError` error sink (4 phases)**                                 | option `193`, `reportError` `607:619`                                                                 | Phases: `"write"` / `"hydrate"` / `"migrate"` / `"crossTab"`; dev-only `console.*` fallback (prod silent without sink).                                                                                                        |
| 21  | **Error containment (never propagates to caller's setState)**       | `writeSafe` `751:760`, `hydrate` catch `1049:1065`, tests `312:371`                                   | Sync `setItem` throw / async reject / throwing migrate / throwing listener — all contained.                                                                                                                                    |
| 22  | **`skipPersist` (conditional persistence)**                         | option `184`, `writeToStorage` `732:743`, test `662:680`                                              | Evaluated against the partialized slice; when true → `removeItem` instead of write.                                                                                                                                            |
| 23  | **Trailing throttle (`throttleMs`)**                                | option `273`, `scheduleWrite` `800:827`, tests `1342:1370`                                            | Single `setTimeout`; coalesces burst into one trailing write with flush-time state; re-arms after flush.                                                                                                                       |
| 24  | **Throttle bypass for `skipPersist` removals**                      | `scheduleWrite` `805:809`, test `1399:1421`                                                           | Reset-to-default drops key immediately and cancels pending write.                                                                                                                                                              |
| 25  | **`destroy()` flushes pending throttled write**                     | `destroy` `1101:1120`, `flushPendingWrite` `779:794`, test `1372:1397`                                | One immediate attempt at teardown (noRetry mode) so no coalesced state is lost.                                                                                                                                                |
| 26  | **`retryWrite` (uncapped shrink-and-retry)**                        | option `302`, `retryLoop` `673:707`, `writeGuarded` `714:730`                                         | Callback gets `{state, error, errorCount}`; return smaller state to retry, `undefined` to give up (last error reported once); applies to subscribe-writes AND post-migrate write-back.                                         |
| 27  | **Write-generation guard**                                          | `writeGeneration` `652`, `scheduleWrite` `814`, `retryLoop` `682,694`, tests `1551:1656`, `1736:1775` | Newer `setState` / `destroy` / coalesced setState silently abandons in-flight retry loop; stale shrunk state never clobbers fresher state.                                                                                     |
| 28  | **Retry envelope rebuilt fresh per attempt**                        | `attemptWrite` `666:667`, `buildEnvelope` `657:664`, test `1884:1924`                                 | New `timestamp`, current `version`/`buster` on every retry.                                                                                                                                                                    |
| 29  | **Sync-path purity**                                                | `writeGuarded` `714:730`, test `1862:1882`                                                            | Sync `setItem` failure with no `retryWrite` → reported synchronously, no promise hop.                                                                                                                                          |
| 30  | **Cross-tab sync (`crossTab`)**                                     | option `221`, listener `846:882`, tests `801:998`                                                     | Listens for `storage` events on `window` (or injected target); matches key + `storageArea` against `raw`; calls `rehydrate()`. No echo loops (browser never fires in originating tab; `hydrationVersion` dedupes overlapping). |
| 31  | **Cross-tab event-target injection**                                | option `228`, `CrossTabEventTarget` `113:122`                                                         | Inject `BroadcastChannel` bridge or fake (tests, non-DOM runtimes).                                                                                                                                                            |
| 32  | **Cross-tab `storageArea` identity guard w/ key-only fallback**     | listener `856:863`, test `848:897`                                                                    | `event.storageArea` compared to `PersistStorage.raw`; hand-rolled impls without `raw` fall back to key-only.                                                                                                                   |
| 33  | **`onCrossTabRemove` (removal-event ownership)**                    | option `240`, listener `869:876`, tests `1000:1132`                                                   | `newValue: null` events go to callback (rehydrate can't express "reset"); throws contained → phase `"crossTab"`. Without it → rehydrate fallback (documented keep-state divergence).                                           |
| 34  | **Cross-tab listener attaches regardless of `skipHydration`**       | `846:882`, test `899:928`                                                                             | Manual rehydrate path still cross-tab-syncs.                                                                                                                                                                                   |
| 35  | **`destroy()` removes cross-tab listener**                          | `1104:1106`, test `930:959`                                                                           | Clean teardown, no post-destroy rehydrate.                                                                                                                                                                                     |
| 36  | **`PersistRegistry` (logout-style clearAll)**                       | option `206`, `createPersistRegistry` `384:401`, tests `1999:2074`                                    | Stores register `clearStorage`; `clearAll()` wipes every registered key; `allSettled` + rethrow-first-rejection; no ambient registry (opt-in only).                                                                            |
| 37  | **Registry unregister on destroy (no leak)**                        | `1103`, tests `694:767`                                                                               | Non-singleton stores created per mount cleanly unregister.                                                                                                                                                                     |
| 38  | **`setOptions` (live option merge)**                                | `1078:1086`                                                                                           | Merge new options (explicit `undefined` ignored via `mergeDefined`); `storage` swappable; structural options (`registry`/`crossTab`/`crossTabEventTarget`) NOT re-wired.                                                       |
| 39  | **`mergeDefined` undefined-guard**                                  | `545:553`, tests `1938:1985`                                                                          | `{ merge: undefined }` can't clobber a default at create time or via `setOptions`.                                                                                                                                             |
| 40  | **`clearStorage()`**                                                | `1087:1089`                                                                                           | Removes the key; state stays in memory.                                                                                                                                                                                        |
| 41  | **`destroy()` full teardown**                                       | `1101:1120`                                                                                           | Detaches source subscription, removes cross-tab listener, unregisters from registry, flushes pending throttled write (noRetry), cancels in-flight hydrate + retryWrite loop.                                                   |
| 42  | **`destroy()` cancels in-flight hydrate**                           | `1116`, test `584:608`                                                                                | `hydrationVersion++` discards pending async `getItem`/`migrate` — no post-teardown setState.                                                                                                                                   |
| 43  | **No-op `PersistApi` when storage unavailable**                     | `createNoopApi` `555:568`, tests `487:547`                                                            | Always-hydrated stub; reports `storage unavailable` to `onError` once.                                                                                                                                                         |
| 44  | **Re-schedule cancelled write post-rehydrate**                      | `hydrate` `992:993`, `1048`, test `1486:1509`                                                         | A pending throttled write cancelled by an incoming hydrate is re-scheduled so unpersisted state isn't stranded.                                                                                                                |
| 45  | **Hydration signal for framework adapters**                         | `toHydrationSignal` `52:95`                                                                           | Bridges `onHydrate`/`onFinishHydration` into one external-store subscribe target (React `useSyncExternalStore`, Svelte/Solid/Vue).                                                                                             |
| 46  | **Lazy signal attach/detach**                                       | `66:91`, tests `281:310`                                                                              | Source subscribed on first listener, torn down on last unsubscribe — no leak from recreated wrappers.                                                                                                                          |
| 47  | **Independent per-subscription wrappers**                           | `75:84`, test `214:234`                                                                               | Same listener fn subscribed twice → two independent subs; either unsubscribe doesn't kill the other.                                                                                                                           |
| 48  | **Idempotent unsubscribe**                                          | `84:90`, test `236:255`                                                                               | Second call to a stale unsub doesn't re-trigger teardown.                                                                                                                                                                      |
| 49  | **Pull-model signal (no initial notification, no payload)**         | JSDoc `18:21`, tests `198:279`                                                                        | Listeners never invoked on subscribe; (re)read `isHydrated()` after attaching; missed transitions recovered by snapshot re-read.                                                                                               |
| 50  | **`alwaysHydratedSignal()` (no-persist uniform handle)**            | `103:108`                                                                                             | Drops the `persist ? toHydrationSignal(persist) : null` ternary.                                                                                                                                                               |
| 51  | **Zero-dep core (enforced by test)**                                | test `19:30`                                                                                          | `src/core/persist-core.ts` has no value imports; type-only imports only.                                                                                                                                                       |
| 52  | **Async-vs-sync detection via `instanceof Promise` (not thenable)** | JSDoc `13:18`, `createStorage` `494`                                                                  | A stored value with a `.then` property is never mistaken for a pending read; same-realm native promises only.                                                                                                                  |

## A.3 Extension points / seams (interface shapes)

**Storage backend** — `StateStorage<TRaw>` (`20:24`):

```ts
export interface StateStorage<TRaw = string> {
  getItem: (name: string) => TRaw | null | Promise<TRaw | null>;
  setItem: (name: string, value: TRaw) => void | Promise<void>;
  removeItem: (name: string) => void | Promise<void>;
}
```

**Codec** — `StorageCodec<S, TRaw>` (`74:77`):

```ts
export interface StorageCodec<S, TRaw = string> {
  encode: (value: StorageValue<S>) => TRaw;
  decode: (raw: TRaw) => StorageValue<S>;
}
```

**Encoded layer** (build with `createStorage` or hand-roll) — `PersistStorage<S>` (`49:64`):

```ts
export interface PersistStorage<S> {
  getItem: (
    name: string,
  ) => StorageValue<S> | null | Promise<StorageValue<S> | null>;
  setItem: (name: string, value: StorageValue<S>) => void | Promise<void>;
  removeItem: (name: string) => void | Promise<void>;
  raw?: unknown; // cross-tab storageArea identity compare
}
```

**Reactive source** — `PersistableSource<TState>` (`357:361`):

```ts
export interface PersistableSource<TState> {
  getState: () => TState;
  setState: (updater: (prev: TState) => TState) => void;
  subscribe: (listener: () => void) => { unsubscribe: () => void };
}
```

**Cross-tab event target** — `CrossTabEventTarget` (`113:122`):

```ts
export interface CrossTabEventTarget {
  addEventListener: (
    type: "storage",
    listener: (event: CrossTabStorageEvent) => void,
  ) => void;
  removeEventListener: (
    type: "storage",
    listener: (event: CrossTabStorageEvent) => void,
  ) => void;
}
```

**Registry** — `PersistRegistry` (`369:377`):

```ts
export interface PersistRegistry {
  register: (clearStorage: () => void | Promise<void>) => () => void;
  clearAll: () => Promise<void>;
}
```

**Hydration source for signal** — `HydrationSource` (`38:42`):

```ts
export interface HydrationSource {
  hasHydrated: () => boolean;
  onHydrate: (listener: () => void) => () => void;
  onFinishHydration: (listener: () => void) => () => void;
}
```

**Error sink signature** (`193:199`): `(error: unknown, ctx: { name; phase: "write"|"hydrate"|"migrate"|"crossTab" }) => void`.

**`retryWrite` signature** (`302:308`): `(ctx: { state: TPersistedState; error: unknown; errorCount: number }) => TPersistedState | undefined | Promise<TPersistedState | undefined>`.

**User-implemented option callbacks**: `partialize`, `merge`, `migrate`, `onRehydrateStorage`, `skipPersist`, `onCrossTabRemove`, `onError`, `retryWrite`.

## A.4 Hidden / under-documented powers

- **`PersistStorage.raw` identity compare** (`63`, `505:509`) — re-exposes the backend so cross-tab can match `event.storageArea`; hand-rolled impls silently fall back to key-only. Not obvious unless you read the cross-tab guard.
- **`identityCodec` for structured-clone backends** (`421:424`) — skips serialization entirely; only mentioned in a seroval/IndexedDB context. Powerful for any structured-clone store (in-memory `Map`s, IndexedDB).
- **`retryWrite` is uncapped and IS the termination policy** (`275:288`) — a callback that always returns a state spins forever; `errorCount` is the aggressiveness dial. Not surfaced as a "policy" in consumer docs.
- **`retryWrite` covers the post-migrate write-back** (`1034:1040`, test `1814:1860`) — not just subscribe-writes.
- **Write-generation guard spans throttle + retry + destroy + rehydrate** (`652`, `814`, `999`) — a coalesced `setState` _during the throttle window_ supersedes an in-flight retry loop at schedule time, not flush time. Subtle correctness invariant.
- **Re-scheduling of a cancelled throttled write after rehydrate** (`1048`, test `1486:1509`) — prevents stranded unpersisted state. Easy to miss.
- **`destroy()` teardown flush uses `noRetry` mode** (`779:794`, `1112`) — bypasses retry loop so a teardown-flush failure reaches `onError` instead of being silently abandoned by the generation bump.
- **`mergeDefined` protects against `merge: undefined`** (`545:553`) — both at create and `setOptions`; matters for `persistAtom`'s replace-merge default.
- **Sync-path purity** (`714:730`) — no promise allocation when the first attempt succeeds or fails without `retryWrite`. Performance detail unlikely in docs.
- **`instanceof Promise` (same-realm) over thenable duck-typing** (`13:18`, `494`) — deliberately avoids misclassifying stored values carrying a `then` property.
- **Node 22+ broken-`localStorage` shape check** (`456:466`) — handles the global-exists-but-methods-undefined case the `typeof` guard misses.
- **`HydrationSignal` pull model + lazy attach/detach + fresh-wrapper-per-sub** (`66:91`) — the full adapter contract (independent subs for same fn, idempotent unsub, snapshot re-read recovers missed transitions). Adapter authors need this but it's deep in JSDoc.
- **`alwaysHydratedSignal()` collapses the conditional ternary** — uniform handle drops `persist ? toHydrationSignal(persist) : null`.
- **Cross-tab `storageArea` guard prevents echo across different storage areas** (`856:863`) — same key in `sessionStorage` vs `localStorage` won't cross-fire.
- **`crossTab` listener attaches even with `skipHydration`** (`846:882`) — manual-rehydrate users still get cross-tab.
- **Expiry runs before migrate** (`1018:1022`) — expired data is never migrated; not obvious from option names.
- **`maxAge`/`buster` missing-on-payload = expired/mismatch** (`887:895`, tests `1182:1199`, `1240:1257`) — payloads written by other persist impls (no `timestamp`/`buster`) count as expired when those options are configured.
- **Dev-only `console.error`/`console.warn` fallback is `process.env.NODE_ENV`-gated** (`613`, `628`) — bundler-replaceable; prod tree-shakes it. Prod without `onError` is silent by design.

## A.5 Gaps / limitations

- **No IndexedDB integration in core** — only the seam (`StateStorage<TRaw>` + `identityCodec`). Actual IDB lives in the `./backends/idb` subpath (idb-keyval peer). No transaction batching, no key-range cursors, no IDB-specific error mapping in core.
- **No `BroadcastChannel` transport shipped** — only the `CrossTabEventTarget` seam. Default is `window` `storage` events (same-origin only, no large-payload guarantee). A `BroadcastChannel` bridge is user-implemented.
- **No schema-migration helper / migration chain** — `migrate` is a single callback receiving the stored version; multi-step v0→v1→v2 chaining is user-written.
- **No compression** — pluggable via `StorageCodec` (encode/decode), but nothing shipped.
- **No encryption** — same: codec seam only, nothing shipped.
- **No batching of multiple keys** — one key per `persistSource`; no atomic multi-key write, no `clearAll`-across-stores transaction (registry `clearAll` is best-effort `allSettled`).
- **No key namespacing helper** — `name` is a raw string; no built-in prefix convention.
- **Trailing-only throttle (no leading edge)** — first write waits out the window; explicit trade-off vs TanStack Query's leading+trailing (JSDoc `262:266`).
- **`retryWrite` is uncapped by design** — no built-in max-attempts / backoff; the callback owns termination (can spin forever).
- **`setOptions` cannot re-wire structural options** — `registry`, `crossTab`, `crossTabEventTarget` set at create time only (JSDoc `316:320`).
- **No selective rehydrate / per-field hydrate** — `merge` is the only knob; no field-level hydration hooks.
- **No built-in cross-tab payload diff** — full rehydrate on every matching `storage` event; no "only changed fields" optimization.
- **No built-in size/quota introspection** — `retryWrite` reacts to failures but the core never probes quota.
- **No SSR serialize-and-rehydrate** — server-side renders `hydrated = true` (no storage); no mechanism to ship server state to client for first-paint hydration (adapter's job via `useHydrated` server snapshot).
- **Async detection limited to native same-realm `Promise`** — cross-realm or custom thenable backends aren't supported (`13:18`).
- **Cross-tab `onCrossTabRemove` is the only removal primitive** — no symmetric "another tab wrote" callback distinct from `rehydrate()`; consumers must derive intent from a fresh read.
- **No telemetry / observability hooks beyond `onError`** — no write-success, hydrate-success, or retry-attempt events (only start/finish hydration listeners + `onError`).
- **`partialize` runs on every `setState`** — no memoization hook for expensive projections (consumer's responsibility).
- **No built-in devtools / time-travel** — `setOptions` + `rehydrate` are the only runtime knobs.

### Notes for docs-adequacy / ROI analysis

- The JSDoc on `PersistOptions` is exceptionally thorough (every invariant, every trade-off) — but several runtime invariants (write-generation guard, re-schedule-after-rehydrate, `noRetry` teardown flush, `instanceof Promise` choice, Node-22 shape check) live only in code comments + tests, not in any consumer-facing README.
- The `HydrationSignal` adapter contract is fully specified in `src/core/hydration.ts` JSDoc but is exactly the kind of thing adapter authors need promoted to top-level docs.
- Gaps are mostly "ship more codecs/transports" (compression, encryption, `BroadcastChannel`, IDB transactions) — all have clean seams already in place, so ROI on adding them is high (no core rework needed).

---

# Appendix B — Adapter landscape (full subagent report)

## B.1 Current adapters / entry points

The `exports` map in `package.json` ships 5 subpath entries. Each optional peer is isolated behind its own subpath entry — importing the subpath IS the dep opt-in (enforced by a per-entry dependency-isolation test, e.g. `src/adapters/backends/idb.test.ts`).

### `.` (the core entry)

- **Provides:** re-exports `persist-core` + `hydration` (`src/core/index.ts:5-6`). Zero-dep.
- **Implements:** the canonical adapter contracts + `persistSource` engine + `createJSONStorage` / `createStorage` / `jsonCodec` / `identityCodec` / `createPersistRegistry` + `toHydrationSignal` / `alwaysHydratedSignal`.
- **Deps:** none. `peerDependenciesMeta` in `package.json` marks everything optional.
- **Consumer meaning:** the framework-agnostic persistence middleware. Bring your own reactive source via `persistSource`, or wire a framework adapter on top. This is also the entry non-TanStack users (zustand/Redux/hand-rolled atom) use — `persistSource` is the universal seam.

### `./codecs/seroval`

- **Provides:** `serovalCodec` + `createSerovalStorage` (`src/adapters/codecs/seroval.ts:21,37`).
- **Implements:** `StorageCodec<S>` from persist-core (`src/adapters/codecs/seroval.ts:9`).
- **Deps:** `seroval` (optional peer, `>=1.0.0`).
- **Consumer meaning:** a drop-in codec so `Set` / `Map` / `Date` round-trip through any _string-keyed_ backend (`localStorage`, `sessionStorage`, custom). One factory: `createSerovalStorage(() => localStorage)` (`src/adapters/codecs/seroval.ts:31-35`). The codec is also exposed standalone so it composes over `createStorage` for non-default backends (`src/adapters/codecs/seroval.test.ts:159-180`).

### `./backends/idb`

- **Provides:** `idbStateStorage` + `createIdbStorage` (`src/adapters/backends/idb.ts:34,74`).
- **Implements:** `StateStorage<TRaw>` (`src/adapters/backends/idb.ts:11`) with `TRaw = StorageValue<S>` — the **structured-clone mode** that the generic wire-type seam enables.
- **Deps:** `idb-keyval` (optional peer, `>=4.0.0`).
- **Consumer meaning:** IndexedDB-backed persistence that stores the `StorageValue` envelope _natively_ — `Set`/`Map`/`Date` round-trip via structured clone with **no codec at all** (`identityCodec`), better DevTools inspection (objects, not encoded strings). Codec use cases (encryption/compression) compose as a one-liner over `idbStateStorage` + `createStorage` (`src/adapters/backends/idb.ts:52-58`). Custom idb-keyval `store` for namespacing (`src/adapters/backends/idb.ts:16-23`).

### `./sources/tanstack-store`

- **Provides:** `persistStore` + `persistAtom` (`src/adapters/sources/tanstack-store.ts:24,56`).
- **Implements:** thin wrappers that supply the `PersistableSource` shape (`src/core/persist-core.ts:357-361`) to `persistSource`.
- **Deps:** `@tanstack/store` (optional peer, `>=0.10.0`); types only (`src/adapters/sources/tanstack-store.ts:4`).
- **Consumer meaning:** the only shipped reactive-source adapters. `persistStore` wraps a `Store` (action-bearing via `StoreActionMap`); `persistAtom` wraps a writable `Atom` and overrides default `merge` to **replace** (not shallow-spread) so primitive atom values aren't corrupted (`src/adapters/sources/tanstack-store.ts:74-80`), and throws on readonly atoms (`src/adapters/sources/tanstack-store.ts:60-62`).

### `./frameworks/react`

- **Provides:** `useHydrated` (`src/adapters/frameworks/react.ts:37`).
- **Implements:** mounts a `HydrationSignal` (`src/core/hydration.ts:28-31`) into React via `useSyncExternalStore`.
- **Deps:** `react` (optional peer, `^18.0.0 || ^19.0.0`).
- **Consumer meaning:** the _only_ React surface. Returns `{ hydrated }` to gate the hydrate flash on async backends (IndexedDB). State reads stay on the store (`useSelector`), not this hook (`src/adapters/frameworks/react.ts:7-10`). Null signal → `hydrated: true`. Server snapshot is always `true` (`src/adapters/frameworks/react.ts:42`).

## B.2 Adapter pattern

Three orthogonal seams, all in `src/core/persist-core.ts` / `src/core/hydration.ts`. An "adapter" picks exactly one seam to extend; it never reimplements the `persistSource` plumbing.

### Seam A — storage backend: `StateStorage<TRaw>`

```src/core/persist-core.ts:20:24
export interface StateStorage<TRaw = string> {
  getItem: (name: string) => TRaw | null | Promise<TRaw | null>;
  setItem: (name: string, value: TRaw) => void | Promise<void>;
  removeItem: (name: string) => void | Promise<void>;
}
```

Sync or async (detected via `instanceof Promise`, _not_ thenable duck-typing — `src/core/persist-core.ts:14-19`). A new backend adapter either hand-rolls these three methods, or wraps an existing backend (like `idbStateStorage` wraps idb-keyval, `src/adapters/backends/idb.ts:37-42`) and passes it to `createStorage`.

### Seam B — codec: `StorageCodec<S, TRaw>`

```src/core/persist-core.ts:74:77
export interface StorageCodec<S, TRaw = string> {
  encode: (value: StorageValue<S>) => TRaw;
  decode: (raw: TRaw) => StorageValue<S>;
}
```

A new codec plugs into `createStorage(getStorage, codec, options)` (`src/core/persist-core.ts:444-448`) — that's the entire integration surface. `serovalCodec` (`src/adapters/codecs/seroval.ts:21-24`) is the reference.

### Seam C — reactive source: `PersistableSource<TState>`

```src/core/persist-core.ts:357:361
export interface PersistableSource<TState> {
  getState: () => TState;
  setState: (updater: (prev: TState) => TState) => void;
  subscribe: (listener: () => void) => { unsubscribe: () => void };
}
```

A new framework/store adapter constructs this shape and calls `persistSource(source, opts)`. `persistStore`/`persistAtom` (`src/adapters/sources/tanstack-store.ts:28-38`, `64-72`) are the reference.

### Seam D — framework hydration: `HydrationSignal`

```src/core/hydration.ts:28:31
export interface HydrationSignal {
  subscribeHydrated: (listener: () => void) => () => void;
  isHydrated: () => boolean;
}
```

Adapter contract (`src/core/hydration.ts:14-27`): multiple concurrent subscribers, idempotent unsubscribe, **no** initial notification, **no** payload (pull model), SSR renders `hydrated: true`, `null` signal → hydrated. `useHydrated` is the reference implementation (`src/adapters/frameworks/react.ts:37-44`).

**Adapter contract checklist for a new adapter:**

1. Own your dep — ship a new subpath entry, mark it optional in `peerDependenciesMeta`, never import it from core/other entries (the isolation test pattern at `src/adapters/backends/idb.test.ts:175-199`).
2. Map onto exactly one seam (A/B/C/D); compose via the exposed factory (`createStorage` / `persistSource` / `toHydrationSignal`), never reimplement the engine.
3. For framework adapters, implement the SSR policy (`getServerSnapshot` returns `true`) in the adapter, not the signal (`src/core/hydration.ts:22-25`).

## B.3 Missing adapters

### Storage backends

| Adapter                                                          | Effort | Demand | Justification                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------- | ------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **sessionStorage** wrapper (`createSessionStorage` / doc recipe) | S      | med    | Already works today via `createJSONStorage(() => sessionStorage)` — but no named factory or SKILL entry. Cross-tab caveat is documented (`skills/tanstack-store/SKILL.md:116`). Low payoff; mostly a DX/ discoverability gap.                                                                                                |
| **OPFS** (Origin Private File System)                            | M      | med    | High-volume structured state in browsers; async, file-backed. Fits `StateStorage<TRaw>` naturally. Growing demand as localStorage hits quota.                                                                                                                                                                                |
| **Node fs / file**                                               | S      | med    | Server/SSR/CLI persistence. Trivial `StateStorage` over `fs.readFileSync`/`writeFileSync` (or async). Unblocks Node usage entirely — currently the lib is browser-flavored.                                                                                                                                                  |
| **memory** (test/fixture storage)                                | S      | low    | Already hand-rolled in every test file (`src/adapters/codecs/seroval.test.ts:7-25`, `src/adapters/sources/tanstack-store.test.ts:10-28`, `src/adapters/frameworks/react.test.ts:25-39`). Shipping one would dedupe ~3 copies.                                                                                                |
| **Redis**                                                        | M      | med    | Server-side persistent state; async. Pairs with Node fs entry for a real backend story.                                                                                                                                                                                                                                      |
| **SQLite WASM** (wa-sqlite / sqlite-wasm)                        | L      | med    | Structured-clone mode like IDB; powerful but heavy. Better as a community recipe than a shipped peer.                                                                                                                                                                                                                        |
| **expo-secure-store**                                            | S      | high   | React Native secure persistence is a top requested feature for any persist lib; small surface.                                                                                                                                                                                                                               |
| **MMKV** (react-native-mmkv)                                     | S      | high   | RN default fast KV; synchronous, drops straight into `StateStorage`. Very high RN demand signal.                                                                                                                                                                                                                             |
| **AsyncStorage** (RN)                                            | S      | high   | Legacy RN fallback; still widely used.                                                                                                                                                                                                                                                                                       |
| **Chrome `storage.area`** (`local`/`sync`/`session`)             | S      | med    | Extension developers — `localStorage` is forbidden in MV3 service workers. Strong niche demand.                                                                                                                                                                                                                              |
| **cookies**                                                      | M      | low    | Server-rendered hydration story; awkward (size limits, HTTP coupling). Better as recipe.                                                                                                                                                                                                                                     |
| **Cloudflare KV / Durable Objects**                              | M      | med    | Edge runtime persistence; async `StateStorage`. Growing with Workers adoption.                                                                                                                                                                                                                                               |
| **BroadcastChannel bridge** for IDB cross-tab                    | S      | high   | Explicitly called out as missing (`src/adapters/backends/idb.ts:62-64`, `skills/tanstack-store/SKILL.md:116`) — IDB fires no `storage` events, so `crossTab` is broken on IDB without a `crossTabEventTarget` bridge. The seam exists (`CrossTabEventTarget`, `src/core/persist-core.ts:113-122`); only the adapter doesn't. |

### Codecs

| Codec                                                        | Effort | Demand | Justification                                                                                                                                                                                                                                 |
| ------------------------------------------------------------ | ------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **JSON**                                                     | —      | —      | Already default (`jsonCodec`, `src/core/persist-core.ts:407-412`).                                                                                                                                                                            |
| **seroval**                                                  | —      | —      | Shipped.                                                                                                                                                                                                                                      |
| **structuredClone** codec                                    | S      | low    | Largely subsumed by IDB identity mode; marginal value as a codec.                                                                                                                                                                             |
| **MessagePack / cbor-x / CBOR**                              | S      | med    | Compact binary wire format; `cbor-x` is very fast. Drops into `StorageCodec<S, TRaw=Uint8Array>` — needs `TRaw` plumbing already in the seam.                                                                                                 |
| **zod-validated encode/decode**                              | S      | high   | Schema-gated persistence is a frequently-requested feature; `decode` runs in the existing try/catch corrupt-payload path (`src/core/persist-core.ts:473-488`), so validation errors map cleanly to `clearCorruptOnFailure`.                   |
| **protobuf**                                                 | L      | low    | Strongly-typed but heavy toolchain; better as recipe.                                                                                                                                                                                         |
| **encryption-at-rest** (WebCrypto + codec)                   | M      | high   | Explicitly framed as the canonical "custom codec" use case (`src/core/persist-core.ts:69-70`, `src/adapters/backends/idb.ts:52-58`, `skills/tanstack-store/SKILL.md:155`). No shipped adapter despite being the headline composition example. |
| **compression** (gzip/brotli via WASM / `CompressionStream`) | M      | med    | Native `CompressionStream` makes this a ~S now; pairs with binary `TRaw`.                                                                                                                                                                     |
| **superjson / devalue**                                      | S      | med    | Already name-dropped as drop-ins (`src/core/persist-core.ts:69`, `src/core/persist-core.ts:437-440`); seroval covers the same niche so demand is partial.                                                                                     |
| **immutable-hamt**                                           | L      | low    | Niche; structural sharing for huge state. Better as external lib.                                                                                                                                                                             |

### Framework integrations

| Adapter                                                       | Effort | Demand | Justification                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------- | ------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **React `useHydrated`**                                       | —      | —      | Shipped.                                                                                                                                                                                                                                                              |
| **Solid** `from(signal)` adapter                              | S      | high   | The `HydrationSignal` contract (`src/core/hydration.ts:8-10`) explicitly names Solid `from` as a target. Trivial one-liner; high Solid demand.                                                                                                                        |
| **Vue** (`shallowRef` + watch)                                | S      | high   | Also explicitly named in the signal JSDoc (`src/core/hydration.ts:10`).                                                                                                                                                                                               |
| **Svelte** (`createSubscriber` / readable store)              | S      | med    | Also named (`src/core/hydration.ts:9`).                                                                                                                                                                                                                               |
| **Preact**                                                    | S      | med    | `useSyncExternalStore` compatible — near-clone of React adapter.                                                                                                                                                                                                      |
| **Angular signals**                                           | S      | med    | `signal` + `effect`-based hydration gate; growing signals userbase.                                                                                                                                                                                                   |
| **TanStack Query** persister bridge                           | M      | high   | Natural cross-sell (the JSDoc repeatedly cites TanStack Query as the reference design, e.g. `src/core/persist-core.ts:12`, `src/core/persist-core.ts:263-264`, `src/core/persist-core.ts:88`). A `persistQueryClient`-shaped adapter would be a flagship integration. |
| **React provider/context/auto-binding**                       | M      | high   | See §B.5 — React users get only a hook, no ergonomics layer.                                                                                                                                                                                                          |
| **Zustand / Jotai / Valtio / MobX / signals** source adapters | S each | med    | All reduce to `PersistableSource` (the skill explicitly says "pass a custom implementation to persist anything else", `skills/tanstack-store/SKILL.md:135-139`). Each is ~10 lines; the question is whether to ship them or keep them as recipes.                     |

**Highest-leverage gaps (rough ranking):** MMKV/AsyncStorage/expo-secure-store (RN block), BroadcastChannel IDB cross-tab bridge (completes a documented-but-missing feature), encryption-at-rest codec (the headline example with no implementation), zod-validated codec, Solid/Vue framework adapters, TanStack Query bridge.

## B.4 Examples inventory

**None.** No `examples/`, `example/`, `demo/`, `playground/`, `snippets/`, or `sandboxes/` directory exists (Glob returned 0). The only runnable artefacts beyond `src/*.test.ts` and `tests-dom/*.test.tsx` are:

- `skills/tanstack-store/SKILL.md` — the single shipped skill (the `skills` dir contains only `tanstack-store/`, confirmed by `ls`).
- Inline `@example` JSDoc blocks in each adapter module (`src/adapters/backends/idb.ts:67-72`, `src/adapters/codecs/seroval.ts:29-35`, `src/adapters/sources/tanstack-store.ts:13-22`, `src/adapters/frameworks/react.ts:25-35`).
- `README.md` and `docs/architecture.md` prose snippets.

The `package.json` `files` array ships `dist` + `skills` only — no examples are published either. There is no end-to-end runnable app demonstrating wiring (store + storage + codec + hydration gate) outside the test suite.

## B.5 `./frameworks/react` entry nuance

`useHydrated` is the **entire** React surface. Confirmed: `exports` maps `./frameworks/react` → only `./dist/frameworks/react.{d.,}mts` in `package.json`, and `src/adapters/frameworks/react.ts` exports one function (`src/adapters/frameworks/react.ts:37`).

**What React users do NOT get:**

- **No provider / context.** No `<PersistProvider>`, no React context, no Devtools. Each component manually threads a `HydrationSignal` to `useHydrated` (`src/adapters/frameworks/react.ts:32-34`).
- **No automatic store binding.** The hook returns _only_ `hydrated` (`src/adapters/frameworks/react.ts:5-11`); state reads are explicitly the caller's job via `useSelector` from `@tanstack/store` (the JSDoc is emphatic: "Returns ONLY `hydrated` — state reads go through `useSelector`", `src/adapters/frameworks/react.ts:18-19`). There is no `usePersisted(store)` or selector-binding helper.
- **No `persistStore`-aware React hook.** The TanStack adapter (`./sources/tanstack-store`) and the React adapter (`./frameworks/react`) are decoupled — a React user imports `persistStore` from one subpath, `toHydrationSignal` from `.` core, and `useHydrated` from another, wiring them by hand (the canonical 3-line recipe at `skills/tanstack-store/SKILL.md:75-82`).
- **No automatic `destroy()` on unmount.** Teardown is manual — the skill documents the `useEffect` cleanup pattern as user responsibility (`skills/tanstack-store/SKILL.md:96-101`).
- **No hydration-aware `<Suspense>`/`use()` integration, no `useSyncExternalStore` selector helper, no SSR helper beyond the implicit server-snapshot policy.**
- **No React Native-specific entry** (no MMKV/AsyncStorage/expo-secure-store wiring — see §B.3).

The design is deliberately minimal — `src/adapters/frameworks/react.ts:22-24` states the hook is "the reference" implementation of the framework-agnostic `HydrationSignal` adapter contract, signaling that richer React ergonomics (provider, auto-binding, Devtools) are intentionally left to consumers or a future higher-layer package.

---

# Appendix C — Consumer docs adequacy (full subagent report)

## C.1 Doc inventory

| Doc                                     | Audience                                                | Quality (1–2 sentences)                                                                                                                                                                                                                                    |
| --------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md` (root)                      | **Consumers** — primary landing page                    | Strong. Install + quick start + a dense "Extensibility guide" with entry table, three-seam breakdown, recipes, framework-adapter sketch, lifecycle paragraph. Dense to the point of being a wall of text; no table of contents, no progressive disclosure. |
| `docs/README.md`                        | Maintainers                                             | Thin index. Explicitly says consumer doc is the root README; this folder is "maintainer-facing reference."                                                                                                                                                 |
| `docs/architecture.md`                  | Maintainers                                             | Good maintainer reference for seams, hydration lifecycle, sync/async, test matrix, publishing/API-docs policy. Not consumer-prose — assumes familiarity.                                                                                                   |
| `docs/glossary.md`                      | Maintainers                                             | Excellent ubiquitous-language table. Useful to consumers too, but not linked from README.                                                                                                                                                                  |
| `docs/roadmap.md`                       | Maintainers                                             | Forward-looking only; explicitly "not a mirror of src/". Fine.                                                                                                                                                                                             |
| `docs/plans/upstream-tanstack-pitch.md` | Maintainers / TanStack maintainers                      | A pitch draft, not consumer doc. Good context but irrelevant to a new user.                                                                                                                                                                                |
| `.github/CONTRIBUTING.md`               | Contributors                                            | Dev workflow, hooks, releases, agent rules. Solid.                                                                                                                                                                                                         |
| `skills/tanstack-store/SKILL.md`        | **Consumers via TanStack Intent** (packaged in tarball) | The single best consumer doc in the repo — wiring, `persistAtom` vs `persistStore`, hydration gate, throttle, teardown, cross-tab, migrate, mistakes, backend×codec matrix, full options/API surface.                                                      |
| `typedoc.json`                          | Tooling config                                          | TypeDoc over 5 entry points → `docs/api/` (git-ignored). `treatWarningsAsErrors`, `invalidLink` gated.                                                                                                                                                     |
| `.changeset/README.md`                  | Contributors                                            | Boilerplate + pointer to CONTRIBUTING releases. Fine.                                                                                                                                                                                                      |
| `CHANGELOG.md`                          | Consumers (release notes)                               | Two entries (0.1.0, 0.1.1). Adequate.                                                                                                                                                                                                                      |
| `docs/api/`                             | Consumers (generated reference)                         | Generated TypeDoc HTML site (`index.html`, `modules/`, `interfaces/`, `types/`, `hierarchy.html`). **Git-ignored** — so not in the repo, and **not linked from the README**.                                                                               |

## C.2 Capabilities: documented vs hidden

### `@stainless-code/persist` (core)

| Export                                                                                                                                                                                                      | Status | Where                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `persistSource`                                                                                                                                                                                             | ✅     | README:117, skill:131–139                                                                                                                                                                                                                                                                                           |
| `PersistApi` (interface: `rehydrate`, `hasHydrated`, `onHydrate`, `onFinishHydration`, `setOptions`, `clearStorage`, `getOptions`, `destroy`)                                                               | 🟡     | Lifecycle paragraph README:183 mentions `rehydrate`/`destroy`/`onError`; full surface only enumerated in skill:164. README never lists `setOptions`/`getOptions`/`clearStorage`/`onHydrate`/`onFinishHydration`.                                                                                                    |
| `createStorage`                                                                                                                                                                                             | ✅     | README:120, 125, 131                                                                                                                                                                                                                                                                                                |
| `createJSONStorage`                                                                                                                                                                                         | 🟡     | Only appears in README:75 inside a backend example; never explained as a public factory.                                                                                                                                                                                                                            |
| `jsonCodec`                                                                                                                                                                                                 | ✅     | README:95                                                                                                                                                                                                                                                                                                           |
| `identityCodec`                                                                                                                                                                                             | ✅     | README:97, skill:144                                                                                                                                                                                                                                                                                                |
| `registry` / `createPersistRegistry` / `PersistRegistry`                                                                                                                                                    | ❌     | `createPersistRegistry` is exported in `src/core/persist-core.ts:384` but **not mentioned anywhere in consumer docs**. The skill:163 lists `registry` as an option and skill:166 mentions `registry.clearAll()` once, but there is no example, no "clear-all-on-logout" recipe, no link to `createPersistRegistry`. |
| `HydrationSignal` / `toHydrationSignal` / `alwaysHydratedSignal` / `HydrationSource`                                                                                                                        | 🟡     | `toHydrationSignal` in quick-start README:40 and skill:79. `HydrationSignal` named in adapter section README:156. **`alwaysHydratedSignal` is undocumented** in any consumer doc — only in JSDoc. `HydrationSource` not mentioned.                                                                                  |
| Types: `StateStorage`, `StorageValue`, `PersistStorage`, `StorageCodec`, `JsonStorageOptions`, `CreateStorageOptions`, `CrossTabStorageEvent`, `CrossTabEventTarget`, `PersistOptions`, `PersistableSource` | 🟡     | `StateStorage`/`StorageCodec`/`PersistableSource` named in README:70–106. `CrossTabEventTarget` mentioned README:149. `StorageValue`, `PersistStorage`, `CreateStorageOptions`, `JsonStorageOptions`, `CrossTabStorageEvent` not surfaced in prose (only JSDoc + typedoc).                                          |

### `@stainless-code/persist/seroval`

| Export                 | Status | Where                            |
| ---------------------- | ------ | -------------------------------- |
| `serovalCodec`         | ✅     | README:96                        |
| `createSerovalStorage` | ✅     | README quick-start:30, README:77 |

### `@stainless-code/persist/idb`

| Export             | Status | Where                                                                                                                                                                                            |
| ------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `idbStateStorage`  | 🟡     | README:93, 131, 136 — appears in recipes but its async/cross-tab caveats are buried; `skill:116` mentions BroadcastChannel bridge. Never given a standalone "this is the raw backend" explainer. |
| `createIdbStorage` | ✅     | README:79, 139                                                                                                                                                                                   |

### `@stainless-code/persist/tanstack-store`

| Export         | Status | Where                     |
| -------------- | ------ | ------------------------- |
| `persistStore` | ✅     | README quick-start, skill |
| `persistAtom`  | ✅     | README:111, skill:52–66   |

### `@stainless-code/persist/react`

| Export              | Status | Where                                         |
| ------------------- | ------ | --------------------------------------------- |
| `useHydrated`       | ✅     | README quick-start:43, skill:81               |
| `UseHydratedResult` | 🟡     | Type only; `hydrated` field shown in example. |

### Options on `PersistOptions` (the real capability surface)

Documented in skill:163 list, but in the **README** only a subset is shown in prose/recipes:

| Option                                                | README                             | Skill           |
| ----------------------------------------------------- | ---------------------------------- | --------------- |
| `name`, `storage`, `version`, `migrate`               | ✅                                 | ✅              |
| `partialize`, `merge`, `onRehydrateStorage`           | ❌ in README                       | ✅              |
| `skipHydration`, `skipPersist`                        | 🟡 (`skipHydration` README:183)    | ✅              |
| `crossTab`, `crossTabEventTarget`, `onCrossTabRemove` | ✅ README:142–149                  | ✅              |
| `maxAge`, `buster`                                    | 🟡 (mentioned README:183)          | ✅              |
| `throttleMs`                                          | 🟡 (README:183)                    | ✅              |
| `retryWrite`                                          | 🟡 (README:183, JSDoc has example) | ❌ not in skill |
| `onError`                                             | 🟡 (README:183)                    | ❌ not in skill |
| `registry`                                            | ❌                                 | 🟡              |

**Biggest hidden capabilities:**

- **`createPersistRegistry` + `registry` clear-all-on-logout** — fully undocumented in README; the only "logout wipes everything" path is invisible to a new reader.
- **`alwaysHydratedSignal`** — exported, undocumented in prose.
- **`partialize` / `merge` / `onRehydrateStorage`** — core projection/merge hooks, absent from the README entirely (only in skill).
- **`retryWrite`** — has a great JSDoc example (`src/core/persist-core.ts:290–299`) but no README recipe; the quota-shrink story is a selling point and is buried.
- **`setOptions` / `getOptions` / `clearStorage`** on `PersistApi` — never enumerated in README.
- **The generated API site** (`docs/api/`) — built, validated, but **never linked from the README** and is git-ignored so consumers can't browse it in-repo; they must run `bun run docs:api` or read hovers.

## C.3 Onboarding path quality (5-minute test)

A brand-new user landing on `README.md`:

1. **What is this?** README:1–3 — one sentence. Crisp but jargon-dense ("storage × codec seams", "structural `PersistableSource`"). A newcomer who doesn't know "seam" or "hydration-aware" is lost on line 3.
2. **Why use it?** README:46–48 — the comparison paragraph. Good, but dense; "hydration lifecycle" is asserted, not explained.
3. **Install?** ✅ README:5–24 — clear, optional-peer table is excellent.
4. **Wire it up (TanStack Store + localStorage + seroval + React)?** ✅ README:26–44 quick start does exactly this. **But** the quick start uses `createSerovalStorage(() => localStorage)` + `useHydrated` — it does **not** show IndexedDB, and IndexedDB is where the hydration gate actually matters (async). The headline demo skips the case that justifies the library's "hydration-aware" name.
5. **Where they get stuck:**
   - **No "what is hydration?" explainer.** The word "hydration" appears 20+ times in the README; it is never defined for a reader who only knows it from the Next.js/SSR sense (where it means something different). README:152 says "gate UI on `useHydrated`" but never says _what flashes_ or _why_.
   - **No IndexedDB end-to-end example.** A user wanting IDB (the second-most-common backend) must assemble it from recipes README:131–139, which show `createStorage(() => idbStateStorage(), encryptedCodec, …)` and `createIdbStorage()` but never a complete `persistStore(store, { storage: createIdbStorage() })` + `useHydrated` gate + `destroy()` on unmount chain.
   - **No React component context.** The quick start ends with `// in a component:` and one line. No full component, no `<Skeleton />` fallback, no `useEffect(() => { const persist = persistStore(...); return () => persist.destroy() }, [])` pattern in the README (it's in skill:96–101 but a README reader won't find it).
   - **`useHydrated` import path is shown but `useSelector` is never mentioned** in the README — a TanStack Store user needs to know state reads go through `useSelector`, only the skill says so (skill:33 area via JSDoc example).
   - **No SSR/Next.js example** despite the library shipping an SSR policy (`alwaysTrue` server snapshot, `null` signal = hydrated). README:156 mentions "render `hydrated: true` on the server" in the adapter-author section, not the consumer section.
   - **`bun add` only.** No npm/pnpm/yarn equivalent. Minor, but `bun`-only install alienates non-Bun users (the engines field supports Node 20.19+/22.12+).
   - **The generated API site is invisible** — a user wanting reference has only hovers or `docs/api/` which they must build themselves and is not linked.

**Biggest onboarding gaps, ranked:**

1. No "what is hydration / why does it flash" explainer — the library's namesake concept is undefined.
2. No complete IndexedDB + React + `useHydrated` + `destroy()` walkthrough.
3. No full React component example in the README.
4. `createPersistRegistry` / clear-all invisible.
5. Generated API reference not linked.

## C.4 Examples in docs

Counting copy-pasteable code blocks across README + skill:

| Adapter combination                                           | Example?      | Where                                                                                           |
| ------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------- |
| TanStack Store + localStorage + seroval + React `useHydrated` | ✅            | README:28–44                                                                                    |
| TanStack Store + localStorage + seroval (no React)            | ✅            | skill:38–48                                                                                     |
| TanStack Atom + (default JSON localStorage)                   | ✅            | skill:59–66                                                                                     |
| TanStack Store + localStorage + jsonCodec (default)           | 🟡 implied    | quick start uses seroval; no plain-JSON example                                                 |
| TanStack Store + IndexedDB (`createIdbStorage`) + React       | ❌            | never shown end-to-end                                                                          |
| TanStack Store + IndexedDB + `identityCodec`                  | ❌            | `createIdbStorage()` shown standalone README:79, never wired to `persistStore`                  |
| TanStack Store + IndexedDB + encrypted codec                  | 🟡            | README:131–133 shows `createStorage(...)` but not the `persistStore(store, { storage })` wiring |
| TanStack Store + IndexedDB + seroval (legacy string payloads) | 🟡            | README:136, not wired                                                                           |
| TanStack Store + sessionStorage                               | 🟡            | README:78 shows `createSerovalStorage(() => sessionStorage)` standalone                         |
| TanStack Store + cross-tab (localStorage)                     | ✅            | README:142–147, skill:107–114                                                                   |
| TanStack Store + cross-tab (IDB via BroadcastChannel)         | ❌            | only prose README:149, skill:116 — no code                                                      |
| `persistSource` + zustand/Redux/hand-rolled                   | ❌            | README:117 shows the call shape; no real zustand/Redux example                                  |
| React Native (`AsyncStorage`)                                 | 🟡            | README:80 shows `createJSONStorage(() => AsyncStorage)` standalone, not wired                   |
| `partialize`                                                  | ❌            | no example anywhere                                                                             |
| `merge` custom                                                | ❌            | no example                                                                                      |
| `migrate`                                                     | ✅            | skill:122–129                                                                                   |
| `retryWrite`                                                  | ✅ JSDoc only | `src/core/persist-core.ts:290–299` — not in README/skill                                        |
| `registry` / `clearAll`                                       | ❌            | no example                                                                                      |
| `skipPersist`                                                 | ✅            | skill (via persistStore JSDoc `src/adapters/sources/tanstack-store.ts:18`), README mentions     |
| `throttleMs`                                                  | ❌            | no example, only prose                                                                          |
| `maxAge` / `buster`                                           | ❌            | no example, only prose                                                                          |
| Svelte / Solid / Vue adapter                                  | 🟡            | README:161–178 Svelte sketch only                                                               |
| Custom codec (superjson / encrypted)                          | ✅            | README:99–103                                                                                   |

**Rough count:** ~12 distinct code blocks in README, ~8 in skill. **No example** for: IDB+React end-to-end, IDB+identity wired to a store, IDB cross-tab BroadcastChannel, zustand/Redux via `persistSource`, `partialize`, `merge`, `registry`/clearAll, `throttleMs`, `maxAge`, `buster`, `retryWrite` (in prose docs), SSR/Next.js.

**No `examples/` directory exists** in the repo — no runnable demo apps at all.

## C.5 Missing doc types

- **Docs site (VitePress / MkDocs / Astro Starlight).** Currently the consumer surface is one giant README. A multi-page site with sidebar nav would fix the "wall of text" problem and let the generated `docs/api/` be hosted and linked.
- **"Getting Started" guide** — progressive (install → 30-sec localStorage → IDB + hydration gate → SSR), distinct from the reference-dense README.
- **"Adapters" catalog page** — one page per entry (`./codecs/seroval`, `./backends/idb`, `./sources/tanstack-store`, `./frameworks/react`) with install, API, and a complete example each.
- **"Choose your storage" decision matrix** — localStorage vs sessionStorage vs IndexedDB vs AsyncStorage vs custom: sync/async, cross-tab support, structured-clone, size limits, when to gate UI. The skill has a 4-row version (skill:150–155); a fuller one belongs in consumer docs.
- **"Choose your codec" matrix** — jsonCodec vs serovalCodec vs identityCodec vs custom: Set/Map/Date support, wire type, backend compatibility, perf notes. Currently scattered across README:95–103.
- **Recipes section** (separate page) — encryption-at-rest, cross-tab IDB via BroadcastChannel, partialize+merge, retryWrite quota-shrink, registry clear-all-on-logout, SSR/Next.js, React Native AsyncStorage, throttled high-frequency writes, schema migration chains. Most of these have no example today.
- **Migration guide** — for users coming from zustand-persist / redux-persist / @tanstack/query-persist-client / pinia-persist: option-name mapping, conceptual diffs, copy-paste port. The README:46–48 paragraph compares positioning but gives no port guide.
- **Comparison page** — vs zustand-persist, redux-persist, `@tanstack/query-persist-client`, pinia-persist. README:46–48 does this in one paragraph; a table (store-agnostic? hydration signal? codec seam? cross-tab? retryWrite? migrate? throttle?) would land harder.
- **Playground / StackBlitz / CodeSandbox** — none. A live editable example is the fastest on-ramp.
- **Interactive REPL** — none.
- **API reference caveats** — `docs/api/` is generated and git-ignored; **the README never links to it** and never tells a user how to read it (`bun run docs:api` is in CONTRIBUTING, not README). A "Reference" section pointing at the generated site (hosted on GitHub Pages via the `.nojekyll` already present in `docs/api/`) is missing.
- **A "Common mistakes" page** — skill:141–146 has 4; lift to consumer docs.
- **An "Examples" repo / `examples/` dir** — none; runnable TanStack+IDB+React and Next.js SSR apps would close the biggest onboarding gap.

## C.6 Tone & positioning

- **Value proposition:** Crisp at the seam/structure level ("every 'can it do X?' is a one-line composition instead of a feature request", README:3). But it leads with mechanism (seams, `PersistableSource`) before outcome (your prefs survive reload, no UI flash, works with any store). A new user learns _how it's built_ before _what it does for them_. The headline should answer "what do I get?" first.
- **"Hydration-aware":** **Not explained.** The word appears in the title (`README.md:1`), in `package.json` description, and ~20 times in the README, but is never defined. A reader who knows "hydration" only from React/Next.js SSR will be confused — here it means _"has the persisted state finished loading from storage yet,"_ a completely different concept. README:152 says "gate UI on `useHydrated`" but never shows _what_ flashes (the default state rendering briefly before stored state lands). **This is the single biggest tone gap.**
- **TanStack intent:** Clear in `skills/tanstack-store/SKILL.md` and `docs/plans/upstream-tanstack-pitch.md`, but **opaque in the README**. The README never says "this is meant to become TanStack Persist" or that `./sources/tanstack-store` is the primary adapter. A reader sees five equal-weight subpaths and doesn't know `@tanstack/store` is the blessed path. The "Relationship to TanStack Persist / zustand persist" section (README:46) frames it as a _competitor/alternative_ rather than a _collaboration target_, which undersells the TanStack intent.
- **Density vs audience mismatch:** The README is one document trying to serve "give me 5 minutes" (quick start) and "I want the full seam theory" (Extensibility guide) and "I'm writing a Svelte adapter" (adapter section). All three audiences get one scroll. Progressive disclosure (a Getting Started page → Extensibility guide → Adapter authoring) would serve each without overwhelming the others.
- **Voice:** Confident and opinionated (good — "deliberate divergence", "no barrel", "prefs shouldn't silently expire"). This is a strength; preserve it in any restructure.
- **`bun`-centrism:** README assumes Bun (`bun add`). Engines field supports Node ≥20.19. The install command should show npm/pnpm/yarn too, or a note that any package manager works.

### Bottom line

The **skill file** (`skills/tanstack-store/SKILL.md`) is the real consumer doc and is excellent; the **README** is a dense reference that doubles as a landing page and underserves the brand-new user. The library's headline concept ("hydration-aware") is never defined; the headline use case that justifies the library (IndexedDB + async hydration gate) has no end-to-end example; the clear-all registry, `partialize`/`merge`, `retryWrite`, and `alwaysHydratedSignal` are effectively hidden; and the generated API site is built but unlinked. Sufficient for an experienced TanStack Store user willing to read JSDoc; **not** sufficient for a 5-minute cold onboarding.

---

# Appendix D — Build / tooling (subagent report)

> The build/CI agent returned a high-level summary rather than a full structured report (it refused to expand twice on resume). The summary is reproduced verbatim below; every point it raised is captured in the synthesis `Build & tooling` section and the ROI tiers. If deeper file:line detail is needed for this lane, resume [the build/CI agent](d0f5c223-e7eb-4495-b33d-2a55f0d1a43c).

**Verbatim summary returned by the build/CI agent:**

> Re-output the complete 6-section build/tooling/test/release audit of `@stainless-code/persist` with file:line citations: zero-dep core with optional peers and ESM-only output; bun-unit + vitest/jsdom DOM split with no coverage/matrix/real-browser/SSR-framework tests; three CI workflows (ci/release/check-skills) with single-env matrix and gaps in preview deploy, pkg-size diff, and semver/export pack-validation; changesets publish flow lacking npm provenance/signing and id-token permission; consumer DX gaps in attw/knip/exportslint, bundle badge, packageManager pin, TS range, compatibility table, FAQ; and no examples/playground infra.

**Cross-checked against the synthesis `Build & tooling` section:** all six points (zero-dep core + optional peers + ESM-only; bun/vitest-jsdom split with no coverage/matrix/real-browser/SSR-framework tests; three CI workflows with single-env matrix + gaps; changesets lacking provenance/signing/id-token; consumer DX gaps; no examples/playground) are present. No information lost from this lane.
