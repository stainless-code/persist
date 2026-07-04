import { describe, expect, it } from "bun:test";

import { effect, effectScope } from "vue";

import { useHydrated } from "./persist-vue";

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

describe("useHydrated (vue)", () => {
  it("returns a ref that stays true when signal is null", () => {
    const hydrated = useHydrated(null);
    expect(hydrated.value).toBe(true);
  });

  it("reflects isHydrated() and updates reactively inside an effectScope", () => {
    const signal = createFakeSignal();
    const scope = effectScope();
    scope.run(() => {
      const h = useHydrated(signal);
      let last: boolean | undefined;
      effect(() => {
        last = h.value;
      });
      expect(last).toBe(false);
      signal.set(true);
      expect(last).toBe(true);
    });
    scope.stop();
  });

  it("cleans up subscription on scope.stop() and stops updating the ref", () => {
    const signal = createFakeSignal();
    const scope = effectScope();
    let hydratedRef: ReturnType<typeof useHydrated> | undefined;
    scope.run(() => {
      hydratedRef = useHydrated(signal);
      effect(() => {
        hydratedRef!.value;
      });
    });
    expect(signal.listenerCount()).toBe(1);
    scope.stop();
    expect(signal.listenerCount()).toBe(0);
    const lastValue = hydratedRef!.value;
    signal.set(true);
    expect(hydratedRef!.value).toBe(lastValue);
  });

  it("no sibling entry IMPORTS persist-vue (dependency isolation)", async () => {
    // Each entry owns its dependency; importing persist-vue is the vue opt-in.
    // Core/seroval/tanstack/hydration must never pull it in (doc comments may
    // mention it — only import lines count).
    for (const sibling of [
      "persist-core.ts",
      "persist-seroval.ts",
      "persist-idb.ts",
      "persist-crosstab.ts",
      "persist-zod.ts",
      "persist-tanstack.ts",
      "persist-solid.ts",
      "hydration.ts",
      "use-hydrated.ts",
      "index.ts",
    ]) {
      const url = new URL(`./${sibling}`, import.meta.url);
      if (!(await Bun.file(url).exists())) continue;
      const source = await Bun.file(url).text();
      // Declaration-level matching (not per-line): a formatter can wrap an
      // import across lines, which a `^import` line filter would miss. Any
      // `from "./persist-vue"` clause or dynamic `import("./persist-vue")`
      // is an import regardless of layout; doc-comment mentions never carry
      // the from/import() syntax.
      const offendingImports = source.match(
        /(?:from\s+|import\s*\(\s*)["']\.\/persist-vue["']/g,
      );
      expect(offendingImports).toBeNull();
    }
  });
});
