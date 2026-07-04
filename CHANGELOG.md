# @stainless-code/persist

## 0.1.1

### Patch Changes

- [#4](https://github.com/stainless-code/persist/pull/4) [`efc5614`](https://github.com/stainless-code/persist/commit/efc5614799cd26c7e81b8a679d13f058deadd475) Thanks [@SutuSebastian](https://github.com/SutuSebastian)! - `createStorage` now shape-checks the resolved backend and treats one missing `getItem`/`setItem`/`removeItem` as unavailable. Fixes the Node 22+ SSR crash where `localStorage` exists as an object (so the availability lookup doesn't throw) but its methods are `undefined` without a valid `--localstorage-file` path — previously this passed availability and threw `storage.getItem is not a function` inside `hydrate`; now `persistSource`/`persistStore`/`persistAtom` collapse to the no-op `PersistApi`.

## 0.1.0

### Minor Changes

- [#2](https://github.com/stainless-code/persist/pull/2) [`dbf0428`](https://github.com/stainless-code/persist/commit/dbf0428edf45479a45dd6a092ba7f130278b9691) Thanks [@SutuSebastian](https://github.com/SutuSebastian)! - Ship consumer Agent Skills via TanStack Intent. Adds `skills/tanstack-store/SKILL.md` (packaged in the npm tarball), the `tanstack-intent` keyword for registry discovery, `intent:validate` / `intent:stale` scripts, `intent validate` gated in `prepublishOnly`, and a `check-skills.yml` CI workflow for skill validation + post-release staleness review. No runtime API change.
