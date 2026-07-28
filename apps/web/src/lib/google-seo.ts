import { headers } from 'next/headers';
import { hostLooksRetail } from '@/lib/channel';
import {
  gscEnvFor,
  sanitizeGscToken,
  type GoogleChannel,
} from '@/lib/google';
import { API_URL } from '@/lib/seo-origins';

type MarketingPublic = {
  gscWholesaleVerification?: string;
  gscRetailVerification?: string;
};

async function fetchMarketing(): Promise<MarketingPublic> {
  const candidates = [
    API_URL,
    process.env.INTERNAL_API_URL,
    'http://api:4000/v1',
    'http://127.0.0.1:4000/v1',
  ].filter(Boolean) as string[];

  for (const base of candidates) {
    try {
      const res = await fetch(`${base.replace(/\/$/, '')}/settings/public`, {
        cache: 'no-store',
      });
      if (!res.ok) continue;
      const json = await res.json();
      return (json?.marketing ?? {}) as MarketingPublic;
    } catch {
      /* try next */
    }
  }
  return {};
}

export async function resolveGoogleChannel(): Promise<GoogleChannel> {
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host');
  if (hostLooksRetail(host)) return 'RETAIL';
  const force =
    process.env.NEXT_PUBLIC_FORCE_RETAIL === '1' ||
    h.get('x-taranom-channel') === 'RETAIL';
  return force ? 'RETAIL' : 'WHOLESALE';
}

/** Prefer env, then admin settings. */
export async function resolveGscVerification(
  channel?: GoogleChannel,
): Promise<string | undefined> {
  const ch = channel ?? (await resolveGoogleChannel());
  const fromEnv = gscEnvFor(ch);
  if (fromEnv) return fromEnv;
  const m = await fetchMarketing();
  const fromDb =
    ch === 'RETAIL'
      ? sanitizeGscToken(m.gscRetailVerification)
      : sanitizeGscToken(m.gscWholesaleVerification);
  return fromDb || undefined;
}
