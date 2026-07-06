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

  it("skipPersist reset + onCrossTabRemove: no remove-echo loop across tabs", async () => {
    const shared = new Map<string, StorageValue<{ count: number }>>();
    shared.set("echo", { state: { count: 5 }, version: 0 });
    const channelName = `echo-${Math.random()}`;
    const bridgeA = createBroadcastCrossTab<{ count: number }>({
      channelName,
    })!;
    const bridgeB = createBroadcastCrossTab<{ count: number }>({
      channelName,
    })!;

    let removeCallsA = 0;
    let removeCallsB = 0;
    const sourceA = createMockSource({ count: 0 });
    const sourceB = createMockSource({ count: 0 });

    const persistA = persistSource(sourceA, {
      name: "echo",
      storage: bridgeA.wrap(createSharedAsyncStorage(shared)),
      crossTab: true,
      crossTabEventTarget: bridgeA.crossTabEventTarget,
      skipPersist: (s) => s.count === 0,
      onCrossTabRemove: () => {
        removeCallsA++;
        sourceA.setState(() => ({ count: 0 }));
      },
    });
    const persistB = persistSource(sourceB, {
      name: "echo",
      storage: bridgeB.wrap(createSharedAsyncStorage(shared)),
      crossTab: true,
      crossTabEventTarget: bridgeB.crossTabEventTarget,
      skipPersist: (s) => s.count === 0,
      onCrossTabRemove: () => {
        removeCallsB++;
        sourceB.setState(() => ({ count: 0 }));
      },
    });

    await waitForHydration(persistA.hasHydrated);
    await waitForHydration(persistB.hasHydrated);
    expect(sourceA.state.count).toBe(5);
    expect(sourceB.state.count).toBe(5);

    // Tab A resets to default → skipPersist removes + broadcasts. Tab B's
    // onCrossTabRemove resets → its skipPersist removeItem finds the key already
    // absent in the shared backend → must NOT re-broadcast (would loop).
    sourceA.setState(() => ({ count: 0 }));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(removeCallsB).toBe(1); // tab A's removal reached tab B once
    expect(removeCallsA).toBe(0); // tab B never echoed back
    expect(shared.get("echo")).toBeUndefined();

    persistA.destroy();
    persistB.destroy();
    bridgeA.close();
    bridgeB.close();
  });

  it("a failed setItem/removeItem does not broadcast", async () => {
    const channelName = `fail-${Math.random()}`;
    const bridgeA = createBroadcastCrossTab<{ x: number }>({ channelName })!;
    const bridgeB = createBroadcastCrossTab<{ x: number }>({ channelName })!;

    let posts = 0;
    bridgeB.crossTabEventTarget.addEventListener("storage", () => posts++);

    const failing: PersistStorage<{ x: number }> = {
      raw: undefined,
      getItem: () => ({ state: { x: 1 }, version: 0 }), // present → removeItem probe proceeds
      setItem: () => Promise.reject(new Error("write fail")),
      removeItem: () => Promise.reject(new Error("remove fail")),
    };
    const wrapped = bridgeA.wrap(failing);

    await expect(
      wrapped.setItem("k", { state: { x: 1 }, version: 0 }),
    ).rejects.toThrow();
    await expect(wrapped.removeItem("k")).rejects.toThrow();

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(posts).toBe(0);

    bridgeA.close();
    bridgeB.close();
  });

  it("removeEventListener stops delivery to that listener", async () => {
    const channelName = `rm-${Math.random()}`;
    const bridge = createBroadcastCrossTab({ channelName })!;
    const poster = new BroadcastChannel(channelName);

    let fired = 0;
    const listener = () => fired++;
    bridge.crossTabEventTarget.addEventListener("storage", listener);

    poster.postMessage({ key: "k", newValue: "1", storageArea: null });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fired).toBe(1);

    bridge.crossTabEventTarget.removeEventListener("storage", listener);
    poster.postMessage({ key: "k", newValue: "1", storageArea: null });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fired).toBe(1); // no second delivery after removeEventListener

    poster.close();
    bridge.close();
  });

  itImportsOnlyFromCore(new URL("./crosstab.ts", import.meta.url));
});
