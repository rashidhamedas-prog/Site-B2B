type SalesChannel = 'WHOLESALE' | 'RETAIL';

const RETAIL_ORIGIN = 'https://www.poshaktaranom.ir';
const WHOLESALE_ORIGIN = 'https://poshaktaranom.com';

/** Merchant listings reject relative `/uploads/...` images as a missing field. */
export function absoluteJsonLdUrl(
  channel: SalesChannel,
  url?: string | null,
): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (/^https:\/\//i.test(trimmed)) return trimmed;
  if (/^http:\/\//i.test(trimmed)) return `https://${trimmed.slice(7)}`;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  const origin = channel === 'RETAIL' ? RETAIL_ORIGIN : WHOLESALE_ORIGIN;
  return trimmed.startsWith('/') ? `${origin}${trimmed}` : `${origin}/${trimmed}`;
}
