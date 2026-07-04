# Reference

> **See also [LANGUAGE.md](./LANGUAGE.md)** for the vocabulary every recommendation uses (module, interface, depth, seam, adapter, leverage, locality, deletion test). Read it before applying the dependency categories below — the categories assume the vocabulary.

## Dependency Categories

When assessing a candidate for deepening, classify its dependencies:

### 1. In-process

Pure computation, in-memory state, no I/O. Always deepenable — just merge the modules and test directly.

> **Examples in this repo.** Most of `src/core/persist-core.ts`: the hydration gate, the write/throttle loop, the registry, the `migrate`/`buster`/`maxAge` helpers. Codec `encode` / `decode` (pure transforms between `StorageValue` and `TRaw`). `src/core/hydration.ts` (`HydrationSignal` construction).

### 2. Local-substitutable

Dependencies that have local test stand-ins. Deepenable if the test substitute exists. The deepened module is tested with the local stand-in running in the test suite.

> **Examples in this repo.** An in-memory `StateStorage` map doubles for `localStorage` / `idb-keyval` in `bun:test` (no DOM, no real storage). A hand-rolled `PersistableSource` (a plain object with `getState` / `setState` / `subscribe`) doubles for a TanStack Store — `src/core/persist-core.test.ts` exercises the whole middleware without `@tanstack/store`. The `HydrationSignal` is observed from outside the store, so framework adapters test against a synthetic signal, not a real React tree (the `tests-dom` suite covers the React rerender path separately).

### 3. Remote but owned (Ports & Adapters)

Your own services across a network boundary (a future remote/async storage backend, a sync service). Define a port (interface) at the module boundary. The deep module owns the logic; the transport is injected. Tests use an in-memory adapter. Production uses the real adapter.

Recommendation shape: "Define a `StateStorage<TRaw>` port (already the seam), implement an in-memory adapter for testing and the real transport adapter for production, so the persistence logic stays one deep module even though a backend is deployed across a network boundary."

> **Examples in this repo.** Today every backend is local (`localStorage`, `idb-keyval`), so category 3 is mostly forward-looking — the `StateStorage<TRaw>` seam is the port a future remote storage adapter would satisfy. The async read path (`getItem` returning a `Promise`) already routes through the same gate, so a remote adapter composes without core changes.

### 4. True external (Mock)

Third-party services you don't control (`idb-keyval`, `seroval`, `react`, `@tanstack/store`). Mock at the boundary. The deepened module takes the external dependency as an injected port, and tests provide a mock / stand-in.

> **Examples in this repo.** `idb-keyval` (the `./backends/idb` subpath is the adapter; tests use the in-memory `StateStorage`); `seroval` (the `./codecs/seroval` codec is the adapter; tests use a JSON passthrough codec); `react` (`src/adapters/frameworks/react.ts` is the adapter; `tests-dom` is the only place a real React renderer runs); `@tanstack/store` (`src/adapters/sources/tanstack-store.ts` is the adapter; core tests use a synthetic source).

## Seam discipline

