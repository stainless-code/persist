import { describe, expect, it } from "bun:test";

import { get } from "svelte/store";

import { hydratedStore } from "./svelte-store";

function createFakeSignal() {
  let hydrated = false;
  const listeners = new Set<() => void>();
  return {
    subscribeHydrated: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    isHydrated: () => hydrated,
    set: (value: boolean) => {
      hydrated = value;
      listeners.forEach((l) => l());
    },
    listenerCount: () => listeners.size,
  };
}

describe("hydratedStore (svelte 3+ stores)", () => {
  it("yields true for a null signal", () => {
    expect(get(hydratedStore(null))).toBe(true);
  });

  it("mirrors isHydrated() and pushes updates to subscribers", () => {
    const signal = createFakeSignal();
    const store = hydratedStore(signal);
    const values: boolean[] = [];
    const unsubscribe = store.subscribe((value) => values.push(value));

    // start runs on first subscribe → pushes the initial value (false).
    expect(values).toEqual([false]);
    signal.set(true);
    expect(values).toEqual([false, true]);
    signal.set(false);
    expect(values).toEqual([false, true, false]);

    unsubscribe();
    const lengthBefore = values.length;
    signal.set(true);
    expect(values.length).toBe(lengthBefore); // no more pushes after unsubscribe
  });

  it("subscribes to the signal on first subscriber and unsubscribes on the last", () => {
    const signal = createFakeSignal();
    const store = hydratedStore(signal);
    expect(signal.listenerCount()).toBe(0);

    const unsubscribe = store.subscribe(() => {});
    expect(signal.listenerCount()).toBe(1);

    unsubscribe();
    expect(signal.listenerCount()).toBe(0);
  });
});

describe("svelte-store dependency isolation", () => {
  it("imports only from core (no cross-adapter coupling)", async () => {
    const source = await Bun.file(
      new URL("./svelte-store.ts", import.meta.url),
    ).text();
    const relativeImports = [
      ...source.matchAll(/from\s+["'](\.\.?\/[^"']+)["']/g),
    ].map((match) => match[1]);
    for (const importPath of relativeImports) {
      expect(importPath).toMatch(/^\.\.\/\.\.\/core\//);
    }
  });
});
