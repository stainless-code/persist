// Solid hydration entry — owns the `solid-js` peer dep so the core stays
// zero-dep. Ships as its own subpath entry with solid-js as an optional peer;
// no barrel re-exports it (importing it IS the dep opt-in, enforced by an
// isolation test).
import { from } from "solid-js";
import type { Accessor } from "solid-js";

import type { HydrationSignal } from "./hydration";

const alwaysTrue: Accessor<boolean> = () => true;

/**
 * Mount a `HydrationSignal` into Solid's reactivity via `from`. Returns a
 * Solid `Accessor<boolean>` — read it inside a reactive scope (`createEffect`,
 * a component, JSX) to track the hydration gate. Null/undefined signal →
 * always `true` (store stays the same with or without persistence). The
 * subscription is owned by the reactive scope that creates the accessor and
 * is cleaned up automatically on scope dispose — no manual teardown.
 *
 * The signal is always-hydrated on the server (no storage → no-op
 * `PersistApi`), so this accessor renders `true` during SSR without
 * special-casing — matching the `HydrationSignal` adapter contract.
 *
 * @example
 * ```ts
 * import { createEffect } from "solid-js";
 * const hydrated = useHydrated(prefsHydration);
 * createEffect(() => { if (hydrated()) renderPrefs(); });
 * ```
 */
export function useHydrated(
  signal: HydrationSignal | null | undefined,
): Accessor<boolean> {
  if (!signal) return alwaysTrue;
  return from((set) => {
    const unsubscribe = signal.subscribeHydrated(() => {
      set(signal.isHydrated());
    });
    set(signal.isHydrated()); // pull-model: no initial notification, so read it ourselves
    return unsubscribe;
  }, false);
}
