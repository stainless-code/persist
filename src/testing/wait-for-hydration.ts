/**
 * Poll `hasHydrated()` on microtasks until true (or `maxTicks` exceeded).
 * For backends that settle on **macrotasks** (e.g. `node:fs` I/O), write a
 * local `setTimeout`-based variant — microtasks never yield there.
 * Test-only; not shipped in `dist/`.
 */
export function waitForHydration(
  hasHydrated: () => boolean,
  maxTicks = 10_000,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let ticks = 0;
    const tick = () => {
      if (hasHydrated()) {
        resolve();
        return;
      }
      // Bounded: a hydration regression fails loudly here instead of hanging
      // the suite until the runner's opaque timeout.
      if (++ticks > maxTicks) {
        reject(new Error("waitForHydration: never hydrated"));
        return;
      }
      queueMicrotask(tick);
    };
    tick();
  });
}
