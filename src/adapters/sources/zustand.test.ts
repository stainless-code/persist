import { beforeEach, describe, expect, it } from "bun:test";

import type { StoreApi } from "zustand";

import { createJSONStorage } from "../../core/persist-core";
import { itImportsOnlyFromCore } from "../../testing/assert-core-only-imports";
import { MemoryStorage } from "../../testing/memory-storage";
import { waitForHydration } from "../../testing/wait-for-hydration";
import { persistStore } from "./zustand";

function createMockStore<T>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    getInitialState: () => initial,
    setState: (updater: (prev: T) => T) => {
      state = updater(state);
      listeners.forEach((l) => l());
    },
    subscribe: (listener: (state: T, prevState: T) => void) => {
      const wrapped = () => listener(state, state);
      listeners.add(wrapped);
      return () => {
        listeners.delete(wrapped);
      };
    },
    listenerCount: () => listeners.size,
  };
}

describe("persistStore", () => {
  let memory: MemoryStorage;

  beforeEach(() => {
    memory = new MemoryStorage();
  });

  it("round-trips through persistSource", async () => {
    const store = createMockStore({ count: 0 });
    const jsonStorage = createJSONStorage<{ count: number }>(() => memory)!;
    await jsonStorage.setItem("count-store", {
      state: { count: 7 },
      version: 0,
    });

    const persist = persistStore(store as StoreApi<{ count: number }>, {
      name: "count-store",
      storage: jsonStorage,
    });

    await waitForHydration(persist.hasHydrated);
    expect(store.getState().count).toBe(7);

    store.setState((prev) => ({ ...prev, count: prev.count + 1 }));
    await new Promise((resolve) => queueMicrotask(resolve));

    const stored = await jsonStorage.getItem("count-store");
    expect(stored?.state.count).toBe(8);

    const freshStore = createMockStore({ count: 0 });
    const rehydrate = persistStore(freshStore as StoreApi<{ count: number }>, {
      name: "count-store",
      storage: jsonStorage,
    });
    await waitForHydration(rehydrate.hasHydrated);
    expect(freshStore.getState().count).toBe(8);
  });

  it("subscribe fires on setState", async () => {
    const store = createMockStore({ count: 0 });
    const jsonStorage = createJSONStorage<{ count: number }>(() => memory)!;

    const persist = persistStore(store as StoreApi<{ count: number }>, {
      name: "subscribe-store",
      storage: jsonStorage,
    });

    await waitForHydration(persist.hasHydrated);
    expect(store.listenerCount()).toBe(1);

    store.setState((prev) => ({ ...prev, count: 42 }));
    await new Promise((resolve) => queueMicrotask(resolve));

    const stored = await jsonStorage.getItem("subscribe-store");
    expect(stored?.state.count).toBe(42);
  });
});

describe("zustand dependency isolation", () => {
  itImportsOnlyFromCore(new URL("./zustand.ts", import.meta.url));
});
