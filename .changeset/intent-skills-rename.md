---
"@stainless-code/persist": patch
---

Ship Intent skills for persist core (`persist`), every `./sources/*` adapter (`persist-*`), and every `./frameworks/*` hydration adapter (`<framework>-persist`, including `svelte-persist` / `svelte-store-persist`). Renames the old `tanstack-store` leaf — re-run `npx @tanstack/intent@latest install` if an agent config still points at `skills/tanstack-store` or `persist-*` framework leaves.
