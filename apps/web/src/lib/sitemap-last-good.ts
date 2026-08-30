import type { SitemapProductRow } from './sitemap-xml';

const cache = new Map<string, { rows: SitemapProductRow[]; storedAt: number }>();

export function rememberSitemapProducts(channel: string, rows: SitemapProductRow[]) {
  cache.set(channel, { rows, storedAt: Date.now() });
}

export function lastGoodSitemapProducts(channel: string): SitemapProductRow[] | null {
  return cache.get(channel)?.rows ?? null;
}

export function sitemapCacheAgeMs(channel: string): number | null {
  const hit = cache.get(channel);
  return hit ? Date.now() - hit.storedAt : null;
}
