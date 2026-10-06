const isString = <Value>(value: Value): value is Value & string =>
  typeof value === "string";

// Page `seo.x.creator` reaches layouts as raw frontmatter (no config-schema
// transform here); Blume rejects non-strings upstream, so the guard is backup.
export const normalizeXHandle = <Value>(value: Value): string | undefined => {
  if (!isString(value)) {
    return;
  }
  const handle = value.trim().replace(/^@+/u, "");
  return handle ? `@${handle}` : undefined;
};
