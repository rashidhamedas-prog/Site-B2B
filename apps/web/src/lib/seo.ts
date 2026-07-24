import { headers } from 'next/headers';
import { hostLooksRetail } from './channel';

export const WHOLESALE_ORIGIN = 'https://poshaktaranom.com';
export const RETAIL_ORIGIN = 'https://www.poshaktaranom.ir';

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'https://api.poshaktaranom.com/v1';

/** Detect sales channel from the incoming Host header (App Router). */
export async function getSeoChannel(): Promise<'WHOLESALE' | 'RETAIL'> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  return hostLooksRetail(host) ? 'RETAIL' : 'WHOLESALE';
}

export async function getSeoOrigin(): Promise<string> {
  const channel = await getSeoChannel();
  return channel === 'RETAIL' ? RETAIL_ORIGIN : WHOLESALE_ORIGIN;
}

export function absoluteUrl(origin: string, path: string): string {
  if (!path || path === '/') return origin;
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}
