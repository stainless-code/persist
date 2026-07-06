---
"@stainless-code/persist": minor
---

Reorganize the public subpath namespace. Adapter subpaths are now category-prefixed. **Breaking** (early package; consumers must update imports) — the four subpaths that existed on `main` are renamed:

- `./seroval` → `./codecs/seroval`
- `./idb` → `./backends/idb`
- `./tanstack-store` → `./sources/tanstack-store`
- `./react` → `./frameworks/react`

The rest of the surface (`./codecs/zod`, `./backends/{async-storage,mmkv,secure-store,encrypted,compressed,node-fs}`, `./transport/crosstab`, `./sources/{zustand,jotai,valtio,mobx}`, `./frameworks/{solid,vue,svelte,svelte-store,angular,preact}`) is NEW — added by sibling changesets, not renames.

The `.` (core) entry is unchanged.
