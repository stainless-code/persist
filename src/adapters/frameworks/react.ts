import { useSyncExternalStore } from "react";

import type { HydrationSignal } from "../../core/hydration";

export interface UseHydratedResult {
  /**
   * Gates UI flash only, never the state read — `useSelector` reads the
   * pre-hydration (initial) state unchanged until hydration lands.
   */
  hydrated: boolean;
}

// Module-level constants → stable references, no resubscribe churn on rerender.
const noopSubscribe: (listener: () => void) => () => void = () => () => {};
const alwaysTrue: () => boolean = () => true;

/**
 * Mount a `HydrationSignal` into the React lifecycle via `useSyncExternalStore`.
 * Returns ONLY `hydrated` — state reads go through `useSelector`. Null signal →
 * `hydrated: true` (store stays the same with or without persistence). Server
 * snapshot is always `true` (no storage server-side, nothing to gate) — the
 * SSR policy every framework adapter must implement per the
 * `HydrationSignal` adapter contract; this hook is the reference.
 *
 * @example
 * ```ts
 * // store module — hydration signal as a persist sidekick
 * const persist = persistStore(store, { name: "app:prefs:v1" });
 * export const prefsHydration = toHydrationSignal(persist);
 *
 * // component — gate the hydrate flash, read state via useSelector as usual
 * const { hydrated } = useHydrated(prefsHydration);
 * const prefs = useSelector(store, (s) => s.prefs);
 * if (!hydrated) return <Skeleton />;
 * ```
 */
export function useHydrated(
  signal: HydrationSignal | null | undefined,
): UseHydratedResult {
  const subscribe = signal?.subscribeHydrated ?? noopSubscribe;
  const getSnapshot = signal?.isHydrated ?? alwaysTrue;
  const hydrated = useSyncExternalStore(subscribe, getSnapshot, alwaysTrue);
  return { hydrated };
}
