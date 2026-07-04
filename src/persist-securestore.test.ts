import { beforeEach, describe, expect, it, mock } from "bun:test";

const store = new Map<string, string>();

mock.module("expo-secure-store", () => ({
  getItemAsync: (key: string) => Promise.resolve(store.get(key) ?? null),
  setItemAsync: (key: string, value: string) => {
    store.set(key, value);
    return Promise.resolve();
  },
  deleteItemAsync: (key: string) => {
    store.delete(key);
    return Promise.resolve();
  },
}));

const { secureStoreStateStorage, createSecureStoreStorage } =
  await import("./persist-securestore");
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
      if (++ticks > maxTicks) {
        reject(new Error("waitForHydration: never hydrated"));
        return;
      }
      queueMicrotask(tick);
    };
    tick();
  });
}

describe("persist-securestore", () => {
  beforeEach(() => store.clear());

  it("secureStoreStateStorage maps the async backend", async () => {
    const storage = secureStoreStateStorage();
    expect(await storage.getItem("missing")).toBeNull();

    await storage.setItem("k", "v");
    expect(await storage.getItem("k")).toBe("v");

    await storage.removeItem("k");
    expect(await storage.getItem("k")).toBeNull();
  });

  it("createSecureStoreStorage round-trips through persistSource", async () => {
    const storage = createSecureStoreStorage<{ count: number }>()!;

    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, { name: "secure-json", storage });
    await waitForHydration(persist.hasHydrated);

    source.setState(() => ({ count: 7 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((await storage.getItem("secure-json"))?.state.count).toBe(7);

    const source2 = createMockSource({ count: 0 });
    const persist2 = persistSource(source2, {
      name: "secure-json",
      storage,
      skipHydration: true,
    });
    await persist2.rehydrate();
    expect(source2.state.count).toBe(7);

    persist.destroy();
    persist2.destroy();
  });

  it("no sibling entry IMPORTS persist-securestore (dependency isolation)", async () => {
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
      "persist-mmkv.ts",
      "hydration.ts",
      "use-hydrated.ts",
      "index.ts",
    ]) {
      const url = new URL(`./${sibling}`, import.meta.url);
      if (!(await Bun.file(url).exists())) continue;

      const source = await Bun.file(url).text();
      const offendingImports = source.match(
        /(?:from\s+|import\s*\(\s*)["']\.\/persist-securestore["']/g,
      );
      expect(offendingImports).toBeNull();
    }
  });
});
