import { resolvePublicProductChannel } from '../product/public-product-channel';

export function requireDiscountChannel(channel?: string | null): 'RETAIL' | 'WHOLESALE' {
  const resolved = resolvePublicProductChannel(channel);
  if (!resolved) throw new Error('PUBLIC_CHANNEL_REQUIRED');
  return resolved;
}

export function discountAppliesToChannel(
  codeChannel: string | null | undefined,
  channel: 'RETAIL' | 'WHOLESALE',
): boolean {
  const raw = String(codeChannel || '').toUpperCase();
  return raw === 'BOTH' || raw === channel;
}
