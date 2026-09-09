/** Map CMS pageKey to Next filesystem paths and public URL shapes. */

export type CmsChannel = 'RETAIL' | 'WHOLESALE';

const RETAIL_APP_PATHS: Record<string, string[]> = {
  chrome: ['/retail'],
  home: ['/retail'],
  about: ['/retail/about'],
  contact: ['/retail/contact'],
  shipping: ['/retail/shipping'],
  returns: ['/retail/returns'],
  products: ['/retail/products'],
  collections: ['/retail/collections'],
  privacy: ['/retail/privacy'],
  terms: ['/retail/terms'],
};

const WHOLESALE_PATHS: Record<string, string[]> = {
  chrome: ['/'],
  home: ['/'],
  about: ['/about'],
  contact: ['/contact'],
  shipping: ['/shipping'],
  returns: ['/returns'],
  products: ['/products'],
  collections: ['/collections'],
  privacy: ['/privacy'],
  terms: ['/terms'],
  wholesale: ['/wholesale'],
};

/** App Router destinations (after middleware rewrite for retail). */
export function storefrontPathsForCms(channel: CmsChannel, pageKey: string): string[] {
  if (channel === 'WHOLESALE') {
    return WHOLESALE_PATHS[pageKey] || ['/'];
  }
  return RETAIL_APP_PATHS[pageKey] || ['/retail'];
}

/** Public URL bar paths on .ir (middleware rewrites these to /retail/*). */
export function publicStorefrontPathsForCms(channel: CmsChannel, pageKey: string): string[] {
  if (channel !== 'RETAIL') return [];
  return storefrontPathsForCms(channel, pageKey).map((appPath) => {
    if (appPath === '/retail') return '/';
    return appPath.replace(/^\/retail/, '') || '/';
  });
}

/** Every path we should revalidate + warm for a CMS save. */
export function allRevalidatePathsForCms(channel: CmsChannel, pageKey: string): string[] {
  if (pageKey === '*') {
    return channel === 'RETAIL' ? ['/retail', '/'] : ['/'];
  }
  return Array.from(
    new Set([...storefrontPathsForCms(channel, pageKey), ...publicStorefrontPathsForCms(channel, pageKey)]),
  );
}

/** Paths to HTTP-warm after revalidate so the next visitor is not stuck on HIT. */
export function warmPathsForCms(channel: CmsChannel, pageKey: string): string[] {
  if (pageKey === '*') {
    return channel === 'RETAIL' ? ['/retail', '/'] : ['/'];
  }
  // Warm App Router destination + public alias (retail `/` needs Host/channel hint).
  return allRevalidatePathsForCms(channel, pageKey);
}

export function cmsCacheTags(channel: CmsChannel, pageKey: string): string[] {
  const tags = ['cms', `cms:${channel}:${pageKey}`, 'catalog', `catalog:${channel}`];
  if (pageKey === '*') {
    return ['cms', `cms:${channel}:home`, `cms:${channel}:chrome`, 'catalog', `catalog:${channel}`];
  }
  // Chrome edits also affect every page layout.
  if (pageKey === 'chrome') {
    tags.push(channel === 'RETAIL' ? 'cms:RETAIL:home' : 'cms:WHOLESALE:home');
  }
  return tags;
}
