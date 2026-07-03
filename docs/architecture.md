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

## Entry points (one subpath = one optional peer)

| Entry                                    | Module                       | Optional peer                                 |
| ---------------------------------------- | ---------------------------- | --------------------------------------------- |
| `@stainless-code/persist`                | `persist-core` + `hydration` | none (zero-dep core, enforced by a gate test) |
| `@stainless-code/persist/seroval`        | `persist-seroval`            | `seroval`                                     |
| `@stainless-code/persist/idb`            | `persist-idb`                | `idb-keyval`                                  |
| `@stainless-code/persist/tanstack-store` | `persist-tanstack`           | `@tanstack/store` (types only)                |
| `@stainless-code/persist/react`          | `use-hydrated`               | `react`                                       |

No barrel — importing a subpath is the dependency opt-in. Each subpath entry owns its peer dep, which stays external in the build (`tsdown.config.ts` `neverBundle`) so consumers tree-shake cleanly.

## Hydration lifecycle

`persistSource` hydrates on create (skip with `skipHydration`; `rehydrate()` is awaitable), subscribe-writes on every `setState` (gated until hydrated; optional trailing `throttleMs`), and tears down via `destroy()`. The hydration signal (`HydrationSignal` from `hydration`) is observed from outside the store — framework adapters mount it into their external-store mechanism (React `useSyncExternalStore` via `useHydrated`, Svelte `createSubscriber`, Solid `from`, Vue `shallowRef` + watch) without coupling to the store's read path. SSR policy: render `hydrated = true` on the server; `null` signal = no persistence = hydrated.

## Sync vs async

One API. Sync backends (localStorage) settle hydration before first paint; async backends (IndexedDB) ride the same `getItem` Promise branch — `getItem` returning a native `Promise` switches the read path to async (deliberately `instanceof Promise`, not thenable duck-typing, so a stored value carrying a `then` property is never mistaken for a pending read). Gate UI on `useHydrated` for async backends.

## Beyond Query-persister parity

`buster` / `maxAge` / `throttleMs` / `retryWrite` ship alongside versioned `migrate`, cross-tab sync (`crossTab` + `onCrossTabRemove`), the hydration signal, and the codec seam — beyond what TanStack Query's `persistQuery_client` offers. **Deliberate `maxAge` default divergence:** prefs shouldn't silently expire, so `maxAge` is opt-in rather than default-on.

## Publishing & API docs

- **Public surface** — every export from an entry point is the public API and carries JSDoc that reads well in hovers and published typings. `@default` / `@example` tags survive into the shipped `.d.mts` (tsdown dts preserves JSDoc). No `@internal` tags are currently warranted — every export is part of the public surface; `stripInternal: true` is set in `tsconfig.json` as a forward-looking guard so any future `@internal`-marked member is dropped from the dts.
- **`PersistStorage.raw`** — stays **public** (semi-public seam): set by `createStorage` and identity-compared by cross-tab rehydrate; hand-rolled `PersistStorage` implementations may omit it. Typed `unknown` deliberately (only identity matters; typing it `StateStorage<TRaw>` would cascade the wire-type generic for no benefit).
- **Internal aliases** — non-exported helper types (e.g. the listener alias) are kept out of public signatures: `PersistApi.onHydrate` / `onFinishHydration` inline `(state: TState) => void` so the shipped dts never leaks an unexported type name into a hover. The internal alias is reserved for the implementation's listener Sets.
- **API reference** — `bun run docs:api` runs [TypeDoc](https://typedoc.org) (`typedoc.json`) over the five entry points to a static HTML site under `docs/api/` (git-ignored). `treatWarningsAsErrors` + `validation.invalidLink` gate unresolved `{@link}` targets; all current `{@link}` resolve within the `index` core entry (no cross-entry links).

## Test matrix

Two runners, split by what they need:

| Runner                                    | Scope                     | Pattern            | Why                                                                                                                         |
| ----------------------------------------- | ------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `bun:test`                                | `src/**/*.test.ts`        | `bun test ./src`   | No DOM — fast unit tests for the core, codecs, backends, TanStack adapters, and `useHydrated` SSR/snapshot contracts.       |
| `vitest` + jsdom + @testing-library/react | `tests-dom/**/*.test.tsx` | `bun run test:dom` | The React `useHydrated` rerender + unmount-detach path needs a DOM + a client renderer (`useSyncExternalStore` reactivity). |

The split is structural — `tests-dom/` is a top-level directory outside `bun test ./src`'s scan, so the two runners never pick up the same file. `check` runs both in parallel; CI runs them as separate jobs (`Test`, `Test (DOM)`) gated by the single `CI complete` job. The bun suite's `use-hydrated.test.ts` header documents which contracts it pins and which it deliberately leaves to the vitest suite.

## Reference

- Root [`README.md`](../README.md) — install, quick start, recipes, framework-adapter guide.
- [`glossary.md`](./glossary.md) — ubiquitous language (backend, codec, source, envelope, hydration signal, generation guard, entry).
- [`roadmap.md`](./roadmap.md) — forward-looking work.
- `.agents/skills/docs-governance` — docs lifecycle for this folder.
