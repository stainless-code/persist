import { beforeEach, describe, expect, it } from "bun:test";

import { createStorage, persistSource } from "../../core/persist-core";
import type { PersistableSource, StateStorage } from "../../core/persist-core";
import { MemoryStorage } from "../../testing/memory-storage";
import { createSerovalStorage, serovalCodec } from "./seroval";

function createMockSource<T>(initial: T): PersistableSource<T> & { state: T } {
  let state = initial;
  const listeners = new Set<() => void>();

  return {
    get state() {
      return state;
    },
    getState: () => state,
    setState: (updater) => {
      state = updater(state);
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return {
        unsubscribe: () => listeners.delete(listener),
      };
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

describe("createSerovalStorage", () => {
  let memory: MemoryStorage;

  beforeEach(() => {
    memory = new MemoryStorage();
  });

  it("round-trips Set and Map through seroval", async () => {
    const storage = createSerovalStorage<{
      tags: Set<string>;
      map: Map<string, number>;
    }>(() => memory)!;

    await storage.setItem("test", {
      state: { tags: new Set(["a", "b"]), map: new Map([["x", 1]]) },
      version: 1,
    });

    const stored = await storage.getItem("test");
    expect(stored?.state.tags).toEqual(new Set(["a", "b"]));
    expect(stored?.state.tags instanceof Set).toBe(true);
    expect(stored?.state.map.get("x")).toBe(1);
    expect(stored?.state.map instanceof Map).toBe(true);
  });

  it("returns null for corrupt payloads", async () => {
    memory.setItem("bad", "{not-json");

    const storage = createSerovalStorage<{ count: number }>(() => memory)!;
    expect(await storage.getItem("bad")).toBeNull();
  });

  it("clearCorruptOnFailure removes the key on a corrupt seroval payload", async () => {
    memory.setItem("corrupt", "{not-json");

    const storage = createSerovalStorage<{ count: number }>(() => memory, {
      clearCorruptOnFailure: true,
    })!;

    expect(await storage.getItem("corrupt")).toBeNull();
    expect(memory.getItem("corrupt")).toBeNull();
  });

  it("idb-keyval-shaped async backend works end-to-end (async-backend recipe)", async () => {
    // Mirrors idb-keyval's contract: fully async get/set/del, and get resolves
    // `undefined` (not `null`) for missing keys — the recipe maps it via
    // `?? null`, and persistSource's `!= null` guard tolerates a raw
    // `undefined` from out-of-contract storages regardless.
    const idb = new Map<string, string>();
    const idbStorage: StateStorage = {
      getItem: (name) => Promise.resolve(idb.get(name) ?? null),
      setItem: (name, value) => {
        idb.set(name, value);
        return Promise.resolve();
      },
      removeItem: (name) => {
        idb.delete(name);
        return Promise.resolve();
      },
    };
    const storage = createSerovalStorage<{ tags: Set<string> }>(
      () => idbStorage,
      { clearCorruptOnFailure: true },
    )!;

    const source = createMockSource({ tags: new Set<string>() });
    const persist = persistSource(source, { name: "idb", storage });
    await waitForHydration(persist.hasHydrated);

    source.setState(() => ({ tags: new Set(["a", "b"]) }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const stored = await storage.getItem("idb");
    expect(stored?.state.tags).toEqual(new Set(["a", "b"]));

    // Fresh source hydrates from the async backend (rehydrate is awaitable).
    const source2 = createMockSource({ tags: new Set<string>() });
    const persist2 = persistSource(source2, {
      name: "idb",
      storage,
      skipHydration: true,
    });
    await persist2.rehydrate();
    expect(source2.state.tags).toEqual(new Set(["a", "b"]));

    persist.destroy();
    persist2.destroy();
  });
});

describe("serovalCodec direct seam", () => {
  let memory: MemoryStorage;

  beforeEach(() => {
    memory = new MemoryStorage();
  });

  it("serovalCodec plugs into createStorage directly (frozen-API symmetry with jsonCodec)", async () => {
    const storage = createStorage<{ tags: Set<string> }>(
      () => memory,
      serovalCodec<{ tags: Set<string> }>(),
    )!;

    await storage.setItem("direct-seroval", {
      state: { tags: new Set(["a"]) },
      version: 0,
    });
    const stored = await storage.getItem("direct-seroval");
    expect(stored?.state.tags instanceof Set).toBe(true);
    expect(stored?.state.tags.has("a")).toBe(true);
  });
});

describe("seroval dependency isolation", () => {
  it("imports only from core (no cross-adapter coupling)", async () => {
    const source = await Bun.file(
      new URL("./seroval.ts", import.meta.url),
    ).text();
    const relativeImports = [
      ...source.matchAll(/from\s+["'](\.\.?\/[^"']+)["']/g),
    ].map((match) => match[1]);
    for (const importPath of relativeImports) {
      expect(importPath).toMatch(/^\.\.\/\.\.\/core\//);
    }
  });
});
