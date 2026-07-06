import { beforeAll, describe, expect, it, mock } from "bun:test";

import { itImportsOnlyFromCore } from "../../testing/assert-core-only-imports";

// Minimal Angular signals stub — signal() + effect() without an injection
// context. effect() runs immediately + registers cleanup via its callback arg.
const cleanups: Array<() => void> = [];

mock.module("@angular/core", () => ({
  signal: <T>(initial: T) => {
    let value = initial;
    const sig = Object.assign(() => value, {
      set(v: T) {
        value = v;
      },
      update(fn: (prev: T) => T) {
        value = fn(value);
      },
      asReadonly() {
        return sig;
      },
    });
    return sig;
  },
  effect: (fn: (onCleanup: (cleanup: () => void) => void) => void) => {
    fn((cleanup) => {
      cleanups.push(cleanup);
    });
  },
}));

let useHydrated: typeof import("./angular").useHydrated;

beforeAll(async () => {
  ({ useHydrated } = await import("./angular"));
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

function runCleanups() {
  for (const cleanup of cleanups.splice(0)) {
    cleanup();
  }
}

describe("useHydrated", () => {
  it("returns an always-true signal for a null/undefined signal", () => {
    expect(useHydrated(null)()).toBe(true);
    expect(useHydrated(undefined)()).toBe(true);
  });

  it("current mirrors isHydrated() on each access", () => {
    const signal = createFakeSignal();
    const hydrated = useHydrated(signal);
    expect(hydrated()).toBe(false);
    signal.set(true);
    expect(hydrated()).toBe(true);
    signal.set(false);
    expect(hydrated()).toBe(false);
  });

  it("cleans up on context destroy", () => {
    const signal = createFakeSignal();
    useHydrated(signal);
    expect(signal.listenerCount()).toBe(1);
    runCleanups();
    expect(signal.listenerCount()).toBe(0);
  });
});

describe("angular dependency isolation", () => {
  itImportsOnlyFromCore(new URL("./angular.ts", import.meta.url));
});
