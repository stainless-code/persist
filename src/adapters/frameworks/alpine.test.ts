import { afterEach, describe, expect, it, spyOn } from "bun:test";

import { itImportsOnlyFromCore } from "../../testing/assert-core-only-imports";
import type { AlpineLike, HydratedBag } from "./alpine";
import persist, { useHydrated } from "./alpine";

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

type MagicFn = (
  el: Element,
  utils: { Alpine: AlpineLike; cleanup?: (fn: () => void) => void },
) => unknown;

function createMockAlpine(): AlpineLike & { magics: Map<string, MagicFn> } {
  const magics = new Map<string, MagicFn>();
  return {
    magics,
    reactive: (o) => o,
    magic(name, fn) {
      magics.set(name, fn);
    },
  };
}

describe("useHydrated / persist (alpine)", () => {
  itImportsOnlyFromCore(new URL("./alpine.ts", import.meta.url));

  afterEach(() => {
    // Keep a mock runtime installed so later tests don't trip the missing-plugin warn.
    persist(createMockAlpine());
  });

  it("null signal → hydrated true (no subscribe)", () => {
    persist(createMockAlpine());
    const bag = useHydrated(null);
    expect(bag.hydrated).toBe(true);
    bag.destroy();
  });

  it("undefined signal → hydrated true", () => {
    persist(createMockAlpine());
    expect(useHydrated(undefined).hydrated).toBe(true);
  });

  it("signal flip updates bag.hydrated and calls Alpine.reactive", () => {
    const alpine = createMockAlpine();
    const reactiveCalls: object[] = [];
    alpine.reactive = (o) => {
      reactiveCalls.push(o);
      return o;
    };
    persist(alpine);
    const signal = createFakeSignal();
    const bag = useHydrated(signal);
    expect(reactiveCalls).toHaveLength(1);
    expect(bag.hydrated).toBe(false);
    expect(signal.listenerCount()).toBe(1);

    signal.set(true);
    expect(bag.hydrated).toBe(true);

    signal.set(false);
    expect(bag.hydrated).toBe(false);

    bag.destroy();
    expect(signal.listenerCount()).toBe(0);
    signal.set(true);
    expect(bag.hydrated).toBe(false);
  });

  it("plugin registers $hydrated magic", () => {
    const alpine = createMockAlpine();
    persist(alpine);

    expect(alpine.magics.has("hydrated")).toBe(true);
    const magic = alpine.magics.get("hydrated")!;
    const el = {} as Element;
    const cleanups: Array<() => void> = [];
    const fn = magic(el, {
      Alpine: alpine,
      cleanup: (cb) => cleanups.push(cb),
    }) as (signal: ReturnType<typeof createFakeSignal> | null) => HydratedBag;

    const signal = createFakeSignal();
    const bag = fn(signal);
    expect(bag.hydrated).toBe(false);
    expect(fn(signal)).toBe(bag);

    signal.set(true);
    expect(bag.hydrated).toBe(true);

    for (const c of cleanups) c();
    expect(signal.listenerCount()).toBe(0);
  });
});

describe("useHydrated before plugin (isolated)", () => {
  it("warns once when useHydrated runs before Alpine.plugin(persist)", async () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    const mod = await import(`./alpine.ts?pre-plugin=${Date.now()}`);
    expect(mod.useHydrated(null).hydrated).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain("Alpine.plugin(persist)");

    mod.useHydrated(null);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
