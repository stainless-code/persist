---
"@stainless-code/persist": minor
---

Reorganize the public subpath namespace to mirror the folder structure (`src/core/` + `src/adapters/<seam>/`). Adapter subpaths are now category-prefixed so the public surface is 1:1 with the source layout — a contributor adding `adapters/backends/opfs.ts` knows the subpath is `./backends/opfs` with zero mental mapping. **Breaking** (early package; consumers must update imports):

- `./seroval` → `./codecs/seroval`
- `./zod` → `./codecs/zod`
- `./idb` → `./backends/idb`
- `./async-storage` → `./backends/async-storage`
- `./mmkv` → `./backends/mmkv`
- `./secure-store` → `./backends/secure-store`
- `./crosstab` → `./transport/crosstab`
- `./tanstack-store` → `./sources/tanstack-store`
- `./react` → `./frameworks/react`
- `./solid` → `./frameworks/solid`
- `./vue` → `./frameworks/vue`

The `.` (core) entry is unchanged. `dist/` stays flat (`dist/<basename>.mjs`); the `exports` map routes each categorized subpath to its flat dist file. Internal `src/` was refolded into `core/` + `adapters/<seam>/` with the `persist-` filename prefix dropped (folder is the category, file is the subpath basename).
