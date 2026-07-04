---
"@stainless-code/persist": minor
---

Add `./frameworks/solid` and `./frameworks/vue` hydration subpaths — `useHydrated(signal)` over the `HydrationSignal` seam, mirroring the React adapter (`src/adapters/frameworks/react.ts`).

- `./frameworks/solid` (peer `solid-js >=1.6.0`): returns a Solid `Accessor<boolean>` via `from`; the subscription is owned by the reactive scope and cleaned up on scope dispose. Uses the `from(producer, initialValue)` overload so the accessor is `Accessor<boolean>` (not `boolean | undefined`); reads `isHydrated()` for the initial value (pull-model signal — no initial notification).
- `./frameworks/vue` (peer `vue >=3.3.0`): returns a Vue `Ref<boolean>` via `shallowRef`; subscription cleaned up via `onScopeDispose` — call inside `setup()` or an `effectScope()`.

Both render `true` on the server (the no-op `PersistApi` is always-hydrated, so the signal is `true` server-side) — matching the `HydrationSignal` adapter contract. Each ships as its own subpath with the peer as optional, no cross-entry value imports.
