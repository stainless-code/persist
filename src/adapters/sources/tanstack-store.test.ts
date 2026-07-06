import { beforeEach, describe, expect, it } from "bun:test";

import { createAtom, Store } from "@tanstack/store";
import type { Atom } from "@tanstack/store";

import { createJSONStorage } from "../../core/persist-core";
import { itImportsOnlyFromCore } from "../../testing/assert-core-only-imports";
import { MemoryStorage } from "../../testing/memory-storage";
import { waitForHydration } from "../../testing/wait-for-hydration";
import { persistAtom, persistStore } from "./tanstack-store";

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

describe("tanstack-store dependency isolation", () => {
  itImportsOnlyFromCore(new URL("./tanstack-store.ts", import.meta.url));
});
