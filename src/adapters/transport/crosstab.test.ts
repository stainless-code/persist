import { describe, expect, it } from "bun:test";

import { persistSource } from "../../core/persist-core";
import type { PersistStorage, StorageValue } from "../../core/persist-core";
import { itImportsOnlyFromCore } from "../../testing/assert-core-only-imports";
import { createMockSource } from "../../testing/mock-source";
import { waitForHydration } from "../../testing/wait-for-hydration";
import { createBroadcastCrossTab } from "./crosstab";

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

  it("removeItem broadcast → receiving-tab onCrossTabRemove", async () => {
    const shared = new Map<string, StorageValue<{ count: number }>>();
    const channelName = `remove-${Math.random()}`;

    const bridgeA = createBroadcastCrossTab<{ count: number }>({
      channelName,
    })!;
    const bridgeB = createBroadcastCrossTab<{ count: number }>({
      channelName,
    })!;

    const sourceA = createMockSource({ count: 0 });
    const sourceB = createMockSource({ count: 0 });

    const persistA = persistSource(sourceA, {
      name: "remove-key",
      storage: bridgeA.wrap(createSharedAsyncStorage(shared)),
      crossTab: true,
      crossTabEventTarget: bridgeA.crossTabEventTarget,
    });

    let removeCalls = 0;
    const persistB = persistSource(sourceB, {
      name: "remove-key",
      storage: bridgeB.wrap(createSharedAsyncStorage(shared)),
      skipHydration: true,
      crossTab: true,
      crossTabEventTarget: bridgeB.crossTabEventTarget,
      onCrossTabRemove: () => {
        removeCalls++;
        sourceB.setState(() => ({ count: 0 }));
      },
    });

    await waitForHydration(persistA.hasHydrated);
    // Seed a non-default value so the removal is meaningful.
    sourceA.setState(() => ({ count: 7 }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await waitForHydration(persistB.hasHydrated);

    // Tab A clears → bridge posts newValue:null → tab B's onCrossTabRemove fires.
    await persistA.clearStorage();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(removeCalls).toBe(1);

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

  itImportsOnlyFromCore(new URL("./crosstab.ts", import.meta.url));
});
