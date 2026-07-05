---
"@stainless-code/persist": minor
---

Add four source adapters over the `PersistableSource` seam — shape-named (not library-named): same persistable shape → same name → same merge semantics, regardless of library; the subpath carries the library. Each is a thin `persistSource` wrapper mapping the library's store API:

- `./sources/zustand` (peer `zustand >=4.0.0`): `persistStore(store, opts)` — zustand's `getState`/`setState`/`subscribe` map directly. Same name + shallow-spread merge as `./sources/tanstack-store`'s `persistStore` (same shape); alias one if importing both.
- `./sources/jotai` (peer `jotai >=2.0.0`): `persistAtom(store, atom, opts)` — wraps a writable atom + jotai `Store`; replace-merge default (like `persistAtom` from `./sources/tanstack-store`) so primitive atoms don't hydrate to `{}`.
- `./sources/valtio` (peer `valtio >=1.0.0`): `persistProxy(proxyObject, opts)` — `snapshot` for reads, `Object.assign` for writes, `subscribe` for changes.
- `./sources/mobx` (peer `mobx >=6.0.0`): `persistObservable(observable, opts)` — `toJS` for reads, `Object.assign` for writes, `observe` for changes.

Each is its own subpath with the peer optional, no cross-entry value imports. README "Wrapping your store" recipe section shows both the shipped adapter + the underlying `persistSource` mapping for customization.
