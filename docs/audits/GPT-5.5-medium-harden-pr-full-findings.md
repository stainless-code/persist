# GPT-5.5-medium harden-pr full findings

Mode: `/harden-pr full`, read-only/report-only.
Scope: `origin/main...HEAD` at `a882d082a786b8b2b80ae550b6a977e169f15476`.
PR: <https://github.com/stainless-code/persist/pull/7>

User constraints: no code changes, no commit. This file is the requested findings artifact.

## Status

- Branch working tree was clean before writing this report.
- PR checks were green (`CI complete`, format, lint, typecheck, unit, DOM, build, audit, pack, size).
- PR is mergeable but review-required.
- Reviewer pass ran read-only across correctness, ship-readiness, structure, public API, tests, and performance.

## Vetted Findings

### Blocker

1. `src/core/persist-core.ts` - `clearStorage()` can be undone by older writes.

   `clearStorage()` only calls `storage.removeItem(options.name)` and does not cancel a pending throttled write or bump `writeGeneration`. A pending timer or in-flight `retryWrite` loop can re-write the key after explicit clear/logout. This also affects `PersistRegistry.clearAll()`, because registered callbacks call `api.clearStorage()`.

### Major

2. `src/core/persist-core.ts` - writes during async hydration can be permanently skipped.

   The source subscription returns early while `hasHydratedFlag` is false. If state changes during an async hydrate and storage has no usable payload, the change is not written after hydration settles because `hadPendingWrite` only tracks cancelled throttle timers, not subscription events skipped by the hydration gate.

3. `src/adapters/backends/encrypted.ts`, `src/adapters/backends/compressed.ts`, `src/core/persist-core.ts` - wrapped `localStorage` does not inherit native `storage` events.

   `createStorage` exposes the object returned by `getStorage()` as `PersistStorage.raw`. For encrypted/compressed wrappers over `localStorage`, `raw` becomes the wrapper object, while browser `StorageEvent.storageArea` is the real `localStorage`. The cross-tab identity guard rejects those events, so the README matrix claim that these wrappers inherit cross-tab behavior is not true for native storage events.

4. `src/adapters/backends/secure-store.ts` - common documented names are invalid SecureStore keys.

   The adapter passes persist names directly to `SecureStore.getItemAsync` / `setItemAsync` / `deleteItemAsync`. Expo SecureStore keys may only contain alphanumeric characters, `.`, `-`, and `_`; documented/example keys like `auth:token:v1` will reject.

5. `src/adapters/backends/encrypted.ts` - published JSDoc example passes an invalid option to `persistStore`.

   The hover example calls `persistStore(store, { name, storage, clearCorruptOnFailure: true })`, but `clearCorruptOnFailure` is a `createStorage` option, not a `PersistOptions` option. Copying the example should fail typecheck and teaches the wrong API surface.

6. `.changeset/encrypted-compressed.md` - release note states the wrong encrypted corrupt-payload behavior.

   The changeset says wrong-key/tampered ciphertext decrypt failures go through persist-core's corrupt-payload path and can be removed by `clearCorruptOnFailure`. Decrypt happens inside backend `getItem`, so the failure rejects during hydrate instead of codec decode cleanup.

7. `src/adapters/frameworks/svelte.ts`, `src/adapters/frameworks/svelte-store.ts` - Svelte examples reverse the hydration gate.

   Both examples render `<Skeleton />` when `hydrated` is true and `<Prefs />` when false. That is inverted from the documented gate behavior and will ship into published hovers.

8. `docs/audits/2026-07-04-docs-adapters-roi.md`, `README.md` - API docs hosting is marked shipped but still not hosted.

   ROI item #3 is checked as shipped for linking/publishing the generated TypeDoc site and says `.nojekyll` is already present. Current README still says the API reference is not hosted, no GitHub Pages/docs site workflow exists, and no `.nojekyll` file is tracked.

9. `docs/audits/2026-07-04-docs-adapters-roi.md` - shipped migration-chain item remains listed as unshipped.

   `createMigrationChain` is implemented, exported, tested, documented, and has a changeset, but audit item #31 still appears unmarked in Tier 4. This conflicts with the audit/plan convention that shipped ROI items are marked and remaining work is tracked in `docs/plans/remaining-roi.md`.

10. `src/core/persist-core.ts`, `src/adapters/transport/crosstab.ts` - BroadcastChannel remove events can echo between tabs.

    `onCrossTabRemove` commonly resets the local source. With `skipPersist`, that reset calls `removeItem`; the BroadcastChannel wrapper broadcasts removals after successful `removeItem` even if the key was already absent. Two tabs using the bridge can bounce remove notifications/reset writes.

### Minor

11. `.cursor/skills/codemap/SKILL.md` - codemap skill symlink shape violates the agents-first convention.

    Other Cursor skills are tracked as `.cursor/skills/<name>` symlinks to `.agents/skills/<name>`. The codemap entry is a real directory containing only a `SKILL.md` symlink, so future sibling files under `.agents/skills/codemap/` would not be mirrored.

12. `docs/plans/remaining-roi.md` - docs-site acceptance references missing `.nojekyll`.

    The docs-site plan says `.nojekyll` is already present, but the repo does not track it. This will mislead the next docs-site implementation.

13. `docs/audits/2026-07-04-docs-adapters-roi.md` - npm provenance item is stale.

    ROI item #20 still describes `id-token: write` plus `--provenance` as unshipped. The branch implements trusted publishing via OIDC and `publishConfig.provenance`; the remaining work is first-release verification and old token cleanup, already captured in `docs/plans/remaining-roi.md`.

14. `src/adapters/frameworks/preact.test.ts` - Preact subscription cleanup is not tested.

    The `preact/compat` mock returns `getSnapshot()` only and ignores `subscribe`, so tests do not exercise `signal.subscribeHydrated` wiring or unsubscribe cleanup.

15. `src/adapters/frameworks/svelte.test.ts` - Svelte runes reactive ownership is not tested.

    Tests cover direct `current` reads and explicitly skip the `createSubscriber` path inside a Svelte owner. Reactive auto-update/cleanup remains unverified.

16. `src/adapters/backends/node-fs.test.ts` - traversal guard lacks a regression test.

    `nodeFsStateStorage` refuses keys that sanitize to `.`, `..`, or empty, but tests only cover unsafe-character sanitization and collision resistance. A regression reopening traversal-by-key would pass.

17. `src/adapters/transport/crosstab.test.ts` - failed-write broadcast suppression lacks tests.

    The wrapper now catches rejected `setItem`/`removeItem` follow-up promises and avoids broadcasting failed writes/removes, but no test covers those branches.

18. `src/adapters/sources/mobx.ts` - large MobX sources pay full `toJS()` cost before `partialize`.

    The adapter reads `toJS(observable)` on every source change before persist-core can run `partialize`, so large observables pay O(store) clone/allocation cost even when the persisted slice is small.

## Dropped During Vetting

- `retryWrite` being uncapped was dropped as by-design for this report: the JSDoc explicitly states the callback is the termination policy and that a callback always returning state can spin forever.
- The package-level `svelte >=3.0.0` peer range was dropped per `harden-pr` ledger: it is shared by `./frameworks/svelte` and `./frameworks/svelte-store`, and cannot be fixed per subpath in this package.
- Dated audit historical counts were dropped per `harden-pr` ledger.
