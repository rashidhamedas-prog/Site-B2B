/**
 * Public storefront HTML Cache-Control (middleware clamp).
 * Keep s-maxage aligned with page `revalidate` (60) so CMS on-demand
 * revalidate + warm still refreshes within a minute, but allow a long
 * stale-while-revalidate window so edge/origin can serve STALE instantly
 * instead of cold MISS (field TTFB was the LCP bottleneck).
 */
export const STOREFRONT_HTML_CACHE_CONTROL =
  'public, s-maxage=60, stale-while-revalidate=86400' as const;
