// Svelte 3+ (stores) hydration adapter — peer `svelte` >=3.0.0 (Svelte 4 + Svelte 5 store users). Svelte 5 runes: `./frameworks/svelte`.
import { readable } from "svelte/store";
import type { Readable } from "svelte/store";

import type { HydrationSignal } from "../../core/hydration";

/**
 * Mount a `HydrationSignal` into a Svelte `readable` store. Auto-subscribe
 * with `$hydratedStore`. Null/undefined signal → a store that stays `true`;
 * the subscription is tied to the store's subscriber lifecycle (start on first
 * subscriber, unsubscribe on the last). Yields `true` on the server.
 *
 * @example
 * ```ts
 * const hydrated = hydratedStore(prefsHydration);
 * // {#if !$hydrated}<Skeleton />{:else}<Prefs />{/if}
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
