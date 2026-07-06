import { beforeEach, describe, expect, it, mock } from "bun:test";

import { itImportsOnlyFromCore } from "../../testing/assert-core-only-imports";
import { MemoryStorage } from "../../testing/memory-storage";
import { waitForHydration } from "../../testing/wait-for-hydration";

type MockProxy<T extends object> = T & {
  __listeners: Set<() => void>;
  __state: T;
};

mock.module("valtio/vanilla", () => ({
  snapshot: <T extends object>(proxyObj: T): T => {
    const state = (proxyObj as MockProxy<T>).__state ?? proxyObj;
    return { ...state };
  },
  subscribe: (proxyObj: object, callback: () => void) => {
    const listeners = (proxyObj as MockProxy<object>).__listeners;
    listeners.add(callback);
    return () => listeners.delete(callback);
  },
}));

const { createJSONStorage } = await import("../../core/persist-core");
const { persistProxy } = await import("./valtio");

function createMockProxy<T extends object>(initial: T): MockProxy<T> {
  const listeners = new Set<() => void>();
  const state = { ...initial };
  const proxy = new Proxy(state, {
    get(target, prop) {
      if (prop === "__listeners") return listeners;
      if (prop === "__state") return state;
      return target[prop as keyof T];
    },
    set(target, prop, value) {
      if (prop === "__listeners" || prop === "__state") return true;
      (target as Record<string, unknown>)[prop as string] = value;
      listeners.forEach((l) => l());
      return true;
    },
  }) as MockProxy<T>;
  proxy.__listeners = listeners;
  proxy.__state = state;
  return proxy;
}

describe("persistProxy", () => {
  let memory: MemoryStorage;

  beforeEach(() => {
    memory = new MemoryStorage();
  });

  it("round-trips through persistSource", async () => {
    const proxy = createMockProxy({ count: 0 });
    const jsonStorage = createJSONStorage<{ count: number }>(() => memory)!;
    await jsonStorage.setItem("count-proxy", {
      state: { count: 7 },
      version: 0,
    });

    const persist = persistProxy(proxy, {
      name: "count-proxy",
      storage: jsonStorage,
    });

    await waitForHydration(persist.hasHydrated);
    expect(proxy.count).toBe(7);

    Object.assign(proxy, { count: proxy.count + 1 });
    await new Promise((resolve) => queueMicrotask(resolve));

    const stored = await jsonStorage.getItem("count-proxy");
    expect(stored?.state.count).toBe(8);

    const freshProxy = createMockProxy({ count: 0 });
    const rehydrate = persistProxy(freshProxy, {
      name: "count-proxy",
      storage: jsonStorage,
    });
    await waitForHydration(rehydrate.hasHydrated);
    expect(freshProxy.count).toBe(8);
  });

  it("subscribe fires on setState", async () => {
    const proxy = createMockProxy({ count: 0 });
    const jsonStorage = createJSONStorage<{ count: number }>(() => memory)!;

    const persist = persistProxy(proxy, {
      name: "subscribe-proxy",
      storage: jsonStorage,
    });

    await waitForHydration(persist.hasHydrated);
    expect(proxy.__listeners.size).toBe(1);

    Object.assign(proxy, { count: 42 });
    await new Promise((resolve) => queueMicrotask(resolve));

    const stored = await jsonStorage.getItem("subscribe-proxy");
    expect(stored?.state.count).toBe(42);
  });
});

describe("valtio dependency isolation", () => {
  itImportsOnlyFromCore(new URL("./valtio.ts", import.meta.url));
});
