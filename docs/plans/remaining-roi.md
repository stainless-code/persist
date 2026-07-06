# Remaining ROI work

Actionable items not yet shipped from the docs-adapters ROI work. When an item ships, lift its durable bits to `docs/architecture.md` / `docs/roadmap.md` / a rule and strike it here; when the list is empty, delete this file (per [docs-governance § Closing a plan](../../.agents/skills/docs-governance/LIFECYCLE.md)).

## Context (read this first)

`@stainless-code/persist` is a hydration-aware persistence middleware for any reactive store. The agnostic core is `persistSource(source, options)` (`src/core/persist-core.ts`) plus `HydrationSignal` (`src/core/hydration.ts`). Three seams compose every backend × codec cell:

- **Backend** — `StateStorage<TRaw>`: `getItem` / `setItem` / `removeItem`, sync or Promise (async detected via `instanceof Promise`, not thenable duck-typing).
- **Codec** — `StorageCodec<S, TRaw>`: pure `encode` / `decode` between the `StorageValue<S>` envelope and the backend's wire type. Sync by design — async transforms (encryption, compression) are backend **wrappers**, not codecs.
- **Source** — `PersistableSource<TState>`: `getState` / `setState` / `subscribe`. Structural, store-agnostic.

Framework adapters mount `HydrationSignal` into each framework's external-store mechanism (React `useSyncExternalStore`, Solid `from`, Vue `shallowRef` + `onScopeDispose`, Svelte runes `createSubscriber` / stores `readable`, Angular `signal` + `effect`, Preact `useSyncExternalStore` via `preact/compat`).

**Layout:** `src/core/` (zero-dep engine) + `src/adapters/<seam>/` (`codecs/`, `backends/`, `transport/`, `sources/`, `frameworks/`). One subpath per optional peer, mirroring `src/` → `dist/` → `./<seam>/<name>` 1:1. No barrel — importing a subpath is the dependency opt-in. Each adapter imports only from `core/` (enforced by a per-entry self-check test). Full seam model + entry-point table + test matrix: [`docs/architecture.md`](../architecture.md). Consumer guide + recipes: root [`README.md`](../../README.md).

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

### 3. Docs site — Tier 2, M

- **What:** a VitePress or Astro Starlight site splitting the wall-of-text README into Getting Started → Adapters → Recipes → Adapter authoring → Reference; host the generated `docs/api/` under it. The README stays as the landing-page digest.
- **Why:** the README is one document serving "give me 5 minutes", "I want the seam theory", and "I'm writing a Svelte adapter" — all three audiences get one scroll. The generated `docs/api/` site is built but git-ignored and unlinked.
- **Acceptance:** site builds (`bun run docs:site` or equivalent), deployed to GitHub Pages (add `.nojekyll` at publish time); README links to it; `docs/api/` reachable from the site nav. No content duplication — the site pulls from the same source prose where possible.
- **Lands:** `docs/site/` (or a `docs/` restructure); README trimmed to landing digest. Changeset: `minor`.

### 4. npm provenance + signing — Tier 3, S ✅ implemented (verify on next release)

