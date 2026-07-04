---
"@stainless-code/persist": minor
---

Add `./frameworks/angular` and `./frameworks/preact` hydration adapters over the `HydrationSignal` seam — completing the framework adapter set (React, Solid, Vue, Svelte, Angular, Preact).

- `./frameworks/angular` (peer `@angular/core >=17.0.0`): `useHydrated(signal)` returns a readonly `Signal<boolean>` via Angular `signal()` + `effect()`. Call inside a component's injection context (`effect()` requires it); subscription cleaned up via `onCleanup`. `@if (hydrated())` in templates.
- `./frameworks/preact` (peer `preact >=10.19.0`): `useHydrated(signal)` returns `{ hydrated: boolean }` via `useSyncExternalStore` (preact/compat). Near-clone of `./frameworks/react`. `@ts-expect-error` on the 3-arg call (Preact types omit `getServerSnapshot`; runtime ignores it).

Both render `true` on the server (no-op `PersistApi`). Each is its own subpath with the peer optional, no cross-entry value imports. Angular tested with a mocked `@angular/core` (signal/effect/onCleanup stub — no injection context needed); Preact tested with a mocked `preact/compat` (snapshot-only stub). Both pin the value contract; the reactive auto-update rides on the `HydrationSignal` contract pinned in `core/hydration.test.ts`.
