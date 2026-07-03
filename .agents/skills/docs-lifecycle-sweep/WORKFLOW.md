# Docs lifecycle sweep — procedure

## The 5-step procedure

### 1. Enumerate the surface

Walk the directory and list every doc file by lifecycle type:

```bash
# Tier B
find docs -name '*.md' -type f
```

Map each file to one of the 5 lifecycle types per [`docs-governance` § 1](../docs-governance/LIFECYCLE.md#1-five-lifecycle-types). If a file fits no type, that itself is a finding (rogue doc — fold + delete).

### 2. Apply the existence test to every file

Per [`docs-governance` § 2 Existence test](../docs-governance/LIFECYCLE.md#2-existence-test-apply-on-every-doc-touching-pr), each file earns its place if it meets ≥1 of:

1. **Source code cites it** (JSDoc, comment grep-anchor, error message, cited rule number, `NOTE(...)` marker, file path reference).
2. **Documents durable policy or framework** unavailable elsewhere (rejected alternatives, decisions of record, the deliberate `maxAge` divergence, the `instanceof Promise` read-path invariant).
3. **Tracks open work** (open audit findings, in-flight plan, roadmap item, open evaluation).
4. **Carries unique historical context** that `git log` + the relevant reference doc cannot reconstruct.

For each file, run the cite-check evidence command and record the result:

```bash
# Source-cite check (any file path, rule number, section anchor, or NOTE marker
# referencing the doc from non-doc paths)
rg -n "<filename>(\.md)?(#[a-z0-9-]+)?" \
   --glob '!docs/**' --glob '!**/*.md' .

rg -n "Rule [0-9]+" <doc-path>           # rule numbers cited from source
rg -n "NOTE\(<topic>" src/ scripts/      # marker convention
```

If the file is an audit, also check the [`docs-governance` § Closing an audit re-derivable test](../docs-governance/LIFECYCLE.md#closing-an-audit) three keep-criteria:

1. **Decisions of record with rejected alternatives** — would the rationale be lost if deleted?
2. **Source-back-references** — `NOTE(...)` markers, JSDocs, test names citing the audit by file?
3. **Reusable methodology / playbook** that doesn't already live in a skill — verification recipes, codec/backend test matrices?

### 3. Classify each file

| Tier                  | Verdict                                                                                                                                                                   | Action                                                                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A — Keep verbatim** | Cited from source by rule number / section anchor; OR codifies a policy still in force; OR is a Reference doc / Roadmap that lives forever per its lifecycle              | Update "Last verified" header (audits) or no-op (reference / roadmap)                                                                                                                     |
| **B — Slim + keep**   | Closed but ≥1 of the audit keep-criteria applies; OR has cited content that's stable                                                                                      | Slim to the cited / durable bits + verification recipe + status header; preserve cited rule numbers per [§ 6](../docs-governance/LIFECYCLE.md#6-cross-reference-preservation)             |
| **C — Delete + lift** | Closed AND no source cites AND all findings shipped or lifted to roadmap; OR superseded by a later doc that incorporated everything; OR fails the existence test outright | Lift any orphan-able knowledge into the natural reference doc (`architecture.md`, `glossary.md`, `roadmap.md`, or a skill); update the pointer index; **delete the file** (no tombstones) |

### 4. Surface the classification report (BEFORE any edits)

Present the user with a table:

| File (shape)                          | Type     | Tier             | Evidence (the kind of finding to record)                                                                                                          | Action                                                                                                                                |
| ------------------------------------- | -------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/audits/<YYYY-MM-DD>-<topic>.md` | Audit    | **C**            | 0 source-cites; N/N findings shipped (commits ...); deferred items already in `roadmap.md`; no rejected-alternatives rationale unique to the file | Delete; lift any orphan-able framework into a reference doc / skill before the source goes                                            |
| `docs/audits/<rolling-topic>.md`      | Audit    | **A**            | "§-numbers referenced from source — do not renumber" header; M source-cites by §-anchor from `src/`                                               | Keep verbatim                                                                                                                         |
| `docs/audits/<framework-topic>.md`    | Audit    | **B**            | Closed; framework still policy in force; K inbound roadmap citations; per-instance inventory regenerable                                          | Slim closed findings to the durable framework + cited categories; drop per-instance evidence dumps; preserve cited §-anchors verbatim |
| `docs/plans/<topic>.md`               | Plan     | **C**            | Work shipped on commits X, Y; lifted destinations confirmed in `architecture.md`                                                                  | Delete; pointer in `roadmap.md` already exists                                                                                        |
| `docs/research/<tool>.md`             | Research | **A (Rejected)** | `Status: Rejected (date) — <reason>` header; the rejection rationale IS the keep-criterion                                                        | Keep verbatim                                                                                                                         |

Use **shape placeholders** in the report (`<topic>`, `<tool>`) when illustrating the classification template — citing real audit names couples this skill to the lifecycle of files it's supposed to retire (see § Anti-patterns: skill-durability hazard).

The report includes the **executable diff preview** for every Tier B (slim) and Tier C (delete + lift) — the user reviews before approval. Cross-reference impact is shown: every inbound link to a Tier C file gets a "this link will need rewiring" line.

### 5. Execute on user approval

For each approved action, in dependency order (delete + lift before slimming so cross-refs are correct):

1. **Lift** orphan-able knowledge to its destination.
2. **Update** every inbound cross-reference (`rg "<path>"` from § 2 confirms the list; in-place edits with `StrReplace`).
3. **Delete** the source file (Tier C) or apply the slim diff (Tier B).
4. **Update pointer index** — `roadmap.md` § Closed audits (pointers) for audits; `architecture.md` for newly-promoted reference content.
5. **Re-grep** to confirm zero broken cross-references: `rg "<deleted-filename>"` returns 0 hits outside the deletion commit message.

After execution, the surface is **clean** by definition — every remaining file passed the existence test at sweep time.

## Output substrate (the sweep report itself)

A sweep report is **transient** by design — it lives on the PR / chat where the sweep ran, not in `docs/`. The findings + chosen actions land as commit messages + cross-link updates; the report itself is not a doc to keep.

If the user wants a durable record (e.g. "we deleted N audits, here's why"), promote the report to a one-time entry in `roadmap.md` § Closed audits (pointers) — but only if the rationale would be hard to reconstruct from `git log --follow` on the deleted files. Default is: don't write a meta-doc about the cleanup.
