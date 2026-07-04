# Language

Shared vocabulary for every suggestion this skill makes. Use these terms exactly — don't substitute "component," "service," "API," or "boundary." Consistent language is the whole point of this file: a glossary stops the next round of "did 'storage' mean the backend, the codec's wire type, or the composed PersistStorage?" drift.

> Vocabulary extends the seam model in [`docs/architecture.md`](../../../docs/architecture.md) and the persistence nouns in [`docs/glossary.md`](../../../docs/glossary.md). Those cover domain terms; this file covers architecture nouns.

## Terms

**Module**
Anything with an interface and an implementation. Deliberately scale-agnostic — applies equally to a function, a class, a file with a public surface, or a subpath entry.
_Avoid_: unit, component, service. ("Component" conflicts with React component; use "Module" even when the module is `use-hydrated.ts`.)
_Examples in this repo_: a single factory (`createStorage`); a subpath entry (`src/adapters/backends/idb.ts`); the core entry (`src/core/persist-core.ts` + `src/core/hydration.ts` behind `src/core/index.ts`); a codec (`src/adapters/codecs/seroval.ts`).

**Interface**
Everything a caller must know to use the module correctly. Includes the type signature, but also: invariants, ordering constraints, error modes, required configuration, the wire-type contract it depends on, the `HydrationSignal` observation contract.
_Avoid_: API (overloaded with the package public API), signature (too narrow — only the type-level surface).
_Examples in this repo_: `createStorage(backend, codec, options)`'s interface includes the invariant that a codec factory takes the backend as an argument (factory policy); `PersistableSource<TState>`'s interface includes the structural `getState` / `setState` / `subscribe` triple — store-agnostic by design.

**Implementation**
What's inside a module — its body of code. Distinct from **Adapter**: a thing can be a small adapter with a large implementation (an IndexedDB backend wrapping `idb-keyval` + retries) or a large adapter with a small implementation (a passthrough `localStorage` backend).
_Reach for_ "adapter" when the seam is the topic; "implementation" otherwise.

**Depth**
Leverage at the interface — the amount of behaviour a caller (or test) can exercise per unit of interface they have to learn. A module is **deep** when a large amount of behaviour sits behind a small interface. A module is **shallow** when the interface is nearly as complex as the implementation.
_Examples in this repo_: `persistSource(source, options)` is deep — one call hides hydration-on-create, subscribe-writes (gated until hydrated), throttle, cross-tab sync, teardown. A thin wrapper that just re-exports `createStorage` + `persistSource` with no added behaviour would be shallow.

