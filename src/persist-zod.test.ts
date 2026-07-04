import { beforeEach, describe, expect, it } from "bun:test";

import { z } from "zod";

import { createStorage, persistSource } from "./persist-core";
import type { PersistableSource, StateStorage } from "./persist-core";
import { createZodStorage, zodCodec } from "./persist-zod";

class MemoryStorage implements StateStorage {
  private store = new Map<string, string>();

  clear() {
    this.store.clear();
  }

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}

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

describe("zodCodec", () => {
  let memory: MemoryStorage;

  beforeEach(() => {
    memory = new MemoryStorage();
  });

  it("round-trips typed state through a zod schema", async () => {
    const schema = z.object({ count: z.number() });
    const storage = createZodStorage<{ count: number }>(() => memory, schema)!;

    await storage.setItem("test", {
      state: { count: 42 },
      version: 1,
    });

    const stored = await storage.getItem("test");
    expect(stored?.state.count).toBe(42);
    expect(stored?.version).toBe(1);
  });

  it("decode of an invalid payload returns null", async () => {
    memory.setItem("bad", JSON.stringify({ state: { count: "not-a-number" } }));

    const schema = z.object({ count: z.number() });
    const storage = createZodStorage<{ count: number }>(() => memory, schema)!;
    expect(await storage.getItem("bad")).toBeNull();
  });

  it("clearCorruptOnFailure removes the key on an invalid payload", async () => {
    memory.setItem("corrupt", JSON.stringify({ state: { count: "bad" } }));

    const schema = z.object({ count: z.number() });
    const storage = createZodStorage<{ count: number }>(() => memory, schema, {
      clearCorruptOnFailure: true,
    })!;

    expect(await storage.getItem("corrupt")).toBeNull();
    expect(memory.getItem("corrupt")).toBeNull();
  });

  it("encode of an invalid state throws and abandons the write", async () => {
    const schema = z.object({ count: z.number() });
    const errors: Array<{ phase: string }> = [];
    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, {
      name: "invalid-write",
      storage: createZodStorage<{ count: number }>(() => memory, schema)!,
      onError: (_error, context) => errors.push({ phase: context.phase }),
    });

    await waitForHydration(persist.hasHydrated);

    source.setState(
      () => ({ count: "not-a-number" }) as unknown as { count: number },
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(memory.getItem("invalid-write")).toBeNull();
    expect(errors.some((entry) => entry.phase === "write")).toBe(true);

    persist.destroy();
  });
});

describe("zodCodec direct seam", () => {
  let memory: MemoryStorage;

  beforeEach(() => {
    memory = new MemoryStorage();
  });

  it("zodCodec plugs into createStorage directly (frozen-API symmetry with serovalCodec)", async () => {
    const schema = z.object({ count: z.number() });
    const storage = createStorage<{ count: number }>(
      () => memory,
      zodCodec(schema),
    )!;

    await storage.setItem("direct-zod", {
      state: { count: 7 },
      version: 0,
    });
    const stored = await storage.getItem("direct-zod");
    expect(stored?.state.count).toBe(7);
  });
});

describe("persist-zod dependency isolation", () => {
  it("no sibling entry IMPORTS persist-zod (dependency isolation)", async () => {
    // Each entry owns its dependency; importing persist-zod is the zod
    // opt-in. Core/seroval/idb/tanstack/hydration must never pull it in (doc
    // comments may mention it — only import lines count).
    for (const sibling of [
      "persist-core.ts",
      "persist-seroval.ts",
      "persist-idb.ts",
      "persist-crosstab.ts",
      "persist-tanstack.ts",
      "hydration.ts",
      "use-hydrated.ts",
      "index.ts",
    ]) {
      const source = await Bun.file(
        new URL(`./${sibling}`, import.meta.url),
      ).text();
      const offendingImports = source.match(
        /(?:from\s+|import\s*\(\s*)["']\.\/persist-zod["']/g,
      );
      expect(offendingImports).toBeNull();
    }
  });
});
