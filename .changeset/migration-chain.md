---
"@stainless-code/persist": minor
---

Add `createMigrationChain` — a zero-dep core helper that builds a `migrate` callback from a per-version step chain. The returned function walks `steps[fromVersion]` → `steps[fromVersion+1]` → … → `steps[version-1]`, awaiting each, so a payload at any supported older version migrates to the current one. Plug it into `PersistOptions.migrate`.

- Options bag: `version` (current), `steps` (keyed by the version each step transforms _from_), `onNewer` (default `"throw"` — a downgrade is a bug), `onOlder` (default `"discard"` — you dropped support for that version).
- Eager construction validation: a gap in the covered range, an out-of-range step key, or a non-integer version throws now, not on a payload months later.
- Beyond TanStack Persist's `buster` (which discards on mismatch) — this transforms instead.
