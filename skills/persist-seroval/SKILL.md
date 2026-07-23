---
name: persist-seroval
description: Persist Set/Map/Date (and richer graphs) with @stainless-code/persist/codecs/seroval (serovalCodec / createSerovalStorage). Use when JSON.stringify would lose types on string-wire backends.
license: MIT
metadata:
  type: composition
  library: "@stainless-code/persist"
  library_version: "0.4.0"
  framework: "seroval"
requires:
  - persist
sources:
  - stainless-code/persist:src/adapters/codecs/seroval.ts
---

# Seroval codec

This skill builds on `persist`. Read it first for `createStorage` / `clearCorruptOnFailure`.

`@stainless-code/persist/codecs/seroval` round-trips values JSON cannot (`Set`/`Map`/`Date`) via `seroval` `toJSON`/`fromJSON` on string-wire backends (`localStorage`, etc.).

## Install

```bash
bun add @stainless-code/persist seroval
```

Peer: `seroval` `>=1.0.0` (optional of this subpath).

## Minimal wiring

```ts
import { createSerovalStorage } from "@stainless-code/persist/codecs/seroval";

const storage = createSerovalStorage<Prefs>(() => localStorage, {
  clearCorruptOnFailure: true,
});
```

Or `createStorage(getStorage, serovalCodec(), opts)`.

## Common mistakes

- **Using `createJSONStorage` for Set/Map/Date** — they won't round-trip.
- **Layering seroval on default IDB** — `persist-idb` already uses structured clone / `identityCodec`.
- **Forgetting the `seroval` peer.**

## API surface

- `serovalCodec<S>() → StorageCodec<S>`
- `createSerovalStorage(getStorage, options?) → PersistStorage | undefined`

See also: `persist-idb` for structured-clone without seroval; `persist`.
