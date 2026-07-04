# PR comment fact-check — workflow

## Process

### 1. Pull the comments

```bash
# Top-level review comments + line comments
gh pr view <number> --json reviews,comments --jq '.reviews[].body, .comments[].body' | head -100

# Line-level inline comments (with file + line + position)
gh api "repos/{owner}/{repo}/pulls/<number>/comments" \
  --jq '.[] | { id, path, line, body: .body[0:200], user: .user.login, in_reply_to_id }'

# Outstanding review threads only (unresolved)
gh api graphql -f query='
  query($owner:String!, $repo:String!, $pr:Int!) {
    repository(owner:$owner, name:$repo) {
      pullRequest(number:$pr) {
        reviewThreads(first:100) {
          nodes {
            isResolved
            comments(first:10) {
              nodes { id, path, originalLine, body, author { login } }
            }
          }
        }
      }
    }
  }' -F owner=<owner> -F repo=<repo> -F pr=<number> \
  --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false)'
```

The GraphQL form is the only way to get the **resolved/unresolved** state. REST endpoints don't expose it. Filter out resolved threads — they don't need re-triaging.

**Done when:** all unresolved threads fetched; count logged.

### 2. Group comments

For each comment, capture:

- file path + line number (the **anchor**)
- comment body (the **claim**)
- author (human reviewer? CodeRabbit? Copilot? Cursor bot? dependabot?)
- thread context (reply to an earlier comment? what was said?)

Group comments touching the same file/line/concern into one thread — a reviewer usually makes the same point in 3 places; verify once.

### 3. Fact-check each claim

For every distinct claim, **verify against the actual code and the repo's authoritative sources**:

