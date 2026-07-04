---
"@stainless-code/persist": minor
---

Add `./backends/node-fs` — `nodeFsStateStorage({ dir })`, an async `StateStorage<string>` over Node `fs.promises` (one file per key under `dir`). No peer dep (`node:fs` is a Node built-in). Keys are sanitized to filename-safe segments (`app:prefs:v1` → `app_prefs_v1`); missing files map to `null` (no throw); the dir is created lazily on first write. Compose with `createStorage(() => nodeFsStateStorage({ dir }), codec)`. Unblocks server / SSR / CLI persistence.

Also adds a pack-validation + semver gate (`check:pack`: `@arethetypeswrong/cli` + `publint` + `knip`) wired into CI (`check-pack` job) + `prepublishOnly`; and README storage + codec decision matrices.
