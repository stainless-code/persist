import { describe, expect, it } from "bun:test";

import { MemoryStorage } from "../testing/memory-storage";
import { alwaysHydratedSignal, toHydrationSignal } from "./hydration";
import type { HydrationSource } from "./hydration";
import { createJSONStorage, persistSource } from "./persist-core";
import type { PersistableSource } from "./persist-core";

function createMockSource<T>(initial: T): PersistableSource<T> & { state: T } {
  let state = initial;
  const listeners = new Set<() => void>();

  return {
    get state() {
      return state;
    },
    getState: () => state,
    setState: (updater) => {
      state = updater(state);
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return {
        unsubscribe: () => listeners.delete(listener),
      };
    },
  };
}

function waitForHydration(hasHydrated: () => boolean, maxTicks = 10_000) {
  return new Promise<void>((resolve, reject) => {
    let ticks = 0;
    const tick = () => {
      if (hasHydrated()) {
        resolve();
        return;
      }
      // Bounded: a hydration regression fails loudly here instead of hanging
      // the suite until the runner's opaque timeout.
      if (++ticks > maxTicks) {
        reject(new Error("waitForHydration: never hydrated"));
        return;
      }
      queueMicrotask(tick);
    };
    tick();
  });
}

describe("toHydrationSignal", () => {
  it("delegates isHydrated to the persist api", async () => {
    const memory = new MemoryStorage();
    const storage = createJSONStorage<{ count: number }>(() => memory)!;
    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, { name: "to-sync", storage });

    const sync = toHydrationSignal(persist)!;

    expect(sync.isHydrated()).toBe(false);

    await waitForHydration(persist.hasHydrated);
    expect(sync.isHydrated()).toBe(true);
  });

  it("isHydrated flips across a rehydrate cycle", async () => {
    const memory = new MemoryStorage();
    const storage = createJSONStorage<{ count: number }>(() => memory)!;
    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, { name: "to-sync-cycle", storage });
    const sync = toHydrationSignal(persist)!;

    await waitForHydration(persist.hasHydrated);
    expect(sync.isHydrated()).toBe(true);

    void persist.rehydrate();
    expect(sync.isHydrated()).toBe(false);
    await waitForHydration(persist.hasHydrated);
    expect(sync.isHydrated()).toBe(true);
  });

  it("subscribeHydrated notifies on hydration transitions", async () => {
    const memory = new MemoryStorage();
    const storage = createJSONStorage<{ count: number }>(() => memory)!;
    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, { name: "to-sync-sub", storage });
    const sync = toHydrationSignal(persist)!;

    const calls: boolean[] = [];
    const unsub = sync.subscribeHydrated(() => calls.push(sync.isHydrated()));

    await waitForHydration(persist.hasHydrated);
    void persist.rehydrate();
    await waitForHydration(persist.hasHydrated);

    unsub();
    expect(calls.length).toBeGreaterThan(0);
  });
});

describe("alwaysHydratedSignal", () => {
  it("is always hydrated", () => {
    const sync = alwaysHydratedSignal();
    expect(sync.isHydrated()).toBe(true);
    // subscribe is a no-op but must return an unsubscribe function.
    const unsub = sync.subscribeHydrated(() => {});
    expect(typeof unsub).toBe("function");
    unsub();
  });
});

describe("toHydrationSignal null passthrough", () => {
  it("returns null for a null persist api (no ternary at the call site)", () => {
    expect(toHydrationSignal(null)).toBeNull();
  });

  it("returns null for an undefined persist api", () => {
    expect(toHydrationSignal(undefined)).toBeNull();
  });
});

// Hand-rolled structural `HydrationSource` that counts `onHydrate` /
// `onFinishHydration` (un)registrations — observes the signal's lazy
// attach/detach without any persist layer, and drives transitions manually.
function createCountingHydrationSource() {
  let hydrated = false;
  const hydrateListeners = new Set<() => void>();
  const finishListeners = new Set<() => void>();
  const counts = {
    hydrateAttached: 0,
    hydrateDetached: 0,
    finishAttached: 0,
    finishDetached: 0,
  };

  const source: HydrationSource = {
    hasHydrated: () => hydrated,
    onHydrate: (listener) => {
      counts.hydrateAttached++;
      hydrateListeners.add(listener);
      return () => {
        counts.hydrateDetached++;
        hydrateListeners.delete(listener);
      };
    },
    onFinishHydration: (listener) => {
      counts.finishAttached++;
      finishListeners.add(listener);
      return () => {
        counts.finishDetached++;
        finishListeners.delete(listener);
      };
    },
  };

  return {
    source,
    counts,
    startHydration() {
      hydrated = false;
      for (const listener of hydrateListeners) listener();
    },
    finishHydration() {
      hydrated = true;
      for (const listener of finishListeners) listener();
    },
  };
}

