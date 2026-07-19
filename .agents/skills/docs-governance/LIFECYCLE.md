# Docs governance — repo-wide blueprint

This is a small library: **Tier B only** (repo-wide `docs/` at the root). No per-feature `docs/` subtrees, no per-shared-component READMEs. The shared spine below is the whole story.

## Surface tier in scope

| Tier                                 | Substrate              | Shape                                                                                                                                                  |
| ------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Tier B** — repo-wide cross-cutting | `docs/` at repo root   | Plans + Audits + Research + cross-cutting reference (`architecture.md`, `roadmap.md`); `README.md` index when ≥3 files of substance (already present). |
| **Tier 0** — per-tooling-area        | `.agents/`, `.cursor/` | Router index: `.agents/README.md`; governance via `agents-first-convention` + `agents-tier-system`.                                                    |

## Shared spine

### 1. Five lifecycle types

| Type          | Folder                                                  | Lifecycle                                                                   |
| ------------- | ------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Reference** | root (`architecture.md`)                                | Lives forever. Kept current.                                                |
| **Roadmap**   | root (`roadmap.md`, single)                             | Lives forever. Items move in (new findings) and out (per "Closing a plan"). |
| **Plan**      | `plans/<topic>.md`                                      | Created when work commits. Closed per § Closing a plan.                     |
| **Audit**     | `audits/<YYYY-MM-DD>-<topic>.md` or `audits/<topic>.md` | Created at audit time. Closed per § Closing an audit.                       |
| **Research**  | `research/<tool-name>.md`                               | Created when an evaluation begins. Closed per § Closing research.           |

Backlogs fold into a `roadmap.md` section; decisions of record fold into `architecture.md` or a rule; ephemeral notes don't get a top-level file.

### 2. Existence test (apply on every doc-touching PR)

A file earns its place if it meets at least one of:

1. **Source code cites it** (JSDoc, error message, or comment that grep-points back at it)
2. **It documents durable policy or framework** unavailable elsewhere
3. **It tracks open work** (open audit findings, in-flight plan, roadmap items, ongoing evaluation)
4. **It carries unique historical context** that `git log` + the relevant reference doc cannot reconstruct

If none → fold salvageable content into roadmap / architecture, fix cross-refs, delete the file.

### 3. Naming

- `plans/` files: `<topic>.md` (folder provides "plan" context; no `-plan` suffix)
- `research/` files: `<tool-name>.md` (no `-research` suffix)
- `audits/` files: `<YYYY-MM-DD>-<topic>.md` (dated) or `<topic>.md` (ongoing)
- Top-level reference: descriptive domain name (`architecture.md`, `roadmap.md`)
- All files: kebab-case

### 4. `.gitkeep` discipline

Every potentially-empty docs subdirectory carries a `.gitkeep` (`plans/`, `audits/`, `research/`). Absence signals "this convention isn't expected here".

### 5. Anti-bloat meta-rule

Don't add a rule until there's content that needs it. Each rule must point at concrete content it governs. Density per [`authoring-discipline`](../../rules/authoring-discipline.md); lifecycle stays here.

### 6. Cross-reference preservation

Before slimming or moving any doc cited from source or other docs:

```bash
rg "<path>(#[a-z-]+)?" .
```

Preserve cited anchors / rule numbers; if renumbering is unavoidable, update every citation in the same commit. Don't maintain hand-written cross-reference indexes — the grep IS the index.

## Closing states

### Closing a plan

**Default — delete + lift.** When work ships, durable bits move to where they earn a permanent home; the plan file dies. Lift destinations:

- Caller-facing convention → `architecture.md`
- Project-wide policy → `.agents/rules/` / `.agents/skills/`
- Open items → `roadmap.md`

**In-flight or deferred** → stays in `plans/` with no status header (open is the default). **No "slim & keep in plans/" state** — a shipped doc worth keeping earned a permanent home elsewhere.

### Closing an audit

**Default — delete + lift.** Digest deferred items to `roadmap.md`, lift any orphan-able knowledge, delete. **Slim + keep** only when inbound source cites (rule numbers, `NOTE(...)`, test names) would orphan — then keep cited sections + a `Status: Closed (YYYY-MM-DD)` header, not the full evaluation prose. Keep (don't delete) only if it carries: decisions of record with rejected alternatives, source-back-references, or reusable methodology not already in a skill.

### Closing research

- **Adopted** → lift the decision-of-record into `architecture.md` or a rule/skill; delete the research file unless its comparison framework is reusable.
- **Rejected** → add `Status: Rejected (YYYY-MM-DD) — <one-line reason>` at the top. Keep. The rejection rationale saves the next agent from re-litigating.
- **Open** → stays in `research/` with no status header.

## README surfaces

**The `apps/docs` docs site (built with Blume) is the canonical public documentation** for concepts, API, guides, recipes, adapters, and reference detail. The repo root `README.md` is an **npm/repo landing only**: package name, brand one-liner, install command, optional-peer table (or link), one idiomatic taste snippet, and links to `https://stainless-code.com/persist` — it **must not** restate API tables, when-to-use matrices, lifecycle explanations, or feature lists. Maintainer-facing depth stays in `docs/architecture.md`, `docs/glossary.md`, and the docs site `/reference/*`. On API changes, update the docs site first (`update-docs`); the root README changes only when install/peers/package name change.

PR checklist: docs site updated for behavior/API; README touched only for install/taste/links. Label the PR **`docs`** when it changes `apps/docs/**` (or site-visible root README branding) — merge then deploys `/persist` via `.github/workflows/deploy-docs.yml` (also `release` / `workflow_dispatch`). Not GitHub's default `documentation` label.
