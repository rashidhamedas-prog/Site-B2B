/**
 * Server-only API base for RSC / route handlers.
 * Prefer docker-internal URL so SSR does not depend on public DNS/loopback.
 */
export function getServerApiBase(): string {
  return (
    process.env.API_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:4000/v1'
  );
}

export async function fetchProductBySlug(slug: string): Promise<Record<string, unknown> | null> {
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
      const res = await fetch(`${base}/products/slug/${encodeURIComponent(candidate)}`, {
        cache: 'no-store',
      });
      if (!res.ok) continue;
      return (await res.json()) as Record<string, unknown>;
    } catch {
      /* try next */
    }
  }
  return null;
}