// Pins the ADAPTER CONTRACT documented on `HydrationSignal` (hydration.ts) —
// each guarantee an adapter (React/Svelte/Solid/Vue) leans on gets its own test.
describe("HydrationSignal lifecycle contract", () => {
  it("notifies every concurrent subscriber on both transition kinds", () => {
    const { source, startHydration, finishHydration } =
      createCountingHydrationSource();
    const signal = toHydrationSignal(source)!;

    let aCalls = 0;
    let bCalls = 0;
    const unsubA = signal.subscribeHydrated(() => aCalls++);
    const unsubB = signal.subscribeHydrated(() => bCalls++);

    // No initial notification on subscribe — pull model.
    expect(aCalls).toBe(0);
    expect(bCalls).toBe(0);

    finishHydration();
    expect(aCalls).toBe(1);
    expect(bCalls).toBe(1);

    startHydration();
    expect(aCalls).toBe(2);
    expect(bCalls).toBe(2);

    unsubA();
    unsubB();
  });

  it("the same listener fn subscribed twice yields two independent subscriptions", () => {
    const { source, finishHydration } = createCountingHydrationSource();
    const signal = toHydrationSignal(source)!;

    let calls = 0;
    const listener = () => calls++;
    const unsubFirst = signal.subscribeHydrated(listener);
    const unsubSecond = signal.subscribeHydrated(listener);

    finishHydration();
    expect(calls).toBe(2); // once per subscription, not deduped on the raw fn

    // Unsubscribing one keeps the other live — pins the fresh-wrapper fix.
    unsubFirst();
    finishHydration();
    expect(calls).toBe(3);

    unsubSecond();
    finishHydration();
    expect(calls).toBe(3);
  });

  it("unsubscribe is idempotent — a second call cannot kill later subscriptions", () => {
    const { source, counts, finishHydration } = createCountingHydrationSource();
    const signal = toHydrationSignal(source)!;

    const unsubStale = signal.subscribeHydrated(() => {});
    unsubStale(); // last subscriber gone — upstream detached

    let calls = 0;
    const unsubLive = signal.subscribeHydrated(() => calls++); // re-attach
    unsubStale(); // second call — must not re-run the size-0 teardown

    finishHydration();
    expect(calls).toBe(1);
    // Only the first unsubscribe detached upstream; the live subscription's
    // attachment survived the duplicate call.
    expect(counts.hydrateDetached).toBe(1);
    expect(counts.finishDetached).toBe(1);

    unsubLive();
  });

  it("re-attach after full detach works; snapshot re-read recovers missed transitions", () => {
    const { source, startHydration, finishHydration } =
      createCountingHydrationSource();
    const signal = toHydrationSignal(source)!;

    const unsub = signal.subscribeHydrated(() => {});
    unsub(); // full detach

    // Transition while nothing is subscribed: not replayed …
    finishHydration();

    let calls = 0;
    const resub = signal.subscribeHydrated(() => calls++);
    expect(calls).toBe(0); // … no replay, no initial notification …
    expect(signal.isHydrated()).toBe(true); // … the snapshot re-read recovers it

    // and the fresh subscription is live for the NEXT transition.
    startHydration();
    expect(calls).toBe(1);
    expect(signal.isHydrated()).toBe(false);

    resub();
  });

  it("attaches to the source on the first subscriber and detaches on the last", () => {
    const { source, counts } = createCountingHydrationSource();
    const signal = toHydrationSignal(source)!;

    // Lazy: creating the signal alone registers nothing upstream.
    expect(counts.hydrateAttached).toBe(0);
    expect(counts.finishAttached).toBe(0);

    const unsubA = signal.subscribeHydrated(() => {});
    expect(counts.hydrateAttached).toBe(1);
    expect(counts.finishAttached).toBe(1);

    const unsubB = signal.subscribeHydrated(() => {});
    expect(counts.hydrateAttached).toBe(1); // second subscriber reuses the attachment
    expect(counts.finishAttached).toBe(1);

    unsubA();
    expect(counts.hydrateDetached).toBe(0); // one subscriber still live
    expect(counts.finishDetached).toBe(0);

    unsubB();
    expect(counts.hydrateDetached).toBe(1); // last one out detaches upstream
    expect(counts.finishDetached).toBe(1);

    // The next subscriber re-attaches lazily.
    const unsubC = signal.subscribeHydrated(() => {});
    expect(counts.hydrateAttached).toBe(2);
    expect(counts.finishAttached).toBe(2);
    unsubC();
  });
});
