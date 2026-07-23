---
name: persist-angular
description: Gate Angular UI on Persist hydration with useHydrated (readonly Signal). Call inside an injection context; use when avoiding flash of default state on async backends.
license: MIT
metadata:
  type: framework
  library: "@stainless-code/persist"
  library_version: "0.4.0"
  framework: "angular"
requires:
  - persist-core
sources:
  - stainless-code/persist:src/adapters/frameworks/angular.ts
---

# Angular hydration gate

This skill builds on `persist-core`. Read it first for `toHydrationSignal`.

`@stainless-code/persist/frameworks/angular` returns a readonly `Signal<boolean>`. Must be called in an **injection context** (`effect()` requires it — typically a component field initializer).

## Install

```bash
bun add @stainless-code/persist @angular/core
```

Peer: `@angular/core` `>=17.0.0`.

## Minimal wiring

```ts
import { useHydrated } from "@stainless-code/persist/frameworks/angular";

export class PrefsComponent {
  hydrated = useHydrated(prefsHydration);
}
```

```html
@if (hydrated()) {
<prefs-panel />
} @else {
<skeleton />
}
```

## Common mistakes

- **Calling outside injection context.**
- **Treating the signal as store state.**
- **SSR / null signal** — both surface as hydrated `true`.

## API surface

- `useHydrated(signal) → Signal<boolean>` (readonly)

See also: `persist-core`.
