---
"@stainless-code/persist": minor
---

Add `createMigrationChain` — a zero-dep core helper that builds a `migrate` callback from a per-version step chain. Plug into `PersistOptions.migrate`.

- `steps[N]` takes vN → v(N+1); the chain walks from the stored version to `version`, awaiting each.
- `onNewer` (default `"throw"` — a downgrade is a bug) / `onOlder` (default `"discard"` — dropped support for that version).
- Eager construction validation: a gap in the covered range, an out-of-range key, or a non-integer version throws now.
- Beyond TanStack `buster` (discards on mismatch) — transforms instead.
