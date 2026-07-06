import { describe, expect, it } from "bun:test";

import * as React from "react";
import { renderToString } from "react-dom/server";

import { alwaysHydratedSignal, toHydrationSignal } from "../../core/hydration";
import { createJSONStorage, persistSource } from "../../core/persist-core";
import { itImportsOnlyFromCore } from "../../testing/assert-core-only-imports";
import { MemoryStorage } from "../../testing/memory-storage";
import { createMockSource } from "../../testing/mock-source";
import { waitForHydration } from "../../testing/wait-for-hydration";
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
  itImportsOnlyFromCore(new URL("./react.ts", import.meta.url));
});