**Seam** _(from Michael Feathers' "Working Effectively with Legacy Code")_
A place where you can alter behaviour without editing in that place. The _location_ at which a module's interface lives. Choosing where to put the seam is its own design decision, distinct from what goes behind it.
_Avoid_: "boundary" — overloaded with DDD's bounded context AND with oxlint folder bans. Say **seam** when you mean "the testable place" and **lint boundary** when you mean "the enforced folder rule".
_Examples in this repo_: the three seams in `docs/architecture.md` — **backend** (`StateStorage<TRaw>`), **codec** (`StorageCodec<S, TRaw>`), **source** (`PersistableSource<TState>`) — are the seams at which every backend × codec × source cell is a one-line composition; the `HydrationSignal` is the seam at which framework adapters (React `useSyncExternalStore`, Svelte, Solid, Vue) observe hydration without coupling to the store's read path.

**Adapter**
A concrete thing that satisfies an interface at a seam. Describes _role_ (what slot it fills), not substance (what's inside).
_Examples in this repo_: each backend (`localStorage` adapter, `idb-keyval` adapter) is an adapter at the `StateStorage<TRaw>` seam; each codec (`persist-seroval`, a JSON passthrough) is an adapter at the `StorageCodec` seam; `useHydrated` is the React adapter at the `HydrationSignal` seam. Two adapters per seam = real seam (sync backend + async backend); one adapter = hypothetical.

**Leverage**
What callers get from depth. More capability per unit of interface they have to learn. One implementation pays back across N call sites and M tests.
_Example_: `createStorage(backend, codec, options)` carries the whole composed-`PersistStorage` shape; every framework adapter and consumer gets storage in one call. Adding a new backend is one adapter, not N call-site edits.

**Locality**
What maintainers get from depth. Change, bugs, knowledge, and verification concentrate at one place rather than spreading across callers. Fix once, fixed everywhere.
_Example_: the `instanceof Promise` gate on the read path lives in one place in `persist-core`; every backend (sync or async) routes through it. Changing the async-detection rule is one edit, not per-backend.

## Principles

- **Depth is a property of the interface, not the implementation.** A deep module can be internally composed of small, mockable, swappable parts — they just aren't part of the interface. A module can have **internal seams** (private to its implementation, used by its own tests) as well as the **external seam** at its interface. Example: `persist-core` exposes `persistSource` / `createStorage` (small external seam) but internally composes the hydration gate, the write loop, the cross-tab listener, the registry — each testable in isolation; none leak through the external interface.

- **The deletion test.** Imagine deleting the module. If complexity vanishes, the module wasn't hiding anything (it was a pass-through). If complexity reappears across N callers, the module was earning its keep. Use this test on every shallow-module-suspect — the "yes, concentrates" answer is the signal you want to deepen.
  - **Example: a passing deletion test** — deleting `createStorage` would resurrect per-composition wiring (backend + codec + options merge + `PersistStorage` construction) across every consumer. Deep, earning its keep.
  - **Example: a failing deletion test** — a wrapper that just re-exported `persistSource` under another name. Deleting it removes the indirection without resurrecting any complexity. Shallow; deletion correct.

- **The interface is the test surface.** Callers and tests cross the same seam. If you want to test _past_ the interface, the module is probably the wrong shape. Example: the zero-dep core gate test asserts the invariant (`persist-core` + `hydration` import no value from a peer dep) via a static source scan at the package seam — no test reaches inside to mock imports.

- **One adapter means a hypothetical seam. Two adapters means a real one.** Don't introduce a seam unless something actually varies across it. Example: a `StateStorage` port with only a `localStorage` adapter is hypothetical; add the `idb-keyval` adapter and it's a real seam (sync vs async read path). Don't introduce a "backend factory per codec" seam before a second backend genuinely needs per-codec adaptation — the factory policy (`createStorage(backend, codec)`) exists because backends and codecs compose, not because every pair needs bespoke wiring.

## Relationships

- A **Module** has exactly one **Interface** (the surface it presents to callers and tests).
- **Depth** is a property of a **Module**, measured against its **Interface**.
- A **Seam** is where a **Module**'s **Interface** lives.
- An **Adapter** sits at a **Seam** and satisfies the **Interface**.
- **Depth** produces **Leverage** for callers and **Locality** for maintainers.

## Rejected framings

- **Depth as ratio of implementation-lines to interface-lines** (one common mis-reading of Ousterhout): rewards padding the implementation. We use depth-as-leverage instead.
- **"Interface" as the TypeScript `interface` keyword or a class's public methods**: too narrow — interface here includes every fact a caller must know (invariants, ordering, error modes, the wire-type contract).
- **"Boundary"**: overloaded with DDD's bounded context AND with the lint-rule meaning we use for oxlint folder bans. Say **seam** when you mean "the testable place" and **lint boundary** when you mean "the enforced folder rule".

## Reference

- [`improve-codebase-architecture`](./SKILL.md)
- Project glossary (persistence domain terms, distinct from this architecture vocabulary): [`docs/glossary.md`](../../../docs/glossary.md). **They're complementary** — the project glossary covers domain nouns (`backend`, `codec`, `source`, `envelope`, `hydration signal`); this file covers architecture nouns (`module`, `seam`, `adapter`).
- Origin: John Ousterhout, "A Philosophy of Software Design" (deep modules); Michael Feathers, "Working Effectively with Legacy Code" (seams).
