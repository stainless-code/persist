---
description: Read lessons when relevant; lift durable ones into rules/skills
alwaysApply: true
---

# Lessons Convention

## Rules

1. **Read when relevant** — skim this file when the task touches an area with past corrections; not a mandatory full read every session.
2. **Append only durable, non-obvious corrections** — not session trivia already in a rule, skill, or reference doc.
3. **Prefer lifting** — when a lesson becomes policy, move it to `.agents/rules/` or the relevant skill and remove the bullet here (or supersede with one line pointing at the rule).
4. **Keep entries atomic** — one lesson per bullet. One sentence.
5. **No duplicates** — merge or supersede instead of appending near-duplicates.
6. **Supersede, don't accumulate** — outdated lesson → one replacement bullet; don't leave both.

<!-- Append durable corrections below, one bullet per line. Keep this file
     short — lift into rules/skills when a lesson becomes policy. -->

- npm trusted publishing (OIDC) needs npm ≥ 11.5.1 + Node ≥ 22.14; oven-sh/setup-bun leaves npm 10.x in PATH, so a release job running `changeset publish`/`npm publish` must also run actions/setup-node (Node 24 → npm 11) or OIDC isn't detected → ENEEDAUTH.
- Don't pin a GitHub action to a moving major tag's commit SHA (e.g. setup-node@<v6-tag-commit>) — the tag moves and orphans/GCs the commit → "unable to find version"; pin to an immutable release-tag commit or use the moving @vN tag.
- Release git auth: GitHub App on the `release` environment (`RELEASE_APP_CLIENT_ID` + `RELEASE_APP_PRIVATE_KEY`, Workflows write) — `permissions.workflows` on `GITHUB_TOKEN` is invalid in workflow YAML (startup_failure) and cannot tag when the tip touched `.github/workflows/*`.
- Blume `audit` + `deployment.base`: skip `canonical_bad_target` / `non_canonical_in_sitemap` / `indexable_page_not_in_sitemap` — canonical keeps the base; `page.url` is stripped.
- Format `apps/docs` non-content at `printWidth: 80` via nested `apps/docs/.oxfmtrc.json` (nearest-config-wins); keep `content/**` ignored so oxfmt cannot collapse `:::note`/`:::tip` fences (oxfmt Markdown bug — [Blume FAQ](https://useblume.dev/docs/faq#why-is-oxfmt--ultracite-collapsing-my-directives)); lint-staged must list `mdx` or content-only commits skip format entirely.
- Bun `workspaces: ["apps/*"]` alone drops the root package from manypkg/changesets discovery → `Found changeset … which is not in the workspace`; include `"."` (and ignore private `@stainless-code/persist-docs`) so Release can `changeset version` the publishable root.
