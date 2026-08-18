export function decodeIncomingSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

export function productPublicPath(slug: string): string {
  return `/products/${slug}`;
}

/** When API resolved a product via SKU/legacy slug, send the browser to the live slug. */
export function canonicalMismatchPath(
  incomingRaw: string,
  canonicalSlug: string | null | undefined,
): string | null {
  const incoming = decodeIncomingSlug(incomingRaw);
  const canonical = String(canonicalSlug || '').trim();
  if (!canonical || incoming === canonical) return null;
  return productPublicPath(canonical);
}

/**
 * Legacy WP descriptive slugs live in a static map (old → former SKU slug).
 * Always land on the product's current slug, never bounce a live canonical
 * back to an outdated SKU.
 */
export function legacyMapRedirectPath(
  incomingRaw: string,
  staticTarget: string | null | undefined,
  mappedCanonicalSlug: string | null | undefined,
): string | null {
  const incoming = decodeIncomingSlug(incomingRaw);
  const dest = String(mappedCanonicalSlug || staticTarget || '').trim();
  if (!dest || dest === incoming) return null;
  return productPublicPath(dest);
}
