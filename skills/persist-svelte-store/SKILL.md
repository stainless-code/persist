---
name: persist-svelte-store
description: Gate Svelte store-based UI on Persist hydration with hydratedStore (Readable). Use for Svelte 3–4 or Svelte 5 apps that still use stores; runes UI → persist-svelte.
license: MIT
metadata:
  type: framework
  library: "@stainless-code/persist"
  library_version: "0.4.0"
  framework: "svelte-store"
requires:
  - persist-core
sources:
  - stainless-code/persist:src/adapters/frameworks/svelte-store.ts
---

# Svelte stores hydration gate

This skill builds on `persist-core`. Read it first for `toHydrationSignal`.

`@stainless-code/persist/frameworks/svelte-store` exports `hydratedStore(signal) → Readable<boolean>`. Use `$hydrated` auto-subscribe in templates. **Separate public entry** from `./frameworks/svelte` (runes).

## Install

```bash
bun add @stainless-code/persist svelte
```

Peer: `svelte` `>=3.0.0`.

## Minimal wiring

```svelte
<script>
  import { hydratedStore } from "@stainless-code/persist/frameworks/svelte-store";
  const hydrated = hydratedStore(prefsHydration);
</script>

{#if !$hydrated}
  <Skeleton />
{:else}
  <Prefs />
{/if}
```

## Common mistakes

- **Using this for Svelte 5 runes UI.** Use `persist-svelte` / `hydratedRune`.
- **Forgetting the `$` prefix** in templates.
- **Null signal ≠ loading** → `readable(true)`.

## API surface

- `hydratedStore(signal) → Readable<boolean>`

See also: `persist-svelte`; `persist-core`.
