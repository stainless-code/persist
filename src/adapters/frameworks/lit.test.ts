import { describe, expect, it, mock } from "bun:test";

import type { ReactiveControllerHost } from "lit";

import { itImportsOnlyFromCore } from "../../testing/assert-core-only-imports";
import { HydrationController } from "./lit";

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

function createFakeHost(): ReactiveControllerHost & {
  requestUpdate: ReturnType<typeof mock>;
  controllers: unknown[];
} {
  const controllers: unknown[] = [];
  return {
    controllers,
    addController(controller) {
      controllers.push(controller);
    },
    removeController() {},
    requestUpdate: mock(() => {}),
    updateComplete: Promise.resolve(true),
  };
}

describe("HydrationController (lit)", () => {
  itImportsOnlyFromCore(new URL("./lit.ts", import.meta.url));

  it("registers with the host and stays hydrated for a null signal", () => {
    const host = createFakeHost();
    const controller = new HydrationController(host, null);
    expect(host.controllers).toEqual([controller]);
    expect(controller.hydrated).toBe(true);
    controller.hostConnected();
    expect(host.requestUpdate).not.toHaveBeenCalled();
  });

  it("does not subscribe for undefined signal (hydrated stays true)", () => {
    const host = createFakeHost();
    const controller = new HydrationController(host, undefined);
    expect(controller.hydrated).toBe(true);
    controller.hostConnected();
    expect(host.requestUpdate).not.toHaveBeenCalled();
  });

  it("requestUpdate on signal flip and hydrated tracks isHydrated()", () => {
    const signal = createFakeSignal();
    const host = createFakeHost();
    const controller = new HydrationController(host, signal);
    expect(controller.hydrated).toBe(false);
    controller.hostConnected();
    expect(signal.listenerCount()).toBe(1);
    expect(host.requestUpdate).not.toHaveBeenCalled();

    signal.set(true);
    expect(host.requestUpdate).toHaveBeenCalledTimes(1);
    expect(controller.hydrated).toBe(true);

    signal.set(false);
    expect(host.requestUpdate).toHaveBeenCalledTimes(2);
    expect(controller.hydrated).toBe(false);
  });

  it("requestUpdate on connect when already hydrated", () => {
    const signal = createFakeSignal();
    signal.set(true);
    const host = createFakeHost();
    const controller = new HydrationController(host, signal);
    controller.hostConnected();
    expect(controller.hydrated).toBe(true);
    expect(host.requestUpdate).toHaveBeenCalledTimes(1);
  });

  it("hostDisconnected unsubscribes so further flips do not requestUpdate", () => {
    const signal = createFakeSignal();
    const host = createFakeHost();
    const controller = new HydrationController(host, signal);
    controller.hostConnected();
    expect(signal.listenerCount()).toBe(1);

    controller.hostDisconnected();
    expect(signal.listenerCount()).toBe(0);

    signal.set(true);
    expect(host.requestUpdate).not.toHaveBeenCalled();
    expect(controller.hydrated).toBe(true);
  });
});
