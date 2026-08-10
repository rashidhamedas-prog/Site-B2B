/**
 * Single public retail product path invariant shared by PDP canonical, sitemap, and Torob feed.
 * Prefer resolvable product.slug. Custom canonical accepted only when same-origin `/products/<slug>`.
 */

export const RETAIL_PUBLIC_ORIGIN = 'https://www.poshaktaranom.ir';

export function normalizeRetailOrigin(raw?: string | null): string {
  const fallback = RETAIL_PUBLIC_ORIGIN;
  if (!raw || !String(raw).trim()) return fallback;
  try {
    const u = new URL(String(raw).trim());
    const host = u.hostname.toLowerCase();
    if (host === 'poshaktaranom.ir' || host === 'www.poshaktaranom.ir') {
      return RETAIL_PUBLIC_ORIGIN;
    }
    // Strip path/query/hash — origin only, force https for known retail hosts.
    if (host.endsWith('poshaktaranom.ir')) {
      return `https://www.poshaktaranom.ir`;
    }
    return `${u.protocol}//${u.host}`.replace(/\/$/, '');
  } catch {
    return fallback;
  }
}

export function publicProductPath(slug: string): string {
  const s = String(slug || '').replace(/^\/+|\/+$/g, '');
  return `/products/${s}`;
}

export function publicProductUrl(slug: string, origin?: string): string {
  return `${normalizeRetailOrigin(origin)}${publicProductPath(slug)}`;
}

/**
 * Resolve canonical path for a product.
 * Custom seo canonical is accepted only when it is same-origin `/products/<slug>`
 * and that slug equals the product's resolvable slug (or we fall back with warning).
 */
export function resolvePublicProductCanonical(opts: {
  productSlug: string;
  customCanonical?: string | null;
  origin?: string;
  onInvalid?: (reason: string) => void;
}): { path: string; url: string; usedCustom: boolean } {
  const origin = normalizeRetailOrigin(opts.origin);
  const fallbackPath = publicProductPath(opts.productSlug);
  const custom = (opts.customCanonical || '').trim();
  if (!custom) {
    return { path: fallbackPath, url: `${origin}${fallbackPath}`, usedCustom: false };
  }
  try {
    const u = new URL(custom, origin);
    const sameHost =
      u.hostname === 'www.poshaktaranom.ir' ||
      u.hostname === 'poshaktaranom.ir' ||
      u.hostname === new URL(origin).hostname;
    const m = u.pathname.replace(/\/+$/, '').match(/^\/products\/([^/]+)$/);
    if (!sameHost || !m) {
      opts.onInvalid?.('custom_canonical_not_same_origin_products_path');
      return { path: fallbackPath, url: `${origin}${fallbackPath}`, usedCustom: false };
    }
    const customSlug = decodeURIComponent(m[1]!);
    if (customSlug !== opts.productSlug) {
      // Do not publish a soft-404 canonical that disagrees with the resolvable slug.
      opts.onInvalid?.(
        `custom_canonical_slug_mismatch expected=${opts.productSlug} got=${customSlug}`,
      );
      return { path: fallbackPath, url: `${origin}${fallbackPath}`, usedCustom: false };
    }
    const path = publicProductPath(customSlug);
    return { path, url: `${origin}${path}`, usedCustom: true };
  } catch {
    opts.onInvalid?.('custom_canonical_parse_error');
    return { path: fallbackPath, url: `${origin}${fallbackPath}`, usedCustom: false };
  }
}
