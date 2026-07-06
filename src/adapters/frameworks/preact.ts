// Preact hydration adapter — peer `preact` >=10.19.0 (useSyncExternalStore via preact/compat).
import { useSyncExternalStore } from "preact/compat";

import type { HydrationSignal } from "../../core/hydration";

export interface UseHydratedResult {
  hydrated: boolean;
}

const noopSubscribe: (listener: () => void) => () => void = () => () => {};
const alwaysTrue: () => boolean = () => true;

/**
 * Mount a `HydrationSignal` into Preact.
 *
 * @example
 * ```ts
 * import { useHydrated } from "@stainless-code/persist/frameworks/preact";
 * const { hydrated } = useHydrated(prefsHydration);
 * if (!hydrated) return <Skeleton />;
 * ```
 */
export function useHydrated(
  signal: HydrationSignal | null | undefined,
): UseHydratedResult {
  const subscribe = signal?.subscribeHydrated ?? noopSubscribe;
  const getSnapshot = signal?.isHydrated ?? alwaysTrue;
  // @ts-expect-error preact/compat types omit getServerSnapshot (SSR third arg)
  const hydrated = useSyncExternalStore(subscribe, getSnapshot, alwaysTrue);
  return { hydrated };
}
