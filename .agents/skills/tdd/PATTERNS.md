# Good and bad tests (this repo)

Loaded from [`tdd`](./SKILL.md). Two runners — pick by whether the behavior needs a DOM (see `docs/architecture.md` § Test matrix).

## Good tests

Integration-style through the **public seams** (`persistSource`, `createStorage`, a codec factory, `useHydrated`):

```ts
import { describe, expect, it } from "bun:test";
import { persistSource } from "./persist-core";
import { jsonCodec } from "./persist-core";
import { createStorage } from "./persist-core";

describe("persistSource", () => {
  it("rehydrates the stored envelope before first write", async () => {
    const backend = memoryBackend({
      key: "k",
      raw: jsonCodec.encode({ state: { n: 7 } }),
    });
    const storage = createStorage(backend, jsonCodec);
    const source = atomSource(() => ({ n: 0 }));
    const persist = persistSource(source, { key: "k", storage });
    await persist.rehydrate();
    expect(source.getState()).toEqual({ n: 7 });
  });
});
```

Characteristics:

- Observable behavior callers care about (hydrate, write, rehydrate, cross-tab, migrate)
- Public seam only — `persistSource` / `createStorage` / a `StorageCodec` / `useHydrated`
- Survives internal refactors of `persist-core`
- One logical assertion per test

## Bad tests

```ts
// BAD: mocks an internal helper of persist-core
vi.mock("./internal-gate", () => ({ isHydrated: () => true }));

// BAD: asserts call order on a private scheduler
expect(internalScheduler.flush).toHaveBeenCalledBefore(writeQueue.drain);

// BAD: reaches past the seam — reads the codec's internal cache
expect(codec.__cache.get("k")).toEqual(rawValue);

// BAD: depends on the backend's synchronous settle when the contract is async
expect(source.getState()).toEqual({ n: 7 }); // awaited rehydrate above — but the fix loop asserted sync
```

Red flags: mocking own modules under `src/`, testing private helpers, call-count assertions, tests that break on a rename-only refactor, assuming sync settle for an async `getItem`.

## Mock boundaries

Mock at the **storage backend seam** only:

- **OK to fake** — `StateStorage` (`getItem` / `setItem` / `removeItem`) with an in-memory map; a `PersistableSource` (`getState` / `setState` / `subscribe`) driven by the test; `crossTab` event payloads.
- **Don't mock** — `persist-core` internals, a `StorageCodec` under test (exercise the real codec against a faked backend), `useSyncExternalStore` (use the real hook via `tests-dom` + `renderHook`).

```ts
// GOOD: fake the backend, exercise the real codec + persist-core
const backend = memoryBackend({ key: "k", raw: encoded });
const storage = createStorage(backend, realCodec);
persistSource(source, { key: "k", storage });
```

Designing for mockability: the seam model already passes the backend and codec into `createStorage`/`persistSource` as arguments — no module-scope globals to wrestle with. Prefer a `memoryBackend()` test helper over mocking `localStorage` (sync) or `idb-keyval` (async) unless the bug only reproduces against the real backend.

## Component / hook tests (`tests-dom/`)

Test what a consumer sees through `useHydrated`, not React internals:

```tsx
// GOOD: behavior through the hook's return value
const { result } = renderHook(() => useHydrated(signal), { wrapper });
expect(result.current).toBe(true);

// BAD: asserts on internal subscription count
expect(store.__listeners.size).toBe(1);
```
