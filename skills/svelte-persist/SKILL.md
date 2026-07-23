---
name: svelte-persist
description: Gate Svelte 5 runes UI on Persist hydration with hydratedRune (.current). Use for Svelte 5; for stores / Svelte 3–4 use svelte-store-persist.
license: MIT
metadata:
  type: framework
  library: "@stainless-code/persist"
  library_version: "0.4.0"
  framework: "svelte"
requires:
  - persist
sources:
  - stainless-code/persist:src/adapters/frameworks/svelte.ts
---

# Svelte 5 runes hydration gate

`@stainless-code/persist/frameworks/svelte` exports `hydratedRune(signal)` → `{ readonly current: boolean }`. Read `.current` inside `$derived` / `$effect` / `{#if}` (createSubscriber is lazy inside a reactive owner).

**Stores / Svelte 3–4 / Svelte 5 store users → `svelte-store-persist`** (`./frameworks/svelte-store`).

## Install

```bash
bun add @stainless-code/persist svelte
```

Needs Svelte **5.7+** for `svelte/reactivity` `createSubscriber` (package peer allows `>=3` because of the separate store entry).

## Minimal wiring

```svelte
<script>
  import { hydratedRune } from "@stainless-code/persist/frameworks/svelte";
  const hydrated = hydratedRune(prefsHydration);
</script>

{#if !hydrated.current}
  <Skeleton />
{:else}
  <Prefs />
{/if}
```

## Contracts

Null/undefined → `current: true`. SSR: hydrated `true`.

## Common mistakes

- **Using this entry for store-based UI.** Import `svelte-store-persist`.
- **Reading `.current` outside a reactive owner** — subscribe is a no-op.
- **Expecting a `useHydrated` name** — runes API is `hydratedRune`.

## API surface

- `hydratedRune(signal) → { readonly current: boolean }`

See also: `svelte-store-persist`.
