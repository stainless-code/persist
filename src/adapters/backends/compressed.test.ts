import { beforeEach, describe, expect, it } from "bun:test";

import { createStorage, persistSource } from "../../core/persist-core";
import type { PersistableSource, StateStorage } from "../../core/persist-core";
import { serovalCodec } from "../codecs/seroval";
import { createCompressedStorage } from "./compressed";

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

describe("createCompressedStorage", () => {
  let memory: MemoryStorage;

  beforeEach(() => {
    memory = new MemoryStorage();
  });

  it("round-trips: setItem then getItem returns the plaintext", async () => {
    const storage = createCompressedStorage(() => memory)!;
    const plaintext = "x".repeat(10_000);

    await storage.setItem("k", plaintext);
    expect(await storage.getItem("k")).toBe(plaintext);
  });

  it("the stored value is smaller than the plaintext (compression works)", async () => {
    const storage = createCompressedStorage(() => memory)!;
    const plaintext = "x".repeat(10_000);

    await storage.setItem("k", plaintext);
    const stored = memory.getItem("k")!;
    expect(stored.length).toBeLessThan(10_000);
  });

  it("getItem returns null for a missing key", async () => {
    const storage = createCompressedStorage(() => memory)!;
    expect(await storage.getItem("missing")).toBeNull();
  });

  it("supports gzip, deflate, deflate-raw formats", async () => {
    const formats = ["gzip", "deflate", "deflate-raw"] as const;
    const plaintext = "hello compression";

    for (const format of formats) {
      memory.clear();
      const storage = createCompressedStorage(() => memory, { format })!;
      await storage.setItem("k", plaintext);
      expect(await storage.getItem("k")).toBe(plaintext);
    }
  });

  it("composes with createStorage + persistSource end-to-end", async () => {
    const name = "compressed-persist";
    const storage = createStorage<{ count: number }>(
      () => createCompressedStorage(() => memory)!,
      serovalCodec(),
    )!;

    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, { name, storage });
    await waitForHydration(persist.hasHydrated);

    source.setState(() => ({ count: 7 }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const stored = memory.getItem(name)!;
    const plaintext = serovalCodec<{ count: number }>().encode({
      state: { count: 7 },
      version: 0,
    });
    expect(stored).not.toBe(plaintext);
    expect(stored).not.toContain('"count":7');

    const source2 = createMockSource({ count: 0 });
    const persist2 = persistSource(source2, {
      name,
      storage,
      skipHydration: true,
    });
    await persist2.rehydrate();
    expect(source2.state.count).toBe(7);

    persist.destroy();
    persist2.destroy();
  });

  it("returns undefined when CompressionStream is unavailable", () => {
    const original = globalThis.CompressionStream;
    try {
      // @ts-expect-error — simulating a runtime without CompressionStream
      delete globalThis.CompressionStream;
      if (typeof globalThis.CompressionStream !== "undefined") {
        // Non-configurable — fall back to getStorage-throws guard.
        expect(
          createCompressedStorage(() => {
            throw new Error("no backend");
          }),
        ).toBeUndefined();
        return;
      }
      expect(createCompressedStorage(() => memory)).toBeUndefined();
    } finally {
      globalThis.CompressionStream = original;
    }
  });

  it("imports only from core (no cross-adapter coupling)", async () => {
    const source = await Bun.file(
      new URL("./compressed.ts", import.meta.url),
    ).text();
    const relativeImports = [
      ...source.matchAll(/from\s+["'](\.\.?\/[^"']+)["']/g),
    ].map((match) => match[1]);
    for (const importPath of relativeImports) {
      expect(importPath).toMatch(/^\.\.\/\.\.\/core\//);
    }
  });
});
