# Remaining ROI work

Actionable items not yet shipped from the docs-adapters ROI work. When an item ships, lift its durable bits to `docs/architecture.md` / `docs/roadmap.md` / a rule and strike it here; when the list is empty, delete this file (per [docs-governance § Closing a plan](../../.agents/skills/docs-governance/LIFECYCLE.md)).

## Context (read this first)

`@stainless-code/persist` is a hydration-aware persistence middleware for any reactive store. The agnostic core is `persistSource(source, options)` (`src/core/persist-core.ts`) plus `HydrationSignal` (`src/core/hydration.ts`). Three seams compose every backend × codec cell:

- **Backend** — `StateStorage<TRaw>`: `getItem` / `setItem` / `removeItem`, sync or Promise (async detected via `instanceof Promise`, not thenable duck-typing).
- **Codec** — `StorageCodec<S, TRaw>`: pure `encode` / `decode` between the `StorageValue<S>` envelope and the backend's wire type. Sync by design — async transforms (encryption, compression) are backend **wrappers**, not codecs.
- **Source** — `PersistableSource<TState>`: `getState` / `setState` / `subscribe`. Structural, store-agnostic.

Framework adapters mount `HydrationSignal` into each framework's external-store mechanism (React `useSyncExternalStore`, Solid `from`, Vue `shallowRef` + `onScopeDispose`, Svelte runes `createSubscriber` / stores `readable`, Angular `signal` + `effect`, Preact `useSyncExternalStore` via `preact/compat`).

