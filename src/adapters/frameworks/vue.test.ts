import { describe, expect, it } from "bun:test";

import { effect, effectScope } from "vue";

import { itImportsOnlyFromCore } from "../../testing/assert-core-only-imports";
import { useHydrated } from "./vue";

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
        void hydratedRef!.value;
      });
    });
    expect(signal.listenerCount()).toBe(1);
    scope.stop();
    expect(signal.listenerCount()).toBe(0);
    const lastValue = hydratedRef!.value;
    signal.set(true);
    expect(hydratedRef!.value).toBe(lastValue);
  });

  itImportsOnlyFromCore(new URL("./vue.ts", import.meta.url));
});
