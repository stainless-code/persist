---
name: diagnosing-bugs
description: Diagnosis loop for hard bugs and regressions. Use when the user says diagnose or debug this, or reports something broken, throwing, failing, or slow.
---

# Diagnosing Bugs

A discipline for hard bugs. Skip phases only when explicitly justified.

When exploring, read `docs/architecture.md` (seam model + hydration lifecycle) for module vocabulary before forming hypotheses.

**Feedback loops (prefer in order):**

1. **Failing `bun test`** — co-located `src/**/*.test.ts` at the unit/codec/backend seam (fastest; no DOM)
2. **`bun run test:dom`** — `tests-dom/**/*.test.tsx` for `useHydrated` rerender / unmount-detach / `useSyncExternalStore` reactivity
3. **Isolated storage-codec harness** — construct a `PersistStorage` over an in-memory `StateStorage` and drive `persistSource` against a fake source to reproduce cross-tab / throttle / migrate paths without a real browser
4. **Real backend in a DOM runner** — `localStorage` (sync) or `idb-keyval` (async) inside the vitest jsdom suite when the bug only shows against a real storage backend
5. **Captured trace replay** — a recorded `CrossTabStorageEvent` payload or a `getState` sequence replayed through the isolated harness

## Phase 1 — Build a feedback loop

**This is the skill.** Spend disproportionate effort here. A tight pass/fail signal for **this bug** beats staring at code.

Done when you can name **one command** that is red-capable, deterministic, fast, and agent-runnable (`bun test <file>` or `bun run test:dom -- <pattern>`). No red-capable command → no Phase 2.

## Phase 2 — Reproduce + minimise

Run the loop; shrink to the smallest scenario that still goes red. Every remaining element must be load-bearing — one codec, one backend, one source, one `setState` sequence.

**Done when:** minimal repro documented; non-load-bearing steps removed.

## Phase 3 — Hypothesise

Generate **3–5 ranked, falsifiable hypotheses**. Show the list to the user before testing. Bias toward the seams: sync-vs-async `getItem` branch, hydration gate ordering, throttle trailing edge, `migrate` version mismatch, cross-tab `raw` identity compare, codec `encode`/`decode` asymmetry.

**Done when:** user has seen ranked list before any fix attempt.

## Phase 4 — Instrument

One variable at a time. Tag debug logs `[DEBUG-xxxx]` for cleanup. Perf bugs (write loop, cross-tab listener, hydrate read path): measure first, then bisect.

**Done when:** one hypothesis confirmed or all falsified with evidence.

## Phase 5 — Fix + regression test

Regression test **before** the fix when a correct seam exists — co-locate under `src/` (`bun test`) or `tests-dom/` (`test:dom`) per the test matrix in `docs/architecture.md`. If no seam exists to test through, document that as an architectural finding (a shallow module worth deepening behind a smaller interface) and track it in `docs/roadmap.md`.

**Done when:** loop is green; regression test added or gap documented.

## Phase 6 — Cleanup + post-mortem

Remove `[DEBUG-...]` logs, delete throwaway harnesses, state the winning hypothesis in the commit message. If prevention needs an architecture change, record specifics in `docs/roadmap.md`.

**Done when:** no debug sediment; commit message states root cause.

## Reference

- [`tracer-bullets`](../../rules/tracer-bullets.md) · [`verify-after-each-step`](../../rules/verify-after-each-step.md) · [`harden-pr`](../harden-pr/SKILL.md) (lite on the fix commit)
- [`docs/architecture.md`](../../../docs/architecture.md) — seam model, hydration lifecycle, test matrix
