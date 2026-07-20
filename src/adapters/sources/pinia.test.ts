import { beforeEach, describe, expect, it } from "bun:test";

import { createPinia, defineStore, setActivePinia } from "pinia";
import { ref } from "vue";

import { createJSONStorage } from "../../core/persist-core";
import { itImportsOnlyFromCore } from "../../testing/assert-core-only-imports";
import { MemoryStorage } from "../../testing/memory-storage";
import { waitForHydration } from "../../testing/wait-for-hydration";
import { persistStore } from "./pinia";

describe("persistStore", () => {
  let memory: MemoryStorage;

  beforeEach(() => {
    setActivePinia(createPinia());
    memory = new MemoryStorage();
  });

  it("round-trips through persistSource (option store)", async () => {
    const useCountStore = defineStore("count", {
      state: () => ({ count: 0 }),
    });
    const store = useCountStore();
    const jsonStorage = createJSONStorage<{ count: number }>(() => memory)!;
    await jsonStorage.setItem("count-store", {
      state: { count: 7 },
      version: 0,
    });

    const persist = persistStore(store, {
      name: "count-store",
      storage: jsonStorage,
    });

    await waitForHydration(persist.hasHydrated);
    expect(store.$state.count).toBe(7);

    store.$state = { ...store.$state, count: store.$state.count + 1 };
    await new Promise((resolve) => queueMicrotask(resolve));

    const stored = await jsonStorage.getItem("count-store");
    expect(stored?.state.count).toBe(8);

    setActivePinia(createPinia());
    const freshStore = useCountStore();
    const rehydrate = persistStore(freshStore, {
      name: "count-store",
      storage: jsonStorage,
    });
    await waitForHydration(rehydrate.hasHydrated);
    expect(freshStore.$state.count).toBe(8);
  });

  it("round-trips through persistSource (setup store)", async () => {
    const useSetupStore = defineStore("setup-count", () => {
      const count = ref(0);
      return { count };
    });
    const store = useSetupStore();
    const jsonStorage = createJSONStorage<{ count: number }>(() => memory)!;
    await jsonStorage.setItem("setup-count-store", {
      state: { count: 3 },
      version: 0,
    });

    const persist = persistStore(store, {
      name: "setup-count-store",
      storage: jsonStorage,
    });

    await waitForHydration(persist.hasHydrated);
    expect(store.count).toBe(3);
  });

  it("subscribe writes on state change after hydrate", async () => {
    const useCountStore = defineStore("subscribe-count", {
      state: () => ({ count: 0 }),
    });
    const store = useCountStore();
    const jsonStorage = createJSONStorage<{ count: number }>(() => memory)!;

    const persist = persistStore(store, {
      name: "subscribe-store",
      storage: jsonStorage,
    });

    await waitForHydration(persist.hasHydrated);

    store.count = 42;
    await new Promise((resolve) => queueMicrotask(resolve));

    const stored = await jsonStorage.getItem("subscribe-store");
    expect(stored?.state.count).toBe(42);
  });
});

describe("pinia dependency isolation", () => {
  itImportsOnlyFromCore(new URL("./pinia.ts", import.meta.url));
});
