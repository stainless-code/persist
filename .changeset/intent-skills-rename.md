---
"@stainless-code/persist": patch
---

Rename the TanStack Store Intent skill to `persist-tanstack-store` (composition leaf; avoids clashing with upstream skill names) and add `persist-zustand`. Re-run `npx @tanstack/intent@latest install` if an agent config still points at `skills/tanstack-store`.
