---
"@stainless-code/persist": minor
---

Add Svelte hydration adapters over the `HydrationSignal` seam, covering both pre- and post-runes Svelte. Two subpaths because `svelte/reactivity` (runes) is Svelte 5+ and would break a Svelte 4 import — each subpath owns its dep range:

- `./frameworks/svelte` (peer `svelte >=5.0.0`) — `hydratedRune(signal)` via `svelte/reactivity` `createSubscriber`. Returns `{ readonly current: boolean }`; read `current` inside a reactive context (`$derived`/`$effect`/component/`{#if}`). Subscription owned by the reactive context, cleaned up on context dispose. Post-runes.
- `./frameworks/svelte-store` (peer `svelte >=3.0.0`) — `hydratedStore(signal)` via `svelte/store` `readable`. Returns `Readable<boolean>`; auto-subscribe with `$hydratedStore`. Works on Svelte 4 (pre-runes) AND Svelte 5 (for users who prefer the store API). Subscription tied to the store's subscriber lifecycle.

Both render `true` on the server (no-op `PersistApi` is always-hydrated) — matching the `HydrationSignal` adapter contract. Each is its own subpath with `svelte` optional, no cross-entry value imports (isolation test included). 7 co-located tests: the store adapter is fully tested in bun (`svelte/store` works standalone — value, subscriber updates, signal subscribe/unsubscribe lifecycle); the runes adapter pins the value contract (the reactive auto-update needs a Svelte component context — `createSubscriber`'s start is a no-op without an owner — and rides on the `HydrationSignal` contract pinned in `core/hydration.test.ts`, same philosophy as the React `use-hydrated` bun test).
