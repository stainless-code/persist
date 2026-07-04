import { cleanup, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { useHydrated } from "../src/adapters/frameworks/react";
import { toHydrationSignal } from "../src/core/hydration";
import type { HydrationSource } from "../src/core/hydration";
import { createJSONStorage, persistSource } from "../src/core/persist-core";
import type { PersistableSource, StateStorage } from "../src/core/persist-core";

/**
 * Framework-matrix tests for the React `useHydrated` reactivity path — the
 * `useSyncExternalStore` rerender + cleanup wiring that `bun:test` can't
 * exercise (no DOM, no client renderer). The bun suite (`src/use-hydrated.test.ts`)
 * pins SSR safety + snapshot values; this suite pins that a real client
 * renderer actually rerenders on the hydration flip and detaches on unmount.
 */

function Probe({ signal }: { signal: Parameters<typeof useHydrated>[0] }) {
  const { hydrated } = useHydrated(signal);
  return <span>{String(hydrated)}</span>;
}

/** Sync-to-async `StateStorage` — `getItem` returns a native Promise. */
class AsyncMemoryStorage implements StateStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return Promise.resolve(this.store.get(key) ?? null);
  }
  removeItem(key: string) {
    return Promise.resolve(this.store.delete(key));
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
    return Promise.resolve();
  }
}

function createMockSource<T>(initial: T): PersistableSource<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    setState: (updater) => {
      state = updater(state);
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return { unsubscribe: () => listeners.delete(listener) };
    },
  };
}

/**
 * `HydrationSource` that counts live `onHydrate` / `onFinishHydration`
 * registrations so a test can observe `useHydrated` attaching and detaching
 * upstream (via `toHydrationSignal`'s lazy subscribe / last-unsubscribe teardown).
 */
class CountingSource implements HydrationSource {
  hydrated = false;
  activeHydrate = 0;
  activeFinish = 0;
  onHydrate() {
    this.activeHydrate++;
    return () => {
      this.activeHydrate--;
    };
  }
  onFinishHydration() {
    this.activeFinish++;
    return () => {
      this.activeFinish--;
    };
  }
  hasHydrated() {
    return this.hydrated;
  }
}

afterEach(() => {
  cleanup();
});

describe("useHydrated — reactivity (vitest + jsdom)", () => {
  it("rerenders false → true when an async backend hydrates", async () => {
    const memory = new AsyncMemoryStorage();
    memory.setItem("app:count", JSON.stringify({ state: { count: 7 } }));
    const storage = createJSONStorage<{ count: number }>(() => memory)!;
    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, { name: "app:count", storage });
    const signal = toHydrationSignal(persist)!;

    expect(signal.isHydrated()).toBe(false);

    render(<Probe signal={signal} />);
    // Pre-hydration: the client snapshot is false, rendered immediately.
    expect(screen.getByText("false")).toBeTruthy();

    // Async getItem resolves → onFinishHydration fires → React rerenders.
    await waitFor(() => {
      expect(screen.getByText("true")).toBeTruthy();
    });
    expect(signal.isHydrated()).toBe(true);

    persist.destroy();
  });

  it("a null signal renders hydrated:true immediately (no persistence layer)", () => {
    render(<Probe signal={null} />);
    expect(screen.getByText("true")).toBeTruthy();
  });

  it("unmount detaches — upstream source registration count drops to zero", () => {
    const source = new CountingSource();
    const signal = toHydrationSignal(source)!;

    const { unmount } = render(<Probe signal={signal} />);
    // Mount: `toHydrationSignal` lazily subscribed to both source channels.
    expect(source.activeHydrate).toBe(1);
    expect(source.activeFinish).toBe(1);

    unmount();
    // Unmount: React ran the `useSyncExternalStore` cleanup → the signal's
    // unsubscribe tore down the upstream subscriptions on the last listener.
    expect(source.activeHydrate).toBe(0);
    expect(source.activeFinish).toBe(0);
  });

  it("rehydrate flips hydrated false → true again and rerenders", async () => {
    const memory = new AsyncMemoryStorage();
    memory.setItem("app:theme", JSON.stringify({ state: { theme: "dark" } }));
    const storage = createJSONStorage<{ theme: string }>(() => memory)!;
    const source = createMockSource({ theme: "light" });
    const persist = persistSource(source, { name: "app:theme", storage });
    const signal = toHydrationSignal(persist)!;

    render(<Probe signal={signal} />);
    await waitFor(() => {
      expect(screen.getByText("true")).toBeTruthy();
    });

    // A rehydrate restarts the lifecycle: false (in-flight) → true (settled).
    void persist.rehydrate();
    await waitFor(() => {
      expect(screen.getByText("false")).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.getByText("true")).toBeTruthy();
    });

    persist.destroy();
  });
});
