// Alpine hydration adapter — peer `alpinejs` >=3.0.0.
import type { HydrationSignal } from "../../core/hydration";

/** Minimal Alpine surface used by the adapter (no `@types/alpinejs` required). */
export interface AlpineLike {
  reactive<T extends object>(obj: T): T;
  magic(
    name: string,
    fn: (
      el: Element,
      utils: { Alpine: AlpineLike; cleanup?: (fn: () => void) => void },
    ) => unknown,
  ): void;
}

/** Alpine-reactive bag returned by {@link useHydrated}. */
export interface HydratedBag {
  hydrated: boolean;
  /** Unsubscribe from the hydration signal. No-op when there is no signal. */
  destroy(): void;
}

let alpineRuntime: AlpineLike | undefined;
let warnedMissingRuntime = false;

/** Reactive holder when the plugin has run; plain object fallback for unit tests. */
function alpineReactive<T extends object>(seed: T): T {
  if (alpineRuntime) return alpineRuntime.reactive(seed);
  if (process.env.NODE_ENV !== "production" && !warnedMissingRuntime) {
    warnedMissingRuntime = true;
    console.warn(
      "[persist/alpine] useHydrated called before Alpine.plugin(persist); updates won't be reactive.",
    );
  }
  return seed;
}

/**
 * Mount a `HydrationSignal` into Alpine reactivity — reactive `{ hydrated }`
 * for `x-show` / `x-text`. Call after `Alpine.plugin(persist)`. Null signal →
 * `{ hydrated: true }`. Tear down with `bag.destroy()` from `Alpine.data`.
 * Template `$hydrated(signal)` caches per element and cleans up on remove.
 *
 * @example
 * ```ts
 * import persist, { useHydrated } from "@stainless-code/persist/frameworks/alpine";
 * Alpine.plugin(persist);
 * Alpine.data("prefs", () => {
 *   const hydration = useHydrated(prefsHydration);
 *   return {
 *     get hydrated() { return hydration.hydrated; },
 *     destroy() { hydration.destroy(); },
 *   };
 * });
 * ```
 */
export function useHydrated(
  signal: HydrationSignal | null | undefined,
): HydratedBag {
  let unsubscribe: (() => void) | undefined;
  const bag = alpineReactive({
    hydrated: signal?.isHydrated() ?? true,
    destroy() {
      unsubscribe?.();
      unsubscribe = undefined;
    },
  });

  if (signal) {
    unsubscribe = signal.subscribeHydrated(() => {
      bag.hydrated = signal.isHydrated();
    });
  }

  return bag;
}

/** Per-element cache so `$hydrated(signal)` re-evals don't stack subscriptions. */
const magicBags = new WeakMap<
  Element,
  Map<HydrationSignal | null, HydratedBag>
>();

/**
 * Alpine plugin — stores the runtime for `Alpine.reactive` and registers
 * `$hydrated` (`(signal) => useHydrated(signal)`).
 *
 * @example
 * ```ts
 * import persist from "@stainless-code/persist/frameworks/alpine";
 * Alpine.plugin(persist);
 * ```
 */
export default function persist(Alpine: AlpineLike): void {
  alpineRuntime = Alpine;
  warnedMissingRuntime = false;

  Alpine.magic("hydrated", (el, { cleanup }) => {
    return (signal: HydrationSignal | null | undefined) => {
      let map = magicBags.get(el);
      if (!map) {
        map = new Map();
        magicBags.set(el, map);
        cleanup?.(() => {
          for (const bag of map!.values()) bag.destroy();
          magicBags.delete(el);
        });
      }
      const key = signal ?? null;
      let bag = map.get(key);
      if (!bag) {
        bag = useHydrated(signal);
        map.set(key, bag);
      }
      return bag;
    };
  });
}

export { persist };
