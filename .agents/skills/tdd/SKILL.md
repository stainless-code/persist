---
name: tdd
description: Test-driven development with vertical tracer-bullet slices. Use when building test-first, red-green-refactor, or when the user mentions TDD.
---

# Test-driven development

Vertical RED→GREEN cycles — **one behavior per loop**, not horizontal "all tests then all code". Aligns with [`tracer-bullets`](../../rules/tracer-bullets.md) and [`verify-after-each-step`](../../rules/verify-after-each-step.md).

## This repo

- Runner split per `docs/architecture.md` § Test matrix:
  - `bun test <co-located *.test.ts>` — `src/**` unit tests (core, codecs, backends, TanStack adapters, `useHydrated` SSR/snapshot contracts). No DOM.
  - `bun run test:dom` — `tests-dom/**/*.test.tsx` (vitest + jsdom + @testing-library/react) for `useHydrated` rerender / unmount / `useSyncExternalStore` reactivity.
- Co-locate tests next to the module (`src/core/persist-core.ts` → `src/core/persist-core.test.ts`).
- After each GREEN: format/lint/typecheck per [`verify-after-each-step`](../../rules/verify-after-each-step.md).
- Mock at the **storage backend seam** (`StateStorage`), never inside `persist-core` or a codec. See [`PATTERNS.md`](./PATTERNS.md).

## Workflow

### 1. Planning

Confirm **behaviors** to test (not implementation steps) with the user. Prefer deep modules — small public surface (`persistSource`, `createStorage`, a codec factory), complex internals.

### 2. Tracer bullet (within slice)

```
RED:   one test for first behavior → bun test <file>   (or test:dom for hydration rerenders)
GREEN: minimal code to pass → re-run
```

### 3. Incremental loop

For each behavior: RED → GREEN → run affected tests. One test at a time; no speculative features.

### 4. Refactor

After GREEN — look for duplication, long methods, shallow modules, feature envy. Run `bun test <file>` after each step. **Never refactor while RED.** For production polish on a completed slice, [`harden-pr`](../harden-pr/SKILL.md) lite may run in parallel with tracer-bullet commits.

## Checklist per cycle

```
[ ] Test describes behavior, not implementation
[ ] Test uses the public seam only (persistSource / createStorage / a codec / useHydrated)
[ ] Test would survive an internal refactor
[ ] Code is minimal for this test
[ ] bun test (or test:dom) passes on touched file(s)
```

## Reference

- Good/bad test patterns + mock boundaries: [`PATTERNS.md`](./PATTERNS.md)
- Slice cadence: [`tracer-bullets`](../../rules/tracer-bullets.md) · Verify: [`verify-after-each-step`](../../rules/verify-after-each-step.md)
