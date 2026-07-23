---
"@stainless-code/persist": patch
---

Ship Intent skills covering persist core, every `./sources/*` adapter, and every `./frameworks/*` hydration adapter (including separate `persist-svelte` / `persist-svelte-store`). Renames the old `tanstack-store` leaf to `persist-tanstack-store` — re-run `npx @tanstack/intent@latest install` if an agent config still points at `skills/tanstack-store`.
