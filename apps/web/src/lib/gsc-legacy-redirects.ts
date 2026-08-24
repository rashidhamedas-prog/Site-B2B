/**
 * Proven one-hop 301s from PHASE-03B GSC exact URLs (export 2026-08-24).
 * Destinations are public retail paths only. Do not add guessed mappings.
 */

function normalizePathname(pathname: string): string {
  let path = pathname || '';
  try {
    path = decodeURIComponent(path);
  } catch {
    /* keep raw */
  }
  if (path.length > 1 && path.endsWith('/')) {
    path = path.replace(/\/+$/, '');
  }
  return path;
}

/** old public pathname → current canonical pathname */
const GSC_LEGACY_REDIRECTS: Readonly<Record<string, string>> = {
  '/category/20': '/category/women-pants',
  '/category/20/شلوار': '/category/women-pants',
  '/product/161/شلوار-ماهین': '/products/maserati-pants-mahin',
};

export function lookupGscLegacyRedirect(pathname: string): string | null {
  const target = GSC_LEGACY_REDIRECTS[normalizePathname(pathname)];
  return target || null;
}
