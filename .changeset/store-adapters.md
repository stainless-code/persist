---
"@stainless-code/persist": minor
---

Add four source adapters over the `PersistableSource` seam — each is a thin `persistSource` wrapper mapping the library's store API:

- `./sources/zustand` (peer `zustand >=4.0.0`): `persistZustand(store, opts)` — zustand's `getState`/`setState`/`subscribe` map directly.
- `./sources/jotai` (peer `jotai >=2.0.0`): `persistJotai(store, atom, opts)` — wraps a writable atom + jotai `Store`; replace-merge default (like `persistAtom`) so primitive atoms don't hydrate to `{}`.
- `./sources/valtio` (peer `valtio >=1.0.0`): `persistValtio(proxyObject, opts)` — `snapshot` for reads, `Object.assign` for writes, `subscribe` for changes.
- `./sources/mobx` (peer `mobx >=6.0.0`): `persistMobx(observable, opts)` — `toJS` for reads, `Object.assign` for writes, `observe` for changes.

Each is its own subpath with the peer optional, no cross-entry value imports. README "Wrapping your store" recipe section shows both the shipped adapter + the underlying `persistSource` mapping for customization.
