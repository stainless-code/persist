# Harden-pr ledger

Single durable backlog for [`harden-pr`](./SKILL.md). Parent reads **§ Rejections** at vet step; **§ Deferred** on cap and on `/harden-pr reconcile`.

## Rejections

By-design or false-positive findings — do not re-raise.

```markdown
- **[category]** `file:line` — label: reason
```

<!-- Example:
- **[correctness]** `src/core/persist-core.ts:147` — sync-first read path: by-design — sync backends settle pre-paint; async rides the same getItem Promise branch.
-->

## Deferred

Capped or out-of-scope-for-now — reconcile re-vets; remove lines when fixed.

```markdown
- **[severity]** `file:line` — finding (deferred: out of scope | cap | blocked)
```

- **[info]** `package.json` peerDependencies — `./frameworks/svelte` declares `svelte >=5.7.0` in source/README but `package.json` has `svelte >=3.0.0` shared with `./frameworks/svelte-store` (deferred: out of bounds — peer deps are package-level, not subpath-level; can't fix without splitting the svelte subpath into a separate package).
