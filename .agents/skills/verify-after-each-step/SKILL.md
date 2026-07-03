---
name: verify-after-each-step
description: Per-file verification checklist — lint-staged and package.json scripts after each milestone.
disable-model-invocation: true
---

# Verify after each step (full checklist)

Always-on priming: [`.agents/rules/verify-after-each-step.md`](../../rules/verify-after-each-step.md).

Run matching checks on every file touched **before** moving to the next milestone. Pre-commit is the safety net, not the first line of defense.

## Discover project scripts

1. **Read `package.json` `scripts`** at the start of a task.
2. **Read `lint-staged.config.js`** — which checks apply to which patterns (staged-only `tsgo`, paired co-located tests, DOM-suite split).
3. Never assume script names — verify they exist in `package.json` before running.

## Per-file check table (this repo)

| Touched file                          | Run                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `src/**/*.ts` (non-test)              | `bun run lint <file>` · `bun run format:check <file>` · `bun run typecheck` · `bun test <paired test>` |
| `src/**/*.test.ts`                    | `bun test <file>`                                                                                      |
| `tests-dom/**/*.test.tsx`             | `bun run test:dom` (vitest) · `bun run lint <file>` · `bun run format:check <file>`                    |
| `vitest.config.ts`                    | `bun run format:check <file>` · `bun run test:dom`                                                     |
| `tsdown.config.ts` / `tsconfig*.json` | `bun run format:check <file>` · `bun run build` · `bun run typecheck`                                  |
| `package.json`                        | `bun run format:check` · `bun install` (if deps changed) · `bun run check`                             |
| `docs/**` / `*.md` / `.agents/**`     | `bun run format:check <file>`                                                                          |
| `.github/**` / `*.yml`                | `bun run format:check <file>`                                                                          |

**Co-located pair:** `foo.ts` → `foo.test.ts` (lint-staged runs the pair when only the source is staged — mirror that here).

**Build config / entry points:** if `tsdown.config.ts`, `package.json` `exports`, or an entry module changed, add `bun run build` and `bun run docs:api` (TypeDoc `treatWarningsAsErrors` catches broken `{@link}`).

Full gate before commit/push: `bun run typecheck && bun test ./src && bun run test:dom && bun run lint && bun run format:check` (and `bun run build` if entry points / build config changed). `.agents/` / `docs/` / `.github/` only need `bun run format:check`.

## Reference

Tier-1 priming: [`.agents/rules/verify-after-each-step.md`](../../rules/verify-after-each-step.md) · [`tracer-bullets`](../../rules/tracer-bullets.md) · [`no-bypass-hooks`](../../rules/no-bypass-hooks.md) · [`harden-pr`](../harden-pr/SKILL.md)
