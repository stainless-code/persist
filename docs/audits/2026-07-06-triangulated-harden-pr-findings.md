# Triangulated harden-pr findings — final summary

**Date:** 2026-07-06
**HEAD:** `a882d082a786b8b2b80ae550b6a977e169f15476` · **Branch:** `audit/docs-adapters-roi` · [PR #7](https://github.com/stainless-code/persist/pull/7)
**Sources triangulated:**

- [composer-2.5-fast](./composer-2.5-fast-harden-pr-full.md) (C)
- [GPT-5.5-medium](./GPT-5.5-medium-harden-pr-full-findings.md) (G)
- [Opus-4.8-high](./Opus-4.8-high-harden-pr-full-findings.md) (O)

**Method:** each finding re-verified against current code (file:line) before inclusion. Cross-report refs use C/G/O prefixes. Verdicts: ✅ confirmed · ⚠️ partial · ❌ rejected · 🕒 outdated · 💭 defer.

**Production bar:** **not met** — 3 confirmed runtime bugs in shipped code (2 @example/adapter, 1 cross-tab echo), 1 docs-governance blocker (false ✅), plus a cluster of S-effort doc/JSDoc nits. Core engine hot paths verified clean by all three reviewers.

---

## TL;DR

Three reviewers converge on a small set of real, S-effort, in-bounds fixes — most shipped `@example` blocks are broken (encrypted `clearCorruptOnFailure` misplacement, secure-store colon-key throw, svelte inverted gate, zustand missing import) and the audit/plan ✅ marks drifted from reality (API docs hosting, migration-chain, npm provenance). Two deeper core-engine bugs (clearStorage doesn't cancel pending writes; writes during async hydration are permanently skipped) and one crosstab echo loop are **confirmed real but narrow-trigger / core-behavior-changing** — flagged for a decision, not blind application. The mock-fidelity + size-gate items overlap the already-triaged CodeRabbit nitpicks.

---

## Confirmed actionable items

### Tier 1 — fix before ship (S, in-bounds, confirmed bugs)

| #   | File:line                                                                                     | Finding                                                                                                                                                                                                                                                                                            | Raised            | Fix                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `src/adapters/backends/encrypted.ts:35`                                                       | `@example` passes `clearCorruptOnFailure: true` to `persistStore(...)` — it's a `createStorage` option, not `PersistOptions`; copied snippet won't typecheck and the flag is inert there                                                                                                           | O:M1, G:#5        | move into `createStorage<Prefs>(..., ..., { clearCorruptOnFailure: true })`                                                            |
| 2   | `src/adapters/backends/secure-store.ts:24,42`                                                 | forwards `name` verbatim to `expo-secure-store` (keys must match `/^[\w.-]+$/`); the adapter's own `@example` `name: "auth:token:v1"` throws at runtime. Mock accepts any key so the test never catches it                                                                                         | O:M2, G:#4        | sanitize `:` → `_` in the adapter (new adapter only; no cross-cutting change) **or** fix the example + document the charset constraint |
| 3   | `src/adapters/frameworks/svelte.ts:24`, `svelte-store.ts:16`                                  | `@example` renders `<Skeleton/>` when `hydrated` is **true** — inverted; ships wrong into published hovers                                                                                                                                                                                         | G:#7              | swap to `{#if !hydrated}<Skeleton/>{:else}<Prefs/>{/if}`                                                                               |
| 4   | `src/adapters/sources/zustand.ts:16`                                                          | `@example` uses `createJSONStorage` but never imports it                                                                                                                                                                                                                                           | O:n3              | add `import { createJSONStorage } from "@stainless-code/persist";`                                                                     |
| 5   | `.changeset/encrypted-compressed.md:7`                                                        | claims wrong-key/tampered decrypt → "corrupt-payload path returns null (or `clearCorruptOnFailure` removes the key)" — wrong: decrypt rejects in backend `getItem` → phase `"hydrate"`; `clearCorruptOnFailure` is inert (codec-only)                                                              | G:#6              | correct the changeset to match the `encrypted.ts` JSDoc (fixed in `131b213`)                                                           |
| 6   | `README.md:502–503`                                                                           | "Choosing a storage" marks encrypted/compressed cross-tab as `inherits`, but `createStorage` sets `raw` to the **wrapper** while browser `StorageEvent.storageArea` is the real `localStorage` → the identity guard rejects every native event. IDB + `createBroadcastCrossTab` path is unaffected | C:M1, G:#3        | change `inherits` → `✗ (native storage events; use ./transport/crosstab bridge)` + add a regression test (m1)                          |
| 7   | audit `#3` (`docs/audits/2026-07-04…:114`), `README.md:882`, `docs/plans/remaining-roi.md:48` | `#3` is ✅ ("Link docs/api + publish to GitHub Pages, `.nojekyll` already present") but README says "not hosted yet", no Pages workflow exists, **`.nojekyll` is not tracked**                                                                                                                     | C:B2/M2, G:#8/#12 | un-✅ `#3` (or split: ✅ the link, leave publish open); remove the `.nojekyll already present` claim from `remaining-roi.md` + audit   |
| 8   | audit `#31` (`…:158`) and `#20` (`…:143`)                                                     | `#31` migration-chain + `#20` npm provenance are shipped/implemented (commits `2e9247f`, `0c4ea17`) but remain un-✅ in the audit                                                                                                                                                                  | C:M4/M5, G:#9/#13 | ✅ both rows (provenance note "implemented — pending first-release verify")                                                            |
| 9   | `src/core/hydration.ts:2`                                                                     | comment "see `./frameworks/react`" stale after refold — module is now in `src/core/`                                                                                                                                                                                                               | O:n5              | `./frameworks/react` → `../adapters/frameworks/react`                                                                                  |
| 10  | `docs/plans/remaining-roi.md:66`                                                              | numbering skips `### 6` (`### 5` → `### 7`)                                                                                                                                                                                                                                                        | O:n6              | renumber                                                                                                                               |

### Tier 2 — confirmed core-engine bugs (need a decision, not blind apply)

These are real but change core runtime behavior; GPT-5.5 raised them, Composer + Opus did not. Narrow triggers, but correct bugs.

| #   | File:line                                | Finding                                                                                                                                                                                                                                                              | Raised | Notes                                                                                                                                                                        |
| --- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11  | `src/core/persist-core.ts:1207`          | `clearStorage()` only calls `removeItem` — does **not** bump `writeGeneration` or cancel the pending throttled write / in-flight `retryWrite`. A pending timer or retry loop re-writes the key after explicit clear/logout; affects `PersistRegistry.clearAll()` too | G:#1   | Fix: `clearStorage` → `cancelPendingWrite()` + `writeGeneration++` before `removeItem`. In-bounds bug fix, but it's a core-engine behavior change — decide before applying   |
| 12  | `src/core/persist-core.ts:954`           | source subscription returns early while `!hasHydratedFlag`; a `setState` during an async hydrate with no usable payload is dropped and never re-scheduled (`hadPendingWrite` tracks only cancelled throttle timers, not gate-skipped events)                         | G:#2   | Fix: track a "skipped during hydrate" flag and `scheduleWrite()` after settle. Core-engine change — decide before applying                                                   |
| 13  | `src/adapters/transport/crosstab.ts:106` | `wrap().removeItem` broadcasts removal after every successful `removeItem`, even when the key was already absent. With `skipPersist` + `onCrossTabRemove` reset, two tabs can bounce remove notifications / reset writes indefinitely                                | G:#10  | Fix options: (a) `getItem` before `removeItem` and skip the post if absent; (b) suppress re-broadcast of a just-received removal. Design decision — crosstab-bridge-specific |

### Tier 3 — should fix (test gaps, structure, perf — S–M, in-bounds)

| #   | File:line                                         | Finding                                                                                                                                                    | Raised             | Effort      |
| --- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ----------- |
| 14  | `src/core/persist-core.test.ts:22`                | zero-dep gate scans `persist-core.ts` only; `hydration.ts` (other half of the `.` core) unguarded (zero imports today → no active violation)               | C:m2, O:M3         | S           |
| 15  | `src/adapters/backends/node-fs.ts:45`             | `..`/`.`/empty-key refusal guard (security-relevant) has no test                                                                                           | G:#16, O:m1        | S           |
| 16  | `src/adapters/transport/crosstab.ts:100,112`      | failed-write/remove broadcast suppression (`.catch` branches, added `131b213`) uncovered                                                                   | C:m9, G:#17        | S           |
| 17  | `src/adapters/transport/crosstab.ts:67`           | `removeEventListener` teardown path untested                                                                                                               | C:m10              | S           |
| 18  | `src/adapters/backends/encrypted.ts:53`           | invalid-backend shape guard uncovered                                                                                                                      | C:m11              | S           |
| 19  | `src/adapters/backends/encrypted.ts:89`           | malformed ciphertext (missing `.`) branch untested (wrong-key is covered)                                                                                  | C:m12, O:n7        | S           |
| 20  | `src/adapters/backends/compressed.ts:51`          | invalid-backend shape guard uncovered                                                                                                                      | C:m13              | S           |
| 21  | `src/adapters/backends/compressed.test.ts`        | no corrupt/non-base64 decompress failure test                                                                                                              | C:m14              | S           |
| 22  | `encrypted`+`compressed`                          | documented compress-then-encrypt stack has no integration test                                                                                             | C:m15              | M           |
| 23  | `src/adapters/frameworks/preact.test.ts:5`        | `useSyncExternalStore` mock ignores `subscribe` → no rerender-on-flip / unsubscribe-cleanup coverage; no `tests-dom/` parity for preact                    | C:M7, G:#14, O:m3  | M           |
| 24  | `src/adapters/frameworks/svelte.test.ts:39`       | runes `createSubscriber` reactive ownership untested (needs a Svelte runtime — out of bun scope)                                                           | C:M8, G:#15, O:n10 | L · defer   |
| 25  | `src/adapters/frameworks/angular.test.ts:25`      | mock runs `effect()` synchronously → hides the async gap `angular.ts:30` guards                                                                            | O:n8               | S–M · defer |
| 26  | `src/core/persist-core.test.ts` (migration chain) | `onOlder: "throw"` has no `persistSource` e2e (unlike discard / throwing-step)                                                                             | C:n5               | S           |
| 27  | `encrypted.ts:102`, `compressed.ts:100`           | `toBase64` O(n²) per-byte string concat — latency on large payloads                                                                                        | C:m17              | S           |
| 28  | `.size-limit.json`                                | no `transport/crosstab` gate (encrypted/compressed/zod added in `a882d08`)                                                                                 | O:m6               | S           |
| 29  | `.cursor/skills/codemap/`                         | real directory containing a `SKILL.md` symlink, not a symlink to `.agents/skills/codemap` (violates agents-first convention; future siblings won't mirror) | G:#11              | S           |
| 30  | `src/adapters/sources/mobx.ts:31`                 | `Object.assign(observable, next)` writes without `runInAction` → throws under `configure({ enforceActions: "always" })`; mock never enforces actions       | O:m4, (CodeRabbit) | S–M         |

### Tier 4 — doc / JSDoc / public-API nits (S, fix when touching the file)

| #   | File:line                                 | Finding                                                                                                                                          | Raised  |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | --- |
| 31  | `README.md:57–58`                         | install table lists both svelte subpaths as peer `svelte` with no version split (entry table + architecture require >=5.7 vs >=3)                | C:M6    |
| 32  | `README.md:403`                           | entry table omits `toHydrationSignal` / `alwaysHydratedSignal`; labels `HydrationSignal` as `(`hydration`)`                                      | C:m7    |
| 33  | `README.md:3`                             | headline undersells the shipped surface (7 framework + 5 source + 6 backend + zod + crosstab)                                                    | O:m5    |
| 34  | `README.md`                               | `alwaysHydratedSignal` exported from core, no README mention                                                                                     | C:m3    |
| 35  | `src/adapters/codecs/zod.ts:24`           | `zodCodec` lacks `@example`                                                                                                                      | C:m5    |
| 36  | `src/adapters/codecs/seroval.ts:20`       | `serovalCodec` lacks `@example`                                                                                                                  | C:n3    |
| 37  | `src/core/persist-core.ts:422`            | `CreateMigrationChainOptions.onNewer`/`onOlder` use prose defaults, not `@default` tags                                                          | C:m6    |
| 38  | `src/adapters/backends/encrypted.ts:15`   | `clearCorruptOnFailure` JSDoc wording self-contradictory ("non-corrupt raw" — should be "corrupt/unparseable")                                   | O:n1    |
| 39  | `react.ts:34`, `preact.ts`                | `@example` fenced ` ```ts ` but contains JSX → should be ` ```tsx `                                                                              | O:n2    |
| 40  | `src/adapters/frameworks/preact.ts:7`     | `UseHydratedResult.hydrated` has no JSDoc (react.ts parallel does)                                                                               | O:n4    |
| 41  | `src/adapters/codecs/zod.ts:20`           | JSDoc cites "persist-core's corrupt-payload path" — prefer consumer-facing language                                                              | C:n4    |
| 42  | `.changeset/node-fs-pack-gate.md:7`       | mixes consumer `./backends/node-fs` API with maintainer CI internals (attw/knip/publint)                                                         | C:m8    |
| 43  | `.changeset/subpath-mirror-folders.md:14` | maintainer internals (tsdown keys, `persist-` prefix) in consumer changeset                                                                      | C:n2    |
| 44  | `docs/glossary.md:5`                      | no `transport/` seam term (`./transport/crosstab`)                                                                                               | C:n1    |
| 45  | `docs/audits/2026-07-04…:11,635`          | TL;DR + appendix C describe pre-ship gaps without a "historical snapshot" banner; appendix C.2 documents flat legacy subpaths without annotation | C:M3/m4 | M   |

---

## Rejected / by-design / dropped (with reason)

| Claim                                                                                     | Verdict                             | Reason                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.changeset/subpath-mirror-folders.md` `minor` vs `Breaking` body = semver blocker (C:B1) | ⚠️ judgment call, **not a blocker** | Package is 0.x; a `major` changeset would jump to 1.0.0 (changesets default). `minor` to stay pre-1.0 is defensible; the "Breaking" body text communicates the import-path migration to consumers. Keep `minor`; ensure the Breaking callout stays prominent |
| Extract `toBase64`/`fromBase64` to `core/` (CodeRabbit)                                   | ❌ reject                           | Opus i2 confirms: 2 consumers < the 3+ bar in `architecture-priming`; a core export spends the zero-dep-core budget; a shared adapter util violates per-entry `assert-core-only-imports`. **Keep the duplicate**                                             |
| `zustand.test.ts` mock `setState` full-replace (O:n9)                                     | 💭 info                             | Safe today — `PersistableSource.setState` contract returns the full state; zustand function-setState with full-state return ≡ replace. Distinction invisible                                                                                                 |
| `createMigrationChain` return type `undefined as unknown as S` cast (O:i1)                | ❌ out of bounds                    | Correct when plugged into `PersistOptions.migrate`; fixing = semantic API change                                                                                                                                                                             |
| `svelte >=3.0.0` package peer vs `>=5.7` for runes (all)                                  | 🕒 LEDGER § Deferred                | npm can't express per-subpath peer ranges; documented per-subpath in README/JSDoc/changeset. Needs a package split to fix                                                                                                                                    |
| Audit historical counts ("5 subpath entries", flat subpaths)                              | 🕒 LEDGER § Rejections              | Dated audit record; counts accurate to 2026-07-04                                                                                                                                                                                                            |
| `retryWrite` uncapped                                                                     | by-design                           | JSDoc states the callback IS the termination policy                                                                                                                                                                                                          |
| `mobx` `toJS` cost before `partialize` (G:#18)                                            | by-design                           | `PersistableSource.getState` must return full state; `partialize` projects after. Inherent to the contract; document if needed                                                                                                                               |
| `crosstab` per-write post no coalescing (C:m18)                                           | 💭 defer                            | Mitigated by `throttleMs`; design note, not a bug                                                                                                                                                                                                            |

---

## Recommended fix order

1. **Tier 1 (1–10)** — one pass: `@example`/JSDoc corrections (1,3,4,9), changeset text (5), secure-store key handling (2), README matrix (6), audit ✅ reconciliation + `.nojekyll` prose (7,8,10). All S, in-bounds, no runtime behavior change.
2. **Tier 2 (11–13)** — decision required: confirm the three core-engine/crosstab bugs and the intended fix shape before applying (they change observable runtime behavior — outside the "no behavior change" harden guardrail, but legitimate bug fixes once approved).
3. **Tier 3 (14–30)** — test-gap + structure + perf pass; highest-value first: 14 (hydration gate), 15 (node-fs traversal), 27 (toBase64), 28 (crosstab size gate), 29 (codemap symlink), 30 (mobx runInAction).
4. **Tier 4 (31–45)** — doc/JSDoc nits, batch when touching each file.

---

## Passing (no action — confirmed by all three reviewers)

- Core zero-dep gate on `persist-core.ts`; no cross-adapter imports; 22/22 adapter `itImportsOnlyFromCore` checks; 202 unit + 4 DOM tests pass.
- `exports` ↔ `tsdown.config.ts` ↔ `typedoc.json` ↔ `architecture.md` ↔ README subpath tables aligned (23 subpaths + core).
- CI: coverage (90% gate, ~98% aggregate), size-limit, pack validation (attw+publint+knip), audit high/critical gate, trusted publishing.
- Hot paths verified clean: `createMigrationChain` O(k)+O(version); trailing throttle single-timer + generation supersede; crosstab `close()` clears handler map; `persist-core.ts` zero value imports.

---

## Cross-reviewer agreement matrix

| Finding                                                     | C            | G   | O   | Verdict                                  |
| ----------------------------------------------------------- | ------------ | --- | --- | ---------------------------------------- |
| encrypted `@example` `clearCorruptOnFailure` misplacement   | –            | ✅  | ✅  | confirmed                                |
| secure-store colon-key throw                                | –            | ✅  | ✅  | confirmed                                |
| encrypted/compressed wrapper breaks native cross-tab events | ✅           | ✅  | –   | confirmed                                |
| svelte `@example` inverted gate                             | –            | ✅  | –   | confirmed                                |
| audit `#3` false ✅ + `.nojekyll` missing                   | ✅           | ✅  | –   | confirmed                                |
| audit `#31`/`#20` un-✅ despite shipped                     | ✅           | ✅  | –   | confirmed                                |
| preact mock ignores `subscribe`                             | ✅           | ✅  | ✅  | confirmed (test gap)                     |
| svelte runes reactive ownership untested                    | ✅           | ✅  | ✅  | confirmed (defer — needs Svelte runtime) |
| `clearStorage` doesn't cancel pending writes                | –            | ✅  | –   | confirmed real (narrow)                  |
| writes during async hydration skipped                       | –            | ✅  | –   | confirmed real (narrow)                  |
| crosstab remove-echo between tabs                           | –            | ✅  | –   | confirmed real (narrow)                  |
| `hydration.ts` zero-dep gate gap                            | ✅           | –   | ✅  | confirmed (low risk)                     |
| node-fs traversal guard untested                            | –            | ✅  | ✅  | confirmed                                |
| changeset `subpath-mirror` `minor` vs Breaking              | ✅           | –   | –   | judgment call — not a blocker            |
| base64 dedup extract                                        | (CodeRabbit) | –   | ❌  | reject (keep duplicate)                  |