(Distilled from the principles in [LANGUAGE.md § Principles](./LANGUAGE.md#principles).)

- **One adapter means a hypothetical seam. Two adapters means a real one.** Don't introduce a port unless at least two adapters are justified (typically sync + async, or two real backends). Concrete example: `localStorage` (sync) + `idb-keyval` (async) at the `StateStorage` seam IS two adapters — the sync-vs-async read-path divergence is a real seam, so the gate (`instanceof Promise`, deliberately not thenable duck-typing) stays. A "unified sync backend" that pretends async backends don't exist would invent a hypothetical seam to remove a real one — rejected.
- **Internal seams vs external seams.** A deep module can have internal seams (private to its implementation, used by its own tests) as well as the external seam at its interface. Don't expose internal seams through the interface just because tests use them. Concrete example: `persistSource` exposes a small external seam (`source`, `options`); internally it composes the hydration gate, write loop, cross-tab listener, and registry, each independently testable, none leaking.
- **Replace, don't layer.** Once tests live at the new external seam, the per-internal-seam unit tests on the parts you just deepened become waste — delete them in the same commit as the deepening.

## Testing Strategy

The core principle: **replace, don't layer.**

- Old unit tests on shallow modules are waste once boundary tests exist — delete them.
- Write new tests at the deepened module's interface boundary.
- Tests assert on observable outcomes through the public interface, not internal state.
- Tests should survive internal refactors — they describe behaviour, not implementation.

For boundary-enforcement candidates (rather than module-deepening), the equivalent is the **zero-dep core gate test** pattern: one architectural regression test that asserts the rule via static source scan / import graph, kept alongside the corresponding **oxlint** rule. This repo uses oxlint, not ESLint — see "Boundary enforcement" below.

## Boundary enforcement (oxlint)

This repo runs **oxlint only** (no ESLint, no `eslint-plugin-boundaries`). Architectural rules live in the repo-root `.oxlintrc.json` (and a nested config if a `src/` subfolder ever needs different rules). Use these built-in rules to codify boundary candidates:

- **`eslint/no-restricted-imports`** — directional rules. Use `patterns[].group` for gitignore-style globs or `patterns[].regex` for Rust regex. Scope per-folder by placing the rule in the appropriate config. Supports `allowTypeImports: true` for type-only escape hatches (a subpath entry may import the _type_ from another entry's `.d.ts` without pulling its peer-dep value) and `importNames` / `importNamePattern` for symbol-level rules.
- **`import/no-cycle`** — runs under oxlint's multi-file analysis. One config flip; no extra deps.
- **`oxc/no-barrel-file`** — flags a deep barrel. This repo deliberately has **no barrel** (subpath import is the dependency opt-in); the rule codifies that intent so a future root barrel doesn't sneak in.

### Nested-config rules (read before adding a new one)

oxlint resolves the **nearest** `.oxlintrc.json` for each file and **does not auto-merge with parents**. That has three concrete consequences:

1. **Always set `extends`.** Every nested config must extend a parent config that ultimately reaches the repo-root `.oxlintrc.json`, otherwise baseline plugins/rules silently disappear for the files it owns.
2. **The `!` negation in `files` does not work** in oxlint. A `files: ["**", "!persist-idb/**"]` override matches `persist-idb` files too, which silently shadows any `persist-idb`-specific rule defined in another override.
3. **Same rule key in two `overrides[]` matching the same file → later replaces earlier.** Patterns do not merge across overrides. Combine all applicable patterns into a single `no-restricted-imports` rule per scope.

Because of (2) and (3), the cleanest pattern is **one config file per scope** — the repo-root config plus a deeper config for any `src/` subfolder that needs different rules. Each leaf `extends` its parent and re-declares any rules it wants to carry alongside its own.

Canonical example layout (if `src/` ever grows a subfolder needing its own rule):

```text
.oxlintrc.json                 ← baseline only
src/.oxlintrc.json             ← extends root, core zero-dep value-import ban
src/adapters/backends/.oxlintrc.json ← extends ../, backends-seam-specific rules
```

Example leaf for a directional rule (keep `persist-core` / `hydration` free of peer-dep value imports — the zero-dep gate):

```json
{
  "$schema": "../../node_modules/oxlint/configuration_schema.json",
  "extends": ["../.oxlintrc.json"],
  "rules": {
    "no-restricted-imports": [
      "error",
      {
        "patterns": [
          {
            "group": [
              "seroval",
              "idb-keyval",
              "@tanstack/store",
              "react",
              "react-dom"
            ],
            "message": "Zero-dep core: peer deps are subpath opt-in, not core imports. Use the matching subpath entry."
          }
        ]
      }
    ]
  }
}
```

Public-surface rule: a subpath entry exports only its own public API; internal helpers stay unexported. The deliberate **no-barrel** policy (subpath = dependency opt-in) is the public-surface convention — codify with `oxc/no-barrel-file` at the root.

## Plan Template

Plan files live at `docs/plans/<short-kebab-name>.md`. Use this template:

```md
# <Plan title>

> Plan owner: <name or "open">. Status: **Draft / In progress / Landed**. Link from `docs/roadmap.md`.

## Problem

Describe the architectural friction:

- Which modules are shallow / which seam is currently unenforced.
- What integration risk exists in the seams between them.
- Why this makes the codebase harder to navigate, modify, or test.
- (If applicable) the inline `NOTE(...)` markers in source that point here.

## Proposed Interface (or Boundary)

The chosen design from Step 5–6 of the skill:

- Interface signature (types, methods, params), or the post-refactor `src/` shape + the lint config that enforces it.
- Usage example showing how callers use it.
- What complexity / which import classes it hides / forbids.

## Dependency Strategy

Which category from `REFERENCE.md` applies and how dependencies are handled:

- **In-process**: merged directly.
- **Local-substitutable**: tested with [specific stand-in] (in-memory `StateStorage`, synthetic `PersistableSource`).
- **Ports & adapters**: port definition, production adapter, test adapter.
- **Mock**: mock boundary for external services (`idb-keyval`, `seroval`, `react`, `@tanstack/store`).

## Migration

- **Import sites to update**: enumerate (Grep result), don't guess.
- **Backwards-compatible re-exports** (if any) and the deprecation window (changeset entry).
- **Order of operations**: the smallest landing-safe slices (tracer bullets).

## Testing Strategy

- **New boundary tests to write**: describe the behaviours to verify at the interface.
- **Architectural regression test** (if a boundary candidate): the gate test to add (zero-dep core, no-barrel, subpath peer ownership).
- **Old tests to delete**: list shallow-module tests that become redundant after the refactor.
- **Test environment needs**: any local stand-ins or adapters required (which runner — `bun:test` vs `tests-dom`).

## Glossary impact

- Terms in [`docs/glossary.md`](../../../docs/glossary.md) that get renamed, added, or have their canonical name changed by this plan. Update glossary on the same PR. If the term is genuinely domain-bearing and there's no glossary entry yet, recommend [`domain-modeling`](../domain-modeling/SKILL.md) first.

## Out of scope

- Things that look related but explicitly aren't part of this plan (so reviewers don't expect them).

## Open questions

- Anything the plan author needs a maintainer / domain expert to answer before / during execution.
```

## Project-specific conventions

- **File naming**: don't add a `-plan` suffix — the `plans/` folder provides context. `docs/plans/<short-kebab-name>.md`.
- **Roadmap link format**: `[<title>](./plans/<file>.md)` under the appropriate section in `docs/roadmap.md`.
- **Boundary candidates that need lint enforcement** should propose the exact `.oxlintrc.json` block in the same plan — see [Boundary enforcement](./REFERENCE.md#boundary-enforcement-oxlint) above.
- **Public-surface changes**: when the candidate touches the package public API (an `exports` map entry, a shipped `.d.mts`, the root `README.md`), the plan must include the migration path for **every** consumer-reachable import (and a changeset entry). The published typings are the public surface — don't guess; enumerate via `package.json` `exports` + `src/core/index.ts` re-exports.
- **Pure dead-code removal is not a plan candidate.** Those go directly into `docs/roadmap.md`. This skill is for plans that need design discussion.
- **Glossary cross-reference**: when the proposal renames or introduces a domain term, link to (and on the same PR, update) [`docs/glossary.md`](../../../docs/glossary.md). If there's no entry yet and the term is genuinely domain-bearing, recommend [`domain-modeling`](../domain-modeling/SKILL.md) first.
