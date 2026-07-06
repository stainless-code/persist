# Opus-4.8-high — harden-pr (full) findings

**Mode:** full · **Scope:** `origin/main...HEAD` (52 files) · **HEAD:** `a882d082a786b8b2b80ae550b6a977e169f15476`
**Branch:** `audit/docs-adapters-roi` (PR #7) · **Run:** review-only — **no code changed, no commit**.
**Reviewers (parallel, readonly):** Correctness · Ship-readiness · Structure · Public API · Tests · Performance.
**Suite:** `bun test ./src` = 202 pass / 0 fail (confirmed by two reviewers).

## Intent anchor (contract used by every reviewer)

- **Goal:** execute the 2026-07-04 ROI audit — ship adapters + `createMigrationChain`, refold `src/`→`src/core/`+`src/adapters/<seam>/` (breaking subpath rename mirroring folders), harden CI/supply-chain, docs rewrite.
- **Non-goals (must not change):** core runtime behavior; core stays zero-dep; subpaths own their optional peer, import only from `core/`, no barrel; source adapters shape-named; `maxAge` opt-in; sync-first read path; `.` core entry unchanged.

## Verdict

Branch is close to pristine. **3 in-bounds items worth fixing before ship** (2 real bugs in shipped `@example`/adapter code + 1 enforcement gap), all **S effort**. The remainder are test-coverage gaps, mock-fidelity notes (mostly overlapping CodeRabbit's already-triaged nitpicks), and doc nits. No blocker; no correctness bug in the core engine hot paths (verified clean).

---

## Fix-before-ship (Major — new, not previously triaged)

### M1 · Public API · `src/adapters/backends/encrypted.ts:35` · S

The shipped `@example` passes `clearCorruptOnFailure: true` **to `persistStore(store, { ... })`**, but that flag is a `CreateStorageOptions` field consumed by `createStorage`, **not** a `PersistOptions` field. `persistSource`/`persistStore` never read it.

- **Impact:** published example won't typecheck (TS excess-property error) and the flag is inert where placed. The README recipe (`README.md` ~L542) places it correctly on `createStorage`'s 3rd arg.
- **Vetted:** confirmed `PersistOptions` (persist-core.ts) has no `clearCorruptOnFailure`; it lives on `CreateStorageOptions`.
- **Fix (in-bounds):** move `clearCorruptOnFailure: true` into the `createStorage<Prefs>(..., ..., { clearCorruptOnFailure: true })` options arg in the example.

### M2 · Correctness · `src/adapters/backends/secure-store.ts:42` (+ test:9) · S

The adapter forwards the store `name` verbatim to `expo-secure-store`, whose keys **must match `/^[\w.-]+$/`** (alphanumeric, `.`, `-`, `_`). The repo-wide colon naming convention — including **this adapter's own JSDoc example `name: "auth:token:v1"`** — throws `Invalid key provided to SecureStore` at runtime on first get/set.

- **Vetted:** real library constraint; the documented example would throw.
- **Mock-tautology:** `secure-store.test.ts` mocks with a plain `Map` that accepts any key (and the test happens to use colon-free `"secure-json"`), so the charset contract is never exercised.
- **Fix (in-bounds):** sanitize keys (e.g. `:` → `_`) in the adapter **or** change the JSDoc example + document that secure-store keys can't contain colons. (Sanitizing changes only this new adapter's on-storage key mapping — no cross-cutting behavior change.)

### M3 · Structure · `src/core/persist-core.test.ts:22` · S

The zero-dep gate test reads only `./persist-core.ts`. `hydration.ts` — the other half of the zero-dep core per the intent anchor **and its own file header** — is **not** enforced.

- **Vetted:** confirmed the gate `describe` only `Bun.file("./persist-core.ts")`. `hydration.ts` currently has zero imports, so **no active violation** — but the invariant is regression-unguarded for half the core.
- **Severity note:** reviewer rated `major`; my vet leans **minor↔major** (tiny file, zero imports today → low regression risk). Either way, an S-effort add-a-second-assertion.
- **Fix (in-bounds):** extend the gate to also assert `hydration.ts` has no value imports.

---

## Should-fix (Minor)

| #   | Bar               | Location                                               | Finding                                                                                                                                                                                                                                                                                                                                                                | Effort |
| --- | ----------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| m1  | Tests             | `src/adapters/backends/node-fs.ts:45`                  | Path-traversal/`..`/`.`/empty-key refusal guard (security-relevant) has **zero test coverage** — a regression reintroducing traversal passes CI. Add a test asserting `setItem("..", …)` / `"."` throws.                                                                                                                                                               | S      |
| m2  | Tests             | `src/adapters/sources/jotai.test.ts:49`                | Atom **replace-merge** contract only implicitly covered (primitive round-trip). No object-atom test proving replace ≠ core's shallow-spread; the user-supplied-`merge` branch (left of `??`) untested.                                                                                                                                                                 | S      |
| m3  | Tests             | `src/adapters/frameworks/preact.test.ts:5`             | Mock ignores the `subscribe` arg → no test verifies the hydration flip rerenders or that unsubscribe fires. Unlike React (which has `tests-dom/`), preact has no DOM coverage → reactive wiring effectively untested.                                                                                                                                                  | M      |
| m4  | Correctness/Tests | `src/adapters/sources/mobx.ts:31` (+ `mobx.test.ts:9`) | `Object.assign(observable, next)` writes **without `runInAction`** → under `configure({ enforceActions: "always" })` MobX warns on every hydrate/write; the hand-rolled mock never enforces actions so it's uncatchable. (Merged: impl gap + mock-fidelity.)                                                                                                           | S–M    |
| m5  | Docs              | `README.md:3` (+ L397 intro)                           | Headline tagline — "storage × codec seams, **TanStack Store adapters, and a React hydration hook**" — undersells the shipped surface (7 framework adapters, 5 source adapters, 6 new backends, zod codec, crosstab). Tables below are correct → headline drift, not a broken contract.                                                                                 | S      |
| m6  | Perf/Ship shape   | `.size-limit.json`                                     | Gates 6 of 23 bundles (core/react/seroval/encrypted/compressed/zod — the heaviest own-code). Net-new **`transport/crosstab`** (shipped surface) has **no** size gate; the thin framework/source/RN-backend wrappers also unbudgeted. Adding a `transport/crosstab` line is the highest-value single addition. (Rest is a defensible intentional subset per audit #23.) | S      |

---

## Nits (fix when touching the file)

| #   | Bar        | Location                                              | Finding                                                                                                                                                                                                                                                                                                                      |
| --- | ---------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| n1  | Public API | `src/adapters/backends/encrypted.ts:15`               | `clearCorruptOnFailure` JSDoc wording is self-contradictory ("only fires when the _codec_ throws parsing a **non-corrupt** raw" — it fires precisely when the raw **is** corrupt/unparseable). Intent (backend-read reject → phase `hydrate`, vs codec parse-fail → self-heal) is correct; the phrase reads wrong in hovers. |
| n2  | Docs       | `src/adapters/frameworks/react.ts:34` (+ `preact.ts`) | `@example` fenced ` ```ts ` but contains JSX (`return <Skeleton />`) → should be ` ```tsx ` for published-typing fidelity.                                                                                                                                                                                                   |
| n3  | Docs       | `src/adapters/sources/zustand.ts:16`                  | `@example` uses `createJSONStorage(() => localStorage)` but never imports it (a real core export) → snippet won't compile as-is. **Vetted.**                                                                                                                                                                                 |
| n4  | Public API | `src/adapters/frameworks/preact.ts:7`                 | `UseHydratedResult.hydrated` has no JSDoc, while the parallel `react.ts` result type carries "gates UI flash only, never the state read". Inconsistent hovers across near-identical public types.                                                                                                                            |
| n5  | Structure  | `src/core/hydration.ts:2`                             | Doc-comment "see `./frameworks/react`" is stale after the refold — hydration.ts now lives in `src/core/`, so the module is at `../adapters/frameworks/react` (comment only, no import/boundary impact).                                                                                                                      |
| n6  | Docs       | `docs/plans/remaining-roi.md:66`                      | Item numbering skips #6 (`### 5` → `### 7`) — internal renumbering slip in a live plan.                                                                                                                                                                                                                                      |
| n7  | Tests      | `src/adapters/backends/encrypted.ts:89` (test)        | `decryptAesGcm` "invalid ciphertext payload" branch (missing `.` separator) untested; wrong-key auth-tag reject is covered.                                                                                                                                                                                                  |
| n8  | Tests      | `src/adapters/frameworks/angular.test.ts:25`          | Mock runs `effect()` synchronously → hides the async gap `angular.ts:30` guards (re-read `isHydrated()` at attach). Deleting that guard line would still pass.                                                                                                                                                               |
| n9  | Tests      | `src/adapters/sources/zustand.test.ts:17`             | Mock does full-replace `setState`; real zustand shallow-merges a function-updater return. Functionally safe today (persist-core always returns full merged state), so the distinction is invisible.                                                                                                                          |
| n10 | Tests      | `src/adapters/frameworks/svelte.test.ts:39`           | Runes `createSubscriber`→`subscribeHydrated` path never invoked in bun (no Svelte owner). Value contract covered; `HydrationSignal` contract pinned in `core/hydration.test.ts`. `fixable_in_bounds: false` (needs a Svelte runtime).                                                                                        |

---

## Info (log only — no action)

- **i1 · `src/core/persist-core.ts:463`** — `createMigrationChain` return type `Promise<S>` doesn't reflect the `undefined` a discard path resolves (deliberate `undefined as unknown as S` cast). Correct when plugged into `PersistOptions.migrate`; the type slightly overstates for a caller invoking the returned fn directly. Fixing = semantic API change → **out of bounds**.
- **i2 · base64 duplication** (`encrypted.ts:100` ≡ `compressed.ts:98`) — Performance reviewer confirms keeping the duplication is the **right** call: extracting to `core/` spends bytes against the 3 KB zero-dep-core budget for a 2-consumer helper, and a shared adapter util would violate the per-entry `assert-core-only-imports` isolation. **Do not extract** (counters CodeRabbit's extract suggestion).
- **i3 · Coverage** — `bun test ./src` 202/0; no new file has an untested surface likely to drag the 0.90 line gate (only the small guarded branches in m1/n7/n10).
- **i4 · Hot paths verified clean** — `createMigrationChain` construction is O(k)+O(k log k)+O(version) with a bounded runtime walk (no O(n²)); the trailing throttle is a single coalescing timer with generation-guard supersede; crosstab `wrap` allocates one deferred microtask per write and `close()` clears the handler map + swallows rejections (no leak); `persist-core.ts` has zero value imports so no peer is dragged into the core bundle.

---

## Dropped at vet step (not re-raised)

- **svelte peer range** — `package.json` declares `svelte >=3.0.0` while `./frameworks/svelte` (runes) needs `>=5.7.0`. Already in **LEDGER § Deferred** (npm can't express per-subpath peer ranges; documented per-subpath in README/JSDoc/changeset). Out of bounds without splitting the subpath into its own package.
- **`docs/audits/2026-07-04-docs-adapters-roi.md` historical counts** ("5 subpath entries", etc.) — **LEDGER § Rejections**: dated audit record, counts accurate to the audit date.

---

## Note on overlap with CodeRabbit

The mock-fidelity items (m4 mobx, m3 preact, n8 angular, n9 zustand) and the size-gate breadth (m6) restate CodeRabbit nitpicks the author already triaged (applied the core-only-imports dedup; deferred/declined the mock-fidelity ones). **New this pass:** M1 (encrypted `@example` `clearCorruptOnFailure` misplacement), M2 (secure-store colon-key runtime throw), M3 (hydration.ts gate gap), n3 (zustand missing import), n1 (encrypted wording), n5 (hydration.ts stale path), n6 (roi numbering). M1 and M2 are the highest-value catches — both ship broken/misleading `@example` or runtime behavior in new public adapters.
