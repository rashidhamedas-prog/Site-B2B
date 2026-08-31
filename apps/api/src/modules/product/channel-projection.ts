import { channelAvailability, isChannelVisible, projectChannelProduct, type ChannelProductSource, type SalesChannel } from './channel-product-projection';

export const RETAIL_CANONICAL_ORIGIN = 'https://www.poshaktaranom.ir';
export const WHOLESALE_CANONICAL_ORIGIN = 'https://www.poshaktaranom.com';
export const RETAIL_CANARY_LIMIT = 10;
export const WHOLESALE_CANARY_LIMIT = 10;

export function canaryLimitFor(channel: SalesChannel): number {
  return channel === 'RETAIL' ? RETAIL_CANARY_LIMIT : WHOLESALE_CANARY_LIMIT;
}

export function canaryExceeded(liveCount: number, limit: number): boolean {
  return liveCount >= limit;
}

export type ChannelProjectionInput = ChannelProductSource & {
  id?: string;
  sku?: string | null;
  slug?: string | null;
  name?: string | null;
  description?: string | null;
  retailFullContent?: string | null;
  wholesaleFullContent?: string | null;
  minOrderQty?: number | string | null;
  sizeType?: string | null;
  seoMeta?: { canonical?: string | null } | null;
};

export type ChannelProjection = {
  channel: SalesChannel;
  sourceType: 'PRODUCT';
  sourceId: string;
  sku: string | null;
  name: string | null;
  visible: boolean;
  publishable: boolean;
  rejectReason: string | null;
  stock: number;
  available: boolean;
  listPrice: number | null;
  salePrice: number | null;
  payable: number;
  content: string | null;
  url: string;
  orderType: 'RETAIL_WEBSITE' | 'WHOLESALE';
  orderChannel: SalesChannel;
  minOrderQty: number;
};

function originFor(channel: SalesChannel): string {
  return channel === 'RETAIL' ? RETAIL_CANONICAL_ORIGIN : WHOLESALE_CANONICAL_ORIGIN;
}

function rejectReason(input: ChannelProjectionInput, channel: SalesChannel): string | null {
  if (String(input.status || '').toUpperCase() !== 'ACTIVE') return 'status_not_public';
  if (channel === 'RETAIL' && input.showOnRetail === false) return 'hidden_on_retail';
  if (channel === 'WHOLESALE' && input.showOnWholesale === false) return 'hidden_on_wholesale';
  if (channel === 'RETAIL' && !(Number(input.retailPrice) > 0)) return 'retail_price_missing';
  if (channel === 'WHOLESALE' && !(Number(input.wholesalePrice) > 0)) return 'wholesale_price_missing';
  return null;
}

export function buildChannelProjection(input: ChannelProjectionInput, channel: SalesChannel): ChannelProjection {
  const core = projectChannelProduct(input, channel);
  const reason = rejectReason(input, channel);
  const slug = String(input.slug || input.sku || input.id || '').replace(/^\/+|\/+$/g, '');
  const content = channel === 'RETAIL'
    ? input.retailFullContent || input.description || null
    : input.wholesaleFullContent || input.description || null;
  return {
    channel,
    sourceType: 'PRODUCT',
    sourceId: String(input.id || ''),
    sku: input.sku ? String(input.sku) : null,
    name: input.name ? String(input.name) : null,
    visible: core.visible,
    publishable: reason == null && core.visible,
    rejectReason: reason,
    stock: core.stock,
    available: core.available,
    listPrice: core.listPrice,
    salePrice: core.salePrice,
    payable: core.payable,
    content,
    url: `${originFor(channel)}/products/${slug}`,
    orderType: channel === 'RETAIL' ? 'RETAIL_WEBSITE' : 'WHOLESALE',
    orderChannel: channel,
    minOrderQty: Math.max(1, Number(input.minOrderQty) || 1),
  };
}

export function storefrontAvailability(product: ChannelProductSource, channel: SalesChannel) {
  return channelAvailability(product, channel);
}

export { channelAvailability, isChannelVisible, projectChannelProduct };
