---
"@stainless-code/persist": patch
---

Treat a defined-but-broken storage backend (e.g. Node 22+ `localStorage` without a valid `--localstorage-file` path, where the global exists as an object but `getItem`/`setItem`/`removeItem` are `undefined`) as unavailable. `createStorage` now shape-checks the backend and returns `undefined`, so `persistSource`/`persistStore`/`persistAtom` collapse to the no-op `PersistApi` instead of throwing `storage.getItem is not a function` during SSR hydration.
