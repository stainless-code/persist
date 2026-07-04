import { describe, expect, it, mock } from "bun:test";

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
  it("imports only from core (no cross-adapter coupling)", async () => {
    const source = await Bun.file(
      new URL("./preact.ts", import.meta.url),
    ).text();
    const relativeImports = [
      ...source.matchAll(/from\s+["'](\.\.?\/[^"']+)["']/g),
    ].map((m) => m[1]);
    for (const imp of relativeImports) {
      expect(imp).toMatch(/^\.\.\/\.\.\/core\//);
    }
  });
});
