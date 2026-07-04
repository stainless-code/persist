---
"@stainless-code/persist": patch
---

`createStorage` now shape-checks the resolved backend and treats one missing `getItem`/`setItem`/`removeItem` as unavailable. Fixes the Node 22+ SSR crash where `localStorage` exists as an object (so the availability lookup doesn't throw) but its methods are `undefined` without a valid `--localstorage-file` path — previously this passed availability and threw `storage.getItem is not a function` inside `hydrate`; now `persistSource`/`persistStore`/`persistAtom` collapse to the no-op `PersistApi`.