| Claim shape                                     | How to verify                                                                                                                                  |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| "This function does X"                          | `Read` the cited file and lines. Does it actually do X? `Grep` for callers to confirm role.                                                    |
| "This is a memory leak / race / re-render trap" | Trace the path (hydration gate, throttle trailing edge, cross-tab listener, `useSyncExternalStore` unmount). Ask for the scenario.             |
| "We should use library/pattern Y here"          | Check `.agents/rules/` + `.agents/skills/` + `docs/architecture.md` — is Y endorsed? Contradicted? Silent?                                     |
| "This breaks convention Z"                      | Find Z in `.agents/` or `docs/`. If it's not codified, it's preference, not rule. Mark style.                                                  |
| "This isn't tested"                             | `Glob` for `*.test.ts` / `*.test.tsx` neighbours **and** sibling entry tests (see SKILL.md catalog #1). Check coverage, not existence.         |
| "This duplicates X elsewhere"                   | `Grep` for the symbol/pattern. Actually duplicated, or just structurally similar?                                                              |
| "This violates type-safety"                     | Run `bun run typecheck`. If it passes, the claim is wrong unless the reviewer shows a runtime case.                                            |
| "Performance issue"                             | Quantify if possible. Many "performance" comments are speculative — ask for a measurement (hydrate read path, write loop, cross-tab listener). |
| "Public API should change"                      | Check `docs/architecture.md` § Publishing & API docs + the export's JSDoc. `PersistStorage.raw` and internal-alias hiding are deliberate.      |

**Done when:** every distinct claim has file:line (or tool) evidence and a verdict.

### 4. Categorize and report

Output a triage table grouped by verdict, not by file:

```markdown
## ✅ Correct (N) — apply

| #   | File:line                   | Claim (1 line) | Action                |
| --- | --------------------------- | -------------- | --------------------- |
| 1   | src/core/persist-core.ts:42 | …              | Apply suggested diff. |

## ❌ Incorrect / hallucinated (N) — push back

| #   | File:line              | Claim                            | Why wrong                                                    |
| --- | ---------------------- | -------------------------------- | ------------------------------------------------------------ |
| 2   | persist-tanstack.ts:13 | "useEffect should depend on key" | key is stable from persistSource options; no useEffect here. |

## ⚠️ Partially correct (N)

…

## 🕒 Outdated (N)

…

## 💭 Style preference (N)

…
```

Then propose **the actual reply** for each comment you push back on — give the reviewer the receipts (file:line link, rule/skill reference, `docs/architecture.md` section, test name).

### 5. Apply / reply / resolve

Default behaviour per category — **resolve threads you have authority over; leave the ones that need reviewer concession**:

| Verdict                     | Apply?                    | Reply?                                                                          | Resolve thread?                                                                                                              |
| --------------------------- | ------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| ✅ Correct                  | Yes                       | Optional ack ("applied in &lt;sha&gt;")                                         | **Yes** — the bot was right, the fix is in, the thread has served its purpose. Leaving it open creates noise.                |
| ⚠️ Partially correct        | The salvageable part      | Yes — explain the nuance                                                        | **Resolve only if the reviewer agrees** (or is a bot that won't push back). Otherwise leave open.                            |
| ❌ Incorrect / hallucinated | No                        | Yes — push back with evidence (file:line, rule reference, architecture section) | **Leave unresolved** — the reviewer needs to see the receipts and concede. Auto-resolving a thread you reject is dismissive. |
| 🕒 Outdated                 | N/A                       | Optional — point at the fix commit                                              | **Yes**                                                                                                                      |
| 💭 Style preference         | If cheap; otherwise defer | Brief reply if you applied                                                      | **Yes if applied**, otherwise leave open for the author to weigh in                                                          |

The "leave unresolved when the reviewer needs to concede" rule applies to bot reviewers too — bots can iterate and update their stance on the next review pass when they see the rebuttal.

#### Resolve-on-merge-gate exception

If the repo's branch protection requires **all conversations resolved to merge** (verify per-repo via `gh api repos/{owner}/{repo}/branches/{base}/protection`), the "leave unresolved on hallucinated comments" guidance changes:

1. Push back with the receipts (file:line, rule reference, architecture section) — same as the default flow.
2. Wait one review-cycle for the reviewer to escalate or concede. For bot reviewers, "one cycle" is one push that triggers a re-review; for humans, give it ≥1 working day unless the merge is time-sensitive.
3. **Resolve the thread regardless** — the rebuttal lives in the thread body for the next reviewer pass; the merge gate cannot be held hostage to a bot's silence. Reviewer-pushback evidence is preserved (`gh api repos/{owner}/{repo}/pulls/{number}/comments` returns the full thread including resolved ones).

Counterbalance the "evidence-in-the-body" trade-off (future reviewers won't see resolved threads by default): drop a one-line summary of contested rebuttals into the **PR description** (e.g. `## Pushed back on (resolved): #2 persist-tanstack.ts:13 — no useEffect here; #5 PersistStorage.raw typing — deliberate unknown`).

The exception applies to `❌ hallucinated` and `⚠️ partial — needs a call` rows. The other rows already resolve by default.

**Done when:** triage table covers every unresolved thread; ✅/⚠️ rows applied or replied; resolve policy from table + merge-gate exception applied.

### Commands

```bash
# Reply to a thread
gh api "repos/{owner}/{repo}/pulls/<number>/comments" \
  -f body="$(cat <<'EOF'
<reply text>
EOF
)" -F in_reply_to=<comment_id>

# Resolve a thread (GraphQL only — REST endpoints don't support resolve)
gh api graphql -f query='mutation($id: ID!) {
  resolveReviewThread(input:{threadId:$id}) { thread { isResolved } }
}' -F id=<thread_node_id>
```

The thread node ID (`PRRT_…`) comes from the GraphQL `reviewThreads` query in step 1 — the REST `comments` endpoint only returns the comment ID (`databaseId`), which is what `in_reply_to` takes.

### After applying

Run [`verify-after-each-step`](../../rules/verify-after-each-step.md) checks on touched files. Optional: [`harden-pr`](../harden-pr/SKILL.md) full on the branch once triage is complete.
