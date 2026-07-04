// Solid hydration adapter — peer `solid-js` >=1.6.0.
import { from } from "solid-js";
import type { Accessor } from "solid-js";

import type { HydrationSignal } from "../../core/hydration";

const alwaysTrue: Accessor<boolean> = () => true;

/**
 * Mount a `HydrationSignal` into Solid's reactivity via `from`. Returns an
 * `Accessor<boolean>` — read it in a reactive scope (`createEffect`/component/JSX).
 * Null/undefined signal → always `true`; the subscription is owned by the
 * reactive scope and cleaned up on scope dispose. Renders `true` on the server.
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
