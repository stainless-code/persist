// Vue hydration entry — owns the `vue` peer dep so the core stays zero-dep.
// Ships as its own subpath entry with vue as an optional peer; no barrel
// re-exports it (importing it IS the dep opt-in, enforced by an isolation
// test).
import { onScopeDispose, shallowRef } from "vue";
import type { Ref } from "vue";

import type { HydrationSignal } from "../../core/hydration";

/**
 * Mount a `HydrationSignal` into Vue's reactivity. Returns a `Ref<boolean>`
 * — read it in a template or `effect`/`computed` to track the hydration gate.
 * Null/undefined signal → a ref that stays `true` (store stays the same with
 * or without persistence). The subscription is cleaned up via
 * `onScopeDispose`, so call this inside `setup()` or an `effectScope()` —
 * the scope owns the teardown, no manual `destroy()` needed.
 *
 * The signal is always-hydrated on the server (no storage → no-op
 * `PersistApi`), so this ref renders `true` during SSR without
 * special-casing — matching the `HydrationSignal` adapter contract.
 *
 * @example
 * ```ts
 * // inside setup() — onScopeDispose is active
 * const hydrated = useHydrated(prefsHydration);
 * // template: <Skeleton v-if="!hydrated" /><PrefsPanel v-else />
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
