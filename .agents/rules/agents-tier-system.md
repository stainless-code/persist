---
description: Tier system for .agents/ rules and skills — context-targeted attachment via the right Cursor frontmatter mode. Apply when authoring a new rule or skill, or when reviewing an existing one's attachment cost.
globs:
  - ".agents/**"
  - ".cursor/**"
alwaysApply: false
---

# `.agents/` tier system

Three attachment modes: **always-on** (`alwaysApply: true`), **auto-attached** (`globs:`), **intent** (`description:` only).

**Tier 1 budget:** ≤7 rules, ≤200 lines total. Audit:

```bash
for f in .agents/rules/*.md .agents/lessons.md; do
  awk '/^---$/{c++; next} c==1 && /^alwaysApply: true$/{found=1; exit} END{exit !found}' "$f" && echo "$f"
done
```

Must match the audit above — **no hardcoded Tier 1 name lists** in rule, skill, or README.

**When authoring:** pick tier before writing; pair fat rules with skills; symlinks per [`agents-first-convention`](./agents-first-convention.md). A small library should stay well under budget — default to intent-triggered skills and a thin always-on set.

## Reference

- Router index: [`.agents/README.md`](../README.md)
- Authoring vocabulary: [`writing-great-skills`](../skills/writing-great-skills/SKILL.md)
