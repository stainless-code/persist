---
name: pr-comment-fact-check
description: STOP and fact-check PR review comments before applying or dismissing reviewer or bot feedback. Use on CodeRabbit, Copilot, Cursor bot, dependabot, or human reviewer comments.
---

# PR comment fact-check

**STOP** before applying or dismissing any PR comment. Each comment is a **claim** — verify against the actual code and this repo's authoritative sources (`.agents/`, `docs/architecture.md`, JSDoc, tests) before acting. **Workflow:** [WORKFLOW.md](./WORKFLOW.md).

| Verdict         | Default action                                                       |
| --------------- | -------------------------------------------------------------------- |
| ✅ Correct      | Apply + resolve                                                      |
| ⚠️ Partial      | Apply salvageable part + explain nuance                              |
| ❌ Hallucinated | Push back with evidence; resolve-on-merge-gate exception in WORKFLOW |
| 🕒 Outdated     | Point at fix commit + resolve                                        |
| 💭 Style        | Apply if cheap, else defer                                           |

## Hallucination catalog (scrutinize harder)

Common LLM-reviewer patterns on this repo:

1. **"This isn't tested" without checking siblings** — `persist-core` contracts are pinned across `src/core/persist-core.test.ts`, `src/adapters/codecs/seroval.test.ts`, `src/adapters/backends/idb.test.ts`, `src/adapters/sources/tanstack-store.test.ts`; `useHydrated` spans `src/adapters/frameworks/react.test.ts` (bun, SSR/snapshot) **and** `tests-dom/**/*.test.tsx` (vitest, rerender/detach). Verify coverage before accepting.
2. **Type-safety alarms** — if `bun run typecheck` (tsgo) passes, the claim is almost always wrong, or about runtime behavior the type system can't see (then the reviewer must justify with the runtime case).
3. **Generic "best practice" claims unsupported by our rules** — "always destructure", "prefer interfaces over types", "add `useMemo`/`useCallback`" — stylistic; we either have a rule or we don't. Grep `.agents/` for the convention.
4. **Convention citations that don't exist** — "this breaks the library's API conventions" — grep `.agents/` + `docs/architecture.md`. If not codified, it's preference, not rule.
5. **Memory-leak / race-condition claims with no concrete trigger** — "this could leak" without a scenario is speculation; ask for the path. Real candidates here: hydration-gate ordering, throttle trailing edge, cross-tab listener teardown (`destroy()`), `useSyncExternalStore` unmount-detach — demand the specific path.
6. **Wrong API for our seams** — bot suggests coupling to a specific store when the seam is `PersistableSource`; suggests a factory-per-combination when factory policy is "backend earns a factory only when it needs real adaptation (IndexedDB)".
7. **Public-API suggestions that leak internals** — `PersistStorage.raw` is **public** and typed `unknown` on purpose (identity compare only); internal listener aliases are deliberately kept out of public signatures. Push back on "tighten this type" / "export this helper".

## Anti-patterns

- ❌ Applying every suggestion to clear the queue.
- ❌ Replying "fixed!" without verifying.
- ❌ Dismissing without evidence.
- ❌ Resolving a thread you rejected as hallucinated (the reviewer needs to see the receipts).

## Reference

- [`verify-after-each-step`](../../rules/verify-after-each-step.md) — run after applying a fix.
- [`harden-pr`](../harden-pr/SKILL.md) — optional full pass on the branch once comments are triaged.
- `docs/architecture.md` — seam model, public-surface policy, test matrix (authoritative for "is this the right seam / is this tested" claims).
