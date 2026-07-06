---
"@stainless-code/persist": minor
---

Add `createSessionStorage` — a zero-dep core DX factory over `sessionStorage` (per-tab; `crossTab` is meaningless). Returns `undefined` when `sessionStorage` is unavailable (SSR / non-DOM) or defined-but-broken (Node 22+ half-built global). No new subpath — exports from the core `.` entry.
