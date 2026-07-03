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
3. **Use the right scope** — lint/format on specific files when possible; `bun run typecheck` when types may be affected; `bun test <paired test>` when a `src/` module changed.
4. **Run affected tests** — co-located `*.test.ts` pair when `src/` source changed; `bun run test:dom` when `tests-dom/**` changed.

**Full per-file check table** (lint-staged, build config, DOM suite): [`verify-after-each-step`](../skills/verify-after-each-step/SKILL.md).

Related: [`no-bypass-hooks`](./no-bypass-hooks.md) · [`tracer-bullets`](./tracer-bullets.md) · [`harden-pr`](../skills/harden-pr/SKILL.md).
