# Contributing

`@stainless-code/persist` is a small, freshly extracted library. Before large PRs, please open an issue so we can align on:

- **Public surface** — anything exported from an entry point (`src/core/index.ts` and the opt-in adapter subpaths) is the public API and must carry JSDoc that reads well in hovers and published typings. See [`docs/architecture.md`](../docs/architecture.md) for the seam model.
- **Runtimes** — **Node** `^20.19.0 || >=22.12.0` and **Bun** `>=1.0.0` (`package.json` **engines**). The core is zero-dep by design (enforced by a gate test); each subpath owns its optional peer.

## Dev workflow

```bash
bun install            # runs `prepare` → Husky git hooks
bun test ./src         # bun:test unit tests
bun run test:dom       # vitest + jsdom — React useHydrated reactivity (DOM) tests
bun run typecheck      # tsgo --noEmit
bun run lint           # oxlint
bun run format         # oxfmt
bun run build          # tsdown → dist/ (one file per entry, mirroring src)
bun run docs:api       # TypeDoc → docs/api/ (git-ignored HTML site)
bun run check          # build, then format:check + lint:ci + test + test:dom + typecheck (in parallel)
bun run check-updates  # interactive dependency updates (`bun update -i --latest`)
bun run clean          # remove untracked/ignored build artifacts (keeps .env)
```

The test suite is split by what it needs: `bun:test` for `src/**/*.test.ts` (no DOM), and `vitest` + jsdom + @testing-library/react for `tests-dom/**/*.test.tsx` (the React `useHydrated` rerender path). See [`docs/architecture.md § Test matrix`](../docs/architecture.md#test-matrix).

### `main` and pull requests

Branch **`main`** is the line of development for this personal repo. Open a **pull request** for anything non-trivial and merge after **[CI](workflows/ci.yml)** passes — the single **`CI complete`** job is the unambiguous green/red signal.

```bash
git fetch origin && git checkout main && git pull
git checkout -b your-branch-name
# … commit …
git push -u origin your-branch-name
```

Then open a PR on GitHub into **`main`**.

### Git hooks

[Husky](https://github.com/typicode/husky) + [lint-staged](https://github.com/latstg/lint-staged) — see [`.husky/pre-commit`](../.husky/pre-commit). Pre-commit runs **`lint-staged`** only when `CURSOR_AGENT`, `CLAUDECODE`, or `AI_AGENT` is set (AI/agent commits). Staged files get `oxfmt`, `oxlint`, staged-only **`tsgo`**, and **`bun test`** on `*.test.ts` / paired co-located tests.

### Style

Match Oxfmt/Oxlint; prefer **straight-line code** and extracted helpers over long nested blocks. Existing source comments are preserved — never delete a `TODO` / `FIXME` / commented-out block without asking (see [`.agents/rules/authoring-discipline.md`](../.agents/rules/authoring-discipline.md)).

### Releases

[@changesets/cli](https://github.com/changesets/changesets) — run **`bun run changeset`** when your PR should bump the version, and commit the `.changeset/*.md` file. The Release workflow opens a "Version packages" PR and publishes to npm on merge (requires `NPM_TOKEN`).

### Issues

Use the [GitHub issue templates](https://github.com/stainless-code/persist/issues/new/choose) — **Bug** vs **Feature / adapter proposal** (see `.github/ISSUE_TEMPLATE/`).

## Agent rules and skills (`.agents/`)

Rules live under **`.agents/rules/`** as `.md` files; skills under **`.agents/skills/<name>/SKILL.md`**. Symlink into **`.cursor/`** with `.mdc` extension (Cursor requires `.mdc` for frontmatter parsing; see [`.agents/rules/agents-first-convention.md`](../.agents/rules/agents-first-convention.md)). Inventory and tier system: [`.agents/README.md`](../.agents/README.md) and [`.agents/rules/agents-tier-system.md`](../.agents/rules/agents-tier-system.md).

Thank you for making hydration-aware persistence reusable across stores and frameworks.
