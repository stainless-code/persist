// Angular signals hydration adapter — peer `@angular/core` >=17.0.0 (signals).
import { effect, signal } from "@angular/core";
import type { Signal } from "@angular/core";

import type { HydrationSignal } from "../../core/hydration";

const alwaysTrue = signal(true);

/**
 * Mount a `HydrationSignal` into Angular signals. Call inside a component's
 * injection context (`effect()` requires it).
 *
 * @example
 * ```ts
 * import { useHydrated } from "@stainless-code/persist/frameworks/angular";
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
