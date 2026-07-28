/**
 * Google Analytics 4 + Search Console helpers (wholesale + retail).
 */

export type GoogleChannel = 'WHOLESALE' | 'RETAIL';

/** Accept only safe GA4 Measurement IDs (G-XXXXXXXX). */
export function sanitizeGa4Id(raw?: string | null): string {
  const v = String(raw ?? '').trim().toUpperCase();
  if (!/^G-[A-Z0-9]+$/.test(v)) return '';
  return v;
}

/** Optional GTM container (GTM-XXXX). */
export function sanitizeGtmId(raw?: string | null): string {
  const v = String(raw ?? '').trim().toUpperCase();
  if (!/^GTM-[A-Z0-9]+$/.test(v)) return '';
  return v;
}

/** Search Console HTML-tag verification token (content=...). */
export function sanitizeGscToken(raw?: string | null): string {
  const v = String(raw ?? '').trim();
  // Google tokens are typically base64-ish; keep conservative charset
  if (!v || v.length > 120 || !/^[A-Za-z0-9_-]+$/.test(v)) return '';
  return v;
}

export function ga4EnvFor(channel: GoogleChannel): string {
  return sanitizeGa4Id(
    channel === 'RETAIL'
      ? process.env.NEXT_PUBLIC_GA4_RETAIL_ID
      : process.env.NEXT_PUBLIC_GA4_WHOLESALE_ID,
  );
}

export function gtmEnvFor(channel: GoogleChannel): string {
  return sanitizeGtmId(
    channel === 'RETAIL'
      ? process.env.NEXT_PUBLIC_GTM_RETAIL_ID
      : process.env.NEXT_PUBLIC_GTM_WHOLESALE_ID,
  );
}

export function gscEnvFor(channel: GoogleChannel): string {
  return sanitizeGscToken(
    channel === 'RETAIL'
      ? process.env.NEXT_PUBLIC_GSC_RETAIL
      : process.env.NEXT_PUBLIC_GSC_WHOLESALE,
  );
}
