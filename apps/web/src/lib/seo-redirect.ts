import { permanentRedirect } from 'next/navigation';
import { getServerApiBase } from '@/lib/server-api';

function safeInternalPath(destination: string): string | null {
  const raw = String(destination || '').trim();
  if (!raw) return null;
  let path = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      path = new URL(raw).pathname;
    } catch {
      return null;
    }
  }
  if (!path.startsWith('/')) path = `/${path}`;
  if (path.includes('//') || path.includes('\\') || path.includes('..')) return null;
  if (!path.startsWith('/category/') && !path.startsWith('/products/')) return null;
  return path;
}

export async function matchPublicRedirect(
  channel: 'RETAIL' | 'WHOLESALE',
  path: string,
): Promise<string | null> {
  const candidates = [path];
  try {
    const decoded = decodeURIComponent(path);
    if (decoded !== path) candidates.push(decoded);
  } catch {
    /* keep raw */
  }
  try {
    for (const candidate of candidates) {
      const url = `${getServerApiBase()}/blog/redirects/match?channel=${encodeURIComponent(channel)}&path=${encodeURIComponent(candidate)}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const json = (await res.json()) as { destinationUrl?: string } | null;
      const dest = safeInternalPath(String(json?.destinationUrl || ''));
      if (dest) return dest;
    }
    return null;
  } catch {
    return null;
  }
}

export async function redirectIfMatched(
  channel: 'RETAIL' | 'WHOLESALE',
  path: string,
): Promise<void> {
  const dest = await matchPublicRedirect(channel, path);
  if (dest) permanentRedirect(dest);
}
