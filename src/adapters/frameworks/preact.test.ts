import { describe, expect, it, mock } from "bun:test";

import { itImportsOnlyFromCore } from "../../testing/assert-core-only-imports";

mock.module("preact/compat", () => ({
  useSyncExternalStore: (
    _subscribe: (listener: () => void) => () => void,
    getSnapshot: () => boolean,
  ) => getSnapshot(),
}));

const { useHydrated } = await import("./preact");

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

describe("useHydrated", () => {
  it("returns hydrated=true for a null signal", () => {
    expect(useHydrated(null).hydrated).toBe(true);
  });

  it("returns hydrated=true for an undefined signal", () => {
    expect(useHydrated(undefined).hydrated).toBe(true);
  });

  it("current mirrors isHydrated()", () => {
    const signal = createFakeSignal();
    expect(useHydrated(signal).hydrated).toBe(false);
    signal.set(true);
    expect(useHydrated(signal).hydrated).toBe(true);
  });
});

describe("preact dependency isolation", () => {
  itImportsOnlyFromCore(new URL("./preact.ts", import.meta.url));
});
