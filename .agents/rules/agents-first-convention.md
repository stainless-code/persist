---
description: When creating or moving rules/skills, always store the source file in .agents/ and symlink from .cursor/
alwaysApply: true
---

# Agents-First File Convention

When creating **any** new rule or skill, follow this convention:

## Rules (`.md` files)

1. Create the file in `.agents/rules/<name>.md` (with YAML frontmatter)
2. Create a `.mdc` symlink in `.cursor/rules/`:

   ```bash
   ln -s ../../.agents/rules/<name>.md .cursor/rules/<name>.mdc
   ```

**Naming:** Tier-2 priming rules that pair with a skill use `<skill-slug>-priming.md` when the rule name would otherwise differ from the skill folder. When names already match, no suffix.

## Skills (`SKILL.md` files)

1. Create the directory and file in `.agents/skills/<name>/SKILL.md`
2. Create a symlink in `.cursor/skills/`:

   ```bash
   ln -s ../../.agents/skills/<name> .cursor/skills/<name>
   ```

**Never** name bulk reference files `AGENTS.md` inside skill folders — use `FULL-GUIDE.md` or topic siblings.

## Never

- Never place original content in `.cursor/` — symlinks only.
- Never create a rule or skill without both `.agents/` source and `.cursor/` symlink.

Related: [`agents-tier-system.md`](./agents-tier-system.md) · [`AGENTS.md`](../../AGENTS.md) · [`.agents/README.md`](../../.agents/README.md).
