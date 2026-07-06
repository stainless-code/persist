import { beforeEach, describe, expect, it, mock } from "bun:test";

import { itImportsOnlyFromCore } from "../../testing/assert-core-only-imports";
import { MemoryStorage } from "../../testing/memory-storage";
import { waitForHydration } from "../../testing/wait-for-hydration";

const observableMap = new WeakMap<object, Set<() => void>>();

mock.module("mobx", () => ({
  observe: (obj: object, callback: () => void) => {
    const listeners = observableMap.get(obj);
    if (listeners) listeners.add(callback);
    return () => listeners?.delete(callback);
  },
  toJS: <T>(obj: T): T => {
    if (obj && typeof obj === "object") return { ...obj } as T;
    return obj;
  },
}));

const { createJSONStorage } = await import("../../core/persist-core");
const { persistObservable } = await import("./mobx");

function createMockObservable<T extends object>(initial: T): T {
  const listeners = new Set<() => void>();
  const state = { ...initial };
  const proxy = new Proxy(state, {
    get(target, prop) {
      return target[prop as keyof T];
    },
    set(target, prop, value) {
      (target as Record<string, unknown>)[prop as string] = value;
      listeners.forEach((l) => l());
      return true;
    },
  });
  observableMap.set(proxy, listeners);
  return proxy as T;
}

function listenerCount(observable: object) {
  return observableMap.get(observable)?.size ?? 0;
}

describe("persistObservable", () => {
  let memory: MemoryStorage;

  beforeEach(() => {
    memory = new MemoryStorage();
  });

  it("round-trips through persistSource", async () => {
    const observable = createMockObservable({ count: 0 });
    const jsonStorage = createJSONStorage<{ count: number }>(() => memory)!;
    await jsonStorage.setItem("count-observable", {
      state: { count: 7 },
      version: 0,
    });

    const persist = persistObservable(observable, {
      name: "count-observable",
      storage: jsonStorage,
    });

    await waitForHydration(persist.hasHydrated);
    expect(observable.count).toBe(7);

    Object.assign(observable, { count: observable.count + 1 });
    await new Promise((resolve) => queueMicrotask(resolve));

    const stored = await jsonStorage.getItem("count-observable");
    expect(stored?.state.count).toBe(8);

    const freshObservable = createMockObservable({ count: 0 });
    const rehydrate = persistObservable(freshObservable, {
      name: "count-observable",
      storage: jsonStorage,
    });
    await waitForHydration(rehydrate.hasHydrated);
    expect(freshObservable.count).toBe(8);
  });

  it("subscribe fires on setState", async () => {
    const observable = createMockObservable({ count: 0 });
    const jsonStorage = createJSONStorage<{ count: number }>(() => memory)!;

    const persist = persistObservable(observable, {
      name: "subscribe-observable",
      storage: jsonStorage,
    });

    await waitForHydration(persist.hasHydrated);
    expect(listenerCount(observable)).toBe(1);

    Object.assign(observable, { count: 42 });
    await new Promise((resolve) => queueMicrotask(resolve));

    const stored = await jsonStorage.getItem("subscribe-observable");
    expect(stored?.state.count).toBe(42);
  });
});

describe("mobx dependency isolation", () => {
  itImportsOnlyFromCore(new URL("./mobx.ts", import.meta.url));
});
