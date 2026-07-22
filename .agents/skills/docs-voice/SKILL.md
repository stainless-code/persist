---
name: docs-voice
description: Voice, tone, and format for the public Persist docs (`apps/docs`, built with Blume). Use when authoring or editing apps/docs prose — landing, guides, concepts, recipes, adapters, reference — or deciding headline grammar, benefit framing, competitor framing, or anti-sell wording.
---

# Docs voice — Persist docs (`apps/docs`, built with Blume)

Keep landing, guides, concepts, recipes, adapters, and reference reading like one voice.

## Voice in one line

Senior-dev to senior-dev: concrete, API-literate, dry, honest about scope. No
hype. The differentiators are radical honesty (say what's planned / diverges /
was rejected) and the "when **not** to use it" anti-sell — keep both.

## Do

- **Lead with the pain, then the mechanism.** "Async IndexedDB hydrates after
  first paint…" → then "`toHydrationSignal` + `useHydrated` gates the tree."
- **Concrete before abstract.** Name localStorage / IndexedDB / zustand /
  TanStack Store before the coinage "seam" / `PersistableSource`.
- **Section headers by page type.** Marketing = period-terminated benefit
  sentence ("One middleware, any store."); guides = action verb ("Gate UI
  until hydrated"); reference = precise noun; concepts = model noun +
  consequence.
- **Card titles = the outcome; card bodies = the API.**
- **One idea per sentence in leads.** Short claim first, then expand.
- **State experimental / pre-1.0 status once per surface, one wording** (see
  Canonical patterns).
- **Sidebar icons: all-or-none per sibling list.** Blume does not reserve an
  icon column — sparse `sidebar.icon` jaggeds labels. Guides, Concepts,
  Recipes, Reference leaves: none unless every peer has a natural glyph.
  Section `meta.ts` icons and tab icons stay.
- **Adapter / listing order:** core → backends → codecs → sources → frameworks
  → transport. Within sources: tanstack-store → zustand → jotai → valtio →
  mobx → pinia → redux → custom. Within frameworks: react → preact → solid →
  angular → vue → lit → alpine → svelte (runes → store).

## Don't

- Don't open a page with a 60+ word sentence.
- Don't restate the frontmatter `description` in the first body sentence — the
  docs site renders `description` as the page subtitle, so an echoing opener
  duplicates content. Open with a concrete scenario/pain instead.
- Don't title cards with bare feature nouns ("Cross-tab") when the outcome is
  the hook ("Sync tabs without a custom `storage` listener").
- Don't manufacture social proof, download counts, "trusted by", or maturity
  adjectives ("production-grade", "battle-tested", "world-class") at pre-1.0 —
  live examples, source, and the changelog are the proof.
- Don't claim Persist owns UI, focus, or a11y — consumers own rendering; Persist
  owns the persistence + hydration lifecycle.
- Don't hype ("blazing-fast", "revolutionary").
- Don't treat query-cache persisters as competitors — peers are **store**
  persist middlewares (zustand / redux / pinia). TanStack Store is an
  _integration_, not a rival.
- Don't invent Lucide icons for prose nav leaves to "fill out" a section —
  strip to none instead of decorating half the list.

## Canonical patterns (use verbatim)

- **Experimental disclaimer** (banner / pill / callout / stability page):
  "Experimental — the API may change between minor releases. Pin your version."
- **Pre-1.0 semver:** breaking changes are expected and ship in **minor
  releases** (`0.1` → `0.2`), **not majors**.
- **Brand one-liner** (memorable beat, not hype): "Any store, any storage, one
  middleware — no flash."
- **Competitor set:** zustand-persist, redux-persist, pinia-persist (and
  hand-rolled store persistence). Not TanStack Query persist-client.

## Product tenets

Decisions and messaging should align with [`product-tenets`](../product-tenets/SKILL.md).

## Verify

`content/**` MDX is excluded from oxfmt; `.astro` is not oxfmt-managed. Build
green before commit ([`verify-after-each-step`](../../rules/verify-after-each-step.md)).
Scheduled drift sync: [`update-docs`](../update-docs/SKILL.md).

## Reference

- Priming: [`docs-voice-priming`](../../rules/docs-voice-priming.md)
- Tenets: [`product-tenets`](../product-tenets/SKILL.md)
- Lifecycle / README surfaces: [`docs-governance`](../docs-governance/SKILL.md)
