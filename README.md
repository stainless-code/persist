# @stainless-code/persist

**Any store, any storage, one middleware — no flash.**

Hydration-aware persistence for any reactive store — no hydrate flash, no SSR mismatch. Store-agnostic via a structural `PersistableSource` (TanStack Store, zustand, jotai, valtio, mobx, pinia, redux, or a hand-rolled atom); three composable seams (backend × codec × source) so you swap storage, serialization, or framework without rewriting. A first-class hydration signal gates UI on async backends; opt-in cross-tab sync, versioned migrations, encrypted/compressed backends, and retry-on-quota. Framework adapters for React, Preact, Solid, Angular, Vue, Lit, Alpine, and Svelte.

[![bundle size](https://deno.bundlejs.com/?q=@stainless-code/persist&badge=detailed)](https://bundlejs.com/?q=@stainless-code/persist)

**Docs:** [https://stainless-code.com/persist](https://stainless-code.com/persist)

## Install

```bash
bun add @stainless-code/persist
```

## Quick start

```ts
import { Store } from "@tanstack/store";
import { createSerovalStorage } from "@stainless-code/persist/codecs/seroval";
import { persistStore } from "@stainless-code/persist/sources/tanstack-store";
import { toHydrationSignal } from "@stainless-code/persist";
import { useHydrated } from "@stainless-code/persist/frameworks/react";

const store = new Store({ theme: "light" });
const persist = persistStore(store, {
  name: "app:prefs:v1",
  storage: createSerovalStorage(() => localStorage),
});
export const prefsHydration = toHydrationSignal(persist);

// in a component:
const { hydrated } = useHydrated(prefsHydration);
```

## Documentation

|                                                                              |                                                 |
| ---------------------------------------------------------------------------- | ----------------------------------------------- |
| [Getting started](https://stainless-code.com/persist/guides/getting-started) | Install, peers, quick start                     |
| [Guides](https://stainless-code.com/persist/guides)                          | Hydration, IndexedDB + React, migrations, FAQ   |
| [Recipes](https://stainless-code.com/persist/recipes)                        | Encrypt, options, wrapping stores, cross-tab    |
| [Concepts](https://stainless-code.com/persist/concepts)                      | Three seams, storage/codec choice, entry points |
| [Reference](https://stainless-code.com/persist/reference/api)                | Generated API (TypeDoc)                         |
| [Changelog](https://stainless-code.com/persist/changelog)                    | GitHub Releases                                 |
