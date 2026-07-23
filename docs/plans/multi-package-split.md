# Multi-package split

Turn the single `@stainless-code/persist` package (subpaths + optional-peer soup) into a **layers-shaped** bun-workspaces monorepo: private root, **zero-peer** `@stainless-code/persist` in `packages/core`, opt-in packages wherever an npm peer exists. Skills already name the units (`skills/<name>/`); this plan maps them to publishable packages.

When this ships: lift durable bits into `docs/architecture.md` + README story + docs-governance README surfaces; delete this file (per [docs-governance § Closing a plan](../../.agents/skills/docs-governance/LIFECYCLE.md)).

## Why

- **Install burden** — consumers must not carry peers/deps for adapters they never import. Optional peers on one package still tax the graph and optics.
- **Product tenets** — open/agnostic core; adapters layered and opt-in; predictable package scope.
- **Naming** — framework packages are `<fw>-persist`; concern packages are `persist-<leaf>` (skills already use these names).
- **Skills lead** — `skills/` is already split 1:1 with intended namespaces (v0.4.1). Package layout should match.
- **Workspace infra** — match [layers](https://github.com/stainless-code/layers): private root, `packages/*`, per-package build/skills/README.

## Rules

1. **Core has zero peers** — no `peerDependencies` / `peerDependenciesMeta` on `@stainless-code/persist`.
2. **Npm peer ⇒ own package** — that peer is **required** on the satellite (not optional). Zero-peer compose (platform globals, vendored types, Node built-ins) stays on core as subpaths — skill ≠ package. Includes `node-fs` (`node:fs` is not an npm peer).
3. **Satellites depend on core** — `dependencies: { "@stainless-code/persist": "workspace:*" }` (like layers). Not a peerDependency; Rule 5 is about import composition, not a second `bun add`.
4. **Skill ships with the package that owns the code** — move root `skills/` into `packages/*/skills/`; delete the root bag.
5. **No core re-export from satellites** — consumers compose ≥2 import surfaces (source + storage ± gate). Unlike layers adapters, satellites do not re-export core.
6. **Framework packages are hydration bindings only** — `useHydrated` / `HydrationController` / etc.; not a UI kit. Name: `<fw>-persist`.
7. **Breaking cut at 0.5.0** — hard cut (remove peer-backed subpaths); CHANGELOG + migration path table; no codemod (pre-1.0). No forever mega-package that re-exports every satellite. **1.0.0 later** = stability seal only, not another package-shape break.
8. **Independent versions** — changesets `fixed: []`; `updateInternalDependencies: "patch"`. First publish wave: all packages at **0.5.0**; independent afterward.
9. **No breaking npm until the full set is ready** — infra may land early if the `0.4.x` publish surface is unchanged; do not publish a half-split.

## Package catalog

### `@stainless-code/persist` — zero peer (`packages/core`)

| Subpath                    | Skill                     | Symbols                                                                               |
| -------------------------- | ------------------------- | ------------------------------------------------------------------------------------- |
| `.`                        | `persist`                 | `persistSource`, storage/codec factories, hydration signal APIs, types                |
| `./backends/encrypted`     | `persist-encrypted`       | `createEncryptedStorage`                                                              |
| `./backends/compressed`    | `persist-compressed`      | `createCompressedStorage`                                                             |
| `./backends/node-fs`       | `persist-node-fs`         | `nodeFsStateStorage`                                                                  |
| `./transport/crosstab`     | `persist-crosstab`        | `createBroadcastCrossTab`                                                             |
| `./codecs/standard-schema` | `persist-standard-schema` | `withStandardSchema*`, `createStandardSchemaStorage` (vendored `~standard` — no peer) |

Deps/peers: **none**.

### Concern satellites — `persist-<leaf>`, required peer

Each: `dependencies: { "@stainless-code/persist": "workspace:*" }`, entry `.`, no core re-export. Peer ranges: carry forward from today's root `peerDependencies`.

| Package                                  | Skill                    | Old path                   | Required peer                               |
| ---------------------------------------- | ------------------------ | -------------------------- | ------------------------------------------- |
| `@stainless-code/persist-seroval`        | `persist-seroval`        | `./codecs/seroval`         | `seroval`                                   |
| `@stainless-code/persist-idb`            | `persist-idb`            | `./backends/idb`           | `idb-keyval`                                |
| `@stainless-code/persist-async-storage`  | `persist-async-storage`  | `./backends/async-storage` | `@react-native-async-storage/async-storage` |
| `@stainless-code/persist-mmkv`           | `persist-mmkv`           | `./backends/mmkv`          | `react-native-mmkv`                         |
| `@stainless-code/persist-secure-store`   | `persist-secure-store`   | `./backends/secure-store`  | `expo-secure-store`                         |
| `@stainless-code/persist-tanstack-store` | `persist-tanstack-store` | `./sources/tanstack-store` | `@tanstack/store`                           |
| `@stainless-code/persist-zustand`        | `persist-zustand`        | `./sources/zustand`        | `zustand`                                   |
| `@stainless-code/persist-jotai`          | `persist-jotai`          | `./sources/jotai`          | `jotai`                                     |
| `@stainless-code/persist-valtio`         | `persist-valtio`         | `./sources/valtio`         | `valtio`                                    |
| `@stainless-code/persist-mobx`           | `persist-mobx`           | `./sources/mobx`           | `mobx`                                      |
| `@stainless-code/persist-pinia`          | `persist-pinia`          | `./sources/pinia`          | `pinia`                                     |
| `@stainless-code/persist-redux`          | `persist-redux`          | `./sources/redux`          | `redux`                                     |

### Framework packages — `<fw>-persist`

Hydration gate only. Each: dep on `@stainless-code/persist`, required framework peer, no core re-export.

| Package                                | Skill                  | Old path                    | Required peer   | Export                               |
| -------------------------------------- | ---------------------- | --------------------------- | --------------- | ------------------------------------ |
| `@stainless-code/react-persist`        | `react-persist`        | `./frameworks/react`        | `react`         | `useHydrated`                        |
| `@stainless-code/preact-persist`       | `preact-persist`       | `./frameworks/preact`       | `preact`        | `useHydrated`                        |
| `@stainless-code/vue-persist`          | `vue-persist`          | `./frameworks/vue`          | `vue`           | `useHydrated`                        |
| `@stainless-code/solid-persist`        | `solid-persist`        | `./frameworks/solid`        | `solid-js`      | `useHydrated`                        |
| `@stainless-code/angular-persist`      | `angular-persist`      | `./frameworks/angular`      | `@angular/core` | `useHydrated`                        |
| `@stainless-code/lit-persist`          | `lit-persist`          | `./frameworks/lit`          | `lit`           | `HydrationController`                |
| `@stainless-code/alpine-persist`       | `alpine-persist`       | `./frameworks/alpine`       | `alpinejs`      | plugin / `useHydrated` / `$hydrated` |
| `@stainless-code/svelte-persist`       | `svelte-persist`       | `./frameworks/svelte`       | `svelte`        | `hydratedRune`                       |
| `@stainless-code/svelte-store-persist` | `svelte-store-persist` | `./frameworks/svelte-store` | `svelte`        | `hydratedStore`                      |

Skills already split Svelte runes vs stores into **two** packages — keep that (not `svelte-persist/store`).

### Test helpers — private, not published

Today `src/testing/` is already omitted from `dist` / typedoc. Do **not** publish `@stainless-code/persist-testing`.

| Home                                       | Contents                                                                  | Why                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `packages/test-utils/` (`"private": true`) | `MemoryStorage`, `createMockSource`, `waitForHydration`, isolation assert | Shared by core + every satellite test; `devDependency: workspace:*` |

**Not** a public export on core. **Not** copied per package. Generalize `itImportsOnlyFromCore` → “imports only `@stainless-code/persist` + own peer”.

**Published count:** 1 core + 12 concern + 9 framework = **22**. Plus one private workspace package for tests.

## Old path → new

| Old                         | New                                      |
| --------------------------- | ---------------------------------------- |
| `@stainless-code/persist`   | same                                     |
| `…/backends/encrypted`      | same                                     |
| `…/backends/compressed`     | same                                     |
| `…/backends/node-fs`        | same                                     |
| `…/transport/crosstab`      | same                                     |
| `…/codecs/standard-schema`  | same                                     |
| `…/codecs/seroval`          | `@stainless-code/persist-seroval`        |
| `…/backends/idb`            | `@stainless-code/persist-idb`            |
| `…/backends/async-storage`  | `@stainless-code/persist-async-storage`  |
| `…/backends/mmkv`           | `@stainless-code/persist-mmkv`           |
| `…/backends/secure-store`   | `@stainless-code/persist-secure-store`   |
| `…/sources/tanstack-store`  | `@stainless-code/persist-tanstack-store` |
| `…/sources/zustand`         | `@stainless-code/persist-zustand`        |
| `…/sources/jotai`           | `@stainless-code/persist-jotai`          |
| `…/sources/valtio`          | `@stainless-code/persist-valtio`         |
| `…/sources/mobx`            | `@stainless-code/persist-mobx`           |
| `…/sources/pinia`           | `@stainless-code/persist-pinia`          |
| `…/sources/redux`           | `@stainless-code/persist-redux`          |
| `…/frameworks/react`        | `@stainless-code/react-persist`          |
| `…/frameworks/preact`       | `@stainless-code/preact-persist`         |
| `…/frameworks/vue`          | `@stainless-code/vue-persist`            |
| `…/frameworks/solid`        | `@stainless-code/solid-persist`          |
| `…/frameworks/angular`      | `@stainless-code/angular-persist`        |
| `…/frameworks/lit`          | `@stainless-code/lit-persist`            |
| `…/frameworks/alpine`       | `@stainless-code/alpine-persist`         |
| `…/frameworks/svelte`       | `@stainless-code/svelte-persist`         |
| `…/frameworks/svelte-store` | `@stainless-code/svelte-store-persist`   |

## Monorepo layout

```
package.json            # private monorepo root (layers-monorepo shape)
packages/
  core/                 # @stainless-code/persist
    skills/{persist,persist-encrypted,persist-compressed,persist-node-fs,persist-crosstab,persist-standard-schema}/
  seroval/              # @stainless-code/persist-seroval + skill
  idb/
  async-storage/
  mmkv/
  secure-store/
  tanstack-store/
  zustand/
  jotai/
  valtio/
  mobx/
  pinia/
  redux/
  react/                # @stainless-code/react-persist + skill
  preact/
  vue/
  solid/
  angular/
  lit/
  alpine/
  svelte/
  svelte-store/         # @stainless-code/svelte-store-persist + skill
  test-utils/           # private — MemoryStorage, mocks, isolation assert (not published)
```

Workspace tooling (match layers): bun workspaces `apps/*` + `packages/*`, `@stainless-code/source` export condition, sherif/knip, changesets, per-package tsdown + size-limit. Isolation assert: each adapter imports only `@stainless-code/persist` + its peer.

## README surfaces (on land)

- **Root `README.md`** — monorepo index (package table + install pointers), not the sole npm blurb.
- **`packages/*/README.md`** — npm landing per publishable (install, peer, short taste).
- Update [docs-governance § README surfaces](../../.agents/skills/docs-governance/LIFECYCLE.md) from “root README = npm landing” to this layers model.
- `apps/docs` remains canonical public docs.

## Install examples (target)

```bash
# headless + localStorage (core alone)
bun add @stainless-code/persist

# zustand + idb + React hydrate gate (core comes transitively; listing it is fine)
bun add @stainless-code/persist-zustand @stainless-code/persist-idb @stainless-code/react-persist

# RN + mmkv
bun add @stainless-code/persist-mmkv
```

## Migration

- Baseline: freeze last single-package **`0.4.x`**.
- Ship multi-package as **`0.5.0`** across all 22 publishables: move the 21 peer-backed entries; leave zero-peer subpaths on core.
- **No codemod** — CHANGELOG breaking section + old→new table (above) + docs install paths.
- No runtime shim / core re-export of satellites (recreates peer soup).
- Update `apps/docs`, per-package READMEs, skill `library:` metadata, typedoc entry points, `sync-skill-versions` for multi-package.

## Non-goals

- One package per zero-peer wrapper (`persist-encrypted` / `persist-node-fs` as npm) — skill yes, package no.
- Umbrella / suite meta-package that re-aggregates all peers.
- Renaming framework packages to `persist-react` — rejected; keep `<fw>-persist`.
- Folding `svelte-store-persist` into `svelte-persist/store` — skills already chose two packages.
- Codemod / calling the split **1.0.0** — deferred; v1 is a later stability seal.
- Core re-export from satellites (layers does this; persist does not).

## Acceptance

- [ ] Workspace builds/publishes all 22 packages at `0.5.0`; core `peerDependencies` empty; root package private.
- [ ] Each satellite declares exactly one required peer (svelte pair: both peer `svelte`) + `dependencies` on core.
- [ ] Skills live under owning package; root `skills/` gone; `library` metadata points at that package.
- [ ] Isolation + zero-dep core gates green; sherif/knip green.
- [ ] CHANGELOG + docs cover old→new table; no half-split publish.
- [ ] Root README = monorepo index; per-package npm READMEs; docs-governance README surfaces updated.
- [ ] Happy-path installs above typecheck without unrelated peers in the lockfile noise.
