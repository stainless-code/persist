// Angular signals hydration adapter — peer `@angular/core` >=17.0.0 (signals).
import { effect, signal } from "@angular/core";
import type { Signal } from "@angular/core";

import type { HydrationSignal } from "../../core/hydration";

const alwaysTrue = signal(true);

/**
 * Mount a `HydrationSignal` into Angular signals. Returns a readonly
 * `Signal<boolean>` — read it in a template or `computed`/`effect`. Call
 * inside a component's injection context (`effect()` requires it); the
 * subscription is cleaned up on context destroy. Null/undefined signal →
 * always `true`. Renders `true` on the server.
 *
 * @example
 * ```ts
 * // in a component
 * hydrated = useHydrated(prefsHydration);
 * // template: @if (hydrated()) { <Prefs /> } @else { <Skeleton /> }
 * ```
 */
export function useHydrated(
  signalSource: HydrationSignal | null | undefined,
): Signal<boolean> {
  if (!signalSource) return alwaysTrue;
  const hydrated = signal(signalSource.isHydrated());
  effect((onCleanup) => {
    const unsubscribe = signalSource.subscribeHydrated(() => {
      hydrated.set(signalSource.isHydrated());
    });
    onCleanup(unsubscribe);
  });
  return hydrated.asReadonly();
}
