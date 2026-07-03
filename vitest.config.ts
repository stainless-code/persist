import { defineConfig } from "vitest/config";

// Framework-matrix tests that bun:test can't run — the React `useHydrated`
// reactivity path needs a DOM + a client renderer (`useSyncExternalStore`
// rerender + cleanup). Scoped to `tests-dom/**` so `bun test ./src` (the
// bun:test unit suite) and vitest NEVER both pick up the same files: bun:test
// is invoked as `bun test ./src` and never scans this top-level directory.
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests-dom/**/*.test.{ts,tsx}"],
    globals: false,
    // RTL auto-cleanup needs the test framework's afterEach; with globals off
    // we call cleanup() explicitly in the suite, so skip the auto setup.
    clearMocks: true,
    restoreMocks: true,
  },
});
