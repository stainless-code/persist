import { beforeEach, describe, expect, it } from "bun:test";

import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { createStore } from "redux";
import type { Reducer } from "redux";

import { createJSONStorage } from "../../core/persist-core";
import { itImportsOnlyFromCore } from "../../testing/assert-core-only-imports";
import { MemoryStorage } from "../../testing/memory-storage";
import { waitForHydration } from "../../testing/wait-for-hydration";
import { persistableReducer, persistStore } from "./redux";

interface CountState {
  count: number;
}

const increment = { type: "INCREMENT" as const };

const countReducer: Reducer<CountState> = (state = { count: 0 }, action) => {
  if (action.type === "INCREMENT") {
    return { count: state.count + 1 };
  }
  return state;
};

describe("persistStore", () => {
  let memory: MemoryStorage;

  beforeEach(() => {
    memory = new MemoryStorage();
  });

  it("round-trips through persistSource (createStore)", async () => {
    const jsonStorage = createJSONStorage<CountState>(() => memory)!;
    await jsonStorage.setItem("count-store", {
      state: { count: 7 },
      version: 0,
    });

    const store = createStore(persistableReducer(countReducer));
    const persist = persistStore(store, {
      name: "count-store",
      storage: jsonStorage,
    });

    await waitForHydration(persist.hasHydrated);
    expect(store.getState().count).toBe(7);

    store.dispatch(increment);
    await new Promise((resolve) => queueMicrotask(resolve));

    const stored = await jsonStorage.getItem("count-store");
    expect(stored?.state.count).toBe(8);

    const freshStore = createStore(persistableReducer(countReducer));
    const rehydrate = persistStore(freshStore, {
      name: "count-store",
      storage: jsonStorage,
    });
    await waitForHydration(rehydrate.hasHydrated);
    expect(freshStore.getState().count).toBe(8);
  });

  it("round-trips through persistSource (RTK configureStore)", async () => {
    const jsonStorage = createJSONStorage<CountState>(() => memory)!;
    await jsonStorage.setItem("rtk-store", {
      state: { count: 3 },
      version: 0,
    });

    const store = configureStore({
      reducer: persistableReducer(countReducer),
    });
    const persist = persistStore(store, {
      name: "rtk-store",
      storage: jsonStorage,
    });

    await waitForHydration(persist.hasHydrated);
    expect(store.getState().count).toBe(3);

    store.dispatch(increment);
    await new Promise((resolve) => queueMicrotask(resolve));

    const stored = await jsonStorage.getItem("rtk-store");
    expect(stored?.state.count).toBe(4);
  });

  it("round-trips with RTK combineReducers under persistableReducer", async () => {
    interface Root {
      count: CountState;
    }
    const rootReducer = combineReducers({ count: countReducer });
    const jsonStorage = createJSONStorage<Root>(() => memory)!;
    await jsonStorage.setItem("combined-store", {
      state: { count: { count: 9 } },
      version: 0,
    });

    const store = configureStore({
      reducer: persistableReducer(rootReducer),
    });
    const persist = persistStore(store, {
      name: "combined-store",
      storage: jsonStorage,
    });

    await waitForHydration(persist.hasHydrated);
    expect(store.getState().count.count).toBe(9);
  });

  it("subscribe writes on state change after hydrate", async () => {
    const jsonStorage = createJSONStorage<CountState>(() => memory)!;
    const store = createStore(persistableReducer(countReducer));
    const persist = persistStore(store, {
      name: "subscribe-store",
      storage: jsonStorage,
    });

    await waitForHydration(persist.hasHydrated);

    store.dispatch(increment);
    await new Promise((resolve) => queueMicrotask(resolve));

    const stored = await jsonStorage.getItem("subscribe-store");
    expect(stored?.state.count).toBe(1);
  });

  it("without persistableReducer, hydrate does not apply", async () => {
    const jsonStorage = createJSONStorage<CountState>(() => memory)!;
    await jsonStorage.setItem("noop-store", {
      state: { count: 7 },
      version: 0,
    });

    const store = createStore(countReducer);
    const persist = persistStore(store, {
      name: "noop-store",
      storage: jsonStorage,
    });

    await waitForHydration(persist.hasHydrated);
    expect(store.getState().count).toBe(0);
  });
});

describe("redux dependency isolation", () => {
  itImportsOnlyFromCore(new URL("./redux.ts", import.meta.url));
});
