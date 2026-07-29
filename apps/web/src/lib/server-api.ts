/**
 * Server-only API base for RSC / route handlers.
 * Prefer docker-internal URL so SSR does not depend on public DNS/loopback.
 */
export function getServerApiBase(): string {
  const raw =
    process.env.API_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:4000/v1';
  const base = String(raw).replace(/\/$/, '');
  return base.endsWith('/v1') ? base : `${base}/v1`;
}

export async function fetchProductBySlug(
  slug: string,
  channel?: 'RETAIL' | 'WHOLESALE',
): Promise<Record<string, unknown> | null> {
  const base = getServerApiBase();
  const candidates = Array.from(
    new Set([
      slug,
      (() => {
        try {
          return decodeURIComponent(slug);
        } catch {
          return slug;
        }
      })(),
    ]),
  );

  for (const candidate of candidates) {
    try {
      const qs = channel ? `?channel=${channel}` : '';
      const res = await fetch(
        `${base}/products/slug/${encodeURIComponent(candidate)}${qs}`,
        { cache: 'no-store' },
      );
      if (!res.ok) continue;
      return (await res.json()) as Record<string, unknown>;
    } catch {
      /* try next */
    }
  }
  return null;
}
