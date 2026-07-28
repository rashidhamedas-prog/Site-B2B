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
  try {
    const res = await fetch(`${API_URL}/settings/public`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return {};
    const json = await res.json();
    return (json?.marketing ?? {}) as MarketingPublic;
  } catch {
    return {};
  }
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
