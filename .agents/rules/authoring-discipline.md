---
description: Authoring discipline for code comments and committed prose — preserve existing comments, keep new prose concise.
alwaysApply: true
---

# Authoring discipline

**Doc lifecycle:** [`docs-governance`](../skills/docs-governance/SKILL.md).

## Preserve existing source comments (non-negotiable)

1. **Never remove comments** — preserve when editing; update if outdated, don't delete.
2. **Never remove TODO / FIXME / HACK** — ask the user before removing completed TODOs.
3. **Never remove commented-out code** — ask before removal.
4. **StrReplace** — copy comments into `new_string`; move comments when restructuring.

User-requested **doc audits** may slim redundant markdown; preservation above applies to **source** comments only.

## New prose (defaults)

- **Decision test:** could a teammate re-derive this from the code in 30 seconds? → cut it.
- **Keep the _why_** — design intent, trade-offs, the rejected alternative, non-obvious constraints (storage quirks, race conditions, ordering), sentinels/magic values, cross-references that save grep time.
- **Cut the _what_** — restating the function/variable name, restating the next line, generic library practice, section headers in short files, author/date stamps.
- **JSDoc** — `@param` / `@returns` / `@default` / `@example` carry the meaning; types stay, narrating them does not. The shipped `.d.mts` should read well in hovers.
- **End-of-turn:** re-read the comments **you** authored this turn and cut the no-ops before reporting.
