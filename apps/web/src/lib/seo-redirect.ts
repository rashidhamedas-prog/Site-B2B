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
  try {
    const url = `${getServerApiBase()}/blog/redirects/match?channel=${encodeURIComponent(channel)}&path=${encodeURIComponent(path)}`;
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const json = (await res.json()) as { destinationUrl?: string } | null;
    return safeInternalPath(String(json?.destinationUrl || ''));
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
