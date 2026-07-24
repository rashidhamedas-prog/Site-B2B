import { headers } from 'next/headers';
import { hostLooksRetail } from './channel';
import { RETAIL_ORIGIN, WHOLESALE_ORIGIN } from './seo-origins';

export {
  WHOLESALE_ORIGIN,
  RETAIL_ORIGIN,
  API_URL,
  absoluteUrl,
} from './seo-origins';

/** Detect sales channel from the incoming Host header (App Router / Server only). */
export async function getSeoChannel(): Promise<'WHOLESALE' | 'RETAIL'> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  return hostLooksRetail(host) ? 'RETAIL' : 'WHOLESALE';
}

export async function getSeoOrigin(): Promise<string> {
  const channel = await getSeoChannel();
  return channel === 'RETAIL' ? RETAIL_ORIGIN : WHOLESALE_ORIGIN;
}
