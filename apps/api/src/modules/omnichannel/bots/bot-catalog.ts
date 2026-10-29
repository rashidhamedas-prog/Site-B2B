/**
 * PR-14 live catalog projection for order bots (WHOLESALE default).
 * Never writes stock; never uses legacy product.stock as write target.
 */

import {
  channelAvailability,
  channelUnitStock,
  isChannelVisible,
  type SalesChannel,
} from '../../product/channel-product-projection';

export type BotCatalogProduct = {
  id: string;
  sku: string;
  name: string;
  status?: string | null;
  showOnWholesale?: boolean | null;
  showOnRetail?: boolean | null;
  wholesalePrice?: number | string | null;
  retailPrice?: number | string | null;
  wholesaleStock?: number | string | null;
  retailStock?: number | string | null;
  /** Legacy — read forbidden for availability; listed only to assert we ignore writes. */
  stock?: number | string | null;
  minOrderQty?: number | string | null;
  variants?: Array<{
    id: string;
    color?: string | null;
    size?: string | null;
    wholesaleStock?: number | string | null;
    retailStock?: number | string | null;
    stock?: number | string | null;
  }> | null;
};

export type BotCatalogQuote = {
  productId: string;
  sku: string;
  name: string;
  channel: SalesChannel;
  unitPrice: number;
  stock: number;
  available: boolean;
  minOrderQty: number;
  variants: Array<{ id: string; color: string; size: string; stock: number }>;
};

export const BOT_COMMERCE_CHANNEL: SalesChannel = 'WHOLESALE';

export function projectBotCatalog(
  product: BotCatalogProduct | null | undefined,
  channel: SalesChannel = BOT_COMMERCE_CHANNEL,
): BotCatalogQuote | null {
  if (!product) return null;
  if (!isChannelVisible(product, channel)) return null;
  const availability = channelAvailability(product, channel);
  const unitPrice =
    channel === 'RETAIL'
      ? Math.max(0, Number(product.retailPrice) || 0)
      : Math.max(0, Number(product.wholesalePrice) || 0);
  const minOrderQty = Math.max(1, Math.floor(Number(product.minOrderQty) || 1));
  const variants = (product.variants || [])
    .filter((v) => v && v.id)
    .map((v) => ({
      id: String(v.id),
      color: String(v.color || ''),
      size: String(v.size || ''),
      stock: channelUnitStock(v, channel),
    }));
  return {
    productId: String(product.id),
    sku: String(product.sku || ''),
    name: String(product.name || ''),
    channel,
    unitPrice,
    stock: availability.stock,
    available: availability.available,
    minOrderQty,
    variants,
  };
}

/** Guard: catalog helpers must not mutate stock fields. */
export function assertCatalogReadOnly(product: BotCatalogProduct): void {
  const before = {
    stock: product.stock,
    wholesaleStock: product.wholesaleStock,
    retailStock: product.retailStock,
  };
  projectBotCatalog(product);
  if (
    product.stock !== before.stock
    || product.wholesaleStock !== before.wholesaleStock
    || product.retailStock !== before.retailStock
  ) {
    throw new Error('catalog_mutated_stock');
  }
}
