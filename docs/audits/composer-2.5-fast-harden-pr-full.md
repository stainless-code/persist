# Harden PR — full pass (read-only)

**Model:** composer-2.5-fast  
**Mode:** full (`origin/main...HEAD`)  
**HEAD:** `a882d082a786b8b2b80ae550b6a977e169f15476`  
**Branch:** `audit/docs-adapters-roi` · [PR #7](https://github.com/stainless-code/persist/pull/7)  
**Date:** 2026-07-06  
**Constraints:** no code changes · no commit · findings only

---

## Intent anchor

Execute the [2026-07-04 docs-adapters ROI audit](2026-07-04-docs-adapters-roi.md): ship adapters, refold `src/` → `core/` + `adapters/<seam>/`, breaking subpath rename, `createMigrationChain`, README/docs rewrite, CI/supply-chain hardening. In-bounds fixes must not redesign features or change observable runtime behavior beyond bug fixes.

---

## Baseline checks (at review time)

| Check           | Status                                                  |
| --------------- | ------------------------------------------------------- |
| `bun run check` | pass (build, format, lint, 202 unit + 4 DOM, typecheck) |
| CI on PR #7     | all jobs green                                          |
| Coverage gate   | 90% threshold met (~98% aggregate per reviewers)        |

**Production bar:** **not met** — 2 blockers, 8 major (incl. 1 already in LEDGER § Deferred), several minor/nit gaps below.

---

## Vetted findings

Sorted: severity → confidence desc → effort asc. Deduped across 6 reviewers (Correctness, Ship-readiness, Structure, Public API, Tests, Performance). Vet step applied: LEDGER § Rejections consulted; each survivor re-read at cited location.

### Blocker

| #   | Severity | File                                          | Line | Finding                                                                                                                                                                                                                                                               | Conf | Effort | Bar  | In bounds |
| --- | -------- | --------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------ | ---- | --------- |
| B1  | blocker  | `.changeset/subpath-mirror-folders.md`        | 2    | Frontmatter declares `@stainless-code/persist: **minor**` while the body labels four import-path renames as **Breaking**. Semver/changelog will under-bump the release.                                                                                               | high | S      | Docs | yes       |
| B2  | blocker  | `docs/audits/2026-07-04-docs-adapters-roi.md` | 114  | ROI item **#3** is ✅ (“Link `docs/api/` + publish to GitHub Pages”) but README § API reference still says “not hosted yet” (`README.md:882`), no GitHub Pages workflow exists, and `.nojekyll` is absent from the tracked tree. False shipped mark vs consumer docs. | high | S      | Docs | yes       |

### Major

| #   | Severity | File                                          | Line | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Conf | Effort | Bar         | In bounds |
| --- | -------- | --------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------ | ----------- | --------- |
| M1  | major    | `src/core/persist-core.ts`                    | 976  | **`crossTab: true` + encrypted/compressed wrapper over `localStorage` silently ignores cross-tab updates.** `createStorage` sets `PersistStorage.raw` to the wrapper `StateStorage`; browser `StorageEvent.storageArea` is the underlying `localStorage`. Guard `event.storageArea !== raw` rejects every event. README decision matrix marks encrypted/compressed cross-tab as “inherits” (`README.md:502–503`) — misleading; users expect localStorage cross-tab to work. Workaround: `createBroadcastCrossTab` (`storageArea: null` → key-only). IDB + bridge path unaffected. | high | M      | Correctness | yes       |
| M2  | major    | `docs/plans/remaining-roi.md`                 | 48   | Prose claims “`.nojekyll` already present” for GitHub Pages; file does not exist anywhere in repo (same root cause as B2).                                                                                                                                                                                                                                                                                                                                                                                                                                                        | high | S      | Docs        | yes       |
| M3  | major    | `docs/audits/2026-07-04-docs-adapters-roi.md` | 11   | Audit **TL;DR + appendix C** still describe pre-ship consumer-doc gaps (no hydration explainer, no IDB walkthrough, registry invisible, API site unlinked) that contradict the ROI table ✅ marks and the current README. Readers cannot trust audit status columns without a “historical snapshot vs post-branch” banner.                                                                                                                                                                                                                                                        | high | M      | Docs        | yes       |
| M4  | major    | `docs/audits/2026-07-04-docs-adapters-roi.md` | 158  | **`createMigrationChain` shipped** (core export, README recipe, `.changeset/migration-chain.md`) but audit ROI **#31** remains un-✅. Plan lifecycle drift vs `remaining-roi.md` contract.                                                                                                                                                                                                                                                                                                                                                                                        | high | S      | Docs        | yes       |
| M5  | major    | `docs/audits/2026-07-04-docs-adapters-roi.md` | 143  | **npm trusted publishing implemented** (`release.yml`, `publishConfig.provenance`) but audit ROI **#20** remains un-✅.                                                                                                                                                                                                                                                                                                                                                                                                                                                           | high | S      | Docs        | yes       |
| M6  | major    | `README.md`                                   | 57   | Install optional-peer table lists `./frameworks/svelte` and `./frameworks/svelte-store` both as peer `svelte` with no version split; Entry points table + `architecture.md` require `>=5.7` for runes vs `>=3` for svelte-store. Intra-README drift.                                                                                                                                                                                                                                                                                                                              | high | S      | Docs        | yes       |
| M7  | major    | `src/adapters/frameworks/preact.test.ts`      | 5    | `useSyncExternalStore` mock returns `getSnapshot()` only — **`subscribeHydrated` wiring and rerender-on-flip never exercised**; tests re-invoke the hook per assertion instead of a mounted component lifecycle. React has `tests-dom/` parity; Preact does not.                                                                                                                                                                                                                                                                                                                  | high | M      | Tests       | yes       |
| M8  | major    | `src/adapters/frameworks/svelte.test.ts`      | 39   | Svelte 5 `hydratedRune` reactive auto-update / `createSubscriber` cleanup untested outside a Svelte owner (suite documents gap). Public subscribe path unverified at production bar.                                                                                                                                                                                                                                                                                                                                                                                              | high | L      | Tests       | yes       |

### Minor

| #   | Severity | File                                              | Line | Finding                                                                                                                                        | Conf   | Effort | Bar        | In bounds |
| --- | -------- | ------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------ | ---------- | --------- |
| m1  | minor    | `src/adapters/backends/encrypted.test.ts`         | —    | No test for wrapper-backend + `crossTab: true` on localStorage (M1 combo).                                                                     | high   | S      | Tests      | yes       |
| m2  | minor    | `src/core/persist-core.test.ts`                   | 22   | Zero-dep gate scans **`persist-core.ts` only**; `hydration.ts` ships via `.` entry but has no matching value-import gate.                      | high   | S      | Structure  | yes       |
| m3  | minor    | `README.md`                                       | —    | `alwaysHydratedSignal` exported from core; no README/skill mention (audit appendix still flags hidden).                                        | high   | S      | Docs       | yes       |
| m4  | minor    | `docs/audits/2026-07-04-docs-adapters-roi.md`     | 635  | Appendix C.2 export inventory still documents flat legacy subpaths (`/seroval`, `/idb`, …) without “pre-refold” annotation.                    | high   | S      | Docs       | yes       |
| m5  | minor    | `src/adapters/codecs/zod.ts`                      | 24   | `zodCodec` lacks `@example` (factory has one).                                                                                                 | high   | S      | Public API | yes       |
| m6  | minor    | `src/core/persist-core.ts`                        | 422  | `CreateMigrationChainOptions.onNewer` / `onOlder` use prose defaults, not `@default` tags (unlike `PersistOptions`).                           | high   | S      | Public API | yes       |
| m7  | minor    | `README.md`                                       | 403  | Entry table omits `toHydrationSignal` / `alwaysHydratedSignal`; mislabels `HydrationSignal` as ``(`hydration`)`` (no such export).             | high   | S      | Public API | yes       |
| m8  | minor    | `.changeset/node-fs-pack-gate.md`                 | 7    | Changeset mixes consumer `./backends/node-fs` API with maintainer CI internals (attw, knip, publint).                                          | high   | S      | Public API | yes       |
| m9  | minor    | `src/adapters/transport/crosstab.ts`              | 100  | `wrap().setItem`/`removeItem` `.catch` branches (suppress broadcast on backend failure) uncovered.                                             | high   | S      | Tests      | yes       |
| m10 | minor    | `src/adapters/transport/crosstab.ts`              | 67   | `crossTabEventTarget.removeEventListener` teardown path untested.                                                                              | high   | S      | Tests      | yes       |
| m11 | minor    | `src/adapters/backends/encrypted.ts`              | 53   | Invalid-backend shape guard (lines 53–58) uncovered.                                                                                           | high   | S      | Tests      | yes       |
| m12 | minor    | `src/adapters/backends/encrypted.ts`              | 89   | Malformed ciphertext wire format (not wrong-key) untested.                                                                                     | high   | S      | Tests      | yes       |
| m13 | minor    | `src/adapters/backends/compressed.ts`             | 51   | Invalid-backend shape guard uncovered.                                                                                                         | high   | S      | Tests      | yes       |
| m14 | minor    | `src/adapters/backends/compressed.test.ts`        | —    | No corrupt/non-base64 decompress failure test.                                                                                                 | high   | S      | Tests      | yes       |
| m15 | minor    | `src/adapters/backends/compressed.ts`             | 18   | Documented compress-then-encrypt stack has no integration test.                                                                                | medium | M      | Tests      | yes       |
| m16 | minor    | `tests-dom/react.test.tsx`                        | —    | DOM suite React-only; Preact shares `useSyncExternalStore` but has no jsdom parity suite.                                                      | high   | M      | Tests      | yes       |
| m17 | minor    | `src/adapters/backends/{encrypted,compressed}.ts` | 100  | `toBase64` uses O(n²) per-byte string concat — latency on large payloads.                                                                      | high   | S      | Ship shape | yes       |
| m18 | minor    | `src/adapters/transport/crosstab.ts`              | 92   | Per-write BroadcastChannel post with no coalescing; peer tabs run overlapping full rehydrates under burst writes (mitigate with `throttleMs`). | high   | M      | Ship shape | yes       |

### Nit

| #   | Severity | File                                   | Line | Finding                                                                                                            | Conf   | Effort | Bar        | In bounds |
| --- | -------- | -------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------ | ------ | ------ | ---------- | --------- |
| n1  | nit      | `docs/glossary.md`                     | 5    | No `transport/` seam term (`./transport/crosstab`) vs `architecture.md`.                                           | high   | S      | Docs       | yes       |
| n2  | nit      | `.changeset/subpath-mirror-folders.md` | 14   | Maintainer internals (tsdown keys, `persist-` prefix) in consumer changeset.                                       | high   | S      | Public API | yes       |
| n3  | nit      | `src/adapters/codecs/seroval.ts`       | 20   | `serovalCodec` lacks `@example` (factory has one).                                                                 | high   | S      | Public API | yes       |
| n4  | nit      | `src/adapters/codecs/zod.ts`           | 20   | JSDoc cites “persist-core's corrupt-payload path” — prefer consumer-facing language.                               | medium | S      | Public API | yes       |
| n5  | nit      | `src/core/persist-core.test.ts`        | 2094 | `createMigrationChain` `onOlder: 'throw'` unit-tested but no persistSource e2e (unlike discard/throwing-step e2e). | medium | S      | Tests      | yes       |

---

## Already deferred (LEDGER § Deferred — do not re-fix without architecture decision)

| File                            | Finding                                                                                                                            | Reason                                                                                        |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `package.json` peerDependencies | `./frameworks/svelte` needs `>=5.7` per README/JSDoc but package declares `svelte >=3.0.0` shared with `./frameworks/svelte-store` | Package-level peers cannot split per subpath without a separate package or peer rename policy |

Related vetted items: M6 above (README tables); duplicate Public API entries merged here.

---

## Dropped at vet (false / by-design / duplicate)

| Claim                                       | Verdict                                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Audit “5 subpath entries” historical counts | **Drop** — LEDGER § Rejections: dated audit record accurate to 2026-07-04                        |
| “Missing changeset for new export”          | **Drop** — all 11 feature changesets present; only B1 semver type wrong                          |
| “Exports / tsdown / typedoc misaligned”     | **Drop** — verified aligned (23 subpaths + core)                                                 |
| “No co-located tests / isolation checks”    | **Drop** — 22/22 adapter entries have `itImportsOnlyFromCore`; 202 tests pass                    |
| persist-core hot-path regression            | **Drop** — diff adds `createMigrationChain` only; hydrate/write/cross-tab core unchanged vs main |

---

## Passing (no action)

- Core zero-dep gate on `persist-core.ts`; no cross-adapter imports detected.
- Architecture: `exports` ↔ `tsdown.config.ts` ↔ `typedoc.json` ↔ `architecture.md` ↔ README subpath tables aligned.
- CI: coverage, size-limit, pack validation (`attw`+`publint`+`knip`), audit gate, trusted publishing workflow in place.
- Co-located test + isolation pattern consistent across adapters.

---

## Recommended fix order (if acting on this report)

1. **B1** — bump `.changeset/subpath-mirror-folders.md` to `major`.
2. **B2 + M2 + M3** — reconcile audit ✅ marks with reality (either ship GitHub Pages + link, or un-✅ #3 and fix prose); add TL;DR banner for historical appendix.
3. **M1 + m1 + README matrix** — fix or document wrapper + `crossTab` limitation; add regression test.
4. **M4 + M5** — ✅ audit rows #31 and #20.
5. **M6** — README install table version split (peer range M7 stays deferred unless package split).
6. **M7 + m16** — Preact DOM tests or improve bun mock to exercise subscribe.
7. Remaining minor/nit doc + JSDoc + test gaps in pass 2.

---

## Reviewers spawned

| Role           | Agent                                                                        |
| -------------- | ---------------------------------------------------------------------------- |
| Correctness    | [2397b09f-d885-4c63-99de-40fc178f3ff8](2397b09f-d885-4c63-99de-40fc178f3ff8) |
| Ship-readiness | [3ef32333-594e-48d4-b58c-fffba1b70eeb](3ef32333-594e-48d4-b58c-fffba1b70eeb) |
| Structure      | [17732c03-4dc0-44b4-833b-a3693321bad3](17732c03-4dc0-44b4-833b-a3693321bad3) |
| Public API     | [bb0db2ca-ba31-470d-a3e8-292f361ba339](bb0db2ca-ba31-470d-a3e8-292f361ba339) |
| Tests          | [71a1a07b-1896-4217-a695-c2eedf6bef0c](71a1a07b-1896-4217-a695-c2eedf6bef0c) |
| Performance    | [988590a5-2895-463a-83c3-1c0447edd7f5](988590a5-2895-463a-83c3-1c0447edd7f5) |

**Passes run:** 1 of 3 (read-only stop — no fix loop per user request).
