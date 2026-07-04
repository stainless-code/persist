---
"@stainless-code/persist": minor
---

Add `./crosstab` subpath — `createBroadcastCrossTab`, a zero-dep `BroadcastChannel` bridge for cross-tab sync over backends that fire no `storage` events (IndexedDB). Returns `{ crossTabEventTarget, wrap, close }`: pass the target as `crossTabEventTarget` and `wrap(storage)` as `storage` so writes/removes broadcast to other tabs. Posts `storageArea: null` on every event so key-only matching applies in every tab (each tab owns its own backend instance — reference equality on `raw` would fail across tabs). Guards `BroadcastChannel` availability (SSR, Node <18) and posts after the write settles so receivers rehydrate into committed state.
