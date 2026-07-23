---
name: persist-vue
description: Gate Vue 3 UI on Persist hydration with useHydrated (shallowRef). Use in setup/effectScope when avoiding flash of default state on async backends.
license: MIT
metadata:
  type: framework
  library: "@stainless-code/persist"
  library_version: "0.4.0"
  framework: "vue"
requires:
  - persist-core
sources:
  - stainless-code/persist:src/adapters/frameworks/vue.ts
---

# Vue hydration gate

This skill builds on `persist-core`. Read it first for `toHydrationSignal`.

`@stainless-code/persist/frameworks/vue` returns a `Ref<boolean>` (`shallowRef`). Call inside `setup()` / an active `effectScope()` so `onScopeDispose` unsubscribes.

## Install

```bash
bun add @stainless-code/persist vue
```

Peer: `vue` `>=3.3.0`.

## Minimal wiring

```ts
import { toHydrationSignal } from "@stainless-code/persist";
import { useHydrated } from "@stainless-code/persist/frameworks/vue";

const prefsHydration = toHydrationSignal(persist);
// in setup():
const hydrated = useHydrated(prefsHydration);
```

```vue
<Skeleton v-if="!hydrated" />
<PrefsPanel v-else />
```

## Common mistakes

- **Calling outside setup / scope** — leak or no teardown.
- **Treating the ref as store state.**
- **SSR expects `false`.** Server renders hydrated `true`.

## API surface

- `useHydrated(signal) → Ref<boolean>`

See also: `persist-pinia` for Pinia store wiring; `persist-core`.
