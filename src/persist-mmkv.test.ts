import { beforeEach, describe, expect, it, mock } from "bun:test";

import type { MMKV } from "react-native-mmkv";

// Fake MMKV instance backed by a Map; createMMKV returns one per id. Cast to
// `MMKV` — the adapter only calls `getString`/`set`/`remove`; the HybridObject
// base props (`name`/`equals`/`dispose`/…) are unused in tests.
const instances = new Map<string, Map<string, string>>();
function fakeInstance(id: string): MMKV {
  let map = instances.get(id);
  if (!map) {
    map = new Map();
    instances.set(id, map);
  }
  return {
    id,
    set: (key: string, value: boolean | string | number | ArrayBuffer) => {
      map!.set(key, String(value));
    },
    getString: (key: string) => map!.get(key) as string | undefined,
    remove: (key: string) => map!.delete(key),
    contains: (key: string) => map!.has(key),
    getAllKeys: () => [...map!.keys()],
    clearAll: () => map!.clear(),
  } as unknown as MMKV;
}

mock.module("react-native-mmkv", () => ({
  createMMKV: (config: { id: string }) => fakeInstance(config.id),
}));

const { mmkvStateStorage, createMmkvStorage } = await import("./persist-mmkv");
const { persistSource } = await import("./persist-core");

function createMockSource<T>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get state() {
      return state;
    },
    getState: () => state,
    setState: (updater: (prev: T) => T) => {
      state = updater(state);
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return { unsubscribe: () => listeners.delete(listener) };
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

describe("persist-mmkv", () => {
  beforeEach(() => instances.clear());

  it("mmkvStateStorage round-trips synchronously", () => {
    const instance = fakeInstance("state");
    const storage = mmkvStateStorage(instance);

    expect(storage.getItem("missing")).toBeNull();

    storage.setItem("k", "v");
    expect(storage.getItem("k")).toBe("v");

    storage.removeItem("k");
    expect(storage.getItem("k")).toBeNull();
  });

  it("createMmkvStorage round-trips through persistSource", async () => {
    const storage = createMmkvStorage<{ count: number }>({ id: "test" })!;

    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, { name: "mmkv-json", storage });
    await waitForHydration(persist.hasHydrated);

    source.setState(() => ({ count: 7 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((await storage.getItem("mmkv-json"))?.state.count).toBe(7);

    const source2 = createMockSource({ count: 0 });
    const persist2 = persistSource(source2, {
      name: "mmkv-json",
      storage,
      skipHydration: true,
    });
    await persist2.rehydrate();
    expect(source2.state.count).toBe(7);

    persist.destroy();
    persist2.destroy();
  });

  it("no sibling entry IMPORTS persist-mmkv (dependency isolation)", async () => {
    for (const sibling of [
      "persist-core.ts",
      "persist-seroval.ts",
      "persist-idb.ts",
      "persist-crosstab.ts",
      "persist-zod.ts",
      "persist-tanstack.ts",
      "persist-solid.ts",
      "persist-vue.ts",
      "persist-asyncstorage.ts",
      "hydration.ts",
      "use-hydrated.ts",
      "index.ts",
    ]) {
      const url = new URL(`./${sibling}`, import.meta.url);
      if (!(await Bun.file(url).exists())) continue;

      const source = await Bun.file(url).text();
      const offendingImports = source.match(
        /(?:from\s+|import\s*\(\s*)["']\.\/persist-mmkv["']/g,
      );
      expect(offendingImports).toBeNull();
    }
  });
});
