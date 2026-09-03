type SalesChannel = 'WHOLESALE' | 'RETAIL';

const RETAIL_ORIGIN = 'https://www.poshaktaranom.ir';
const WHOLESALE_ORIGIN = 'https://poshaktaranom.com';

const TARANOM_HOSTS = new Set([
  'poshaktaranom.com',
  'www.poshaktaranom.com',
  'poshaktaranom.ir',
  'www.poshaktaranom.ir',
  'api.poshaktaranom.com',
  'storage.poshaktaranom.com',
]);

function channelOrigin(channel: SalesChannel): string {
  return channel === 'RETAIL' ? RETAIL_ORIGIN : WHOLESALE_ORIGIN;
}

function rebaseTaranomUrl(channel: SalesChannel, absolute: string): string {
  try {
    const parsed = new URL(absolute);
    if (!TARANOM_HOSTS.has(parsed.hostname.toLowerCase())) return absolute;
    return `${channelOrigin(channel)}${parsed.pathname}${parsed.search}`;
  } catch {
    return absolute;
  }
}

/** Merchant listings reject relative `/uploads/...` images as a missing field. */
export function absoluteJsonLdUrl(
  channel: SalesChannel,
  url?: string | null,
): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  const origin = channelOrigin(channel);
  let absolute: string;
  if (/^https:\/\//i.test(trimmed)) {
    absolute = trimmed;
  } else if (/^http:\/\//i.test(trimmed)) {
    absolute = `https://${trimmed.slice(7)}`;
  } else if (trimmed.startsWith('//')) {
    absolute = `https:${trimmed}`;
  } else {
    absolute = trimmed.startsWith('/') ? `${origin}${trimmed}` : `${origin}/${trimmed}`;
  }
  return rebaseTaranomUrl(channel, absolute);
}
