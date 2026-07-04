// Svelte 5 (runes) hydration entry — owns the `svelte` peer dep (>=5.0.0) so
// the core stays zero-dep. Ships as its own subpath entry with svelte as an
// optional peer; no barrel re-exports it (importing it IS the dep opt-in,
// enforced by an isolation test). For Svelte 4 (pre-runes) use
// `./frameworks/svelte-store`.
import { createSubscriber } from "svelte/reactivity";

import type { HydrationSignal } from "../../core/hydration";

const alwaysTrue: { readonly current: boolean } = {
  get current() {
    return true;
  },
};

/**
 * Mount a `HydrationSignal` into Svelte 5 reactivity via `createSubscriber`.
 * Returns an object with a `current` getter — read it inside a reactive
 * context (`$derived`, `$effect`, a component, `{#if}`) to track the gate.
 * Null/undefined signal → `current` is always `true` (store stays the same
 * with or without persistence). The subscription is owned by the reactive
 * context that reads `current` and cleaned up on context dispose — no manual
 * teardown.
 *
 * The signal is always-hydrated on the server (no storage → no-op
 * `PersistApi`), so `current` renders `true` during SSR — matching the
 * `HydrationSignal` adapter contract.
 *
 * Svelte 4 (pre-runes) users: use `./frameworks/svelte-store` (`hydratedStore`).
 *
 * @example
 * ```ts
 * const hydrated = hydratedRune(prefsHydration);
 * // in a component: {#if hydrated.current}<Skeleton />{:else}<Prefs />{/if}
 * ```
 */
export function hydratedRune(signal: HydrationSignal | null | undefined): {
  readonly current: boolean;
} {
  if (!signal) return alwaysTrue;
  const subscribe = createSubscriber((update) =>
    signal.subscribeHydrated(update),
  );
  return {
    get current() {
      subscribe();
      return signal.isHydrated();
    },
  };
}
