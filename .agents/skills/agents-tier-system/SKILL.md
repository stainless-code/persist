---
name: agents-tier-system
description: Full tier assignments, pairing conventions, and authoring checklist for .agents/ rules and skills. Use when creating or reviewing a rule or skill, deciding Tier 1 vs 2 vs 3, or auditing attachment cost.
---

# `.agents/` tier system — full reference

Always-on priming: [`.agents/rules/agents-tier-system.md`](../../rules/agents-tier-system.md). Entry points: [`.agents/README.md`](../../README.md), [`agents-first-convention`](../../rules/agents-first-convention.md), [`writing-agents-config`](../writing-agents-config/SKILL.md).

## Discover on disk (do not maintain partial catalogs here)

| Tier       | How to list                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| **Tier 1** | Frontmatter audit in [`agents-tier-system` rule](../../rules/agents-tier-system.md) — budget set there |
| **Tier 2** | `ls .agents/rules/*.md` + `globs:` in frontmatter                                                      |
| **Tier 3** | `alwaysApply: false`, no `globs:` — intent via `description`                                           |
| **Skills** | `ls .agents/skills` — runtime discovery via descriptions                                               |

**Pairing examples in this repo:** `architecture-priming` ↔ `improve-codebase-architecture`; `docs-governance-priming` ↔ `docs-governance` + `docs-lifecycle-sweep`; `agents-tier-system` rule + skill; `authoring-discipline` rule + PROSE; `verify-after-each-step` rule + skill.

**Caution:** avoid stacking broad globs without thin priming bodies.

## Authoring guidelines

### Adding a new rule

1. **Decide the tier** before writing.
2. **Tier 1 needs justification** — every turn? If file/intent scoped, demote to Tier 2 or Tier 3.
3. **Tier 2 globs** — broadest meaningful scope; pair with skill when applicable.
4. **Source + symlink** per [`agents-first-convention`](../../rules/agents-first-convention.md).

### Adding a new skill

1. **Needs a rule?** Hard `NEVER`/`ALWAYS` + file-scoped work → Tier 2 priming rule.
2. **Skill-only** — explicit trigger phrases in description.
3. **User-only orchestrator** — `disable-model-invocation: true` + delegate to model skill.
4. **Size** — [`writing-agents-config`](../writing-agents-config/SKILL.md) § SKILL.md size tiers.

### Tier 1 audit command

```bash
for f in .agents/rules/*.md .agents/lessons.md; do
  awk '/^---$/{c++; next} c==1 && /^alwaysApply: true$/{found=1; exit} END{exit !found}' "$f" && echo "$f"
done
```

**Done when:** tier choice justified; pairing checklist satisfied; Tier-1 audit command run when adding always-on rules.

## Reference

- Skill authoring SSOT: [`writing-great-skills`](../writing-great-skills/SKILL.md)
- Persist deltas: [`writing-agents-config`](../writing-agents-config/SKILL.md)
- File-layout: [`agents-first-convention.md`](../../rules/agents-first-convention.md)
- Tier-1 priming rule: [`.agents/rules/agents-tier-system.md`](../../rules/agents-tier-system.md)
