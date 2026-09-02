import { resolvePublicProductChannel } from '../product/public-product-channel';

export function requirePublicCmsChannel(channel?: string | null): 'RETAIL' | 'WHOLESALE' {
  const resolved = resolvePublicProductChannel(channel);
  if (!resolved) throw new Error('PUBLIC_CHANNEL_REQUIRED');
  return resolved;
}
