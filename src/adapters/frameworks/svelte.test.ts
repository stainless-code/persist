import { describe, expect, it } from "bun:test";

import { itImportsOnlyFromCore } from "../../testing/assert-core-only-imports";
import { hydratedRune } from "./svelte";

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

describe("hydratedRune (svelte 5 runes)", () => {
  it("returns current=true for a null/undefined signal", () => {
    expect(hydratedRune(null).current).toBe(true);
    expect(hydratedRune(undefined).current).toBe(true);
  });

  it("current mirrors isHydrated() on each access (value contract)", () => {
    const signal = createFakeSignal();
    const rune = hydratedRune(signal);
    expect(rune.current).toBe(false);
    signal.set(true);
    expect(rune.current).toBe(true);
    signal.set(false);
    expect(rune.current).toBe(false);
  });

  // The reactive auto-update + subscription cleanup need a Svelte component
  // context (`createSubscriber`'s start runs lazily inside an owner); outside
  // one, `subscribe()` is a no-op. The HydrationSignal contract that wiring
  // rides on is pinned in `core/hydration.test.ts`; the value contract above
  // is what's exercisable in bun.
});

describe("svelte dependency isolation", () => {
  itImportsOnlyFromCore(new URL("./svelte.ts", import.meta.url));
});
