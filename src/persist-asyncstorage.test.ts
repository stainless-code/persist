import { beforeEach, describe, expect, it, mock } from "bun:test";

// bun has no React Native runtime — fake AsyncStorage with a Map-backed
// implementation. The module under test only maps shapes; real RN behavior is
// AsyncStorage's concern.
const store = new Map<string, string>();

mock.module("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: (key: string) => Promise.resolve(store.get(key) ?? null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key: string) => {
      store.delete(key);
      return Promise.resolve();
    },
  },
}));

const { asyncStorageStateStorage, createAsyncStorage } =
  await import("./persist-asyncstorage");
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

describe("persist-asyncstorage", () => {
  beforeEach(() => store.clear());

  it("asyncStorageStateStorage maps the async backend", async () => {
    const storage = asyncStorageStateStorage();
    expect(await storage.getItem("missing")).toBeNull();

    await storage.setItem("k", "v");
    expect(await storage.getItem("k")).toBe("v");

    await storage.removeItem("k");
    expect(await storage.getItem("k")).toBeNull();
  });

  it("createAsyncStorage round-trips through persistSource", async () => {
    const storage = createAsyncStorage<{ count: number }>()!;

    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, { name: "async-json", storage });
    await waitForHydration(persist.hasHydrated);

    source.setState(() => ({ count: 7 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((await storage.getItem("async-json"))?.state.count).toBe(7);

    const source2 = createMockSource({ count: 0 });
    const persist2 = persistSource(source2, {
      name: "async-json",
      storage,
      skipHydration: true,
    });
    await persist2.rehydrate();
    expect(source2.state.count).toBe(7);

    persist.destroy();
    persist2.destroy();
  });

  it("no sibling entry IMPORTS persist-asyncstorage (dependency isolation)", async () => {
    for (const sibling of [
      "persist-core.ts",
      "persist-seroval.ts",
      "persist-idb.ts",
      "persist-crosstab.ts",
      "persist-zod.ts",
      "persist-tanstack.ts",
      "persist-solid.ts",
      "persist-vue.ts",
      "hydration.ts",
      "use-hydrated.ts",
      "index.ts",
    ]) {
      const url = new URL(`./${sibling}`, import.meta.url);
      if (!(await Bun.file(url).exists())) continue;

      const source = await Bun.file(url).text();
      const offendingImports = source.match(
        /(?:from\s+|import\s*\(\s*)["']\.\/persist-asyncstorage["']/g,
      );
      expect(offendingImports).toBeNull();
    }
  });
});
