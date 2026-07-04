// Hydration is OBSERVED from outside the store via `useSyncExternalStore`
// (see `./frameworks/react` — the reference `useHydrated`), never by mutating `store.state` with a
// `__hydrated` flag — store creation and `useSelector` reads stay identical
// with or without a hydration sidekick.

/**
 * Reactive hydration signal — the framework-agnostic subscribe target an
 * adapter mounts into its external-store mechanism (React
 * `useSyncExternalStore` via `useHydrated`, Svelte `createSubscriber` /
 * readable stores, Solid `from`, Vue `shallowRef` + watch). Non-generic:
 * state reads stay on the store (`useSelector`); the signal only exposes
 * hydration.
 *
 * ADAPTER CONTRACT — what an adapter may rely on and must do:
 * - `subscribeHydrated(listener)` supports multiple concurrent subscribers
 *   and returns an idempotent unsubscribe. Each call is an independent
 *   subscription, even for the same listener function.
 * - Listeners are NOT invoked on subscribe (no initial notification) and
 *   carry NO payload — this is a pull model: (re)read `isHydrated()` after
 *   attaching, and on every notification.
 * - Transitions that happen while nothing is subscribed are not replayed;
 *   the snapshot re-read on attach recovers the current state.
 * - SSR: render `hydrated = true` on the server (no storage server-side,
 *   nothing to gate) — this policy lives in each adapter, not in the signal;
 *   see `useHydrated`'s server snapshot for the reference implementation.
 * - A `null` signal means "no persistence" and must render hydrated: `true`.
 */
export interface HydrationSignal {
  subscribeHydrated: (listener: () => void) => () => void;
  isHydrated: () => boolean;
}

/**
 * Minimal structural source `toHydrationSignal` reads from — `PersistApi`
 * satisfies it, and so does any object exposing a hydration lifecycle
 * (the signal layer has no dependency on persist types).
 */
export interface HydrationSource {
  hasHydrated: () => boolean;
  onHydrate: (listener: () => void) => () => void;
  onFinishHydration: (listener: () => void) => () => void;
}

/**
 * Derive a `HydrationSignal` from a `HydrationSource` (e.g. a `PersistApi`),
 * bridging `onHydrate` / `onFinishHydration` into one external-store
 * subscribe target that notifies on either transition. Null-tolerant:
 * `null` / `undefined` in → `null` out, so a conditional-persist consumer
 * drops its hydration ternary (`persist ? toHydrationSignal(persist) : null`
 * → `toHydrationSignal(persist)`).
 */
export function toHydrationSignal(
  source: HydrationSource | null | undefined,
): HydrationSignal | null {
  if (!source) return null;

  const listeners = new Set<() => void>();
  const emit = () => {
    for (const listener of listeners) listener();
  };

  // Subscribe to the source lazily on first listener and tear down on the
  // last unsubscribe — a recreated `HydrationSignal` wrapper otherwise leaks
  // `onHydrate` / `onFinishHydration` callbacks (and their retained closures)
  // permanently.
  let unsubHydrate: (() => void) | null = null;
  let unsubFinish: (() => void) | null = null;

  return {
    subscribeHydrated(listener) {
      // Fresh wrapper per subscription: the same listener fn subscribed twice
      // must yield two independent subscriptions — keying the Set on the raw
      // fn would dedupe them and let either unsubscribe kill both (and
      // detach upstream while a consumer still believes it's subscribed).
      const entry = () => listener();
      listeners.add(entry);
      if (listeners.size === 1) {
        unsubHydrate = source.onHydrate(emit);
        unsubFinish = source.onFinishHydration(emit);
      }
      return () => {
        // Idempotent: a second call finds the entry gone and must not
        // re-trigger the size-0 teardown for subscriptions created since.
        if (!listeners.delete(entry)) return;
        if (listeners.size === 0) {
          unsubHydrate?.();
          unsubFinish?.();
          unsubHydrate = null;
          unsubFinish = null;
        }
      };
    },
    isHydrated: () => source.hasHydrated(),
  };
}

/**
 * Always-hydrated `HydrationSignal` for the no-persist path — a uniform
 * handle instead of a `null` branch at the call site. Solves null-tolerance
 * once in the core so framework adapters stay dumb (subscribe + snapshot,
 * nothing else).
 */
export function alwaysHydratedSignal(): HydrationSignal {
  return {
    subscribeHydrated: () => () => {},
    isHydrated: () => true,
  };
}
