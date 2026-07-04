import { describe, expect, it } from "bun:test";

import * as React from "react";
import { renderToString } from "react-dom/server";

import { alwaysHydratedSignal, toHydrationSignal } from "../../core/hydration";
import { createJSONStorage, persistSource } from "../../core/persist-core";
import type { PersistableSource, StateStorage } from "../../core/persist-core";
import { useHydrated } from "./react";

/**
 * `bun test` has no DOM, so we can't drive `useSyncExternalStore` reactivity
 * with a client renderer. We assert the contracts the adapter guarantees:
 *
 *  1. SSR safety — `renderToString` invokes `getServerSnapshot`, which must
 *     return `true` regardless of the signal's real hydration state (server
 *     has no storage, so nothing to gate). This is the constraint-critical path.
 *  2. Snapshot value — on the client `useHydrated` returns exactly
 *     `signal.isHydrated()` (or `true` for a null/undefined signal). The
 *     reactivity wiring (`onHydrate` + `onFinishHydration` → rerender) needs
 *     a DOM renderer and is not exercised here; `hydration.test.ts` pins the
 *     subscribe/notify contract that wiring rides on.
 */

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

function Probe({ signal }: { signal: Parameters<typeof useHydrated>[0] }) {
  const { hydrated } = useHydrated(signal);
  return React.createElement("span", null, String(hydrated));
}

describe("useHydrated", () => {
  it("SSR returns true for a null signal (no persistence layer)", () => {
    const html = renderToString(React.createElement(Probe, { signal: null }));
    expect(html).toContain("true");
  });

  it("SSR returns true for an undefined signal", () => {
    const html = renderToString(
      React.createElement(Probe, { signal: undefined }),
    );
    expect(html).toContain("true");
  });

  it("SSR returns true even when the signal has not hydrated", async () => {
    const memory = new MemoryStorage();
    const storage = createJSONStorage<{ count: number }>(() => memory)!;
    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, { name: "ssr-unhydrated", storage });
    const signal = toHydrationSignal(persist)!;

    // Client snapshot is false pre-hydration, but the server must still
    // render `true` (getServerSnapshot is independent of getSnapshot).
    expect(signal.isHydrated()).toBe(false);
    const html = renderToString(React.createElement(Probe, { signal }));
    expect(html).toContain("true");

    await waitForHydration(persist.hasHydrated);
  });

  it("SSR returns true for an alwaysHydratedSignal", () => {
    const signal = alwaysHydratedSignal();
    const html = renderToString(React.createElement(Probe, { signal }));
    expect(html).toContain("true");
  });

  it("client snapshot mirrors signal.isHydrated() across the lifecycle", async () => {
    const memory = new MemoryStorage();
    const storage = createJSONStorage<{ count: number }>(() => memory)!;
    const source = createMockSource({ count: 0 });
    const persist = persistSource(source, { name: "client-snapshot", storage });
    const signal = toHydrationSignal(persist)!;

    // The hook's getSnapshot is `signal.isHydrated()` (null collapses to true).
    expect(signal.isHydrated()).toBe(false);
    await waitForHydration(persist.hasHydrated);
    expect(signal.isHydrated()).toBe(true);

    // A rehydrate flips it back to false, then true again — the subscribe
    // wiring (onHydrate + onFinishHydration) is what surfaces this to React.
    void persist.rehydrate();
    expect(signal.isHydrated()).toBe(false);
    await waitForHydration(persist.hasHydrated);
    expect(signal.isHydrated()).toBe(true);
  });

  it("a noop api (storage unavailable) reports hydrated immediately", () => {
    // Neutralize any localStorage leaked by other test files in the same
    // process so resolveDefaultStorage can't fall back to it — forces the
    // noop-api path (storage unavailable → hasHydrated() === true).
    const savedLocalStorage = globalThis.localStorage;
    // @ts-expect-error intentionally undefined for this test
    delete globalThis.localStorage;
    try {
      const source = createMockSource({ count: 0 });
      const persist = persistSource(source, {
        name: "noop",
        storage: createJSONStorage(() => {
          throw new Error("no storage");
        })!,
      });
      const signal = toHydrationSignal(persist)!;
      expect(signal.isHydrated()).toBe(true);
      const html = renderToString(React.createElement(Probe, { signal }));
      expect(html).toContain("true");
    } finally {
      if (savedLocalStorage === undefined) {
        // @ts-expect-error -- restore the bun runtime default (no localStorage)
        delete globalThis.localStorage;
      } else {
        globalThis.localStorage = savedLocalStorage;
      }
    }
  });
});

describe("react dependency isolation", () => {
  it("imports only from core (no cross-adapter coupling)", async () => {
    const source = await Bun.file(
      new URL("./react.ts", import.meta.url),
    ).text();
    const relativeImports = [
      ...source.matchAll(/from\s+["'](\.\.?\/[^"']+)["']/g),
    ].map((match) => match[1]);
    for (const importPath of relativeImports) {
      expect(importPath).toMatch(/^\.\.\/\.\.\/core\//);
    }
  });
});
