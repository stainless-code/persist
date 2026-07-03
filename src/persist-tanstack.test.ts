import { beforeEach, describe, expect, it } from "bun:test";

import { createAtom, Store } from "@tanstack/store";
import type { Atom } from "@tanstack/store";

import { createJSONStorage } from "./persist-core";
import type { StateStorage } from "./persist-core";
import { persistAtom, persistStore } from "./persist-tanstack";

class MemoryStorage implements StateStorage {
  private store = new Map<string, string>();

  clear() {
    this.store.clear();
  }

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
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

describe("persistStore", () => {
  let memory: MemoryStorage;

  beforeEach(() => {
    memory = new MemoryStorage();
  });

  it("wraps a TanStack Store", async () => {
    const store = new Store({ jobs: [] as string[] });
    const jsonStorage = createJSONStorage<{ jobs: string[] }>(() => memory)!;
    await jsonStorage.setItem("jobs-store", {
      state: { jobs: ["polling-job"] },
      version: 0,
    });

    const persist = persistStore(store, {
      name: "jobs-store",
      storage: jsonStorage,
      partialize: (state) => ({ jobs: state.jobs }),
    });

    await waitForHydration(persist.hasHydrated);
    expect(store.state.jobs).toEqual(["polling-job"]);

    store.setState((prev) => ({ ...prev, jobs: [...prev.jobs, "new-job"] }));
    await new Promise((resolve) => queueMicrotask(resolve));

    const stored = await jsonStorage.getItem("jobs-store");
    expect(stored?.state.jobs).toEqual(["polling-job", "new-job"]);
  });
});

describe("persistAtom", () => {
  let memory: MemoryStorage;

  beforeEach(() => {
    memory = new MemoryStorage();
  });

  it("wraps a writable atom", async () => {
    const countAtom = createAtom(0);
    const jsonStorage = createJSONStorage<number>(() => memory)!;
    await jsonStorage.setItem("count-atom", { state: 7, version: 0 });

    const persist = persistAtom(countAtom, {
      name: "count-atom",
      storage: jsonStorage,
    });

    await waitForHydration(persist.hasHydrated);
    expect(countAtom.get()).toBe(7);

    countAtom.set(9);
    await new Promise((resolve) => queueMicrotask(resolve));

    const stored = await jsonStorage.getItem("count-atom");
    expect(stored?.state).toBe(9);
  });

  it("rejects readonly atoms", () => {
    const readonlyAtom = createAtom(() => 42);
    expect(() =>
      persistAtom(readonlyAtom as unknown as Atom<number>, {
        name: "readonly",
        storage: createJSONStorage(() => memory)!,
      }),
    ).toThrow("[persistAtom] Cannot persist a readonly atom.");
  });
});
