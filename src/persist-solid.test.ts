import { beforeAll, describe, expect, it, mock } from "bun:test";

// Bun resolves `solid-js` to the SSR build (`createEffect` is a no-op). Point
// both the test and persist-solid at the client build for reactive coverage.
mock.module(
  "solid-js",
  // @ts-expect-error client bundle — no `.d.ts` subpath; runtime-only for tests.
  () => import("solid-js/dist/solid.js"),
);

let createEffect: typeof import("solid-js").createEffect;
let createRoot: typeof import("solid-js").createRoot;
let useHydrated: typeof import("./persist-solid").useHydrated;

beforeAll(async () => {
  ({ createEffect, createRoot } = await import("solid-js"));
  ({ useHydrated } = await import("./persist-solid"));
});

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

/** Solid schedules effects as microtasks — flush before asserting on `last`. */
async function flushEffects() {
  for (let i = 0; i < 5; i++) {
    await new Promise<void>((resolve) => queueMicrotask(resolve));
  }
}

describe("useHydrated", () => {
  it("returns always-true accessor for null signal", () => {
    const h = useHydrated(null);
    expect(h()).toBe(true);
    expect(h()).toBe(true);
  });

  it("reflects isHydrated and updates reactively", async () => {
    const signal = createFakeSignal();
    await createRoot(async (dispose: () => void) => {
      const h = useHydrated(signal);
      let last: boolean | undefined;
      createEffect(() => {
        last = h();
      });
      await flushEffects();
      expect(last).toBe(false);
      signal.set(true);
      await flushEffects();
      expect(last).toBe(true);
      signal.set(false);
      await flushEffects();
      expect(last).toBe(false);
      dispose();
    });
  });

  it("cleans up subscription on scope dispose", async () => {
    const signal = createFakeSignal();
    await createRoot(async (dispose: () => void) => {
      const h = useHydrated(signal);
      let last: boolean | undefined;
      createEffect(() => {
        last = h();
      });
      await flushEffects();
      expect(last).toBe(false);
      expect(signal.listenerCount()).toBe(1);
      dispose();
      await flushEffects();
      expect(signal.listenerCount()).toBe(0);
      expect(() => signal.set(true)).not.toThrow();
      await flushEffects();
      expect(last).toBe(false);
    });
  });
});

describe("persist-solid entry isolation", () => {
  it("no sibling entry IMPORTS persist-solid (dependency isolation)", async () => {
    for (const sibling of [
      "persist-core.ts",
      "persist-seroval.ts",
      "persist-idb.ts",
      "persist-crosstab.ts",
      "persist-zod.ts",
      "persist-tanstack.ts",
      "persist-vue.ts",
      "hydration.ts",
      "use-hydrated.ts",
      "index.ts",
    ]) {
      const url = new URL(`./${sibling}`, import.meta.url);
      if (!(await Bun.file(url).exists())) continue;
      const source = await Bun.file(url).text();
      const offendingImports = source.match(
        /(?:from\s+|import\s*\(\s*)["']\.\/persist-solid["']/g,
      );
      expect(offendingImports).toBeNull();
    }
  });
});
