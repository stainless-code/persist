# Architecture

Brief maintainer reference for the seam model and entry-point layout. The full API contract lives in the **JSDoc of each module** (hovers + published typings); the consumer-facing guide is the root [`README.md`](../README.md) § Extensibility guide. This file points at it, not a restatement.

## Three seams

Persistence is bound to a structural `PersistableSource` (`getState` / `setState` / `subscribe`) rather than a specific store, so the same middleware persists TanStack Store, zustand, Redux, or a hand-rolled atom. Three seams make every backend × codec cell a one-line composition:

| Seam        | Type                             | Role                                                                                                                       |
| ----------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Backend** | `StateStorage<TRaw = string>`    | `getItem` / `setItem` / `removeItem` — sync or Promise-returning, string-wire by default, generic for structured backends. |
| **Codec**   | `StorageCodec<S, TRaw = string>` | Pure `encode` / `decode` between the persisted envelope (`StorageValue`) and the backend's wire type.                      |
| **Source**  | `PersistableSource<TState>`      | The reactive store to persist — structural, store-agnostic.                                                                |

`createStorage(backend, codec, options)` composes a `PersistStorage`; `persistSource(source, options)` wires it to a store. **Factory policy:** codec factories take the backend as an argument; a backend earns its own factory only when it needs real adaptation (IndexedDB). Everything else composes — no factory-per-combination.

## Entry points (optional peer when the adapter needs one)

| Entry                                             | Module                                      | Optional peer                                 |
| ------------------------------------------------- | ------------------------------------------- | --------------------------------------------- |
| `@stainless-code/persist`                         | `core/index` (`persist-core` + `hydration`) | none (zero-dep core, enforced by a gate test) |
| `@stainless-code/persist/codecs/seroval`          | `adapters/codecs/seroval`                   | `seroval`                                     |
| `@stainless-code/persist/codecs/standard-schema`  | `adapters/codecs/standard-schema`           | none                                          |
| `@stainless-code/persist/backends/idb`            | `adapters/backends/idb`                     | `idb-keyval`                                  |
| `@stainless-code/persist/backends/async-storage`  | `adapters/backends/async-storage`           | `@react-native-async-storage/async-storage`   |
| `@stainless-code/persist/backends/mmkv`           | `adapters/backends/mmkv`                    | `react-native-mmkv`                           |
| `@stainless-code/persist/backends/secure-store`   | `adapters/backends/secure-store`            | `expo-secure-store`                           |
| `@stainless-code/persist/backends/encrypted`      | `adapters/backends/encrypted`               | none (web global)                             |
| `@stainless-code/persist/backends/compressed`     | `adapters/backends/compressed`              | none (web global)                             |
| `@stainless-code/persist/backends/node-fs`        | `adapters/backends/node-fs`                 | none (Node built-in)                          |
| `@stainless-code/persist/transport/crosstab`      | `adapters/transport/crosstab`               | none (web global)                             |
| `@stainless-code/persist/sources/tanstack-store`  | `adapters/sources/tanstack-store`           | `@tanstack/store` (types only)                |
| `@stainless-code/persist/sources/zustand`         | `adapters/sources/zustand`                  | `zustand`                                     |
| `@stainless-code/persist/sources/jotai`           | `adapters/sources/jotai`                    | `jotai`                                       |
| `@stainless-code/persist/sources/valtio`          | `adapters/sources/valtio`                   | `valtio`                                      |
| `@stainless-code/persist/sources/mobx`            | `adapters/sources/mobx`                     | `mobx`                                        |
| `@stainless-code/persist/sources/pinia`           | `adapters/sources/pinia`                    | `pinia`                                       |
| `@stainless-code/persist/sources/redux`           | `adapters/sources/redux`                    | `redux`                                       |
| `@stainless-code/persist/frameworks/react`        | `adapters/frameworks/react`                 | `react`                                       |
| `@stainless-code/persist/frameworks/preact`       | `adapters/frameworks/preact`                | `preact` (>=10.19)                            |
| `@stainless-code/persist/frameworks/solid`        | `adapters/frameworks/solid`                 | `solid-js`                                    |
| `@stainless-code/persist/frameworks/angular`      | `adapters/frameworks/angular`               | `@angular/core` (>=17)                        |
| `@stainless-code/persist/frameworks/vue`          | `adapters/frameworks/vue`                   | `vue`                                         |
| `@stainless-code/persist/frameworks/lit`          | `adapters/frameworks/lit`                   | `lit` (>=3)                                   |
| `@stainless-code/persist/frameworks/alpine`       | `adapters/frameworks/alpine`                | `alpinejs` (>=3)                              |
| `@stainless-code/persist/frameworks/svelte`       | `adapters/frameworks/svelte`                | `svelte` (>=5.7 runes)                        |
| `@stainless-code/persist/frameworks/svelte-store` | `adapters/frameworks/svelte-store`          | `svelte` (>=3 store)                          |

