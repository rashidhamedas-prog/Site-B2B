/**
 * Public storefront HTML Cache-Control (middleware clamp).
 * Keep s-maxage aligned with page `revalidate` (60) so CMS on-demand
 * revalidate + warm still refreshes within a minute, but allow a long
 * stale-while-revalidate window so edge/origin can serve STALE instantly
 * instead of cold MISS (field TTFB was the LCP bottleneck).
 */
export const STOREFRONT_HTML_CACHE_CONTROL =
  'public, s-maxage=60, stale-while-revalidate=86400' as const;

/**
 * Explicit edge directive for Cloudflare. Browser Cache-Control alone often
 * leaves HTML as cf-cache-status: DYNAMIC on Next App Router responses
 * (Vary: rsc…). CDN-Cache-Control lets PoPs cache anonymous HTML while
 * keeping the same 60s freshness + long SWR as origin ISR.
 */
export const STOREFRONT_HTML_CDN_CACHE_CONTROL =
  'public, max-age=60, stale-while-revalidate=86400' as const;
