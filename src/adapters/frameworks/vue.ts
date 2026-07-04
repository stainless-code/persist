// Vue hydration adapter — peer `vue` >=3.3.0.
import { onScopeDispose, shallowRef } from "vue";
import type { Ref } from "vue";

import type { HydrationSignal } from "../../core/hydration";

/**
 * Mount a `HydrationSignal` into Vue's reactivity. Returns a `Ref<boolean>`;
 * call inside `setup()` or an `effectScope()` — the subscription is cleaned up
 * via `onScopeDispose` (the scope owns teardown). Null/undefined signal → a
 * ref that stays `true`. Renders `true` on the server.
 *
 * @example
 * ```ts
 * // inside setup() — onScopeDispose is active
 * const hydrated = useHydrated(prefsHydration);
 * // <Skeleton v-if="!hydrated" /><PrefsPanel v-else />
 * ```
 */
export function useHydrated(
  signal: HydrationSignal | null | undefined,
): Ref<boolean> {
  const hydrated = shallowRef(true);
  if (signal) {
    hydrated.value = signal.isHydrated(); // pull-model: read the initial value ourselves
    const unsubscribe = signal.subscribeHydrated(() => {
      hydrated.value = signal.isHydrated();
    });
    onScopeDispose(unsubscribe);
  }
  return hydrated;
}
