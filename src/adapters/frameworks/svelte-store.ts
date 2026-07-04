// Svelte 3+ (stores) hydration entry — owns the `svelte` peer dep (>=3.0.0)
// so the core stays zero-dep. Ships as its own subpath entry with svelte as an
// optional peer; no barrel re-exports it (importing it IS the dep opt-in,
// enforced by an isolation test). Works on Svelte 4 (pre-runes) AND Svelte 5
// (for users who prefer the store API). For Svelte 5 runes, use
// `./frameworks/svelte`.
import { readable } from "svelte/store";
import type { Readable } from "svelte/store";

import type { HydrationSignal } from "../../core/hydration";

/**
 * Mount a `HydrationSignal` into a Svelte `readable` store. Returns a
 * `Readable<boolean>` — auto-subscribe in a component with `$hydratedStore`.
 * Null/undefined signal → a store that stays `true` (store stays the same with
 * or without persistence). The signal subscription is tied to the store's
 * subscriber lifecycle (start on first subscriber, unsubscribe on the last) —
 * no manual teardown.
 *
 * The signal is always-hydrated on the server → the store yields `true`
 * during SSR — matching the `HydrationSignal` adapter contract.
 *
 * @example
 * ```ts
 * const hydrated = hydratedStore(prefsHydration);
 * // in a Svelte 4/5 component: {#if $hydrated}<Skeleton />{:else}<Prefs />{/if}
 * ```
 */
export function hydratedStore(
  signal: HydrationSignal | null | undefined,
): Readable<boolean> {
  if (!signal) return readable(true);
  return readable(signal.isHydrated(), (set) => {
    const unsubscribe = signal.subscribeHydrated(() => {
      set(signal.isHydrated());
    });
    set(signal.isHydrated()); // pull-model: re-read on first subscriber
    return unsubscribe;
  });
}
