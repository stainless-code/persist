---
description: After each working milestone, verify changed files using the same checks lint-staged runs
alwaysApply: true
---

# Verify after each step

After completing a step, verify every file you touched — don't wait for `git commit`.

## What counts as a step

Tracer-bullet slice, plan TODO, refactor, module/entry/hook change, bug fix, review comment.

## Rules

1. **Verify after every step** — run checks matching touched file patterns before moving on.
2. **Fix before moving on** — never carry forward known failures.
3. **Use the right scope** — lint/format on specific files when possible; `bun run typecheck` project-wide when types may be affected.
4. **Run affected tests** — co-located `*.test.ts` pair when a `src/` module changed.

## Per-file check table (this repo)

| Touched file                          | Run                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `src/**/*.ts` (non-test)              | `bun run lint <file>` · `bun run format:check <file>` · `bun run typecheck` · `bun test <paired test>` |
| `src/**/*.test.ts`                    | `bun test <file>`                                                                                      |
| `tsdown.config.ts` / `tsconfig*.json` | `bun run format:check <file>` · `bun run build` · `bun run typecheck`                                  |
| `package.json`                        | `bun run format:check` · `bun install` (if deps changed) · `bun run check`                             |
| `docs/**` / `*.md` / `.agents/**`     | `bun run format:check <file>`                                                                          |
| `.github/**` / `*.yml`                | `bun run format:check <file>`                                                                          |

Full gate before commit/push: `bun run typecheck && bun test ./src && bun run lint && bun run format:check` (and `bun run build` if entry points / build config changed).

Related: [`no-bypass-hooks`](./no-bypass-hooks.md) · [`tracer-bullets`](./tracer-bullets.md) · [`harden-pr`](../skills/harden-pr/SKILL.md).
