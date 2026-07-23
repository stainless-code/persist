---
"@stainless-code/persist": patch
---

Ship Intent skills for the full public surface: core (`persist`), every `./sources/*` (`persist-*`), every `./codecs/*` / `./backends/*` / `./transport/*` (`persist-*`), and every `./frameworks/*` (`<framework>-persist`). Renames the old `tanstack-store` leaf — re-run `npx @tanstack/intent@latest install` if an agent config still points at stale paths.
