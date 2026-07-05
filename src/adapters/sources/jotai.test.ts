import { beforeEach, describe, expect, it } from "bun:test";

import type { WritableAtom } from "jotai";

import { createJSONStorage } from "../../core/persist-core";
import { MemoryStorage } from "../../testing/memory-storage";
import { persistAtom } from "./jotai";

function createMockJotaiStore<T>(initialValue: T) {
  let value = initialValue;
  const listeners = new Set<() => void>();
  const atom = { toString: () => "mock-atom" } as WritableAtom<
    T,
    [T | ((prev: T) => T)],
    void
  >;
  const store = {
    get: <V>(_atom: unknown) => value as unknown as V,
    set: (_atom: unknown, newValue: unknown) => {
      value =
        typeof newValue === "function"
          ? (newValue as (prev: T) => T)(value)
          : (newValue as T);
      listeners.forEach((l) => l());
    },
    sub: (_atom: unknown, listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return {
    store: store as Parameters<typeof persistAtom>[0],
    atom,
    listenerCount: () => listeners.size,
    getValue: () => value,
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

describe("persistAtom", () => {
  let memory: MemoryStorage;

  beforeEach(() => {
    memory = new MemoryStorage();
  });

  it("round-trips through persistSource", async () => {
    const mock = createMockJotaiStore(0);
    const jsonStorage = createJSONStorage<number>(() => memory)!;
    await jsonStorage.setItem("count-atom", { state: 7, version: 0 });

    const persist = persistAtom(mock.store, mock.atom, {
      name: "count-atom",
      storage: jsonStorage,
    });

    await waitForHydration(persist.hasHydrated);
    expect(mock.getValue()).toBe(7);

    mock.store.set(mock.atom, 9);
    await new Promise((resolve) => queueMicrotask(resolve));

    const stored = await jsonStorage.getItem("count-atom");
    expect(stored?.state).toBe(9);

    const fresh = createMockJotaiStore(0);
    const rehydrate = persistAtom(fresh.store, fresh.atom, {
      name: "count-atom",
      storage: jsonStorage,
    });
    await waitForHydration(rehydrate.hasHydrated);
    expect(fresh.getValue()).toBe(9);
  });

  it("subscribe fires on setState", async () => {
    const mock = createMockJotaiStore(0);
    const jsonStorage = createJSONStorage<number>(() => memory)!;

    const persist = persistAtom(mock.store, mock.atom, {
      name: "subscribe-atom",
      storage: jsonStorage,
    });

    await waitForHydration(persist.hasHydrated);
    expect(mock.listenerCount()).toBe(1);

    mock.store.set(mock.atom, 42);
    await new Promise((resolve) => queueMicrotask(resolve));

    const stored = await jsonStorage.getItem("subscribe-atom");
    expect(stored?.state).toBe(42);
  });
});

describe("jotai dependency isolation", () => {
  it("imports only from core (no cross-adapter coupling)", async () => {
    const source = await Bun.file(
      new URL("./jotai.ts", import.meta.url),
    ).text();
    const relativeImports = [
      ...source.matchAll(/from\s+["'](\.\.?\/[^"']+)["']/g),
    ].map((match) => match[1]);
    for (const importPath of relativeImports) {
      expect(importPath).toMatch(/^\.\.\/\.\.\/core\//);
    }
  });
});
