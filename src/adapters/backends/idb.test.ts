import { beforeEach, describe, expect, it, mock } from "bun:test";

// bun has no IndexedDB — fake idb-keyval with a Map-backed implementation
// honoring the optional per-call `store` param (idb-keyval's own seam). The
// module under test only maps shapes; the real IDB behavior is idb-keyval's
// battle-tested concern.
// `unknown` values: the structured-clone mode stores raw objects, not strings
// (real IndexedDB accepts any structured-cloneable value).
const defaultStore = new Map<string, unknown>();
const customStores = new WeakMap<object, Map<string, unknown>>();

function resolveStore(store?: object): Map<string, unknown> {
  if (!store) return defaultStore;
  let map = customStores.get(store);
  if (!map) {
    map = new Map();
    customStores.set(store, map);
  }
  return map;
}

mock.module("idb-keyval", () => ({
  get: (key: string, store?: object) =>
    Promise.resolve(resolveStore(store).get(key)),
  set: (key: string, value: unknown, store?: object) => {
    resolveStore(store).set(key, value);
    return Promise.resolve();
  },
  del: (key: string, store?: object) => {
    resolveStore(store).delete(key);
    return Promise.resolve();
  },
}));

const { createIdbStorage, idbStateStorage } = await import("./idb");
const { createStorage, persistSource } =
  await import("../../core/persist-core");
const { serovalCodec } = await import("../codecs/seroval");

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

describe("persist-idb", () => {
  beforeEach(() => {
    defaultStore.clear();
  });

  it("idbStateStorage maps idb-keyval's undefined-for-missing to null", async () => {
    const storage = idbStateStorage();
    expect(await storage.getItem("missing")).toBeNull();

    await storage.setItem("k", "v");
    expect(await storage.getItem("k")).toBe("v");

    await storage.removeItem("k");
    expect(await storage.getItem("k")).toBeNull();
  });

  it("createIdbStorage round-trips through the persist pipeline (structured mode)", async () => {
    const storage = createIdbStorage<{ count: number }>()!;

    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, { name: "idb-json", storage });
    await waitForHydration(persist.hasHydrated);

    source.setState(() => ({ count: 7 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((await storage.getItem("idb-json"))?.state.count).toBe(7);

    // Fresh source hydrates from the async backend.
    const source2 = createMockSource({ count: 0 });
    const persist2 = persistSource(source2, {
      name: "idb-json",
      storage,
      skipHydration: true,
    });
    await persist2.rehydrate();
    expect(source2.state.count).toBe(7);

    persist.destroy();
    persist2.destroy();
  });

  it("stores the envelope natively — Set survives with NO codec (raw object in storage)", async () => {
    const storage = createIdbStorage<{ tags: Set<string> }>()!;

    const source = createMockSource({ tags: new Set<string>() });
    const persist = persistSource(source, { name: "idb-structured", storage });
    await waitForHydration(persist.hasHydrated);

    source.setState(() => ({ tags: new Set(["a", "b"]) }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    // The backend holds the raw envelope object — not a serialized string.
    const rawStored = defaultStore.get("idb-structured") as {
      state: { tags: Set<string> };
    };
    expect(typeof rawStored).toBe("object");
    expect(rawStored.state.tags instanceof Set).toBe(true);

    // Fresh source hydrates the Set back without any codec.
    const source2 = createMockSource({ tags: new Set<string>() });
    const persist2 = persistSource(source2, {
      name: "idb-structured",
      storage,
      skipHydration: true,
    });
    await persist2.rehydrate();
    expect(source2.state.tags).toEqual(new Set(["a", "b"]));

    persist.destroy();
    persist2.destroy();
  });

  it("codec escape hatch: string codecs compose over idbStateStorage via createStorage (encryption/compression/legacy recipe)", async () => {
    const storage = createStorage<{ tags: Set<string> }>(
      () => idbStateStorage(),
      serovalCodec(),
    )!;
    await storage.setItem("idb-seroval", {
      state: { tags: new Set(["a"]) },
      version: 0,
    });
    const stored = await storage.getItem("idb-seroval");
    expect(stored?.state.tags instanceof Set).toBe(true);
  });

  it("forwards a custom idb-keyval store so keys are namespaced away from the default", async () => {
    const customStore = {} as never;
    const storage = createIdbStorage<{ count: number }>({
      store: customStore,
    })!;

    await storage.setItem("shared-key", { state: { count: 1 }, version: 0 });
    expect((await storage.getItem("shared-key"))?.state.count).toBe(1);
    // The default store never saw the key.
    expect(defaultStore.has("shared-key")).toBe(false);
  });

  it("imports only from core (no cross-adapter coupling)", async () => {
    const source = await Bun.file(new URL("./idb.ts", import.meta.url)).text();
    const relativeImports = [
      ...source.matchAll(/from\s+["'](\.\.?\/[^"']+)["']/g),
    ].map((match) => match[1]);
    for (const importPath of relativeImports) {
      expect(importPath).toMatch(/^\.\.\/\.\.\/core\//);
    }
  });
});
