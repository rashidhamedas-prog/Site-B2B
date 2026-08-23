import { headers } from 'next/headers';
import { hostLooksRetail } from '@/lib/channel';
import {
  gscEnvFor,
  sanitizeGscToken,
  type GoogleChannel,
} from '@/lib/google';
import { fetchPublicSettings } from '@/lib/server-api';

type MarketingPublic = {
  gscWholesaleVerification?: string;
  gscRetailVerification?: string;
};

type SettingsWithMarketing = {
  marketing?: MarketingPublic;
};

async function marketingFor(channel: GoogleChannel): Promise<MarketingPublic> {
  const settings = await fetchPublicSettings<SettingsWithMarketing>(channel);
  return settings?.marketing ?? {};
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

/** Prefer env, then admin settings. Pass `channel` to avoid `headers()` (keeps ISR possible). */
export async function resolveGscVerification(
  channel?: GoogleChannel,
): Promise<string | undefined> {
  const ch = channel ?? (await resolveGoogleChannel());
  const fromEnv = gscEnvFor(ch);
  if (fromEnv) return fromEnv;
  const m = await marketingFor(ch);
  const fromDb =
    ch === 'RETAIL'
      ? sanitizeGscToken(m.gscRetailVerification)
      : sanitizeGscToken(m.gscWholesaleVerification);
  return fromDb || undefined;
}

/**
 * GSC HTML-tag tokens for the shared root `<head>` without reading `headers()`.
 * Dual-host app: both tokens may appear; Search Console matches per property.
 */
export async function resolveGscTokensForRootHead(): Promise<string[]> {
  const seen = new Set<string>();
  const push = (value?: string) => {
    const token = sanitizeGscToken(value);
    if (token) seen.add(token);
  };
  const envRetail = gscEnvFor('RETAIL');
  const envWholesale = gscEnvFor('WHOLESALE');
  push(envRetail);
  push(envWholesale);
  const needRetail = !envRetail;
  const needWholesale = !envWholesale;
  if (needRetail || needWholesale) {
    const [retail, wholesale] = await Promise.all([
      needRetail ? marketingFor('RETAIL') : Promise.resolve(null),
      needWholesale ? marketingFor('WHOLESALE') : Promise.resolve(null),
    ]);
    push(retail?.gscRetailVerification);
    push(wholesale?.gscWholesaleVerification);
  }
  return [...seen];
}
