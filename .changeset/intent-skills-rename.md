---
"@stainless-code/persist": patch
---

Ship Intent skills for persist core, every source adapter (`persist-tanstack-store` … `persist-redux`), and `persist-react` (`useHydrated`). Renames the old `tanstack-store` leaf to `persist-tanstack-store` — re-run `npx @tanstack/intent@latest install` if an agent config still points at `skills/tanstack-store`.