No barrel — importing a subpath is the dependency opt-in. Each subpath entry owns its optional peer dep when the adapter needs one — the no-peer entries are the core, standard-schema, encrypted, compressed, node-fs, and crosstab subpaths — and the peer stays external in the build (`tsdown.config.ts` `neverBundle`) so consumers tree-shake cleanly.

## Folder layout

`src/` splits at the dependency-direction boundary:

- **`core/`** — the zero-dep engine (`persist-core.ts`, `hydration.ts`) plus `index.ts` (the `.` entry that re-exports both). Nothing in `core/` imports an adapter.
- **`adapters/<seam>/`** — opt-in entries that own an optional peer and import only from `core/`:
  - `codecs/` — `StorageCodec` adapters (seroval, Standard Schema) + Standard Schema `PersistStorage` wraps
  - `backends/` — `StateStorage` adapters + wrappers (idb, async-storage, mmkv, secure-store, encrypted, compressed, node-fs)
  - `transport/` — `CrossTabEventTarget` adapters (crosstab — BroadcastChannel bridge)
  - `sources/` — `PersistableSource` adapters (tanstack-store, zustand, jotai, valtio, mobx, pinia, redux). Shape-named, not library-named — same persistable shape → same name → same merge semantics; the subpath carries the library. Alias when importing two same-shape adapters into one module.
  - `frameworks/` — `HydrationSignal` framework adapters (react, preact, solid, angular, vue, lit, alpine, svelte, svelte-store)

A per-entry self-check test pins the invariant: every adapter's relative imports resolve into `core/` (no cross-adapter coupling). `dist/` mirrors `src/` (`dist/<seam>/<name>.mjs` via tsdown's record-form `entry` keyed by `<seam>/<name>`) — src folder → tsdown key → dist path → subpath, all 1:1.

## Hydration lifecycle

`persistSource` hydrates on create (skip with `skipHydration`; `rehydrate()` is awaitable), subscribe-writes on every `setState` (gated until hydrated; optional trailing `throttleMs`), and tears down via `destroy()`. The hydration signal (`HydrationSignal` from `hydration`) is observed from outside the store — framework adapters mount it into their external-store mechanism (React / Preact `useSyncExternalStore`, Solid `from`, Angular `signal` + `effect`, Vue `shallowRef` + `onScopeDispose`, Lit `ReactiveController`, Alpine reactive bag + `$hydrated`, Svelte runes / stores) without coupling to the store's read path. SSR policy: render `hydrated = true` on the server; `null` signal = no persistence = hydrated.

## Sync vs async

One API. Sync backends (localStorage) settle hydration before first paint; async backends (IndexedDB) ride the same `getItem` Promise branch — `getItem` returning a native `Promise` switches the read path to async (deliberately `instanceof Promise`, not thenable duck-typing, so a stored value carrying a `then` property is never mistaken for a pending read). Gate UI on `useHydrated` for async backends. Standard Schema also offers `PersistStorage` wraps (`withStandardSchema` / `withStandardSchemaAsync`) for sync vs async `~standard` lanes — JSON factories are sugar over those wraps.

## Beyond Query-persister parity

`buster` / `maxAge` / `throttleMs` / `retryWrite` ship alongside versioned `migrate`, cross-tab sync (`crossTab` + `onCrossTabRemove`), the hydration signal, and the codec seam — beyond what TanStack Query's `persistQueryClient` offers. **Deliberate `maxAge` default divergence:** prefs shouldn't silently expire, so `maxAge` is opt-in rather than default-on.

## Limitations (by design)

What the core deliberately does **not** do — the seams exist for these, but no shipped impl:

