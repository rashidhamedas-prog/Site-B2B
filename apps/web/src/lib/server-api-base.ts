/**
 * Server API origin helper with no React `cache()` import so CMS prop helpers
 * can be shared with Client Components without pulling a server-only API.
 */
export function getServerApiBase(): string {
  const raw =
    process.env.API_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    (process.env.NODE_ENV === 'production' ? 'http://api:4000/v1' : 'http://localhost:4000/v1');
  const base = String(raw).replace(/\/$/, '');
  return base.endsWith('/v1') ? base : `${base}/v1`;
}