- **What:** npm **trusted publishing** (GitHub OIDC) — no long-lived `NPM_TOKEN`. `.github/workflows/release.yml`: add `id-token: write` + `environment: release` (matches the npm trusted-publisher binding's environment claim); remove `NPM_TOKEN` from the changesets step env. `package.json`: `publishConfig.provenance: true`. Provenance is auto-generated under trusted publishing (no `--provenance` flag); `changesets/action@v1` detects OIDC and skips the `.npmrc` token write, and `changeset publish` routes through `npm publish` (non-pnpm → npm) which does the OIDC exchange.
- **Why:** eliminates the long-lived token secret (the biggest supply-chain risk) + ships Sigstore provenance. Low effort, high integrity payoff.
- **Implemented:** `ci(release): switch to npm trusted publishing` — workflow + `package.json` committed. npm side configured: trusted publisher = `stainless-code/persist` + `release.yml` + environment `release` + `Allow npm publish`; publishing access = "require 2FA and disallow tokens".
- **Acceptance (remaining):** the next changeset merge to `main` publishes with provenance — verify the npm version page shows the Provenance badge, or `npm view @stainless-code/persist@<ver> --json` includes `dist.attestations`. Then revoke + delete the old `NPM_TOKEN` repo secret. Strike this item once verified.
- **Lands:** `.github/workflows/release.yml` + `package.json`. No changeset (infra-only).

### 5. Real-browser + SSR + framework-runtime test matrix — Tier 3, M

- **What:** add a Playwright job covering the React `useHydrated` rerender/detach path in a real browser (Chromium + WebKit/Safari); add a Next.js SSR smoke that asserts the server renders `hydrated: true` and the client hydrates without a flash. The `tests-dom` vitest/jsdom suite stays (fast); Playwright is the slow, real-environment gate. **Framework-runtime coverage gaps to close here** (bun mocks can't exercise the reactive wiring): Preact `useHydrated` subscribe/unsubscribe + rerender-on-flip (add a `tests-dom` jsdom suite — parity with React); Svelte 5 runes `createSubscriber` reactive ownership + cleanup (needs a Svelte component runtime); Angular `effect()` async attach timing (needs an Angular runtime so the `angular.ts:30` re-read guard is exercised, not hidden by a sync mock).
- **Why:** today the matrix is jsdom only — no real browser, no Safari, no SSR-framework. `useSyncExternalStore` reactivity and SSR snapshot policy are the constraint-critical paths; jsdom can diverge from real browsers. The Preact/Svelte/Angular adapters ship reactive wiring that the bun mocks never actually drive.
- **Acceptance:** CI `Test (Browser)` job runs Playwright green; `Test (SSR)` job runs a Next.js app green; Preact jsdom suite green; Svelte + Angular runtime tests green (or an explicit decision per-adapter to defer to a community recipe). All gated by `CI complete`. Co-locate fixtures under `tests-browser/`, `tests-ssr/`, and `tests-dom/preact.test.tsx` (outside `bun test ./src`'s scan, like `tests-dom/`).
- **Lands:** `.github/workflows/ci.yml` + new test dirs; `docs/architecture.md` § Test matrix updated. No changeset (test-only).

### 6. React ergonomics layer — Tier 4, M-L

- **What:** a `./frameworks/react` ergonomics companion (or a new `./frameworks/react-context` subpath) — `<PersistProvider>` + React context + `usePersisted(store, selector)` selector binding + auto-`destroy()` on unmount. The existing `useHydrated` stays the reference primitive.
- **Why:** `useHydrated` is the entire React surface today — no provider, no auto store binding, no auto-teardown. The bare `useHydrated` path stays the reference primitive; a richer ergonomics layer (provider + auto-binding + auto-teardown) is a separate concern.
- **Acceptance:** subpath ships + `tests-dom` coverage for mount/unmount teardown + selector rerender + provider scoping; README "React ergonomics" section. Keep it optional — the bare `useHydrated` path must remain valid.
- **Lands:** `src/adapters/frameworks/react-context.ts` (new subpath) + README section. Changeset: `minor`. **Decision needed:** ship in-repo or as a separate package (the bare `useHydrated` path stays the reference primitive; a richer ergonomics layer (provider + auto-binding + auto-teardown) is a separate concern).

### 7. OPFS + SQLite-WASM + Cloudflare KV/Durable Objects adapters — Tier 4, M-L

- **What:** four new `./backends/` subpaths: `opfs` (Origin Private File System, async, file-backed, high-volume structured state), `sqlite-wasm` (wa-sqlite / sqlite-wasm, structured-clone mode like IDB), `cloudflare-kv` + `cloudflare-do` (edge runtime, async `StateStorage`).
- **Why:** extends the backend surface to high-volume browser state, structured-query WASM storage, and edge runtimes. All fit `StateStorage<TRaw>` cleanly; no core rework.
- **Acceptance:** each ships as its own subpath with optional peer + co-located test (mock the runtime, like the MMKV/AsyncStorage tests) + README backend decision-matrix row. `sqlite-wasm` may be better as a community recipe than a shipped peer (heavy) — decide per-adapter.
- **Lands:** `src/adapters/backends/<name>.ts` + README "Choosing a storage" row + changeset (one per adapter).

### 8. StackBlitz / CodeSandbox playground — Tier 4, M

- **What:** an embedded live-editable example (StackBlitz or CodeSandbox) linked from the docs site (item 3) and README — the fastest on-ramp for a new user.
- **Why:** no playground today; a new user can't try a wiring without cloning. Pairs with the docs site (item 3) and `examples/` (item 2).
- **Acceptance:** a one-click playground loads with a working TanStack + IDB + React wiring; the README + docs site link to it.
- **Deps:** item 2 (`examples/`) or item 3 (docs site) should land first so the playground has a source app.
- **Lands:** README + docs site link. Changeset: `minor` (dev/docs-only).

## Backlog (lower-priority, brainstormed — not ROI-tiered)

From audit Appendix B.3. Each is a one-line composition over an existing seam; ship only if demand surfaces.

- **sessionStorage named factory** (S) — already works via `createJSONStorage(() => sessionStorage)`; a named factory is pure DX/discoverability. Cross-tab is meaningless (per-tab).
- **Redis backend** (M) — server-side persistent state; async `StateStorage`. Pairs with `./backends/node-fs` for a real server story.
- **Chrome `storage.area`** (S) — `local` / `sync` / `session` for MV3 extensions (`localStorage` is forbidden in MV3 service workers).
- **cookies backend** (M) — server-rendered hydration; size limits + HTTP coupling make it awkward — likely a recipe, not a shipped peer.
- **Codecs** — MessagePack / cbor-x / CBOR (S, compact binary wire — needs `TRaw = Uint8Array`), superjson / devalue (S, class-instance round-trip), structuredClone (S, largely subsumed by IDB identity mode), protobuf (L, heavy toolchain — recipe).

## Sequencing

(#4 is implemented; pending first-release verification — strike once the npm Provenance badge lands.)

1. **#1 (Query bridge)** — M, pure code, high adoption payoff, no deps. Best next pick.
2. **#5 (real-browser + SSR matrix)** — M, de-risks the hydration-critical paths before more surface lands.
3. **#2 (examples/) → #3 (docs site) → #8 (playground)** — the docs/demo arc; sequence so each builds on the prior.
4. **#6 (React ergonomics) + #7 (OPFS/SQLite/Cloudflare)** — strategic; decide ship-vs-recipe per item.

## Reference

- [Architecture — seams, entry points, test matrix, limitations](../architecture.md)
- [Roadmap](../roadmap.md)
- [Upstream TanStack pitch](./upstream-tanstack-pitch.md)
- Root [README](../../README.md) — install, quick start, recipes, decision matrices
- [.agents/skills/docs-governance](../../.agents/skills/docs-governance/SKILL.md) — plan lifecycle (close = lift + delete)
