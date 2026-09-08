/** Map CMS pageKey to Next filesystem paths (not public host URLs). */

export type CmsChannel = 'RETAIL' | 'WHOLESALE';

const RETAIL_PATHS: Record<string, string[]> = {
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

export function storefrontPathsForCms(channel: CmsChannel, pageKey: string): string[] {
  const table = channel === 'RETAIL' ? RETAIL_PATHS : WHOLESALE_PATHS;
  return table[pageKey] || (channel === 'RETAIL' ? ['/retail'] : ['/']);
}

export function cmsCacheTags(channel: CmsChannel, pageKey: string): string[] {
  return ['cms', `cms:${channel}:${pageKey}`, 'catalog', `catalog:${channel}`];
}
