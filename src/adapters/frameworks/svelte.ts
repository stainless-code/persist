// Svelte 5 (runes) hydration adapter — peer `svelte` >=5.7.0 (`createSubscriber` from `svelte/reactivity` landed in 5.7). Svelte 4 (pre-runes): `./frameworks/svelte-store`.
import { createSubscriber } from "svelte/reactivity";

import type { HydrationSignal } from "../../core/hydration";

const alwaysTrue: { readonly current: boolean } = {
  get current() {
    return true;
  },
};

/**
 * Mount a `HydrationSignal` into Svelte 5 reactivity (`createSubscriber`).
 * Read `current` inside a reactive context (`$derived`/`$effect`/`{#if}`) to
 * track the gate. Null/undefined signal → `current` is always `true`; the
 * subscription is owned by the reactive context (cleaned up on dispose).
 * Renders `true` on the server (no-op `PersistApi`).
 *
 * Svelte 4 (pre-runes): `./frameworks/svelte-store` (`hydratedStore`).
 *
 * @example
 * ```ts
 * const hydrated = hydratedRune(prefsHydration);
 * // {#if hydrated.current}<Skeleton />{:else}<Prefs />{/if}
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
