---
"@stainless-code/persist": minor
---

Add `./frameworks/angular` and `./frameworks/preact` hydration adapters over the `HydrationSignal` seam.

- `./frameworks/angular` (peer `@angular/core >=17.0.0`): `useHydrated(signal)` → readonly `Signal<boolean>`. Call inside a component's injection context (`effect()` requires it).
- `./frameworks/preact` (peer `preact >=10.19.0`): `useHydrated(signal)` → `{ hydrated }` via `useSyncExternalStore` (preact/compat). `@ts-expect-error` on the 3-arg call (Preact types omit `getServerSnapshot`; runtime ignores it).
