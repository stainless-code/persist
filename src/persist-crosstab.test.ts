import { describe, expect, it } from "bun:test";

import { persistSource } from "./persist-core";
import type {
  PersistableSource,
  PersistStorage,
  StorageValue,
} from "./persist-core";
import { createBroadcastCrossTab } from "./persist-crosstab";

function createSharedAsyncStorage<S>(
  shared: Map<string, StorageValue<S>>,
): PersistStorage<S> {
  return {
    raw: shared,
    getItem: (name) => Promise.resolve(shared.get(name) ?? null),
    setItem: (name, value) => {
      shared.set(name, value);
      return Promise.resolve();
    },
    removeItem: (name) => {
      shared.delete(name);
      return Promise.resolve();
    },
  };
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
      if (++ticks > maxTicks) {
        reject(new Error("waitForHydration: never hydrated"));
        return;
      }
      queueMicrotask(tick);
    };
    tick();
  });
}

function waitForState<T>(
  getState: () => T,
  expected: T,
  equals: (a: T, b: T) => boolean = (a, b) =>
    JSON.stringify(a) === JSON.stringify(b),
  maxTicks = 10_000,
) {
  return new Promise<void>((resolve, reject) => {
    let ticks = 0;
    const tick = () => {
      if (equals(getState(), expected)) {
        resolve();
        return;
      }
      if (++ticks > maxTicks) {
        reject(new Error("waitForState: state never matched"));
        return;
      }
      queueMicrotask(tick);
    };
    tick();
  });
}

describe("createBroadcastCrossTab", () => {
  it("returns undefined when BroadcastChannel is unavailable", () => {
    const original = globalThis.BroadcastChannel;
    try {
      // @ts-expect-error — simulating SSR / Node <18
      delete globalThis.BroadcastChannel;
      expect(
        createBroadcastCrossTab({ channelName: "missing" }),
      ).toBeUndefined();
    } finally {
      globalThis.BroadcastChannel = original;
    }
  });

  it("two tabs sync via BroadcastChannel", async () => {
    const shared = new Map<string, StorageValue<{ count: number }>>();
    const channelName = `sync-${Math.random()}`;

    const bridgeA = createBroadcastCrossTab<{ count: number }>({
      channelName,
    })!;
    const bridgeB = createBroadcastCrossTab<{ count: number }>({
      channelName,
    })!;

    const sourceA = createMockSource({ count: 0 });
    const sourceB = createMockSource({ count: 0 });

    const persistA = persistSource(sourceA, {
      name: "sync-key",
      storage: bridgeA.wrap(createSharedAsyncStorage(shared)),
      crossTab: true,
      crossTabEventTarget: bridgeA.crossTabEventTarget,
    });

    const persistB = persistSource(sourceB, {
      name: "sync-key",
      storage: bridgeB.wrap(createSharedAsyncStorage(shared)),
      skipHydration: true,
      crossTab: true,
      crossTabEventTarget: bridgeB.crossTabEventTarget,
    });

    await waitForHydration(persistA.hasHydrated);

    sourceA.setState(() => ({ count: 42 }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    await waitForState(() => sourceB.state, { count: 42 });

    persistA.destroy();
    persistB.destroy();
    bridgeA.close();
    bridgeB.close();
  });

  it("wrap preserves raw", () => {
    const sentinel = {};
    const storage: PersistStorage<{ x: number }> = {
      raw: sentinel,
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    };

    const bridge = createBroadcastCrossTab<{ x: number }>({
      channelName: "raw-test",
    })!;
    const wrapped = bridge.wrap(storage);

    expect(wrapped.raw).toBe(sentinel);
    bridge.close();
  });

  it("close stops delivery", async () => {
    const channelName = `close-${Math.random()}`;
    const bridge = createBroadcastCrossTab({ channelName })!;

    let fired = false;
    const listener = () => {
      fired = true;
    };
    bridge.crossTabEventTarget.addEventListener("storage", listener);

    bridge.close();

    const poster = new BroadcastChannel(channelName);
    poster.postMessage({
      key: "k",
      newValue: 1,
      storageArea: null,
    });
    poster.close();

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fired).toBe(false);
  });

  it("no sibling entry IMPORTS persist-crosstab (dependency isolation)", async () => {
    for (const sibling of [
      "persist-core.ts",
      "persist-seroval.ts",
      "persist-idb.ts",
      "persist-tanstack.ts",
      "hydration.ts",
      "use-hydrated.ts",
      "index.ts",
    ]) {
      const source = await Bun.file(
        new URL(`./${sibling}`, import.meta.url),
      ).text();
      const offendingImports = source.match(
        /(?:from\s+|import\s*\(\s*)["']\.\/persist-crosstab["']/g,
      );
      expect(offendingImports).toBeNull();
    }
  });
});
