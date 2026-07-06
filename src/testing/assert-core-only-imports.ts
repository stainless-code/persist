import { expect, it } from "bun:test";

/**
 * The per-entry self-check: every relative import in the adapter source
 * resolves into `core/` — pins no cross-adapter coupling (the isolation
 * invariant documented in `docs/architecture.md`). Call inside a
 * `describe(...)`. Test-only; not shipped in `dist/`.
 */
export function itImportsOnlyFromCore(sourceUrl: URL): void {
  it("imports only from core (no cross-adapter coupling)", async () => {
    const source = await Bun.file(sourceUrl).text();
    const relativeImports = [
      ...source.matchAll(/from\s+["'](\.\.?\/[^"']+)["']/g),
    ].map((match) => match[1]);
    for (const importPath of relativeImports) {
      expect(importPath).toMatch(/^\.\.\/\.\.\/core\//);
    }
  });
}