- **No IndexedDB integration in core** — seam only (`StateStorage<TRaw>` + `identityCodec`); IDB lives in `./backends/idb` (idb-keyval peer). No transaction batching, key-range cursors, or IDB-specific error mapping in core.
- **No multi-key batching** — one key per `persistSource`; no atomic multi-key write. `PersistRegistry.clearAll` is best-effort `allSettled`, not a transaction.
- **No key-namespacing helper** — `name` is a raw string; no built-in prefix convention.
- **Trailing-only throttle** — no leading edge; the first write waits out the window (explicit trade-off vs TanStack Query's leading+trailing).
- **`retryWrite` uncapped by design** — no max-attempts / backoff; the callback owns termination (can spin forever).
- **`setOptions` cannot re-wire structural options** — `registry`, `crossTab`, `crossTabEventTarget` are set at create time only.
- **No selective / per-field hydrate** — `merge` is the only knob; no field-level hydration hooks.
- **No built-in cross-tab payload diff** — full rehydrate on every matching event; no "only changed fields" optimization.
- **No built-in size/quota introspection** — `retryWrite` reacts to failures; the core never probes quota.
- **No SSR serialize-and-rehydrate** — the server renders `hydrated: true`; shipping server state to the client for first-paint is the framework adapter's job (`useHydrated` server snapshot).
- **Async detection is native same-realm `Promise` only** — cross-realm / custom-thenable backends aren't supported (deliberate, so a stored value with a `then` property isn't mistaken for a pending read).
- **Cross-tab `onCrossTabRemove` is the only removal primitive** — no symmetric "another tab wrote" callback distinct from `rehydrate()`.
- **No telemetry / observability beyond `onError`** — no write-success / hydrate-success / retry-attempt events.
- **`partialize` runs on every `setState`** — no memoization hook for expensive projections (consumer's responsibility).
- **No built-in devtools / time-travel** — `setOptions` + `rehydrate` are the only runtime knobs.

## Publishing & API docs

- **Public docs** — canonical site is [`apps/docs`](../apps/docs) (`@stainless-code/persist-docs`, Blume), base `/persist`, live at [https://stainless-code.com/persist](https://stainless-code.com/persist). Root scripts: `docs:dev` / `docs:api` / `docs:validate` / `docs:check` / `docs:build` / `docs:audit` / `docs:preview`. CI runs that pipeline; merge of a `docs`-labeled PR (or release / `workflow_dispatch`) deploys via FTP ([`.github/workflows/deploy-docs.yml`](../.github/workflows/deploy-docs.yml)). Brand assets live under `apps/docs/public/`; accent overrides in `apps/docs/theme.css`. Maintainer Tier-B (`docs/architecture.md`, glossary, plans) stays in this folder.
- **Public surface** — every export from an entry point is the public API and carries JSDoc that reads well in hovers and published typings. `@default` / `@example` tags survive into the shipped `.d.mts` (tsdown dts preserves JSDoc). No `@internal` tags are currently warranted — every export is part of the public surface; `stripInternal: true` is set in `tsconfig.json` as a forward-looking guard so any future `@internal`-marked member is dropped from the dts.
- **`PersistStorage.raw`** — stays **public** (semi-public seam): set by `createStorage` and identity-compared by cross-tab rehydrate; hand-rolled `PersistStorage` implementations may omit it. Typed `unknown` deliberately (only identity matters; typing it `StateStorage<TRaw>` would cascade the wire-type generic for no benefit).
- **Internal aliases** — non-exported helper types (e.g. the listener alias) are kept out of public signatures: `PersistApi.onHydrate` / `onFinishHydration` inline `(state: TState) => void` so the shipped dts never leaks an unexported type name into a hover. The internal alias is reserved for the implementation's listener Sets.
- **API reference** — `bun run docs:api` runs [TypeDoc](https://typedoc.org) (`typedoc.json`) with the markdown + frontmatter plugins into MDX under `apps/docs/content/reference/api` (generated, gitignored except hand-authored `index.mdx` + `meta.ts`). `apps/docs/scripts/rewrite-api-links.ts` cleans prior output and rewrites links/anchors for the docs site routes. `treatWarningsAsErrors` + `validation.invalidLink` gate unresolved `{@link}` targets; all current `{@link}` resolve within the core entry (no cross-entry links).

## Test matrix

Two runners, split by what they need:

| Runner                                    | Scope                          | Pattern            | Why                                                                                                                                    |
| ----------------------------------------- | ------------------------------ | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `bun:test`                                | `src/**/*.test.ts`             | `bun test ./src`   | No DOM — fast unit tests for the core, codecs, backends, transport, source + framework adapters, and hydration SSR/snapshot contracts. |
| `vitest` + jsdom + @testing-library/react | `tests-dom/**/*.test.{ts,tsx}` | `bun run test:dom` | The React `useHydrated` rerender + unmount-detach path needs a DOM + a client renderer (`useSyncExternalStore` reactivity).            |

The split is structural — `tests-dom/` is a top-level directory outside `bun test ./src`'s scan, so the two runners never pick up the same file. `check` runs both in parallel; CI runs them as separate jobs (`Test`, `Test (DOM)`) gated by the single `CI complete` job. The bun suite's `src/adapters/frameworks/react.test.ts` header documents which contracts it pins and which it deliberately leaves to the vitest suite.

## Reference

- Public docs — [https://stainless-code.com/persist](https://stainless-code.com/persist) (`apps/docs`).
- Root [`README.md`](../README.md) — npm/repo landing.
- [`glossary.md`](./glossary.md) — ubiquitous language (backend, codec, source, envelope, hydration signal, generation guard, entry).
- [`roadmap.md`](./roadmap.md) — forward-looking work.
- `.agents/skills/docs-governance` — docs lifecycle for this folder.
