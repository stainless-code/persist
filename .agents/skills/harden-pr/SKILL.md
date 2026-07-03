---
name: harden-pr
description: >-
  Bring a branch to pristine, maximum production readiness without changing PR intent —
  spawn parallel Task subagents (never inline review), fix in-bounds findings, loop autonomously until
  clean or pass cap, then report once. Use after a tracer-bullet commit (lite), before PR
  is done (full), on "harden", "harden-pr", "pristine", "review until clean",
  or "production-ready pass". Invoking this skill authorizes one harden commit at cycle end.
  NEVER stop mid-loop to ask about commits, babysit, or the next pass. NEVER redesign
  the feature or change observable runtime behavior.
---

# Harden PR

**Goal:** leave the branch in **pristine, maximum production state** — every changed path shippable, verified, documented, and hygienic. Polish and harden what the PR already does; **never** change its intent or runtime behavior.

Local loop: parallel reviewer subagents → merge findings → vet → fix in-bounds → re-verify → repeat until clean or cap → **one final report**.

**Workflow** (run-to-completion, modes, roster, verification, git): [WORKFLOW.md](./WORKFLOW.md). **Ledger:** [LEDGER.md](./LEDGER.md).