**Layout:** `src/core/` (zero-dep engine) + `src/adapters/<seam>/` (`codecs/`, `backends/`, `transport/`, `sources/`, `frameworks/`). One subpath per optional peer, mirroring `src/` → `dist/` → `./<seam>/<name>` 1:1. No barrel — importing a subpath is the dependency opt-in. Each adapter imports only from `core/` (enforced by a per-entry self-check test). Full seam model + entry-point table + test matrix: [`docs/architecture.md`](../architecture.md). Consumer docs: [https://stainless-code.com/persist](https://stainless-code.com/persist) (`apps/docs`); npm landing: root [`README.md`](../../README.md).

**Source-adapter naming:** shape-based, not library-based — `persistStore` / `persistAtom` / `persistProxy` / `persistObservable`. Same persistable shape → same name → same merge semantics (Store/Proxy/Observable shallow-spread; Atom replace); the subpath carries the library. Alias when importing two same-shape adapters into one module.

## Conventions (apply to every item)

- **New subpath** = add to `package.json` `exports` + `peerDependencies` + `peerDependenciesMeta` (optional) + `tsdown.config.ts` `entry` + `deps.neverBundle` + `typedoc.json` `entryPoints`. Mirror `src/` → `dist/` → subpath 1:1.
- **Adapter isolation** — imports only from `core/`; call the shared `itImportsOnlyFromCore(sourceUrl)` helper (`src/testing/assert-core-only-imports.ts`) from each adapter's co-located test.
- **Zero-dep core gate** — `src/core/persist-core.ts` + `src/core/hydration.ts` have no value imports (enforced by `src/core/persist-core.test.ts`).
- **Changeset** — `.changeset/<slug>.md` with `@stainless-code/persist: minor` (or `major` for breaking) for any public-surface change.
- **Verify after each step** — `bun run lint:changes`, `bun run format:changes`, `bun test <co-located pair>`, `bun run typecheck`; use `bun run format` / `lint:fix` (pinned `oxfmt` / `oxlint`), not `bunx`.
- **Pre-commit** runs format/lint/typecheck/tests on staged files — never `--no-verify`. Run the per-file checks first so the hook passes first try (stash/restore can eat untracked files).

## Remaining items (ROI-ordered)

### 1. TanStack Query persister bridge — Tier 2, M

- **What:** a `./sources/tanstack-query` (or `./integrations/tanstack-query`) subpath exposing a `persistQueryClient`-shaped adapter over `persistSource`. Supply a cache-shaped `PersistableSource` (`getState` → `queryClient.getQueryCache().getAll()`; `setState` → `setQueryData` per entry; `subscribe` → `getQueryCache().subscribe`).
- **Why:** the JSDoc cites TanStack Query persister patterns (`AsyncStorage`, throttle); the README migration guide already maps the option names (`maxAge`, `buster`, `retryWrite` ↔ `retry`, `throttleMs` ↔ `throttleTime`). Flagship integration — converts the cache-bound incumbent's users.
- **Acceptance:** subpath ships + co-located test + README recipe; `persistQueryClient`-shaped call works against a mock `QueryClient`. Verify the cache-shaped source round-trips through `persistSource` with `createJSONStorage` + `maxAge`/`buster`.
- **Lands:** README "Wrapping your store" / a new "Integrations" section; changeset.

### 2. `examples/` monorepo workspace — Tier 2, M

- **What:** a top-level `examples/` workspace with runnable apps: `tanstack-idb-react`, `tanstack-localstorage-react`, `nextjs-ssr`, `react-native-mmkv`. Each wires store + storage + codec + hydration gate end-to-end.
- **Why:** zero runnable demos today — the only executable artefacts are `src/*.test.ts` and `tests-dom/*.test.tsx`. The headline use case (IDB + React + `useHydrated` + `destroy()`) exists only as README prose.
- **Acceptance:** each example `bun install && bun dev` runs; the IDB example demonstrates the hydrate flash + `useHydrated` gate; the Next.js example demonstrates the SSR `true` snapshot; the RN example uses `./backends/mmkv` (sync, no gate). Exclude from the published package (`package.json` `files` keeps `dist` + `skills`).
- **Lands:** stays in-repo as `examples/` (not a doc); README links to it. Changeset: `minor` (dev-only, no public-surface change → possibly no changeset needed).

### 3. Real-browser + SSR + framework-runtime test matrix — Tier 3, M

- **What:** add a Playwright job covering the React `useHydrated` rerender/detach path in a real browser (Chromium + WebKit/Safari); add a Next.js SSR smoke that asserts the server renders `hydrated: true` and the client hydrates without a flash. The `tests-dom` vitest/jsdom suite stays (fast); Playwright is the slow, real-environment gate. **Framework-runtime coverage gaps to close here** (bun mocks can't exercise the reactive wiring): Preact `useHydrated` subscribe/unsubscribe + rerender-on-flip (add a `tests-dom` jsdom suite — parity with React); Svelte 5 runes `createSubscriber` reactive ownership + cleanup (needs a Svelte component runtime); Angular `effect()` async attach timing (needs an Angular runtime so the `angular.ts:30` re-read guard is exercised, not hidden by a sync mock).
- **Why:** today the matrix is jsdom only — no real browser, no Safari, no SSR-framework. `useSyncExternalStore` reactivity and SSR snapshot policy are the constraint-critical paths; jsdom can diverge from real browsers. The Preact/Svelte/Angular adapters ship reactive wiring that the bun mocks never actually drive.
- **Acceptance:** CI `Test (Browser)` job runs Playwright green; `Test (SSR)` job runs a Next.js app green; Preact jsdom suite green; Svelte + Angular runtime tests green (or an explicit decision per-adapter to defer to a community recipe). All gated by `CI complete`. Co-locate fixtures under `tests-browser/`, `tests-ssr/`, and `tests-dom/preact.test.tsx` (outside `bun test ./src`'s scan, like `tests-dom/`).
- **Lands:** `.github/workflows/ci.yml` + new test dirs; `docs/architecture.md` § Test matrix updated. No changeset (test-only).

### 4. React ergonomics layer — Tier 4, M-L

- **What:** a `./frameworks/react` ergonomics companion (or a new `./frameworks/react-context` subpath) — `<PersistProvider>` + React context + `usePersisted(store, selector)` selector binding + auto-`destroy()` on unmount. The existing `useHydrated` stays the reference primitive.
- **Why:** `useHydrated` is the entire React surface today — no provider, no auto store binding, no auto-teardown. The bare `useHydrated` path stays the reference primitive; a richer ergonomics layer (provider + auto-binding + auto-teardown) is a separate concern.
- **Acceptance:** subpath ships + `tests-dom` coverage for mount/unmount teardown + selector rerender + provider scoping; README "React ergonomics" section. Keep it optional — the bare `useHydrated` path must remain valid.
- **Lands:** `src/adapters/frameworks/react-context.ts` (new subpath) + README section. Changeset: `minor`. **Decision needed:** ship in-repo or as a separate package (the bare `useHydrated` path stays the reference primitive; a richer ergonomics layer (provider + auto-binding + auto-teardown) is a separate concern).

### 5. OPFS + SQLite-WASM + Cloudflare KV/Durable Objects adapters — Tier 4, M-L

- **What:** four new `./backends/` subpaths: `opfs` (Origin Private File System, async, file-backed, high-volume structured state), `sqlite-wasm` (wa-sqlite / sqlite-wasm, structured-clone mode like IDB), `cloudflare-kv` + `cloudflare-do` (edge runtime, async `StateStorage`).
- **Why:** extends the backend surface to high-volume browser state, structured-query WASM storage, and edge runtimes. All fit `StateStorage<TRaw>` cleanly; no core rework.
- **Acceptance:** each ships as its own subpath with optional peer + co-located test (mock the runtime, like the MMKV/AsyncStorage tests) + README backend decision-matrix row. `sqlite-wasm` may be better as a community recipe than a shipped peer (heavy) — decide per-adapter.
- **Lands:** `src/adapters/backends/<name>.ts` + README "Choosing a storage" row + changeset (one per adapter).

### 6. StackBlitz / CodeSandbox playground — Tier 4, M

- **What:** an embedded live-editable example (StackBlitz or CodeSandbox) linked from [https://stainless-code.com/persist](https://stainless-code.com/persist) and README — the fastest on-ramp for a new user.
- **Why:** no playground today; a new user can't try a wiring without cloning. Pairs with `examples/` (item 2) and the shipped docs site.
- **Acceptance:** a one-click playground loads with a working TanStack + IDB + React wiring; the README + docs site link to it.
- **Deps:** item 2 (`examples/`) should land first so the playground has a source app (or seed from a docs recipe).
- **Lands:** README + docs site link. Changeset: `minor` (dev/docs-only).

### 7. Redux + Pinia source adapters — Tier 2, M

Migration guides already document hand-rolled `PersistableSource` wraps; first-party adapters close the gap with zustand/jotai/valtio/mobx. Research (2026-07-20) against local `rt2zz/redux-persist` + `prazdevs/pinia-plugin-persistedstate` and upstream `reduxjs/redux` / `vuejs/pinia` sources (OSS clones of the cores were unavailable in-agent — re-clone under `/Users/sutusebastian/Developer/OSS/{reduxjs/redux,vuejs/pinia}` before implementation).

#### `./sources/redux` — `persistStore` + `persistableReducer`

- **What:** thin `persistStore(store, opts)` over `persistSource`; companion `persistableReducer(baseReducer)` (not named `persistReducer`) that handles one internal set/hydrate action returning `action.payload`. Peer: `redux` (RTK stores are still Redux `Store`).
- **Why (fact-checked):** Redux has **no** `setState` — only `getState` / `dispatch` / `subscribe` → bare unsub fn (`createStore.ts`). `replaceReducer` dispatches private randomized `@@redux/REPLACE…` and re-runs the reducer with **previous** state — **not** payload hydrate. redux-persist owns writes inside `persistReducer` + lifecycle via `persistStore` → `dispatch` only (`persistStore.ts` / `persistReducer.ts`) — different ownership model from subscribe-writes. RTK slices ignore foreign actions unless `extraReducers` / root wrapper → silent no-op hydrate without `persistableReducer`.
- **Mapping:** `getState` → `store.getState()`; `setState(updater)` → `dispatch({ type: SET, payload: updater(getState()) })`; `subscribe` → `{ unsubscribe: store.subscribe(listener) }`.
- **Acceptance:** subpath + `persistableReducer` + co-located tests (plain `createStore` + RTK `configureStore`); migrating guide swaps hand-roll for adapter. Changeset: `minor`.
- **Lands:** `src/adapters/sources/redux.ts` (+ helper), entry-points table, [`guides/migrating`](../../apps/docs/content/guides/migrating.mdx). Alias if coexisting with redux-persist's `persistStore`.

#### `./sources/pinia` — `persistStore`

- **What:** thin `persistStore(store, opts)` over `persistSource`. Peer: `pinia` ≥ 2 (API floor; plugin ecosystem is often ≥ 3).
- **Why (fact-checked):** Pinia store is already near-`PersistableSource`. `$state` setter is `$patch(($state) => Object.assign($state, state))` — **shallow assign**, not root replace; object `$patch(partial)` is **deep** merge (`store.ts`). `$subscribe` returns a bare unsub and auto-detaches with the effect scope unless `{ detached: true }` — pinia-plugin-persistedstate uses `$patch` hydrate + `$subscribe(..., { detached: true })` (`runtime/core.ts`). Neither deletes absent keys on hydrate. Adapter is call-site (not a `pinia.use` plugin / `persist:` option).
- **Mapping:** `getState` → `store.$state`; `setState(updater)` → `store.$state = updater(store.$state)` (prefer over object `$patch`); `subscribe` → `{ unsubscribe: store.$subscribe(() => listener(), { detached: true }) }`.
- **Acceptance:** subpath + option-store + setup-store tests; migrating guide swaps hand-roll for adapter. Changeset: `minor`.
- **Lands:** `src/adapters/sources/pinia.ts`, entry-points table, migrating guide.

### 8. Lit + Alpine framework adapters — Tier 2, M

[Layers](https://stainless-code.com/layers/) ships framework mounts for Vanilla, React, Preact, Solid, Angular, Vue, Lit, Alpine, Svelte. Persist already covers React / Preact / Solid / Angular / Vue / Svelte (+ `svelte-store`). Gap vs Layers: **Lit** and **Alpine**. Vanilla is the core `HydrationSignal` / `toHydrationSignal` surface — no `./frameworks/vanilla` subpath (same as Layers' vanilla = core package). Research (2026-07-20) against local `stainless-code/layers` lit + alpine packages and OSS clones `lit` / `alpinejs`.

#### `./frameworks/lit` — `HydrationController` (or `useHydrated` controller)

- **What:** Lit `ReactiveController` that mounts a `HydrationSignal` and exposes `hydrated` (SSR snapshot `true` when no signal / on server). Peer: `lit`.
- **Why (fact-checked):** Layers Lit adapter drives hosts via `ReactiveController` + `host.requestUpdate()` on subscribe (`packages/lit/src/index.ts` `subscribeStackSnapshot` / `StackController`). Persist's contract is the same seam as React's `useHydrated`: `subscribeHydrated` + `isHydrated` only — gate flash, don't own store reads. Lit has no hooks; controller hostAdd / hostDisconnected is the lifecycle pair.
- **Mapping:** `hostConnected` → subscribe; on notify → `host.requestUpdate()`; `hostDisconnected` → unsubscribe; getter `hydrated` → `signal?.isHydrated() ?? true`.
- **Acceptance:** subpath + controller tests (mock `ReactiveControllerHost`); adapters index + docs guide. Changeset: `minor`.
- **Lands:** `src/adapters/frameworks/lit.ts`, entry-points table, [`adapters`](../../apps/docs/content/) / getting-started framework list.

#### `./frameworks/alpine` — plugin + `$hydrated` / `useHydrated`

- **What:** Alpine plugin that mounts `HydrationSignal` into Alpine reactivity (`Alpine.reactive` bag + subscribe). Peer: `alpinejs`. Optional CDN entry if Layers-style auto-plugin is wanted later.
- **Why (fact-checked):** Layers Alpine keeps a reactive bag and `stack.subscribe` → mutate bag so Alpine tracks (`packages/alpine/src/index.ts`); warns if `useStack` runs before `Alpine.plugin`. Persist needs the same: bare `subscribeHydrated` alone won't re-render `x-show` / `x-text` without a reactive property Alpine already tracks. Prefer thin magic/data (`$hydrated(signal)` or `Alpine.data`) over a heavy directive — hydration is a boolean gate, not a stack outlet.
- **Mapping:** `getSnapshot` → `reactive({ hydrated })`; `subscribeHydrated` → set `bag.hydrated = signal.isHydrated()`; cleanup on Alpine destroy / effect teardown; null signal → `hydrated: true`.
- **Acceptance:** subpath + plugin tests (mock Alpine runtime or happy-dom + alpine); adapters index + docs. Changeset: `minor`.
- **Lands:** `src/adapters/frameworks/alpine.ts`, entry-points table, docs framework list (order after Vue, before Svelte — match Layers: … Vue, Lit, Alpine, Svelte).

## Backlog (lower-priority, brainstormed — not ROI-tiered)

From audit Appendix B.3. Each is a one-line composition over an existing seam; ship only if demand surfaces.

- **Redis backend** (M) — server-side persistent state; async `StateStorage`. Pairs with `./backends/node-fs` for a real server story.
- **Chrome `storage.area`** (S) — `local` / `sync` / `session` for MV3 extensions (`localStorage` is forbidden in MV3 service workers).
- **cookies backend** (M) — server-rendered hydration; size limits + HTTP coupling make it awkward — likely a recipe, not a shipped peer.
- **Codecs** — MessagePack / cbor-x / CBOR (S codec, but needs `TRaw = Uint8Array` + a binary backend or base64 bridge — no shipped backend is binary-wire today), superjson / devalue (S, class-instance round-trip — overlaps `seroval`), protobuf (L, heavy toolchain — recipe). `structuredClone` isn't a codec (returns an object, not a wire type); IDB identity mode covers its only use case.

## Sequencing

1. **#1 (Query bridge)** — M, pure code, high adoption payoff, no deps. Best next pick.
2. **#7 (Redux + Pinia sources)** — M, closes migration-guide hand-rolls; Pinia is thin, Redux needs `persistableReducer`.
3. **#8 (Lit + Alpine frameworks)** — M, Layers parity; Lit is a thin controller, Alpine needs reactive bag + plugin.
4. **#3 (real-browser + SSR matrix)** — M, de-risks the hydration-critical paths before more surface lands.
5. **#2 (examples/) → #6 (playground)** — demo arc; docs site already shipped.
6. **#4 (React ergonomics) + #5 (OPFS/SQLite/Cloudflare)** — strategic; decide ship-vs-recipe per item.

## Reference

- [Architecture — seams, entry points, test matrix, limitations](../architecture.md)
- [Roadmap](../roadmap.md)
- [Upstream TanStack pitch](./upstream-tanstack-pitch.md)
- Public docs — [https://stainless-code.com/persist](https://stainless-code.com/persist) (`apps/docs`)
- Root [README](../../README.md) — npm/repo landing
- [.agents/skills/docs-governance](../../.agents/skills/docs-governance/SKILL.md) — plan lifecycle (close = lift + delete)
